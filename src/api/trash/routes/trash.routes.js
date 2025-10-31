import express from 'express';
import { protect } from '../../../middleware/auth.middleware.js';
import {
  softDeleteFile,
  bulkSoftDelete,
  restoreFile,
  bulkRestore,
  purgeFile,
  bulkPurge,
  emptyTrash,
  listTrash,
  getTrashStats,
  cleanExpiredTrash,
  adminHardDelete
} from '../controllers/trash.controller.js';
import {
  bulkOperationSchema,
  cleanupSchema,
  validate
} from '../validators/trash.validators.js';
import {
  loadFile,
  isFileOwner,
  isInTrash,
  isNotInTrash,
  isAdmin,
  validateParentForRestore,
  bulkOperationLimit,
  validateCleanup
} from '../policies/trash.policies.js';

const router = express.Router();

// ============================================================================
// Soft Delete Routes
// ============================================================================

/**
 * DELETE /api/trash/soft-delete/:fileId
 * Move file/folder to trash (soft delete)
 */
router.delete(
  '/soft-delete/:fileId',
  protect,
  loadFile,
  isFileOwner,
  isNotInTrash,
  softDeleteFile
);

/**
 * POST /api/trash/soft-delete/bulk
 * Bulk move files/folders to trash
 */
router.post(
  '/soft-delete/bulk',
  protect,
  validate(bulkOperationSchema, 'body'),
  bulkOperationLimit,
  bulkSoftDelete
);

// ============================================================================
// Restore Routes
// ============================================================================

/**
 * POST /api/trash/restore/:fileId
 * Restore file/folder from trash
 */
router.post(
  '/restore/:fileId',
  protect,
  loadFile,
  isFileOwner,
  isInTrash,
  validateParentForRestore,
  restoreFile
);

/**
 * POST /api/trash/restore/bulk
 * Bulk restore files/folders from trash
 */
router.post(
  '/restore/bulk',
  protect,
  validate(bulkOperationSchema, 'body'),
  bulkOperationLimit,
  bulkRestore
);

// ============================================================================
// Permanent Delete (Purge) Routes
// ============================================================================

/**
 * DELETE /api/trash/purge/:fileId
 * Permanently delete file/folder (must be in trash)
 */
router.delete(
  '/purge/:fileId',
  protect,
  loadFile,
  isFileOwner,
  isInTrash,
  purgeFile
);

/**
 * POST /api/trash/purge/bulk
 * Bulk permanently delete files/folders
 */
router.post(
  '/purge/bulk',
  protect,
  validate(bulkOperationSchema, 'body'),
  bulkOperationLimit,
  bulkPurge
);

/**
 * DELETE /api/trash/empty
 * Empty entire trash (permanent delete all)
 */
router.delete('/empty', protect, emptyTrash);

// ============================================================================
// Query/List Routes
// ============================================================================

/**
 * GET /api/trash
 * List all items in trash
 */
router.get('/', protect, listTrash);

/**
 * GET /api/trash/stats
 * Get trash statistics
 */
router.get('/stats', protect, getTrashStats);

// ============================================================================
// Admin/Maintenance Routes
// ============================================================================

/**
 * POST /api/trash/cleanup
 * Clean up old trash items (admin or scheduled job)
 */
router.post(
  '/cleanup',
  protect,
  isAdmin,
  validate(cleanupSchema, 'body'),
  validateCleanup,
  cleanExpiredTrash
);

/**
 * DELETE /api/trash/admin/hard-delete/:fileId
 * Admin hard delete (bypass soft-delete)
 */
router.delete(
  '/admin/hard-delete/:fileId',
  protect,
  isAdmin,
  loadFile,
  adminHardDelete
);

export default router;
