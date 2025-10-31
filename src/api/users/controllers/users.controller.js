import asyncHandler from '../../_common/http/asyncHandler.js';
import * as usersService from '../services/users.service.js';

/**
 * @desc    Get current user's full profile
 * @route   GET /api/users/me
 * @access  Private
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
    const profile = await usersService.getUserProfile(req.user._id);
    res.status(200).json(profile);
});

/**
 * @desc    Update current user's profile
 * @route   PUT /api/users/me
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
    const updatedProfile = await usersService.updateUserProfile(
        req.user._id,
        req.body
    );
    res.status(200).json(updatedProfile);
});

/**
 * @desc    Change user password
 * @route   PUT /api/users/password
 * @access  Private
 */
export const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    await usersService.changeUserPassword(
        req.user._id,
        currentPassword,
        newPassword
    );
    
    res.status(200).json({ message: 'Password updated successfully' });
});

/**
 * @desc    Get list of discoverable users
 * @route   GET /api/users/discoverable
 * @access  Private
 */
export const getDiscoverableUsers = asyncHandler(async (req, res) => {
    const users = await usersService.getDiscoverableUsers(req.user._id);
    res.status(200).json(users);
});

/**
 * @desc    Update user avatar
 * @route   PUT /api/users/me/avatar
 * @access  Private
 */
export const updateAvatar = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No avatar image file provided');
    }
    
    const avatarUrl = await usersService.updateAvatar(req.user._id, req.file);
    res.status(200).json({ avatar: avatarUrl });
});

/**
 * @desc    Submit application to become a student
 * @route   POST /api/users/apply-student
 * @access  Private
 */
export const applyAsStudent = asyncHandler(async (req, res) => {
    const updatedUser = await usersService.submitStudentApplication(
        req.user._id,
        req.body
    );
    res.status(200).json(updatedUser);
});

/**
 * @desc    Get current user's storage usage and quota
 * @route   GET /api/users/me/storage
 * @access  Private
 */
export const getStorageUsage = asyncHandler(async (req, res) => {
    const storageInfo = await usersService.getStorageUsage(
        req.user._id,
        req.user.role
    );
    res.status(200).json(storageInfo);
});
