import express from 'express';
const router = express.Router();

// --- Import Middleware ---
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import { checkFileLimit } from '../middleware/checkFileLimit.js';

// --- Import Controllers ---
import {
    uploadFiles,
    getUserFiles,
    getDownloadLink,
    deleteFile,
    shareFile,
    manageShareAccess,
} from '../controllers/fileController.js';


router.use(protect);  // Apply 'protect' middleware to all routes in this file.

router.route('/')
    .get(getUserFiles)      // GET /api/files - Fetches all files owned by or shared with the user
    .post(checkFileLimit, upload, uploadFiles);    // POST /api/files - Uploads one or more new files

router.route('/:id')
    .delete(deleteFile);   // DELETE /api/files/:id - Deletes a file owned by the user

router.route('/:id/download')
    .get(getDownloadLink);      // GET /api/files/:id/download - Gets a temporary download link

router.route('/:id/share')
    .post(shareFile)             // POST /api/files/:id/share - Shares a file with another user
    .delete(manageShareAccess);  // DELETE /api/files/:id/share - Revokes access or removes self from a shared file


export default router;