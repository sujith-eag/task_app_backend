import express from 'express';
import * as reportsController from '../controllers/reports.controller.js';

const router = express.Router();

// ============================================================================
// Reports Routes
// ============================================================================

/**
 * @route   GET /api/admin/reports/attendance-stats
 * @desc    Get aggregated attendance statistics
 * @query   teacherId, subjectId, semester (all optional)
 * @access  Private/Admin_HOD
 */
router.get('/attendance-stats', reportsController.getAttendanceStats);

/**
 * @route   GET /api/admin/reports/feedback-summary
 * @desc    Get aggregated feedback summary
 * @query   teacherId, subjectId, semester (all optional)
 * @access  Private/Admin_HOD
 */
router.get('/feedback-summary', reportsController.getFeedbackSummary);

/**
 * @route   GET /api/admin/reports/feedback-report/:classSessionId
 * @desc    Get a comprehensive feedback report for a class session
 * @access  Private/Admin_HOD
 */
router.get('/feedback-report/:classSessionId', reportsController.getFeedbackReport);

/**
 * @route   GET /api/admin/reports/teacher/:teacherId
 * @desc    Get a detailed report for a specific teacher
 * @query   subjectId, semester (optional filters)
 * @access  Private/Admin_HOD
 */
router.get('/teacher/:teacherId', reportsController.getTeacherReport);

/**
 * @route   GET /api/admin/reports/student/:studentId
 * @desc    Get a detailed attendance report for a specific student
 * @access  Private/Admin_HOD
 */
router.get('/student/:studentId', reportsController.getStudentReport);

export default router;
