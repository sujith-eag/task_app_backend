import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { isStudent } from '../middleware/roleMiddleware.js';
import {
    markAttendance,
    submitFeedback,
    getStudentDashboardStats
} from '../controllers/student.controller.js';
import { generalApiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply protect and isStudent middleware to all routes in this file
router.use(protect, isStudent);

router.post('/attendance/mark', generalApiLimiter, markAttendance);

router.post('/feedback', submitFeedback);

router.get('/dashboard-stats', getStudentDashboardStats);

export default router;