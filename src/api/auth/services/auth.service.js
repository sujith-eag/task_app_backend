import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../../../models/userModel.js';
import { logAuthEvent } from './auth.log.service.js';
import { AuthEventTypes } from '../../../models/authEventModel.js';
import { sendEmail } from '../../../services/email.service.js';
import { populateTemplate } from '../../../utils/emailTemplate.js';

// ============================================================================
// Constants
// ============================================================================

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 10;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_MINUTES = 10;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate JWT token for authenticated user
 * @param {string} userId - User ID
 * @returns {string} JWT token
 */
const generateJWTtoken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '3d' });
};

/**
 * Hash a token using SHA256
 * @param {string} token - Plain text token
 * @returns {string} Hashed token
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate a random token
 * @returns {string} Random token
 */
const generateRandomToken = () => {
  return crypto.randomBytes(20).toString('hex');
};

/**
 * Helper to set JWT as httpOnly cookie on the response
 * @param {Object} res - Express response
 * @param {string} token - JWT
 */
const sendTokenCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  res.cookie('jwt', token, cookieOptions);
};


/**
 * Format user response object (do not include token in JSON when using cookies)
 * @param {Object} user - User document
 * @returns {Object} User response object
 */
const formatUserResponse = (user) => {
  return {
    _id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    avatar: user.avatar,
    bio: user.bio,
    preferences: user.preferences,
    studentDetails: user.studentDetails,
    teacherDetails: user.teacherDetails,
  };
};

// ============================================================================
// Registration Service
// ============================================================================

/**
 * Register a new user or resend verification for existing unverified user
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Success message
 */
