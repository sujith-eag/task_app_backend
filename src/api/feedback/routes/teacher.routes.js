import express from 'express';
import teacherController from '../controllers/teacher.controller.js';
import { authenticate } from '../../_common/middleware/auth.middleware.js';
import { authorize } from '../../_common/middleware/rbac.middleware.js';

const router = express.Router();

/**
 * Teacher Feedback Routes (Phase 0 - Feedback Domain)
 * 
 * All routes require authentication and teacher role
 */

// Middleware: Authenticate and authorize teacher
router.use(authenticate);
router.use(authorize('teacher'));

// Feedback summary for session
router.get('/sessions/:sessionId/summary', teacherController.getFeedbackSummary);

// Feedback statistics
router.get('/stats', teacherController.getFeedbackStats);

// Session reflections
router.post('/sessions/:sessionId/reflection', teacherController.upsertReflection);
router.get('/sessions/:sessionId/reflection', teacherController.getReflection);
router.delete('/sessions/:sessionId/reflection', teacherController.deleteReflection);

// Reflection management
router.get('/reflections/pending', teacherController.getPendingReflections);
router.get('/reflections/history', teacherController.getReflectionHistory);
router.get('/reflections/analytics', teacherController.getReflectionAnalytics);

export default router;
