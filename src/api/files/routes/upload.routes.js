import express from 'express';
const router = express.Router();

// --- Import Middleware ---
import { generalApiLimiter } from '../../../middleware/rateLimiter.middleware.js';
import { protect } from '../../../middleware/auth.middleware.js';
import { uploadFiles as upload } from '../../../middleware/file.middleware.js';
import { checkStorageQuota } from '../../../middleware/storage.middleware.js';

// --- Import Controllers ---
import { uploadFiles } from '../controllers/upload.controller.js';

router.use(generalApiLimiter); // Apply the general rate limiter to all file routes.
router.use(protect);  // Apply 'protect' middleware to all routes in this file.

router.route('/')
    .post(checkStorageQuota, upload, uploadFiles);    // Uploads one or more new files

export default router;