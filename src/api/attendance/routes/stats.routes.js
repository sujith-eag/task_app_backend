import express from 'express';
import statsController from '../controllers/stats.controller.js';
import { authenticate } from '../../../middleware/auth.middleware.js';
import { authorize } from '../../../middleware/role.middleware.js';

const router = express.Router();

/**
 * Stats Routes (Phase 0 - Attendance Domain)
 * 
 * All routes require authentication and teacher role
 */

// Middleware: Authenticate and authorize teacher
router.use(authenticate);
router.use(authorize('teacher'));

// Class statistics
router.get('/class', statsController.getClassStats);

// Session summary
router.get('/session/:sessionId', statsController.getSessionSummary);

// Low attendance students
router.get('/low-attendance', statsController.getLowAttendanceStudents);

// Export attendance data
router.get('/export', statsController.exportAttendanceData);

export default router;
