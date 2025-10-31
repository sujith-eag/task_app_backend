import express from 'express';
import teacherRoutes from './routes/teacher.routes.js';
import studentRoutes from './routes/student.routes.js';
import statsRoutes from './routes/stats.routes.js';

const router = express.Router();

/**
 * Attendance Domain Routes (Phase 0)
 * 
 * Aggregates all attendance-related routes
 */

// Teacher routes
router.use('/teacher', teacherRoutes);

// Student routes
router.use('/student', studentRoutes);

// Stats routes
router.use('/stats', statsRoutes);

export default router;
