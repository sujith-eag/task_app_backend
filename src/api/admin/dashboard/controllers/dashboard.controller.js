import asyncHandler from 'express-async-handler';
import * as dashboardService from '../services/dashboard.service.js';

// ============================================================================
// Dashboard Controllers
// ============================================================================

/**
 * @desc    Get dashboard overview statistics
 * @route   GET /api/admin/dashboard/stats
 * @access  Private/Admin_HOD
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getDashboardStats();

  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * @desc    Get attendance trend data for charts
 * @route   GET /api/admin/dashboard/attendance-trend
 * @access  Private/Admin_HOD
 */
export const getAttendanceTrend = asyncHandler(async (req, res) => {
  const trend = await dashboardService.getAttendanceTrend();

  res.status(200).json({
    success: true,
    data: trend,
  });
});

/**
 * @desc    Get feedback rating distribution
 * @route   GET /api/admin/dashboard/feedback-distribution
 * @access  Private/Admin_HOD
 */
export const getFeedbackDistribution = asyncHandler(async (req, res) => {
  const distribution = await dashboardService.getFeedbackDistribution();

  res.status(200).json({
    success: true,
    data: distribution,
  });
});

/**
 * @desc    Get recent activity feed
 * @route   GET /api/admin/dashboard/recent-activity
 * @access  Private/Admin_HOD
 */
export const getRecentActivity = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const activities = await dashboardService.getRecentActivity(limit);

  res.status(200).json({
    success: true,
    count: activities.length,
    data: activities,
  });
});

/**
 * @desc    Get student distribution by semester
 * @route   GET /api/admin/dashboard/students-by-semester
 * @access  Private/Admin_HOD
 */
export const getStudentsBySemester = asyncHandler(async (req, res) => {
  const distribution = await dashboardService.getStudentsBySemester();

  res.status(200).json({
    success: true,
    data: distribution,
  });
});
