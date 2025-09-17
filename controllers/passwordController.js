import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import Joi from 'joi';
import bcrypt from 'bcryptjs';

import User from '../models/userModel.js';



// --- Joi Validation Schemas ---

const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required(),
});


const resetPasswordSchema = Joi.object({
    password: Joi.string().pattern(
        new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$')
    ).required().messages({
        'string.pattern.base': 'Password does not meet security requirements.'
    }),
    confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
        'any.only': 'Passwords do not match.'
    }),
});



// --- PASSWORD RESET CONTROLLERS ---

// @desc    Forgot password - generates token
// @route   POST /api/users/forgotpassword
// @access  Public
export const forgotPassword = asyncHandler(async (req, res) => {
    // Validate the incoming email
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }
    
    const user = await User.findOne({ email: value.email });

    if (user) {
        // Generate and save the reset token if the user exists
        const resetToken = crypto.randomBytes(20).toString('hex');
        
		// Hash token to store in DB
        user.passwordResetToken = crypto
	        .createHash('sha256')
	        .update(resetToken)
	        .digest('hex');

        user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10-minute expiry
        await user.save({ validateBeforeSave: false });

        // you would email the unhashed `resetToken` to the user.
    }

    // 4. Always send a generic success message to prevent email enumeration attacks
    res.status(200).json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
    });
});


// @desc    Reset password using token
// @route   PUT /api/users/resetpassword/:resettoken
// @access  Public
export const resetPassword = asyncHandler(async (req, res) => {

    // Validate the new password
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }
    
    // Find user by the hashed token from the URL
    const passwordResetToken = crypto
        .createHash('sha256')
        .update(req.params.resettoken)
        .digest('hex');

    const user = await User.findOne({
        passwordResetToken,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid token or token has expired');
    }

    // Hash new password and update the user
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(value.password, salt);

    // Clear the reset token fields for security
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successful.' });
});
