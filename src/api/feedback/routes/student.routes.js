import express from 'express';
import studentController from '../controllers/student.controller.js';
import { authenticate } from '../../_common/middleware/auth.middleware.js';
import { authorize } from '../../_common/middleware/rbac.middleware.js';

const router = express.Router();

/**
 * Student Feedback Routes (Phase 0 - Feedback Domain)
 * 
 * All routes require authentication and student role
 */

// Middleware: Authenticate and authorize student
router.use(authenticate);
router.use(authorize('student'));

// Submit feedback
router.post('/submit', studentController.submitFeedback);

// Get pending feedback sessions
router.get('/pending', studentController.getPendingFeedbackSessions);

export default router;
