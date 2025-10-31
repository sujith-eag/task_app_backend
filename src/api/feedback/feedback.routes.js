import express from 'express';
import studentRoutes from './routes/student.routes.js';
import teacherRoutes from './routes/teacher.routes.js';

const router = express.Router();

/**
 * Feedback Domain Routes (Phase 0)
 * 
 * Aggregates all feedback-related routes
 */

// Student routes
router.use('/student', studentRoutes);

// Teacher routes
router.use('/teacher', teacherRoutes);

export default router;
