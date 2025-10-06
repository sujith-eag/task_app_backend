import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import Joi from 'joi';
import bcrypt from 'bcryptjs';

import User from '../../models/userModel.js';
import { sendEmail } from '../../services/email.service.js';
import { populateTemplate } from '../../utils/emailTemplate.js';

// --- Joi Validation Schemas ---

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

const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required(),
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
        // --- Check for an existing, valid token ---
        if (user.passwordResetToken && user.passwordResetExpires > Date.now()) {
            res.status(400); // Bad Request or 429 Too Many Requests
            throw new Error('A reset link has already been sent. Please check your email or wait until the link expires.');
        }
        if(!user.isVerified){
            res.status(403);
            throw new Error('This account is not verified. Please check your email for a verification link.');
        }
        // Generate and save the reset token if user exists
        const resetToken = crypto.randomBytes(20).toString('hex');
		// Hash token to store in DB
        user.passwordResetToken = crypto
	        .createHash('sha256')
	        .update(resetToken)
	        .digest('hex');

        user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10-minute expiry
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;
        
        
        
        
        
        console.log(`Generated URL: ${resetUrl}`);
        // const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please Follow the link to the Password Reset Page: \n\n ${resetUrl}`;

        try {
            const templateData = { name: user.name, resetUrl: resetUrl };
            const htmlMessage = await populateTemplate('passwordReset.html', templateData);
            const textMessage = `Follow this link to reset your password: ${resetUrl}`;
            
            await sendEmail({
                to: user.email,
                subject: 'Password Reset Request for Eagle Campus',
                html: htmlMessage,
                text: textMessage,
            });
        } catch (error) {
            console.error('Password reset email could not be sent:', error);
            // Clearing token fields if email fails, so the user can try again
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });

            throw new Error('Email could not be sent. Please try again.');
        }
    }

    // A generic success message to prevent email enumeration attacks
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
