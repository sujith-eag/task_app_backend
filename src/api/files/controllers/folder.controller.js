import asyncHandler from '../../_common/http/asyncHandler.js';
import * as folderService from '../services/folder.service.js';
import * as fileService from '../services/file.service.js';

// ============================================================================
// Folder Creation Controllers
// ============================================================================

/**
 * @desc    Create a new folder
 * @route   POST /api/folders
 * @access  Private
 */
export const createFolder = asyncHandler(async (req, res) => {
  const { folderName, parentId } = req.body || {};

  if (!folderName || typeof folderName !== 'string') {
    res.status(400);
    throw new Error('folderName is required to create a folder.');
  }

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
  const { newParentId } = req.body || {};

  // newParentId may be null (root) but req.body must be an object
  if (typeof req.body === 'undefined') {
    res.status(400);
    throw new Error('Request body is required and must include newParentId (can be null).');
  }

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
    req.user._id,
    req.user
  );

  res.status(200).json(result);
});

/**
 * @desc    Rename a folder
 * @route   PATCH /api/folders/:id/rename
 * @access  Private
 */
export const renameFolder = asyncHandler(async (req, res) => {
  // Accept several common field names from clients for robustness: newName, name, folderName
  const body = req.body || {};
  const newName = body.newName || body.name || body.folderName;

  if (!newName || typeof newName !== 'string') {
    res.status(400);
    throw new Error('newName (string) is required to rename a folder. Expected one of: newName, name, folderName.');
  }

  try {
    const result = await folderService.renameFolderService(
      req.params.id,
      req.user._id,
      newName
    );

    return res.status(200).json(result);
  } catch (err) {
    // If the target is not a folder, attempt to rename as a file instead
    // IMPROVED: Use error code instead of regex for reliable detection
    if (err?.code === 'FOLDER_NOT_FOUND') {
      const result = await fileService.renameFileService(req.params.id, req.user._id, newName);
      return res.status(200).json(result);
    }
    // Re-throw original error
    throw err;
  }
});
