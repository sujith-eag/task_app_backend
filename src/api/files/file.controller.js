import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import NodeCache from 'node-cache'

import { uploadFile as uploadToS3 } from '../../services/s3.service.js';
import { getSignedUrl as getS3SignedUrl } from '../../services/s3.service.js';
import { deleteFile as deleteFromS3 } from '../../services/s3.service.js';

import File from '../../models/fileModel.js';
import User from '../../models/userModel.js';


const shareFileSchema = Joi.object({
    // ID of the user to share the file with should be present
    userIdToShareWith: Joi.string().required(),
});



// @desc    Upload one or more files
// @route   POST /api/files
// @access  Private
export const uploadFiles = asyncHandler(async (req, res) => {
    // Check if files were actually uploaded
    // `req.files` is populated by the `upload.array('files', 4)` middleware
    if (!req.files || req.files.length === 0) {
        res.status(400);
        throw new Error('No files uploaded.');
    }

    // Upload all files to S3 in parallel for better performance
    const uploadPromises = req.files.map(async (file) => {

        // --- Logic for Unique Filename ---
        let finalFileName = file.originalname;
        let counter = 0;
        let fileExists = true;

        // Check if a file with this name already exists for the user and append a counter if it does
        while (fileExists) {
            const existingFile = await File.findOne({ 
                user: req.user.id, 
                fileName: finalFileName 
            });
            if (existingFile) {
                counter++;
                const originalName = file.originalname.substring(0, file.originalname.lastIndexOf('.'));
                const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
                finalFileName = `${originalName} (${counter})${fileExtension}`;
            } else {
                fileExists = false;
            }
        }

        // Upload the file buffer
        const s3Key = await uploadToS3(file);
        
        // Return metadata for files
        return {
            user: req.user.id,
            fileName: finalFileName,
            s3Key: s3Key,
            fileType: file.mimetype,
        };
    });

    // Wait for all uploads to complete
    const filesMetadata = await Promise.all(uploadPromises);

    // Save metadata for all uploaded files to the database
    let newFiles = await File.insertMany(filesMetadata);
    newFiles = await File.populate(newFiles, { path: 'user', select: 'name avatar' });
    
    // Respond with newly created file records
    res.status(201).json(newFiles);
});




// @desc    Get all files owned by or shared with the user (including class shares)
// @route   GET /api/files
// @access  Private
export const getUserFiles = asyncHandler(async (req, res) => {
    const user = req.user;
    let query;

    // If the user is a student, create an expanded query to find files shared with their class
    if (user.role === 'student' && user.studentDetails) {
        query = {
            $or: [
                { user: user._id }, // Files they own
                { sharedWith: user._id }, // Files shared directly with them
                { // --- Files shared with their specific class ---
                    'sharedWithClass.batch': user.studentDetails.batch,
                    'sharedWithClass.section': user.studentDetails.section,
                    'sharedWithClass.semester': user.studentDetails.semester
                }
            ]
        };
    } else {
        // Original query for non-student roles
        query = {
            $or: [
                { user: user._id },
                { sharedWith: user._id }
            ]
        };
    }
    const files = await File.find(query)
        .sort({ createdAt: -1 })  // Sort by most recently created
        .populate('user', 'name avatar');  // Populate the owner's details for frontend display
    res.status(200).json(files);
});



// Initializing a cache. The stdTTL (standard time-to-live) is in seconds.
// set to 55 seconds, slightly less than the URL's 60-second expiry.
const urlCache = new NodeCache({ stdTTL: 55 });


// @desc    Get a temporary, pre-signed URL to download a file
// @route   GET /api/files/:id/download
// @access  Private
export const getDownloadLink = asyncHandler(async (req, res) => {
    const loggedInUserId = req.user.id;
    const fileId = req.params.id;

    // Find the file in the database
    const file = await File.findById(fileId);
    if (!file) {
        res.status(404);
        throw new Error('File not found.');
    }

    // Verify the user has permission to access this file
    // Mongoose ObjectId needs to be converted to a string for comparison
    const isOwner = file.user.toString() === loggedInUserId;
    const isSharedWith = file.sharedWith.some(id => id.toString() === loggedInUserId);

    if (!isOwner && !isSharedWith) {
        res.status(403); // 403 Forbidden: user is authenticated but not authorized
        throw new Error('You do not have permission to access this file.');
    }

    // --- Caching Logic ---
    const cacheKey = `download-url:${fileId}:${loggedInUserId}`;
    const cachedUrl = urlCache.get(cacheKey);

    if (cachedUrl) {
        // Cache Hit: A valid URL exists, send it back immediately.
        return res.status(200).json({ url: cachedUrl });
    }

    // Cache Miss: No valid URL in cache, so we generate a new one.    
    
    // Generate secure, temporary download link using S3 service
    const downloadUrl = await getS3SignedUrl(file.s3Key, file.fileName);

    // Store the new URL in the cache before sending it.
    urlCache.set(cacheKey, downloadUrl);
        
    // Send the URL back
    res.status(200).json({ url: downloadUrl });
});




