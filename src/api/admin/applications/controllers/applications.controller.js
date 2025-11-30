import asyncHandler from 'express-async-handler';
import * as applicationsService from '../services/applications.service.js';

// ============================================================================
// Application Controllers
// ============================================================================

/**
 * @desc    Get all pending student applications with pagination
 * @route   GET /api/admin/applications?page=1&limit=20&search=john
 * @access  Private/Admin
 */
export const getPendingApplications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;

  const result = await applicationsService.getPendingApplications({
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
    search,
  });

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

/**
 * @desc    Review student application (approve/reject)
 * @route   PATCH /api/admin/applications/:userId/review
 * @access  Private/Admin
 */
export const reviewApplication = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { action } = req.body;

  const result = await applicationsService.reviewApplication(userId, action, req.user, req);

  res.status(200).json({
    success: true,
    data: result,
  });
});
