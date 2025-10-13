import asyncHandler from 'express-async-handler';

import { uploadFile as uploadToS3 } from '../../../services/s3.service.js';
import File from '../../../models/fileModel.js';



// @desc    Upload one or more files
// @route   POST /api/files/uploads
// @access  Private
export const uploadFiles = asyncHandler(async (req, res) => {
    // Check if files were actually uploaded
    // `req.files` is populated by the `upload.array('files', 4)` middleware
    if (!req.files || req.files.length === 0) {
        res.status(400);
        throw new Error('No files uploaded.');
    }

    // Get parentId and find the parent folder
    const { parentId } = req.body;
    let parentFolder = null;
    let newPath = ','; // Default to root path

    if (parentId && parentId !== 'null') {
        parentFolder = await File.findOne({ _id: parentId, user: req.user._id, isFolder: true });
        if (!parentFolder) {
            res.status(404);
            throw new Error('Parent folder not found.');
        }
        newPath = parentFolder.path + parentId + ',';
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
            size: file.size, // Add file size
            isFolder: false, // All uploads are files, not folders
            parentId: parentFolder ? parentFolder._id : null, // Uploaded to the root directory by default
            path: newPath, // Represents the root path
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