// @desc    Delete a file
// @route   DELETE /api/files/:id
// @access  Private
export const deleteFile = asyncHandler(async (req, res) => {
    const loggedInUserId = req.user.id;
    const fileId = req.params.id;

    // Find the file in the database
    const file = await File.findById(fileId);
    if (!file) {
        res.status(404);
        throw new Error('File not found.');
    }

    // Verify the user is the owner of the file.
    // A user the file is shared with CANNOT delete it.
    if (file.user.toString() !== loggedInUserId) {
        res.status(403);
        throw new Error('You do not have permission to delete this file.');
    }

    // Delete the file from the S3 bucket first.
    await deleteFromS3(file.s3Key);

    // After successful S3 deletion, delete the record from the database.
    await File.findByIdAndDelete(fileId);

    res.status(200).json({ message: 'File deleted successfully.' });
});



// @desc    Delete multiple files
// @route   DELETE /api/files
// @access  Private
export const bulkDeleteFiles = asyncHandler(async (req, res) => {
    const { fileIds } = req.body; // Expect an array of file IDs

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        res.status(400);
        throw new Error('File IDs must be provided as an array.');
    }

    // Find all files that match the IDs AND belong to the logged-in user
    const filesToDelete = await File.find({
        '_id': { $in: fileIds },
        'user': req.user.id
    });

    // Security Check: If the number of found files doesn't match the number of requested IDs,
    // it means the user tried to delete a file they don't own.
    if (filesToDelete.length !== fileIds.length) {
        res.status(403);
        throw new Error('You do not have permission to delete one or more of the selected files.');
    }

    // Proceed with deletion
    // 1. Delete from S3 in parallel
    const deleteS3Promises = filesToDelete.map(file => deleteFromS3(file.s3Key));
    await Promise.all(deleteS3Promises);

    // 2. Delete from MongoDB in a single operation
    await File.deleteMany({
        '_id': { $in: fileIds },
        'user': req.user.id
    });

    res.status(200).json({ message: `${filesToDelete.length} files deleted successfully.` });
});



// @desc    Share a file with another user
// @route   POST /api/files/:id/share
// @access  Private
export const shareFile = asyncHandler(async (req, res) => {
    // Validate the request body
    const { error, value } = shareFileSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    const { userIdToShareWith } = value;
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
    if (file.sharedWith.some(id => id.toString() === userIdToShareWith)) {
        res.status(400);
        throw new Error('File is already shared with this user.');
    }
    

    // Add the user to the sharedWith array and save
    file.sharedWith.push(userIdToShareWith);
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
// @route   DELETE /api/files/:id/share
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

    // --- Update the document ---
    // Use MongoDB's $pull operator to remove the ID from the array
    const updatedFile = await File.findByIdAndUpdate(
        req.params.id,
        { $pull: { sharedWith: userToRemoveIdFrom } },
        { new: true } // Return the updated document
    )
    .populate('user', 'name avatar')
    .populate('sharedWith', 'name avatar');

    res.status(200).json(updatedFile);
});



// @desc    Share a file with an entire class
// @route   POST /api/v1/files/:id/share-class
// @access  Private (Owner of the file)
export const shareFileWithClass = asyncHandler(async (req, res) => {
    const { subject, batch, semester, section } = req.body;
    const file = await File.findById(req.params.id);

    // Verify the file exists and the user is the owner
    if (!file) {
        res.status(404);
        throw new Error('File not found.');
    }
    if (file.user.toString() !== req.user.id) {
        res.status(403);
        throw new Error('You are not authorized to share this file.');
    }

    // Validate that the teacher is assigned to the subject they are sharing with
    const teacher = await User.findById(req.user.id);
    const isAssigned = teacher.teacherDetails.subjectsTaught.some(
        taughtSubject => taughtSubject.toString() === subject
    );
    if (!isAssigned) {
        res.status(403);
        throw new Error('You can only share files with classes you are assigned to teach.');
    }

    // Update the file with the class sharing details
    file.sharedWithClass = { subject, batch, semester, section };
    await file.save();

    res.status(200).json({ message: 'File has been shared with the class.' });
});