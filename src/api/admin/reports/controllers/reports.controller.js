import asyncHandler from 'express-async-handler';
import * as reportsService from '../services/reports.service.js';

// ============================================================================
// Reports Controllers
// ============================================================================

/**
 * @desc    Get aggregated attendance statistics
 * @route   GET /api/admin/reports/attendance-stats
 * @access  Private/Admin_HOD
 */
export const getAttendanceStats = asyncHandler(async (req, res) => {
  const filters = req.query;

  const stats = await reportsService.getAttendanceStats(filters);

  res.status(200).json({
    success: true,
    count: stats.length,
    data: stats,
  });
});

/**
 * @desc    Get a comprehensive feedback report for a class session
 * @route   GET /api/admin/reports/feedback-report/:classSessionId
 * @access  Private/Admin_HOD
 */
export const getFeedbackReport = asyncHandler(async (req, res) => {
  const { classSessionId } = req.params;

  const report = await reportsService.getFeedbackReport(classSessionId);

  res.status(200).json({
    success: true,
    data: report,
  });
});

/**
 * @desc    Get aggregated feedback summary
 * @route   GET /api/admin/reports/feedback-summary
 * @access  Private/Admin_HOD
 */
export const getFeedbackSummary = asyncHandler(async (req, res) => {
  const filters = req.query;

  const summary = await reportsService.getFeedbackSummary(filters);

  res.status(200).json({
    success: true,
    count: summary.length,
    data: summary,
  });
});

/**
 * @desc    Get a detailed report for a specific teacher
 * @route   GET /api/admin/reports/teacher/:teacherId
 * @access  Private/Admin_HOD
 */
export const getTeacherReport = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const filters = req.query;

  const report = await reportsService.getTeacherReport(teacherId, filters);

  res.status(200).json({
    success: true,
    data: report,
  });
});

/**
 * @desc    Get a detailed attendance report for a specific student
 * @route   GET /api/admin/reports/student/:studentId
 * @access  Private/Admin_HOD
 */
export const getStudentReport = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  const report = await reportsService.getStudentReport(studentId);

  res.status(200).json({
    success: true,
    data: report,
  });
});
