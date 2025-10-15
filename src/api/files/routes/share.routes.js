import express from 'express';
const router = express.Router();

// --- Import Middleware ---
import { generalApiLimiter } from '../../../middleware/rateLimiter.middleware.js';
import { protect } from '../../../middleware/auth.middleware.js';

// --- Import Controllers ---
import { shareFile, manageShareAccess, 
    createPublicShare, 
    revokePublicShare, bulkRemoveShareAccess  } from '../controllers/share.controller.js'
                
router.use(generalApiLimiter); // Apply the general rate limiter to all file routes.
router.use(protect);  // Apply 'protect' middleware to all routes in this file.

router.route('/:id/share')
    .post(shareFile)             // Shares a file with another user
    .delete(manageShareAccess);  // Revokes access or removes self from a shared file

router.route('/:id/public-share')
    .post(createPublicShare)
    .delete(revokePublicShare);

router.delete('/bulk-remove', bulkRemoveShareAccess);  // bulk-remove from shared files


export default router;
