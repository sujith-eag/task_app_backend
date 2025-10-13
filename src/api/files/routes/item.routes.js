import express from 'express';
const router = express.Router();

// --- Import Middleware ---
import { generalApiLimiter } from '../../../middleware/rateLimiter.middleware.js';
import { protect } from '../../../middleware/auth.middleware.js';

// --- Import Controllers ---
import { getUserFiles } from '../controllers/item.controller.js';

router.use(generalApiLimiter); // Apply the general rate limiter to all file routes.
router.use(protect);  // Apply 'protect' middleware to all routes in this file.

router.route('/')
    .get(getUserFiles);      // Fetches all files owned by or shared with the user
    
export default router;