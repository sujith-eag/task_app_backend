import express from 'express';
const router = express.Router();

// --- Import Middleware ---
import { generalApiLimiter, downloadLimiter } from '../../../middleware/rateLimiter.middleware.js';
import { protect } from '../../../middleware/auth.middleware.js';

// --- Import Controllers ---
import { getDownloadLink, bulkDownloadFiles } from '../controllers/download.controller.js';
                
router.use(generalApiLimiter); // Apply the general rate limiter to all file routes.
router.use(protect);  // Apply 'protect' middleware to all routes in this file.


router.route('/:id/download')
    .get(downloadLimiter, getDownloadLink);  // Gets a temporary download link

router.route('/bulk-download')
    .post(bulkDownloadFiles);


export default router;