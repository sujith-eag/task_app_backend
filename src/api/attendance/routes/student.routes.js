import express from 'express';
import studentController from '../controllers/student.controller.js';
import { authenticate } from '../../_common/middleware/auth.middleware.js';
import { authorize } from '../../_common/middleware/rbac.middleware.js';

const router = express.Router();

/**
 * Student Routes (Phase 0 - Attendance Domain)
 * 
 * All routes require authentication and student role
 */

// Middleware: Authenticate and authorize student
router.use(authenticate);
router.use(authorize('student'));

// Mark attendance
router.post('/mark', studentController.markAttendance);

// Get active sessions
router.get('/active-sessions', studentController.getActiveSessions);

// Get attendance statistics
router.get('/stats', studentController.getAttendanceStats);
router.get('/stats/:subjectId', studentController.getSubjectStats);
router.get('/trend', studentController.getAttendanceTrend);

// Get profile with attendance
router.get('/profile', studentController.getProfile);

export default router;
