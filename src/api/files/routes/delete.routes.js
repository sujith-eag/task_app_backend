import express from 'express';
const router = express.Router();

// --- Import Middleware ---
import { generalApiLimiter } from '../../../middleware/rateLimiter.middleware.js';
import { protect } from '../../../middleware/auth.middleware.js';

// --- Import Controllers ---

import { deleteFile, bulkDeleteFiles } from '../controllers/delete.controller.js';

router.use(generalApiLimiter); // Apply the general rate limiter to all file routes.
router.use(protect);  // Apply 'protect' middleware to all routes in this file.

router.route('/:id')
    .delete(deleteFile);   // Deletes a file owned by the user

router.route('/')
    .delete(bulkDeleteFiles);   // Delete multiple files
    

export default router;