import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto'; // For generating reset tokens
import Joi from 'joi';

import User from '../models/userModel.js';

// JWT Helper Functio
const generateJWTtoken = (id) => {
    return jwt.sign( { id }, process.env.JWT_SECRET, 
            { expiresIn: '3d' });
    }

// Joi Schema for registration data
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().pattern(
      new RegExp(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'
      )).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Joi Schema for profile updates
const updateUserSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).optional(),
    bio: Joi.string().trim().max(250).allow('').optional(), // Allow empty bio
    preferences: Joi.object({
        theme: Joi.string().valid('light', 'dark').optional(),
        isDiscoverable: Joi.boolean().optional(),
        canRecieveMessages: Joi.boolean().optional(),
        canRecieveFiles: Joi.boolean().optional(),
    }).optional(),
});


// Joi Schema for password change
const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().pattern(
        new RegExp(
            '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'
        )).required()
        .messages({ // Custom error message for regex failure
            'string.pattern.base': 'Password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, a number, and a special character.'
        }),
    confirmPassword: Joi.string().required().valid(Joi.ref('newPassword'))
        .messages({ // Custom error message for mismatch
            'any.only': 'Passwords do not match.'
        }),
});





// @desc    Register a new user
// @route   POST /api/users
// @access  Public
export const registerUser = asyncHandler(async (req, res) => {
    
    // Validate first
    const { error, value } = registerSchema.validate(req.body);
    if(error){
        console.error('Joi Validation Error:', error.details);
        res.status(400);
        throw new Error(error.details[0].message);
        // throw new Error ('Invalid input data');
    }
    
    const { name, email, password } = value;

    // Checking for existing user
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('Unable to register user'); // Not revealing user exists
    }

    // Hashing Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
        name,
        email,
        password: hashedPassword
    });

    if (user) {
        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            bio: user.bio,
            preferences: user.preferences,
            token: generateJWTtoken(user._id)
        });
    } else {
        res.status(400);
        throw new Error('Unable to register user');
    }
});



// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
export const loginUser = asyncHandler(async (req, res) => {

    const { error, value } = loginSchema.validate(req.body);
        if (error) {
            res.status(400);
            throw new Error('Invalid credentials');
        }
        
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            bio: user.bio,
            preferences: user.preferences,
            token: generateJWTtoken(user._id)
        });
    } else {
        res.status(400);
        throw new Error('Invalid credentials');
    }
});



// @desc    Get current user's full profile
// @route   GET /api/users/current
// @access  Private
export const getCurrentUser = asyncHandler(async (req, res) => {
    // req.user is set by the 'protect' middleware and contains the user document
    res.status(200).json({
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        avatar: req.user.avatar,
        bio: req.user.bio,
        preferences: req.user.preferences,
    });
});



// @desc    Update current user's profile
// @route   PUT /api/users/me
// @access  Private
export const updateCurrentUser = asyncHandler(async (req, res) => {
    const { error, value } = updateUserSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }
    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    // Only update fields that were provided in request
    if (value.name) user.name = value.name;
    if (value.bio !== undefined) user.bio = value.bio; 
    // Merge preferences object to avoid overwriting nested fields
    if (value.preferences) {
        user.preferences = { ...user.preferences, ...value.preferences };
    }
    
    const updatedUser = await user.save();

    // Respond with the updated user data (excluding password)
    res.status(200).json({
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        bio: updatedUser.bio,
        preferences: updatedUser.preferences,
    });
});





// --- PASSWORD RESET CONTROLLERS ---

// @desc    Forgot password - generates token
// @route   POST /api/users/forgotpassword
// @access  Public
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
    // Always respond the same to prevent enumeration
        res.status(200).json({ message: 'If this email exists, a reset link has been sent' });
        return;
        // res.status(404);
        // throw new Error('No user found with that email');
    }

    // Generate a random reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token to store in DB
    user.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set an expiration time
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;  // 10 minutes
    await user.save({ validateBeforeSave: false });

    
// Send the (unhashed) token back to the user
    // Create a reset URL and email it to the user.
    // const resetUrl = `${req.protocol}://${req.get('host')}/resetpassword/${resetToken}`;
    // await sendEmail({ email: user.email, subject: 'Password Reset', message: `Reset URL: ${resetUrl}` });

    
//   res.status(200).json({ 
//      message: 'If this email exists, a reset link has been sent' });
    res.status(200).json({
        success: true,
        message: 'Token Not sent to email (for demo, token is returned here)',
        resetToken // For testing purposes; remove in production
    });
});



// @desc    Reset password using token
// @route   PUT /api/users/resetpassword/:resettoken
// @access  Public
export const resetPassword = asyncHandler(async (req, res) => {

    // Hash the token from the URL
    const passwordResetToken = crypto
        .createHash('sha256')
        .update(req.params.resettoken)
        .digest('hex');

    // Find the user with the matching token that has not expired
    const user = await User.findOne({
        passwordResetToken,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid token or token has expired');
    }

    
    // Enforce same password regex
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(req.body.password)) {
        res.status(400);
        throw new Error('Password does not meet security requirements');
    }
    
  // Hash new password and update the user
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);

    // Clear the reset token fields for security
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Password reset successful'
    });
});




// @desc    Change user password
// @route   PUT /api/users/password
// @access  Private
export const changePassword = asyncHandler(async (req, res) => {
    // Validate the request body
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    const { currentPassword, newPassword } = value;

    // Find the user and explicitly select the password field
    // (It might be excluded by default in the userModel)
    const user = await User.findById(req.user.id).select('+password');

    // Verify the current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        res.status(401); // 401 Unauthorized
        throw new Error('Incorrect current password.');
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Save the user with the new password
    await user.save();
    
    res.status(200).json({ message: 'Password updated successfully.' });
});