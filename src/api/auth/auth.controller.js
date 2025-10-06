import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import crypto from 'crypto';

import { populateTemplate } from '../../utils/emailTemplate.js';
import { sendEmail } from '../../services/email.service.js';

import User from '../../models/userModel.js';

const MAX_LOGIN_ATTEMPTS=5;
const LOCKOUT_DURATION_MINUTES=10;

// JWT Helper Function
const generateJWTtoken = (id) => {
    return jwt.sign( { id }, 
        process.env.JWT_SECRET, 
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
    }

    const { name, email, password } = value;
    let user = await User.findOne({ email });

    // --- Track if the user is new and set a dynamic success message ---
    let isNewUser = false;
    let successMessage = 'Registration successful. Please check your email to verify your account.';    
    
    // --- LOGIC FOR EXISTING USERS ---
    if (user) {
        // User exists AND is verified
        if (user.isVerified) {
            res.status(400);
	        throw new Error('Unable to register user'); 
	        // Not revealing user exists
        } 
        else 
        {  // User exists but is NOT verified, so we'll update them
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            user.name = name;
            successMessage = 'An account already exists for this email. A new verification link has been sent.';            
        }
    } 
    else 
    {   // No user exists, create a new one.
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        user = new User({  // `new User` instead of `User.create` to prevent premature saving
            name,
            email,
            password: hashedPassword,
            isVerified: false, // Starts Unverified
        });
        isNewUser = true; // for error handling logic
    }
    if (!user) {
         res.status(400);
         throw new Error('Unable to process registration.');
    }

    // --- TOKEN GENERATION AND EMAIL SENDING LOGIC
    const verificationToken = crypto.randomBytes(20).toString('hex');
    user.emailVerificationToken = crypto
	    .createHash('sha256')
	    .update(verificationToken)
	    .digest('hex');
	    
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // --- Send the verification email ---
    try {
        await user.save(); 
        // Save the new user OR the updated unverified user
        
        const verificationUrl = `${process.env.FRONTEND_URL}/verifyemail/${verificationToken}`;

        // const message = `Welcome to Eagle Tasks! Please verify your email address by clicking the following link or pasting it into your browser: \n\n ${verificationUrl}`;

        // Prepare data for the template
        const templateData = {
            name: user.name,
            verificationUrl: verificationUrl,
        };

        // Populate the HTML template
        const htmlMessage = await populateTemplate('verificationEmail.html', templateData);

        // A simple text fallback if HTML fails
        const textMessage = `Welcome to Eagle Campus, ${user.name}! Please verify your email by copying and pasting this link into your browser: ${verificationUrl}`;

        await sendEmail({
            to: user.email,
            subject: 'Verify Your Email Address for Eagle Campus',
            text: textMessage,
            html: htmlMessage,
        });

        res.status(201).json({ message: successMessage });

    } catch (error) {

        // --- ATOMIC OPERATION ---
        console.error('Error during registration finalization:', error);

        // Only delete the user IF they were newly created in this request.
        // Prevents deleting existing unverified users.
        if (isNewUser) {
            await User.deleteOne({ _id: user._id });
        }

        // If email fails to send, delete the user
        // if (error.code !== 'EAUTH') { 
        // Don't delete on simple auth errors, but on send failures
            //  await User.deleteOne({ _id: user._id });
        // }

        // console.error('Email could not be sent for verification:', error);

        throw new Error('User registration failed due to a server error. Please try again.');
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
    const user = await User.findOne({ email }).select('+password +failedLoginAttempts +lockoutExpires');

    if (!user) {
        res.status(400);
        throw new Error('Invalid credentials');
    }
    if (!user.isVerified) {
        res.status(403); // Forbidden
        throw new Error('Please verify your email address before you can log in.');
    }
    if (user.lockoutExpires && user.lockoutExpires > new Date()) {
        res.status(403); // Forbidden
        throw new Error('Account is temporarily locked. Please try again later.');
    }
    if (await bcrypt.compare(password, user.password)) {
        user.failedLoginAttempts = 0;
        user.lockoutExpires = undefined; // Clear any previous lockout
        user.lastLoginAt = new Date;

        await user.save();

        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            bio: user.bio,
            preferences: user.preferences,

            studentDetails: user.studentDetails,
            teacherDetails: user.teacherDetails,
            token: generateJWTtoken(user._id)
        });
    } else {
        user.failedLoginAttempts += 1;
        if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
            user.lockoutExpires = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
        }
        await user.save();

        res.status(400);
        throw new Error('Invalid credentials');
    }
});




// @desc    Verify user's email address
// @route   GET /api/users/verifyemail/:token
// @access  Public
export const verifyEmail = asyncHandler(async (req, res) => {
    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        // emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) { // Token does not exist
        res.status(400);
        throw new Error('Verification token is invalid.');
    }

    // The token exists but has expired
    if (user.emailVerificationExpires < Date.now()) {
        res.status(400);
        throw new Error('Verification token has expired. Please request a new one.');
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
});
