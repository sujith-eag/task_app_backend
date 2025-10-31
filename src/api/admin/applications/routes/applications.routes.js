import express from 'express';
import * as applicationsController from '../controllers/applications.controller.js';
import {
  validate,
  reviewApplicationSchema,
  userIdParamSchema,
} from '../validators/applications.validator.js';

const router = express.Router();

// ============================================================================
// Application Routes
// ============================================================================

/**
 * @route   GET /api/admin/applications
 * @desc    Get all pending student applications
 * @access  Private/Admin
 */
router.get('/', applicationsController.getPendingApplications);

/**
 * @route   PATCH /api/admin/applications/:userId/review
 * @desc    Review student application (approve/reject)
 * @access  Private/Admin
 */
router.patch(
  '/:userId/review',
  validate(userIdParamSchema, 'params'),
  validate(reviewApplicationSchema, 'body'),
  applicationsController.reviewApplication
);

export default router;
