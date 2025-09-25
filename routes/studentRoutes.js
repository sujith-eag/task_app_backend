import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { isStudent } from '../middleware/roleMiddleware.js';
import {
    markAttendance,
    submitFeedback,
    getStudentDashboardStats
} from '../controllers/studentController.js';
import { generalApiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply protect and isStudent middleware to all routes in this file
router.use(protect, isStudent);

// --- Routes ---

// A stricter rate limit can be applied here to prevent code spamming
router.post('/attendance/mark', generalApiLimiter, markAttendance);

router.post('/feedback', submitFeedback);

router.get('/dashboard-stats', getStudentDashboardStats);

export default router;