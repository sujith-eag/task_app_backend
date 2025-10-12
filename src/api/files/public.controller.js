import asyncHandler from 'express-async-handler';
import File from '../../models/fileModel.js';
import { getSignedUrl as getS3SignedUrl } from '../../services/s3.service.js';

import NodeCache from 'node-cache';


// Initialize a cache for public URLs. TTL is 55s, slightly less than the S3 URL expiry of 60s.
const publicUrlCache = new NodeCache({ stdTTL: 55 });


// @desc    Get a download link for a publicly shared file
// @route   POST /api/public/download
// @access  Public
export const getPublicDownloadLink = asyncHandler(async (req, res) => {
    const { code } = req.body;
    if (!code) {
        res.status(400);
        throw new Error('Share code is required.');
    }

    // Find the file by its active, unexpired share code
    const file = await File.findOne({
        'publicShare.code': code.trim(),
        'publicShare.isActive': true,
        'publicShare.expiresAt': { $gt: new Date() }
    });

    if (!file) {
        res.status(404);
        throw new Error('Invalid or expired share code.');
    }

    // --- Caching Logic ---
    const cacheKey = `public-download-url:${file._id}`;
    const cachedUrl = publicUrlCache.get(cacheKey);

    if (cachedUrl) {
        // Cache Hit: A valid URL exists. Atomically increment download count.
        await File.updateOne({ _id: file._id }, { $inc: { downloadCount: 1 } });
        return res.status(200).json({ url: cachedUrl });
    }

    // --- Cache Miss ---
    // Generate a fresh S3 URL for the download
    const downloadUrl = await getS3SignedUrl(file.s3Key, file.fileName);

    // Atomically increment the download count and set the cache URL in parallel
    await Promise.all([
        File.updateOne({ _id: file._id }, { $inc: { downloadCount: 1 } }),
        publicUrlCache.set(cacheKey, downloadUrl)
    ]);

    res.status(200).json({ url: downloadUrl });
});