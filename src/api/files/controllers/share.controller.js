import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import crypto from 'crypto';
import mongoose from 'mongoose';

import File from '../../../models/fileModel.js';
import User from '../../../models/userModel.js';

// Helper: normalize logged in user id from various auth middlewares
const getLoggedInUserId = (req) => String(req.user?.id ?? req.user?._id ?? req.user?.userId ?? req.user?.user_id ?? '');


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
    const loggedInUserId = getLoggedInUserId(req);
    const file = await File.findOne({ _id: req.params.id, user: loggedInUserId });
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
    const loggedInUserId = getLoggedInUserId(req);
    // Use an atomic update to avoid writing null into a uniquely indexed field
    const updated = await File.findOneAndUpdate(
        { _id: req.params.id, user: loggedInUserId },
        {
            $set: { 'publicShare.isActive': false },
            $unset: { 'publicShare.code': '', 'publicShare.expiresAt': '' }
        },
        { new: true }
    ).select('+publicShare') // ensure publicShare field is returned
    .exec();

    if (!updated) {
        res.status(404);
        throw new Error('File not found or you do not have permission.');
    }

    return res.status(200).json({ message: 'Public share link has been revoked.', publicShare: updated.publicShare });
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
    const loggedInUserId = getLoggedInUserId(req);
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
    if (file.user.toString() !== loggedInUserId) {
        res.status(403);
        throw new Error('You do not have permission to share this file.');
    }
    // Verify the user being shared with actually exists
    if (!userToShareWith) {
        res.status(404);
        throw new Error('User to share with not found.');
    }
    // Prevent owner from sharing a file with themselves
    if (userIdToShareWith === loggedInUserId) {
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

    // Populate user details for a clean frontend response (note nested populate)
    await file.populate([
        { path: 'user', select: 'name avatar' },
        { path: 'sharedWith.user', select: 'name avatar' }
    ]);

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

    const loggedInUserId = getLoggedInUserId(req);
    const isOwner = String(file.user) === loggedInUserId;
    const { userIdToRemove } = req.body || {};

    // Determine the intended target user id for removal
    let targetUserId = null;
    if (isOwner && userIdToRemove) {
        targetUserId = String(userIdToRemove);
    } else if (!isOwner && !userIdToRemove) {
        // Shared user removing themself
        targetUserId = loggedInUserId;
    } else if (isOwner && !userIdToRemove) {
        res.status(400);
        throw new Error('Owner must specify a userIdToRemove when revoking access.');
    } else {
        res.status(403);
        throw new Error('You do not have permission to perform this action.');
    }

    // Attempt to pull the shared entry only if it exists; return idempotent success if nothing changed
    const updatedFile = await File.findOneAndUpdate(
        { _id: req.params.id, 'sharedWith.user': new mongoose.Types.ObjectId(targetUserId) },
        { $pull: { sharedWith: { user: new mongoose.Types.ObjectId(targetUserId) } } },
        { new: true }
    )
    .populate('user', 'name avatar')
    .populate('sharedWith.user', 'name avatar');

    if (!updatedFile) {
        // No matching entry found; treat as idempotent success and return current state
        const current = await File.findById(req.params.id)
            .populate('user', 'name avatar')
            .populate('sharedWith.user', 'name avatar');
        // Return the current file object (consistent with success path)
        return res.status(200).json(current);
    }

    res.status(200).json(updatedFile);
});



// @desc    Remove the logged-in user from the share list of multiple files
// @route   DELETE /api/files/shares/bulk-remove
// @access  Private
export const bulkRemoveShareAccess = asyncHandler(async (req, res) => {
    const { fileIds } = req.body;
    const userId = getLoggedInUserId(req);

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
            'sharedWith.user': new mongoose.Types.ObjectId(userId)
        },
        { $pull: { sharedWith: { user: new mongoose.Types.ObjectId(userId) } } }
    );

    res.status(200).json({
        message: `${result.modifiedCount} file(s) successfully removed from your shared list.`,
        ids: fileIds // Return original IDs for frontend state update
    });
});