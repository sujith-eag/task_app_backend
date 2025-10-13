import asyncHandler from 'express-async-handler';
import NodeCache from 'node-cache'
import archiver from 'archiver';

import { getSignedUrl as getS3SignedUrl } from '../../../services/s3.service.js';
import { getFileStream as getS3FileStream } from '../../../services/s3.service.js';
import File from '../../../models/fileModel.js';



// Initializing a cache. The stdTTL (standard time-to-live) is in seconds.
// set to 55 seconds, slightly less than the URL's 60-second expiry.
const urlCache = new NodeCache({ stdTTL: 55 });


// @desc    Get a temporary, pre-signed URL to download a file
// @route   GET /api/files/downloads/:id/download
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
    
    // --- PERMISSION CHECK ---
    const isSharedWith = file.sharedWith.some(share => 
        share.user.toString() === loggedInUserId && 
        (!share.expiresAt || share.expiresAt > new Date())
    );
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


// @desc    Download multiple files as a zip archive
// @route   POST /api/files/downloads/bulk-download
// @access  Private
export const bulkDownloadFiles = asyncHandler(async (req, res) => {
    // Parse the incoming JSON string from the form
    let fileIds;
    try {
        // req.body.fileIds is a string like "[\"id1\",\"id2\"]"
        fileIds = JSON.parse(req.body.fileIds);
    } catch (e) {
        res.status(400);
        throw new Error('Invalid format for file IDs.');
    }

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        res.status(400);
        throw new Error('File IDs must be provided as an array.');
    }

    // --- Security Check ---
    // Find all files that the user has permission to access.
    const accessibleFiles = await File.find({
        _id: { $in: fileIds },
        $or: [
            { user: req.user._id }, // The user is the owner
            { 'sharedWith.user': req.user._id } // The file is shared with the user
        ]
    });

    // If the number of found files doesn't match the requested count, it's a permission error.
    if (accessibleFiles.length !== fileIds.length) {
        res.status(403);
        throw new Error('You do not have permission to download one or more of the selected files.');
    }

    // --- Stream Zipping ---
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="EagleCampus-Files.zip"');

    const archive = archiver('zip', {
        zlib: { level: 9 } // Set compression level.
    });

    // Handle errors and warnings
    archive.on('warning', (err) => {
      if (err.code !== 'ENOENT') throw err;
    });
    archive.on('error', (err) => {
      throw err;
    });

    // Pipe the archive stream directly to the response
    archive.pipe(res);

    // Loop through accessible files, stream from S3, and append to the archive
    for (const file of accessibleFiles) {
        if (!file.isFolder) { // Ensure we only add files, not folders
            const stream = await getS3FileStream(file.s3Key);
            archive.append(stream, { name: file.fileName });
        }
    }

    // Finalize the archive, which automatically ends the response stream
    await archive.finalize();
});

