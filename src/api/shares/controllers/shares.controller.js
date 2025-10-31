import { asyncHandler } from '../../_common/http/asyncHandler.js';
import * as sharesService from '../services/shares.service.js';

// ============================================================================
// Public Share Controllers
// ============================================================================

/**
 * @desc    Create or update a public share link
 * @route   POST /api/shares/:id/public
 * @access  Private (owner only)
 */
export const createPublicShare = asyncHandler(async (req, res) => {
  const { duration } = req.body;

  const result = await sharesService.createPublicShareService(
    req.params.id,
    req.user._id,
    duration
  );

  res.status(200).json(result);
});

/**
 * @desc    Revoke a public share link
 * @route   DELETE /api/shares/:id/public
 * @access  Private (owner only)
 */
export const revokePublicShare = asyncHandler(async (req, res) => {
  const result = await sharesService.revokePublicShareService(
    req.params.id,
    req.user._id
  );

  res.status(200).json(result);
});

// ============================================================================
// Direct Share Controllers
// ============================================================================

/**
 * @desc    Share a file with another user
 * @route   POST /api/shares/:id/user
 * @access  Private (owner only)
 */
export const shareFileWithUser = asyncHandler(async (req, res) => {
  const { userIdToShareWith, expiresAt } = req.body;

  const result = await sharesService.shareFileWithUserService(
    req.params.id,
    req.user._id,
    userIdToShareWith,
    expiresAt
  );

  res.status(200).json(result);
});

/**
 * @desc    Remove share access (owner revokes or user removes self)
 * @route   DELETE /api/shares/:id/user
 * @access  Private
 */
export const manageShareAccess = asyncHandler(async (req, res) => {
  const { userIdToRemove } = req.body;

  const result = await sharesService.manageShareAccessService(
    req.params.id,
    req.user._id,
    userIdToRemove
  );

  res.status(200).json(result);
});

/**
 * @desc    Bulk remove user from multiple file shares
 * @route   POST /api/shares/bulk-remove
 * @access  Private
 */
export const bulkRemoveShareAccess = asyncHandler(async (req, res) => {
  const { fileIds } = req.body;

  const result = await sharesService.bulkRemoveShareAccessService(
    fileIds,
    req.user._id
  );

  res.status(200).json(result);
});

// ============================================================================
// Class Share Controllers
// ============================================================================

/**
 * @desc    Share a file with a class
 * @route   POST /api/shares/:id/class
 * @access  Private (owner only, typically teachers)
 */
export const shareFileWithClass = asyncHandler(async (req, res) => {
  const { batch, semester, section, subjectId } = req.body;

  const result = await sharesService.shareFileWithClassService(
    req.params.id,
    req.user._id,
    { batch, semester, section, subjectId }
  );

  res.status(201).json(result);
});

/**
 * @desc    Remove a class share
 * @route   DELETE /api/shares/class/:shareId
 * @access  Private (owner only)
 */
export const removeClassShare = asyncHandler(async (req, res) => {
  const result = await sharesService.removeClassShareService(
    req.params.shareId,
    req.user._id
  );

  res.status(200).json(result);
});

// ============================================================================
// Share Listing Controllers
// ============================================================================

/**
 * @desc    Get all shares for a file
 * @route   GET /api/shares/:id
 * @access  Private (owner only)
 */
export const getFileShares = asyncHandler(async (req, res) => {
  const result = await sharesService.getFileSharesService(
    req.params.id,
    req.user._id
  );

  res.status(200).json(result);
});

/**
 * @desc    Get all files shared with the user
 * @route   GET /api/shares/with-me
 * @access  Private
 */
export const getFilesSharedWithMe = asyncHandler(async (req, res) => {
  const result = await sharesService.getFilesSharedWithUserService(
    req.user._id,
    req.user
  );

  res.status(200).json(result);
});