export const registerUserService = async ({ name, email, password }) => {
  let user = await User.findOne({ email });
  let isNewUser = false;
  let successMessage =
    'Registration successful. Please check your email to verify your account.';

  // Handle existing user
  if (user) {
    if (user.isVerified) {
      throw new Error('Unable to register user');
    }

    // Update existing unverified user
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.name = name;
    successMessage =
      'An account already exists for this email. A new verification link has been sent.';
  } else {
    // Create new user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      email,
      password: hashedPassword,
      isVerified: false,
    });
    isNewUser = true;
  }

  // Generate verification token
  const verificationToken = generateRandomToken();
  user.emailVerificationToken = hashToken(verificationToken);
  user.emailVerificationExpires =
    Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000;

  try {
    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verifyemail/${verificationToken}`;

    const templateData = {
      name: user.name,
      verificationUrl,
    };

    const htmlMessage = await populateTemplate(
      'verificationEmail.html',
      templateData
    );

    const textMessage = `Welcome to Eagle Campus, ${user.name}! Please verify your email by copying and pasting this link into your browser: ${verificationUrl}`;

    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email Address for Eagle Campus',
      text: textMessage,
      html: htmlMessage,
    });

    // Log email verification request
    try {
      await logAuthEvent({ userId: user._id, actor: user.email, eventType: 'EMAIL_VERIFY_REQUEST', severity: 'info', req: null });
    } catch (e) {}

    return { message: successMessage };
  } catch (error) {
    console.error('Error during registration finalization:', error);

    // Only delete if user was newly created
    if (isNewUser) {
      await User.deleteOne({ _id: user._id });
    }

    throw new Error(
      'User registration failed due to a server error. Please try again.'
    );
  }
};

// ============================================================================
// Login Service
// ============================================================================

/**
 * Authenticate user and return user data with token
 * @param {Object} credentials - User login credentials
 * @returns {Promise<Object>} User data with token
 */
export const loginUserService = async ({ email, password }, res) => {
  const user = await User.findOne({ email }).select(
    '+password +failedLoginAttempts +lockoutExpires'
  );

    if (!user) {
  // Log failed attempt for non-existent user
  try { await logAuthEvent({ actor: email, eventType: 'LOGIN_FAILURE', severity: 'warning', context: { reason: 'Invalid credentials - user not found' }, req: null }); } catch(e){}
    throw new Error('Invalid credentials');
  }

  if (!user.isVerified) {
    const error = new Error(
      'Please verify your email address before you can log in.'
    );
    error.statusCode = 403;
    // Log verification-required event
  try { await logAuthEvent({ userId: user._id, actor: user.email, eventType: 'LOGIN_FAILURE', severity: 'warning', context: { reason: 'Email not verified' }, req: null }); } catch(e){}
    throw error;
  }

  if (user.lockoutExpires && user.lockoutExpires > new Date()) {
    const error = new Error(
      'Account is temporarily locked. Please try again later.'
    );
    error.statusCode = 403;
    throw error;
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (isPasswordValid) {
    // Successful login - reset failed attempts
    user.failedLoginAttempts = 0;
    user.lockoutExpires = undefined;
    user.lastLoginAt = new Date();
    // Attempt to capture IP from the request object if available
    try {
      const ip = res?.req?.ip || undefined;
      if (ip) user.lastIp = ip;
    } catch (err) {
      // ignore
    }

    // Create a session entry for this login (deviceId from header or generated)
    try {
      const deviceIdHeader = res?.req?.headers?.['x-device-id'];
      const deviceId = deviceIdHeader || crypto.randomBytes(12).toString('hex');
      const userAgent = res?.req?.get ? res.req.get('User-Agent') : res?.req?.headers?.['user-agent'];
      const ipAddress = res?.req?.ip || res?.req?.headers?.['x-forwarded-for'] || null;

      // Push session (limit to last 10 sessions)
      user.sessions = user.sessions || [];
      user.sessions.push({ deviceId, ipAddress, userAgent, lastUsedAt: new Date(), createdAt: new Date() });
      if (user.sessions.length > 10) {
        user.sessions = user.sessions.slice(user.sessions.length - 10);
      }

      // Log session creation
      try {
        await logAuthEvent({
          userId: user._id,
          actor: user.email,
          eventType: 'SESSION_CREATED',
          severity: 'info',
          context: { deviceId },
          req: res?.req,
        });
      } catch (e) {
        // ignore
      }
    } catch (err) {
      // ignore session creation errors
    }

    await user.save();

    // Generate token and send as httpOnly cookie
    const token = generateJWTtoken(user._id);
    if (res) sendTokenCookie(res, token);

    // Log success
    try {
      await logAuthEvent({ userId: user._id, actor: user.email, eventType: 'LOGIN_SUCCESS', severity: 'info', req: res?.req });
    } catch (e) { /* ignore logging errors */ }

    // Return user object without token (cookie holds the JWT)
    return formatUserResponse(user);
  } else {
    // Failed login - increment attempts
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockoutExpires = new Date(
        Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
      );
    }

    await user.save();
    // Log failure
  try { await logAuthEvent({ userId: user._id, actor: email, eventType: 'LOGIN_FAILURE', severity: 'warning', context: { reason: 'Invalid password' }, req: res?.req }); } catch(e){}
    throw new Error('Invalid credentials');
  }
};

// ============================================================================
// Email Verification Service
// ============================================================================

/**
 * Verify user's email address using token
 * @param {string} token - Verification token from URL
 * @returns {Promise<Object>} Success message
 */
export const verifyEmailService = async (token) => {
  const hashedToken = hashToken(token);

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
  });

  if (!user) {
    throw new Error('Verification token is invalid.');
  }

  if (user.emailVerificationExpires < Date.now()) {
    throw new Error(
      'Verification token has expired. Please request a new one.'
    );
  }

  user.isVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  // Log email verified
  try {
    await logAuthEvent({ userId: user._id, actor: user.email, eventType: 'EMAIL_VERIFIED', severity: 'info', req: null });
  } catch (e) {}

  return { message: 'Email verified successfully. You can now log in.' };
};

// ============================================================================
// Password Reset Services
// ============================================================================

/**
 * Initiate password reset process
 * @param {string} email - User email
 * @returns {Promise<Object>} Success message
 */
export const forgotPasswordService = async (email) => {
  const user = await User.findOne({ email });

  if (user) {
    // Check for existing valid token
    if (
      user.passwordResetToken &&
      user.passwordResetExpires > Date.now()
    ) {
      throw new Error(
        'A reset link has already been sent. Please check your email or wait until the link expires.'
      );
    }

    if (!user.isVerified) {
      const error = new Error(
        'This account is not verified. Please check your email for a verification link.'
      );
      error.statusCode = 403;
      throw error;
    }

    // Generate reset token
    const resetToken = generateRandomToken();
    user.passwordResetToken = hashToken(resetToken);
    user.passwordResetExpires =
      Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // Log password reset request
  try { await logAuthEvent({ userId: user._id, actor: user.email, eventType: 'PASSWORD_RESET_REQUEST', severity: 'warning', req: null }); } catch(e){}

    const resetUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;

    try {
      const templateData = { name: user.name, resetUrl };
      const htmlMessage = await populateTemplate(
        'passwordReset.html',
        templateData
      );
      const textMessage = `Follow this link to reset your password: ${resetUrl}`;

      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request for Eagle Campus',
        html: htmlMessage,
        text: textMessage,
      });
    } catch (error) {
      console.error('Password reset email could not be sent:', error);

      // Clear token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      throw new Error('Email could not be sent. Please try again.');
    }
  }

  // Generic message to prevent email enumeration
  return {
    message:
      'If an account with that email exists, a password reset link has been sent.',
  };
};

/**
 * Reset user password using token
 * @param {string} token - Reset token from URL
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Success message
 */
export const resetPasswordService = async (token, newPassword) => {
  const hashedToken = hashToken(token);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new Error('Invalid token or token has expired');
  }

  // Hash and update password
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);

  // Clear reset token fields
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  // Log password reset success
  try { await logAuthEvent({ userId: user._id, actor: user.email, eventType: 'PASSWORD_RESET_SUCCESS', severity: 'critical', req: null }); } catch(e){}

  return { message: 'Password reset successful.' };
};
