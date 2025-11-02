import express from 'express';
import teacherController from '../controllers/teacher.controller.js';
import { authenticate } from '../../_common/middleware/auth.middleware.js';
import { authorize } from '../../_common/middleware/rbac.middleware.js';

const router = express.Router();

/**
 * Teacher Routes (Phase 0 - Attendance Domain)
 * 
 * All routes require authentication and teacher role
 */

// Middleware: Authenticate and authorize teacher
router.use(authenticate);
router.use(authorize('teacher'));

// Get class creation data (assigned subjects)
router.get('/class-data', teacherController.getClassCreationData);

// Session management
router.post('/sessions', teacherController.createSession);
router.get('/active-session', teacherController.getActiveSession);
router.get('/sessions/:sessionId/roster', teacherController.getSessionRoster);
router.post('/sessions/:sessionId/finalize', teacherController.finalizeSession);
router.post('/sessions/:sessionId/regenerate-code', teacherController.regenerateCode);
router.delete('/sessions/:sessionId', teacherController.deleteSession);

// Attendance management
router.patch('/records/:recordId', teacherController.updateAttendanceRecord);
router.patch('/records/bulk', teacherController.bulkUpdateAttendance);

// Session history
router.get('/history', teacherController.getSessionHistory);

export default router;
