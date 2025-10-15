import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import crypto from 'crypto';
import mongoose from 'mongoose';

import File from '../../../models/fileModel.js';
import User from '../../../models/userModel.js';


const shareFileSchema = Joi.object({
    // ID of the user to share the file with should be present
    userIdToShareWith: Joi.string().required(),
    expiresAt: Joi.date().iso().optional() // Allow optional expiration date
});


// bulkShareFile not yet implimented


// @desc    Create or update a public share link for a file
// @route   POST /api/files/shares/:id/public-share
// @access  Private
export const createPublicShare = asyncHandler(async (req, res) => {
    const file = await File.findOne({ _id: req.params.id, user: req.user._id });
    if (!file) {
        res.status(404);
        throw new Error('File not found or you do not have permission.');
    }

    const { duration } = req.body; // e.g., '1-hour', '1-day', '7-days'
    let expiresAt = new Date();
    switch (duration) {
        case '1-hour': expiresAt.setHours(expiresAt.getHours() + 1); break;
        case '1-day': expiresAt.setDate(expiresAt.getDate() + 1); break;
        case '7-days': expiresAt.setDate(expiresAt.getDate() + 7); break;
        default: res.status(400); throw new Error('Invalid duration specified.');
    }

    // Generate a secure, URL-friendly, 8-character code
    // const code = crypto.randomBytes(6).toString('base64url').substring(0, 8);

    // Generate a secure, 8-character alphanumeric code (0-9, a-f)
    const code = crypto.randomBytes(4).toString('hex');
    
    file.publicShare = {
        code: code,
        isActive: true,
        expiresAt: expiresAt,
    };

    await file.save();
    res.status(200).json(file.publicShare);
});


// @desc    Revoke a public share link for a file
// @route   DELETE /api/sharesfiles/:id/public-share
// @access  Private
export const revokePublicShare = asyncHandler(async (req, res) => {
    const file = await File.findOne({ _id: req.params.id, user: req.user._id });
    if (!file) {
        res.status(404);
        throw new Error('File not found or you do not have permission.');
    }

    file.publicShare = {
        isActive: false,
    };

    await file.save();
    res.status(200).json({ message: 'Public share link has been revoked.' });
});



// @desc    Share a file with another user
// @route   POST /api/files/shares/:id/share
// @access  Private
export const shareFile = asyncHandler(async (req, res) => {
    // Validate the request body
    const { error, value } = shareFileSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    const { userIdToShareWith, expiresAt } = value;
    // Fetching file and the user-to-share-with in parallel
    const [file, userToShareWith] = await Promise.all([
        File.findById(req.params.id),
        User.findById(userIdToShareWith)
    ]);
   
     if (!file) {
        res.status(404);
        throw new Error('File not found.');
    }
    // Verify that the person making the request is the owner
    if (file.user.toString() !== req.user.id) {
        res.status(403);
        throw new Error('You do not have permission to share this file.');
    }
    // Verify the user being shared with actually exists
    if (!userToShareWith) {
        res.status(404);
        throw new Error('User to share with not found.');
    }
    // Prevent owner from sharing a file with themselves
    if (userIdToShareWith === req.user.id) {
        res.status(400);
        throw new Error('You cannot share a file with yourself.');
    }
    // Check the recipient's file sharing preferences
    if (!userToShareWith.preferences.canRecieveFiles) {
        res.status(403); // Forbidden
        throw new Error('This user is not accepting shared files at the moment.');
    }
    // Check if the file is already shared with this user
    if (file.sharedWith.some(share => share.user.toString() === userIdToShareWith)) {
        res.status(400);
        throw new Error('File is already shared with this user.');
    }
    
    // Add the user to the sharedWith array as an object
    file.sharedWith.push({ user: userIdToShareWith, expiresAt: expiresAt || null });
    await file.save();

    // Populate user details for a clean frontend response
    await file.populate([
        { path: 'user', select: 'name avatar' }, 
        { path: 'sharedWith', select: 'name avatar' }
        ]);
    // await file.populate('user', 'name avatar');
    // await file.populate('sharedWith', 'name avatar');

    res.status(200).json(file);
});



// @desc    Manage share access (owner revokes or user removes self)
// @route   DELETE /api/files/shares/:id/share
// @access  Private
export const manageShareAccess = asyncHandler(async (req, res) => {
    const file = await File.findById(req.params.id);
    if (!file) {
        res.status(404);
        throw new Error('File not found.');
    }

    const loggedInUserId = req.user.id;
    const isOwner = file.user.toString() === loggedInUserId;

    const { userIdToRemove } = req.body; // This may be undefined, then it's the shared user

    // --- Logic to determine which user to remove ---
    let userToRemoveIdFrom = null;

    // Scenario A: The owner is revoking access for a specific user
    if (isOwner && userIdToRemove) {
        userToRemoveIdFrom = userIdToRemove;
    } 
    // Scenario B: A shared user is removing their own access (no request body needed)
    else if (!isOwner && !userIdToRemove) {
        userToRemoveIdFrom = loggedInUserId;
    } 
    // Invalid scenarios (owner not specifying who to remove, or non-owner trying to remove someone else)
    else {
        res.status(403);
        throw new Error('You do not have permission to perform this action.');
    }

    // --- Updated the document ---
    // MongoDB's $pull operator to remove the ID from the array
    const updatedFile = await File.findByIdAndUpdate(
        req.params.id,
        { $pull: { sharedWith: { user: userToRemoveIdFrom } } },
        { new: true } // Return the updated document
    )
    .populate('user', 'name avatar')
    .populate('sharedWith.user', 'name avatar');

    res.status(200).json(updatedFile);
});



// @desc    Remove the logged-in user from the share list of multiple files
// @route   DELETE /api/files/shares/bulk-remove
// @access  Private
export const bulkRemoveShareAccess = asyncHandler(async (req, res) => {
    const { fileIds } = req.body;
    const userId = req.user._id;

    // --- 1. Stricter Input Validation ---
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        res.status(400);
        throw new Error('A non-empty array of fileIds must be provided.');
    }

    // Ensure all provided IDs are valid before proceeding
    for (const id of fileIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400);
            throw new Error(`Invalid file ID format: ${id}`);
        }
    }
            
    // --- Precise & Resilient Query ---
    // This query now has an added condition: it will only match documents
    // where the current user is actually in the 'sharedWith' array.
    // If access was already revoked, that file is simply ignored.
    const result = await File.updateMany(
        {
            _id: { $in: fileIds },
            'sharedWith.user': userId 
        },
        { $pull: { sharedWith: { user: userId } } }
    );

    res.status(200).json({
        message: `${result.modifiedCount} file(s) successfully removed from your shared list.`,
        ids: fileIds // Return original IDs for frontend state update
    });
});