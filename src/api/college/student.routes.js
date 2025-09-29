import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { isStudent } from '../../middleware/role.middleware.js';
import { generalApiLimiter } from '../../middleware/rateLimiter.middleware.js';

import {
    markAttendance,
    submitFeedback,
    getStudentDashboardStats
} from './student.controller.js';

const router = express.Router();

// Apply protect and isStudent middleware to all routes in this file
router.use(protect, isStudent);

router.post('/attendance/mark', generalApiLimiter, markAttendance);

router.post('/feedback', submitFeedback);

router.get('/dashboard-stats', getStudentDashboardStats);

export default router;