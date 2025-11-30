/**
 * Admin Module - Main Router
 * 
 * This is the parent router that mounts all admin sub-domain routers.
 * Each sub-domain is self-contained with its own controllers, services, and validators.
 * 
 * Sub-domains:
 * - /applications      - Student application reviews and approvals (Admin only)
 * - /management        - User management, promotions, teacher/student CRUD (Admin only)
 * - /teacher-assignments - Teacher-subject-class assignments (Admin only)
 * - /subjects          - Subject CRUD and management (Admin only)
 * - /reports           - Statistics, reports, and analytics (Admin & HOD)
 * - /dashboard         - Dashboard statistics and charts (Admin & HOD)
 */

import express from 'express';
import { protect } from '../../_common/middleware/auth.middleware.js';
import { isAdmin, isAdminOrHOD } from '../../_common/middleware/rbac.middleware.js';

// Import sub-domain routers
import applicationsRoutes from '../applications/routes/applications.routes.js';
import managementRoutes from '../management/routes/management.routes.js';
import teacherAssignmentsRoutes from '../teacher-assignments/routes/teacher-assignments.routes.js';
import subjectsRoutes from '../subjects/routes/subjects.routes.js';
import reportsRoutes from '../reports/routes/reports.routes.js';
import dashboardRoutes from '../dashboard/routes/dashboard.routes.js';

const router = express.Router();

// Apply authentication to all admin routes
router.use(protect);

// ========================================
// ADMIN SUB-DOMAIN ROUTES
// ========================================

/**
 * Dashboard Statistics
 * Provides overview stats, charts data, and activity feeds
 * Access: Admin & HOD
 */
router.use('/dashboard', isAdminOrHOD, dashboardRoutes);

/**
 * Applications Management
 * Handles student application reviews and approvals
 * Access: Admin only
 */
router.use('/applications', isAdmin, applicationsRoutes);

/**
 * User Management
 * Handles user promotions, teacher/student CRUD operations
 * Access: Admin only
 */
router.use('/management', isAdmin, managementRoutes);

/**
 * Teacher Assignments
 * Manages teacher-to-subject-to-class assignments
 * Access: Admin only
 */
router.use('/teacher-assignments', isAdmin, teacherAssignmentsRoutes);

/**
 * Subject Management
 * Handles subject CRUD operations
 * Access: Admin only
 */
router.use('/subjects', isAdmin, subjectsRoutes);

/**
 * Reports & Analytics
 * Provides attendance statistics, feedback reports, and analytics
 * Access: Admin & HOD (Head of Department)
 */
router.use('/reports', isAdminOrHOD, reportsRoutes);

export default router;
