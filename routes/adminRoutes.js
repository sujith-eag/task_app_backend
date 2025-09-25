import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/roleMiddleware.js';
import { 
    getPendingApplications,
    reviewApplication,
    promoteToFaculty
} from '../controllers/adminController.js';

const router = express.Router();

// Apply protect and isAdmin middleware to all routes in this file
router.use(protect, isAdmin);

// --- Student Application Management ---
router.route('/applications')
    .get(getPendingApplications);

router.route('/applications/:userId/review')
    .patch(reviewApplication);

// --- User Role Management ---
router.route('/users/:userId/promote')
    .patch(promoteToFaculty);

export default router;