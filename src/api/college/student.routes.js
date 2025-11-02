import express from 'express';
import { protect } from '../_common/middleware/auth.middleware.js';
import { isStudent } from '../_common/middleware/rbac.middleware.js';
import { generalApiLimiter } from '../_common/middleware/rateLimit.middleware.js';

import {
    markAttendance,
    submitFeedback,
    getStudentDashboardStats,
    getSessionsForFeedback,
    getStudentProfile,
} from './student.controller.js';

const router = express.Router();

// Apply protect and isStudent middleware to all routes in this file
router.use(protect, isStudent);

router.get('/me/profile', getStudentProfile);

router.post('/attendance/mark', generalApiLimiter, markAttendance);

router.post('/feedback', submitFeedback);

router.get('/dashboard-stats', getStudentDashboardStats);

router.get('/sessions-for-feedback', getSessionsForFeedback);

export default router;