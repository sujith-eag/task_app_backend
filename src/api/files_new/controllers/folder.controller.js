import { asyncHandler } from '../../_common/http/asyncHandler.js';
import * as folderService from '../services/folder.service.js';

// ============================================================================
// Folder Creation Controllers
// ============================================================================

/**
 * @desc    Create a new folder
 * @route   POST /api/folders
 * @access  Private
 */
export const createFolder = asyncHandler(async (req, res) => {
  const { folderName, parentId } = req.body;

  const result = await folderService.createFolderService(
    folderName,
    req.user._id,
    parentId
  );

  res.status(201).json(result);
});

// ============================================================================
// Folder Deletion Controllers
// ============================================================================

/**
 * @desc    Delete a folder and all its contents
 * @route   DELETE /api/folders/:id
 * @access  Private
 */
export const deleteFolder = asyncHandler(async (req, res) => {
  const result = await folderService.deleteFolderService(
    req.params.id,
    req.user._id
  );

  res.status(200).json(result);
});

// ============================================================================
// Folder Move Controllers
// ============================================================================

/**
 * @desc    Move a file or folder to a new location
 * @route   PATCH /api/folders/:id/move
 * @access  Private
 */
export const moveItem = asyncHandler(async (req, res) => {
  const { newParentId } = req.body;

  const result = await folderService.moveItemService(
    req.params.id,
    req.user._id,
    newParentId
  );

  res.status(200).json(result);
});

// ============================================================================
// Folder Information Controllers
// ============================================================================

/**
 * @desc    Get folder details with statistics
 * @route   GET /api/folders/:id
 * @access  Private
 */
export const getFolderDetails = asyncHandler(async (req, res) => {
  const result = await folderService.getFolderDetailsService(
    req.params.id,
    req.user._id
  );

  res.status(200).json(result);
});

/**
 * @desc    Rename a folder
 * @route   PATCH /api/folders/:id/rename
 * @access  Private
 */
export const renameFolder = asyncHandler(async (req, res) => {
  const { newName } = req.body;

  const result = await folderService.renameFolderService(
    req.params.id,
    req.user._id,
    newName
  );

  res.status(200).json(result);
});
