import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import Joi from 'joi';

import User from '../models/userModel.js';

import { deleteFile as deleteFromS3 } from '../utils/s3Service.js';
import { uploadFile as uploadToS3 } from '../utils/s3Service.js';



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


// Joi Schema for student application
const studentApplicationSchema = Joi.object({
    usn: Joi.string().trim().required().messages({
        'string.empty': 'University Seat Number (USN) is required.'
    }),
    section: Joi.string().trim().valid('A', 'B', 'C').required(),
    batch: Joi.number().integer().min(2000).required(),
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
        studentDetails: req.user.studentDetails, // Also return application status
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

    
    // Update the password change timestamp
    user.passwordResetOn = new Date();
    
    // Reset login attempt counters for security
    user.failedLoginAttempts = 0;
    user.lockoutExpires = null;

    // Save the user with the new password
    await user.save();
    
    res.status(200).json({ message: 'Password updated successfully.' });
});



// @desc    Get a list of users who are discoverable
// @route   GET /api/users/discoverable
// @access  Private
export const getDiscoverableUsers = asyncHandler(async (req, res) => {
    // Find users who are discoverable and are not the current user
    const users = await User.find({ 
        'preferences.isDiscoverable': true,
        '_id': { $ne: req.user.id } 
        // Exclude the user making the request
    }).select('name avatar'); 
    // Selecting only public-facing fields for privacy

    res.status(200).json(users);
});




// @desc    Update a user's avatar
// @route   PUT /api/users/me/avatar
// @access  Private
export const updateUserAvatar = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No avatar image file provided.');
    }

    const user = await User.findById(req.user.id);

    // If user already has an avatar, delete the old one from S3
    if (user.avatar) {
        try {
            // Extract the S3 key from the full URL
            const oldAvatarUrl = new URL(user.avatar);
            const oldS3Key = oldAvatarUrl.pathname.substring(1); // Remove leading '/'
            await deleteFromS3(oldS3Key);
        } catch (error) {
            console.error('Failed to delete old avatar from S3:', error);
            // Non-fatal error, we can still proceed with uploading the new one.
        }
    }

    // Upload the new avatar to S3
    const newS3Key = await uploadToS3(req.file);

    // Construct the full public URL for the new avatar
    const newAvatarUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_BUCKET_REGION}.amazonaws.com/${newS3Key}`;
    console.log('Constructed Avatar URL:', newAvatarUrl);
    // Update the user's avatar field and save
    user.avatar = newAvatarUrl;
    await user.save();

    res.status(200).json({ avatar: newAvatarUrl });
});


// @desc    Submit an application to become a student
// @route   POST /api/users/apply-student
// @access  Private/User
export const applyAsStudent = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    // Check if the user is in a state that allows applying
    const currentStatus = user.studentDetails.applicationStatus;
    if (currentStatus === 'pending') {
        res.status(400);
        throw new Error('You already have a pending application.');
    }
    if (currentStatus === 'approved') {
        res.status(400);
        throw new Error('Your application has already been approved.');
    }

    // Validate the incoming application data
    const { error, value } = studentApplicationSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    const { usn, section, batch } = value;

    // Check if USN is already in use by another verified student
    const usnExists = await User.findOne({ 'studentDetails.usn': usn, 'studentDetails.applicationStatus': 'approved' });
    if (usnExists) {
        res.status(400);
        throw new Error('This USN is already registered to an approved student.');
    }

    // Update user's student details and set status to pending
    user.studentDetails = {
        ...user.studentDetails, // Keep any existing data if necessary
        usn,
        section,
        batch,
        applicationStatus: 'pending',
    };

    await user.save();

    res.status(200).json({
        message: 'Your application has been submitted successfully.',
        applicationStatus: 'pending',
    });
});
