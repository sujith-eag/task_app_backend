import express from 'express';
import { protect } from '../../_common/middleware/auth.middleware.js';
import {
  createPublicShare,
  revokePublicShare,
  shareFileWithUser,
  manageShareAccess,
  bulkRemoveShareAccess,
  shareFileWithClass,
  removeClassShare,
  getFileShares,
  getMySharedFiles,
  getFilesSharedWithMe,
} from '../controllers/shares.controller.js';
import {
  createPublicShareSchema,
  shareWithUserSchema,
  removeUserAccessSchema,
  bulkRemoveSchema,
  shareWithClassSchema,
  validate,
} from '../validators/shares.validators.js';
import {
  isFileOwner,
  canShareFile,
  canAccessPublicShare,
  validateSharePermissions,
  canViewFileShares,
  loadFile,
} from '../policies/shares.policies.js';

const router = express.Router();

// ============================================================================
// Public Share Routes
// ============================================================================

/**
 * POST /api/shares/:fileId/public
 * Create public share link with expiration
 */
router.post(
  '/:fileId/public',
  protect,
  loadFile,
  canShareFile,
  validate(createPublicShareSchema, 'body'),
  createPublicShare
);

/**
 * DELETE /api/shares/:fileId/public
 * Revoke/deactivate public share
 */
router.delete(
  '/:fileId/public',
  protect,
  loadFile,
  canAccessPublicShare,
  revokePublicShare
);

// ============================================================================
// Direct User Share Routes
// ============================================================================

/**
 * POST /api/shares/:fileId/user
 * Share file with specific user
 */
router.post(
  '/:fileId/user',
  protect,
  loadFile,
  canShareFile,
  validate(shareWithUserSchema, 'body'),
  shareFileWithUser
);

/**
 * DELETE /api/shares/:fileId/user
 * Remove user access (owner removes user OR user removes self)
 */
router.delete(
  '/:fileId/user',
  protect,
  loadFile,
  validateSharePermissions,
  validate(removeUserAccessSchema, 'body'),
  manageShareAccess
);

/**
 * POST /api/shares/bulk-remove
 * Bulk remove current user from multiple shared files
 */
router.post(
  '/bulk-remove',
  protect,
  validate(bulkRemoveSchema, 'body'),
  bulkRemoveShareAccess
);

// ============================================================================
// Class Share Routes
// ============================================================================

/**
 * POST /api/shares/:fileId/class
 * Share file with entire class (batch/semester/section)
 */
router.post(
  '/:fileId/class',
  protect,
  loadFile,
  canShareFile,
  validate(shareWithClassSchema, 'body'),
  shareFileWithClass
);

/**
 * DELETE /api/shares/:fileId/class
 * Remove class share
 */
router.delete(
  '/:fileId/class',
  protect,
  loadFile,
  isFileOwner,
  removeClassShare
);

// ============================================================================
// Query/Listing Routes
// ============================================================================
/**
 * GET /api/shares/my-shares
 * Get files owned by current user that are shared with others
 */
router.get('/my-shares', protect, getMySharedFiles);

/**
 * GET /api/shares/shared-with-me
 * Get all files shared with current user
 */
router.get('/shared-with-me', protect, getFilesSharedWithMe);

/**
 * GET /api/shares/:fileId
 * Get all shares for a specific file
 */
router.get('/:fileId', protect, loadFile, canViewFileShares, getFileShares);

export default router;
