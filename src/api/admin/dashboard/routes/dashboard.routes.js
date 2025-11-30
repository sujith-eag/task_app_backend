import express from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = express.Router();

// ============================================================================
// Dashboard Routes
// ============================================================================

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get dashboard overview statistics (counts and trends)
 * @access  Private/Admin_HOD
 */
router.get('/stats', dashboardController.getDashboardStats);

/**
 * @route   GET /api/admin/dashboard/attendance-trend
 * @desc    Get attendance trend data for charts (last 7 days)
 * @access  Private/Admin_HOD
 */
router.get('/attendance-trend', dashboardController.getAttendanceTrend);

/**
 * @route   GET /api/admin/dashboard/feedback-distribution
 * @desc    Get feedback rating distribution for charts
 * @access  Private/Admin_HOD
 */
router.get('/feedback-distribution', dashboardController.getFeedbackDistribution);

/**
 * @route   GET /api/admin/dashboard/recent-activity
 * @desc    Get recent activity feed
 * @query   limit - Number of activities to return (default: 10)
 * @access  Private/Admin_HOD
 */
router.get('/recent-activity', dashboardController.getRecentActivity);

/**
 * @route   GET /api/admin/dashboard/students-by-semester
 * @desc    Get student distribution by semester
 * @access  Private/Admin_HOD
 */
router.get('/students-by-semester', dashboardController.getStudentsBySemester);

export default router;
