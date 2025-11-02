import express from 'express';
import * as fileController from '../controllers/file.controller.js';
import {
  uploadFilesSchema,
  bulkFileIdsSchema,
  listFilesSchema,
  validate,
} from '../validators/file.validators.js';
import {
  canUploadToFolder,
  hasReadAccess,
  isOwner,
} from '../policies/file.policies.js';
import { protect } from '../../_common/middleware/auth.middleware.js';
import { checkStorageQuota } from '../../_common/middleware/quota.middleware.js';
import { uploadFiles } from '../../_common/middleware/file.middleware.js';

const router = express.Router();

// ============================================================================
// File Upload Routes
// ============================================================================

/**
 * @route   POST /api/files/upload
 * @desc    Upload one or more files
 * @access  Private
 */
router.post(
  '/upload',
  protect,
  uploadFiles, // Max 10 files at once (configured in middleware)
  validate(uploadFilesSchema),
  canUploadToFolder,
  checkStorageQuota,
  fileController.uploadFiles
);

// ============================================================================
// File Listing Routes
// ============================================================================

/**
 * @route   GET /api/files
 * @desc    Get all files/folders for user in a directory
 * @access  Private
 */
router.get(
  '/',
  protect,
  validate(listFilesSchema, 'query'),
  fileController.getUserFiles
);

// ============================================================================
// File Download Routes
// ============================================================================

/**
 * @route   GET /api/files/:id/download
 * @desc    Get download link for a file
 * @access  Private
 */
router.get(
  '/:id/download',
  protect,
  hasReadAccess,
  fileController.getDownloadLink
);

/**
 * @route   GET /api/files/downloads/:id/preview
 * @desc    Get preview link (inline) for a file
 * @access  Private
 */
router.get(
  '/downloads/:id/preview',
  protect,
  hasReadAccess,
  fileController.getPreviewLink
);

/**
 * @route   GET /api/files/search
 * @desc    Search files by query
 * @access  Private
 */
router.get('/search', protect, fileController.searchFiles);

/**
 * @route   POST /api/files/folders/:id/download
 * @desc    Create an async folder download job (stub)
 * @access  Private
 */
router.post('/folders/:id/download', protect, fileController.downloadFolderAsZip);

/**
 * @route   POST /api/files/bulk-download
 * @desc    Download multiple files as zip
 * @access  Private
 */
router.post(
  '/bulk-download',
  protect,
  fileController.bulkDownloadFiles
);

// ============================================================================
// File Deletion Routes (Temporary - will be replaced by trash)
// ============================================================================

/**
 * @route   DELETE /api/files/:id
 * @desc    Delete a single file
 * @access  Private
 */
router.delete('/:id', protect, isOwner, fileController.deleteFile);

/**
 * @route   DELETE /api/files
 * @desc    Delete multiple files
 * @access  Private
 */
router.delete(
  '/',
  protect,
  validate(bulkFileIdsSchema),
  fileController.bulkDeleteFiles
);

export default router;
