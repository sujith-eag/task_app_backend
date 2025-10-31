import asyncHandler from 'express-async-handler';
import {
  softDeleteFileService,
  bulkSoftDeleteService,
  restoreFileService,
  bulkRestoreService,
  purgeFileService,
  bulkPurgeService,
  emptyTrashService,
  listTrashService,
  getTrashStatsService,
  cleanExpiredTrashService,
  adminHardDeleteService
} from '../services/trash.service.js';

// ============================================================================
// Soft Delete Controllers
// ============================================================================

/**
 * Soft delete a file or folder
 * @route DELETE /api/trash/soft-delete/:fileId
 */
export const softDeleteFile = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user._id;

  const result = await softDeleteFileService(fileId, userId);

  res.status(200).json(result);
});

/**
 * Bulk soft delete multiple files/folders
 * @route POST /api/trash/soft-delete/bulk
 */
export const bulkSoftDelete = asyncHandler(async (req, res) => {
  const { fileIds } = req.body;
  const userId = req.user._id;

  const result = await bulkSoftDeleteService(fileIds, userId);

  res.status(200).json(result);
});

// ============================================================================
// Restore Controllers
// ============================================================================

/**
 * Restore a soft-deleted file or folder
 * @route POST /api/trash/restore/:fileId
 */
export const restoreFile = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user._id;

  const result = await restoreFileService(fileId, userId);

  res.status(200).json(result);
});

/**
 * Bulk restore multiple files/folders
 * @route POST /api/trash/restore/bulk
 */
export const bulkRestore = asyncHandler(async (req, res) => {
  const { fileIds } = req.body;
  const userId = req.user._id;

  const result = await bulkRestoreService(fileIds, userId);

  res.status(200).json(result);
});

// ============================================================================
// Permanent Delete (Purge) Controllers
// ============================================================================

/**
 * Permanently delete a file (must be in trash first)
 * @route DELETE /api/trash/purge/:fileId
 */
export const purgeFile = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user._id;

  const result = await purgeFileService(fileId, userId);

  res.status(200).json(result);
});

/**
 * Bulk permanently delete multiple files
 * @route POST /api/trash/purge/bulk
 */
export const bulkPurge = asyncHandler(async (req, res) => {
  const { fileIds } = req.body;
  const userId = req.user._id;

  const result = await bulkPurgeService(fileIds, userId);

  res.status(200).json(result);
});

/**
 * Empty entire trash (permanent delete all)
 * @route DELETE /api/trash/empty
 */
export const emptyTrash = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await emptyTrashService(userId);

  res.status(200).json(result);
});

// ============================================================================
// Query/List Controllers
// ============================================================================

/**
 * List all items in trash
 * @route GET /api/trash
 */
export const listTrash = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await listTrashService(userId);

  res.status(200).json(result);
});

/**
 * Get trash statistics
 * @route GET /api/trash/stats
 */
export const getTrashStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await getTrashStatsService(userId);

  res.status(200).json(stats);
});

// ============================================================================
// Maintenance Controllers
// ============================================================================

/**
 * Clean up old trash items (admin/scheduled job)
 * @route POST /api/trash/cleanup
 */
export const cleanExpiredTrash = asyncHandler(async (req, res) => {
  const { retentionDays = 30 } = req.body;

  const result = await cleanExpiredTrashService(retentionDays);

  res.status(200).json(result);
});

/**
 * Admin hard delete (bypass soft-delete)
 * @route DELETE /api/trash/admin/hard-delete/:fileId
 */
export const adminHardDelete = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const adminUserId = req.user._id;

  const result = await adminHardDeleteService(fileId, adminUserId);

  res.status(200).json(result);
});
