import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import crypto from 'crypto'; // Import crypto for generating reset tokens

import User from '../models/userModel.js';

// Note: For a real application, you would set up an email utility
// import sendEmail from '../utils/sendEmail.js';

const generateJWTtoken = id => jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: '5d' }
);



// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('All fields are mandatory');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

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
            role: user.role, // Include role in the response
            token: generateJWTtoken(user._id)
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role, // Include role in the response
            token: generateJWTtoken(user._id)
        });
    } else {
        res.status(400);
        throw new Error('Invalid credentials');
    }
});

// @desc    Get current user data
// @route   GET /api/users/current
// @access  Private
const getCurrentUser = asyncHandler(async (req, res) => {
    // req.user is populated by the 'protect' middleware
    res.status(200).json({
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role // Include role in the response
    });
});

// --- PASSWORD RESET CONTROLLERS ---

// @desc    Forgot password - generates token
// @route   POST /api/users/forgotpassword
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('No user found with that email');
    }

    // 1. Generate a random reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // 2. Hash the token and save it to the user model
    user.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // 3. Set an expiration time (e.g., 10 minutes)
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // 4. Send the (unhashed) token back to the user
    // In a real app, you would create a reset URL and email it to the user.
    // const resetUrl = `${req.protocol}://${req.get('host')}/resetpassword/${resetToken}`;
    // await sendEmail({ email: user.email, subject: 'Password Reset', message: `Reset URL: ${resetUrl}` });

    res.status(200).json({
        success: true,
        message: 'Token sent to email (for demo, token is returned here)',
        resetToken // For testing purposes; remove in production
    });
});



// @desc    Reset password using token
// @route   PUT /api/users/resetpassword/:resettoken
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
    // 1. Hash the token from the URL
    const passwordResetToken = crypto
        .createHash('sha256')
        .update(req.params.resettoken)
        .digest('hex');

    // 2. Find the user with the matching token that has not expired
    const user = await User.findOne({
        passwordResetToken,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid token or token has expired');
    }

    // 3. Hash the new password and update the user
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);

    // 4. Clear the reset token fields for security
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Password reset successfully'
    });
});


export {
    registerUser,
    loginUser,
    getCurrentUser,
    forgotPassword,
    resetPassword
};