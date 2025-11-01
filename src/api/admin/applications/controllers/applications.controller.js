import asyncHandler from 'express-async-handler';
import * as applicationsService from '../services/applications.service.js';

// ============================================================================
// Application Controllers
// ============================================================================

/**
 * @desc    Get all pending student applications
 * @route   GET /api/admin/applications
 * @access  Private/Admin
 */
export const getPendingApplications = asyncHandler(async (req, res) => {
  const applications = await applicationsService.getPendingApplications();

  res.status(200).json({
    success: true,
    count: applications.length,
    data: applications,
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
