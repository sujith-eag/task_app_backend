import express from 'express';
import * as folderController from '../controllers/folder.controller.js';
import {
  createFolderSchema,
  moveItemSchema,
  renameFolderSchema,
  validate,
} from '../validators/file.validators.js';
import { isOwner } from '../policies/file.policies.js';
import { protect } from '../../_common/middleware/auth.middleware.js';

const router = express.Router();

// ============================================================================
// Folder Creation Routes
// ============================================================================

/**
 * @route   POST /api/folders
 * @desc    Create a new folder
 * @access  Private
 */
router.post(
  '/',
  protect,
  validate(createFolderSchema),
  folderController.createFolder
);

// ============================================================================
// Folder Information Routes
// ============================================================================

/**
 * @route   GET /api/folders/:id
 * @desc    Get folder details with statistics
 * @access  Private
 */
router.get('/:id', protect, isOwner, folderController.getFolderDetails);

// ============================================================================
// Folder Update Routes
// ============================================================================

/**
 * @route   PATCH /api/folders/:id/move
 * @desc    Move a file or folder to a new location
 * @access  Private
 */
router.patch(
  '/:id/move',
  protect,
  validate(moveItemSchema),
  isOwner,
  folderController.moveItem
);

/**
 * @route   PATCH /api/folders/:id/rename
 * @desc    Rename a folder
 * @access  Private
 */
router.patch(
  '/:id/rename',
  protect,
  validate(renameFolderSchema),
  isOwner,
  folderController.renameFolder
);

// ============================================================================
// Folder Deletion Routes
// ============================================================================

/**
 * @route   DELETE /api/folders/:id
 * @desc    Delete a folder and all its contents
 * @access  Private
 */
router.delete('/:id', protect, isOwner, folderController.deleteFolder);

export default router;
