import express from 'express';
const router = express.Router();

// --- Import Middleware ---
import { generalApiLimiter, downloadLimiter } from '../../middleware/rateLimiter.middleware.js';
import { protect } from '../../middleware/auth.middleware.js';
import { uploadFiles as upload } from '../../middleware/file.middleware.js';
import { checkStorageQuota } from '../../middleware/storage.middleware.js';

// --- Import Controllers ---
import {
    uploadFiles, getUserFiles, getDownloadLink,
    deleteFile, bulkDeleteFiles,
    shareFile, manageShareAccess,
    shareFileWithClass, createPublicShare, revokePublicShare
                } from './file.controller.js';


router.use(generalApiLimiter); // Apply the general rate limiter to all file routes.
router.use(protect);  // Apply 'protect' middleware to all routes in this file.

router.route('/')
    .get(getUserFiles)      // GET /api/files - Fetches all files owned by or shared with the user
    .post(checkStorageQuota, upload, uploadFiles)    // POST /api/files - Uploads one or more new files
    .delete(bulkDeleteFiles);   // DELETE /api/files - Delete multiple files

router.route('/:id')
    .delete(deleteFile);   // DELETE /api/files/:id - Deletes a file owned by the user

router.route('/:id/download')
    .get(downloadLimiter, getDownloadLink);      // GET /api/files/:id/download - Gets a temporary download link

router.route('/:id/share')
    .post(shareFile)             // POST /api/files/:id/share - Shares a file with another user
    .post(shareFileWithClass)    // POST /api/files/:id/share-class
    .delete(manageShareAccess);  // DELETE /api/files/:id/share - Revokes access or removes self from a shared file

router.route('/:id/public-share')
    .post(createPublicShare)      // POST /api/files/:id/public-share
    .delete(revokePublicShare);    // DELETE /api/files/:id/public-share
    
export default router;