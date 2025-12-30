import express from 'express';
import { protect } from '../../_common/middleware/auth.middleware.js';
import { isTeacher, isStudent } from '../../_common/middleware/rbac.middleware.js';
import {
  createPublicShare,
  revokePublicShare,
  shareFileWithUser,
  manageShareAccess,
  bulkRemoveShareAccess,
  shareFileWithClass,
  removeClassShare,
  getFileClassShares,
  getClassMaterials,
  updateClassShareExpiration,
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
  removeClassShareSchema,
  updateClassShareExpirationSchema,
  getClassMaterialsSchema,
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
 * Share file/folder with one or multiple classes
 * Body: { classShares: [...], description?: string }
 */
router.post(
  '/:fileId/class',
  protect,
  isTeacher, // Only teachers can share with classes
  loadFile,
  canShareFile,
  validate(shareWithClassSchema, 'body'),
  shareFileWithClass
);

/**
 * GET /api/shares/:fileId/class
 * Get all class shares for a file (teacher view)
 */
router.get(
  '/:fileId/class',
  protect,
  isTeacher,
  loadFile,
  isFileOwner,
  getFileClassShares
);

/**
 * DELETE /api/shares/:fileId/class
 * Remove one or more class shares for a file
 * Body: { classFilters?: [...] } - empty array removes all
 */
router.delete(
  '/:fileId/class',
  protect,
  isTeacher,
  loadFile,
  isFileOwner,
  validate(removeClassShareSchema, 'body'),
  removeClassShare
);

/**
 * GET /api/shares/class-materials
 * Get all files/materials shared with student's class
 * Query: ?subjectId=xxx (optional filter)
 */
router.get(
  '/class-materials',
  protect,
  isStudent, // Only students can access this
  validate(getClassMaterialsSchema, 'query'),
  getClassMaterials
);

/**
 * PATCH /api/shares/class/:shareId/expiration
 * Update expiration date for a specific class share
 * Body: { expiresAt: Date | null }
 */
router.patch(
  '/class/:shareId/expiration',
  protect,
  isTeacher,
  validate(updateClassShareExpirationSchema, 'body'),
  updateClassShareExpiration
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
