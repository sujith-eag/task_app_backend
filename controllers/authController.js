import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import crypto from 'crypto';
import { sendEmail } from '../utils/emailService.js';

import User from '../models/userModel.js';

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

    // --- LOGIC FOR EXISTING USERS ---
    if (user) {
        // User exists AND is verified
        if (user.isVerified) {
            res.status(400);
	        throw new Error('Unable to register user'); 
	        // Not revealing user exists
        } 
        // User exists but is NOT verified
        else {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            user.name = name;
        }
    } 
    // If no user exists, create a new one.
    else {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        user = await User.create({
            name,
            email,
            password: hashedPassword,
            isVerified: false, // Starts Unverified
        });
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
        const message = `Welcome to Eagle Tasks! Please verify your email address by clicking the following link or pasting it into your browser: \n\n ${verificationUrl}`;
        await sendEmail({
            to: user.email,
            subject: 'Verify Your Email Address for Eagle Tasks',
            text: message,
        });

        res.status(201).json({ 
            message: 'Registration successful. Please check your email to verify your account.' 
        });

    } catch (error) {
        // --- ATOMIC OPERATION ---
        // If email fails to send, delete the user
        if (error.code !== 'EAUTH') { 
        // Don't delete on simple auth errors, but on send failures
             await User.deleteOne({ _id: user._id });
        }

        console.error('Email could not be sent for verification:', error);

        throw new Error('User registration failed. Please try again.');
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
        emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired verification token.');
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
});
