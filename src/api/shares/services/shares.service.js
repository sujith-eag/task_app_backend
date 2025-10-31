import crypto from 'crypto';
import FileShare from '../../../models/fileshareModel.js';
import File from '../../../models/fileModel.js';
import User from '../../../models/userModel.js';

// ============================================================================
// Public Share Service
// ============================================================================

/**
 * Create or update a public share link for a file
 * 
 * @param {string} fileId - File ID
 * @param {string} userId - User ID (must be owner)
 * @param {string} duration - Duration string ('1-hour', '1-day', '7-days')
 * @returns {Promise<Object>} Public share details
 */
export const createPublicShareService = async (fileId, userId, duration) => {
  // Verify file ownership
  const file = await File.findOne({ _id: fileId, user: userId });
  if (!file) {
    throw new Error('File not found or you do not have permission.');
  }

  // Calculate expiration
  let expiresAt = new Date();
  switch (duration) {
    case '1-hour':
      expiresAt.setHours(expiresAt.getHours() + 1);
      break;
    case '1-day':
      expiresAt.setDate(expiresAt.getDate() + 1);
      break;
    case '7-days':
      expiresAt.setDate(expiresAt.getDate() + 7);
      break;
    default:
      throw new Error('Invalid duration specified.');
  }

  // Check if public share already exists
  let publicShare = await FileShare.findOne({
    file: fileId,
    shareType: 'public',
  });

  if (publicShare) {
    // Update existing share
    publicShare.isActive = true;
    publicShare.expiresAt = expiresAt;
    await publicShare.save();
  } else {
    // Create new public share
    const code = crypto.randomBytes(4).toString('hex'); // 8-character hex

    publicShare = await FileShare.create({
      file: fileId,
      owner: userId,
      shareType: 'public',
      publicCode: code,
      isActive: true,
      expiresAt,
      createdBy: userId,
    });
  }

  return {
    code: publicShare.publicCode,
    isActive: publicShare.isActive,
    expiresAt: publicShare.expiresAt,
  };
};

/**
 * Revoke a public share link
 * 
 * @param {string} fileId - File ID
 * @param {string} userId - User ID (must be owner)
 * @returns {Promise<Object>} Success message
 */
export const revokePublicShareService = async (fileId, userId) => {
  // Verify file ownership
  const file = await File.findOne({ _id: fileId, user: userId });
  if (!file) {
    throw new Error('File not found or you do not have permission.');
  }

  // Find and deactivate public share
  const publicShare = await FileShare.findOne({
    file: fileId,
    shareType: 'public',
  });

  if (!publicShare) {
    return { message: 'No public share found for this file.' };
  }

  await publicShare.deactivate();

  return {
    message: 'Public share link has been revoked.',
    publicShare: {
      code: publicShare.publicCode,
      isActive: publicShare.isActive,
    },
  };
};

/**
 * Get public download link using share code
 * 
 * @param {string} code - Public share code
 * @returns {Promise<Object>} File details and download URL
 */
export const getPublicDownloadLinkService = async (code) => {
  if (!code) {
    throw new Error('Share code is required.');
  }

  // Find valid public share
  const publicShare = await FileShare.findValidPublicShare(code.trim());

  if (!publicShare) {
    throw new Error('Invalid or expired share code.');
  }

  // Record access
  await publicShare.recordAccess();

  // Generate download URL using S3 service
  const { getDownloadUrl } = await import('../../../services/s3/s3.service.js');
  const downloadUrl = await getDownloadUrl(
    publicShare.file.s3Key,
    publicShare.file.fileName
  );

  return {
    file: {
      _id: publicShare.file._id,
      fileName: publicShare.file.fileName,
      fileType: publicShare.file.fileType,
      size: publicShare.file.size,
    },
    owner: {
      name: publicShare.owner.name,
      avatar: publicShare.owner.avatar,
    },
    url: downloadUrl,
  };
};

// ============================================================================
// Direct Share Service
// ============================================================================

/**
 * Share a file with another user
 * 
 * @param {string} fileId - File ID
 * @param {string} userId - Owner user ID
 * @param {string} userIdToShareWith - Target user ID
 * @param {Date|null} expiresAt - Optional expiration date
 * @returns {Promise<Object>} Updated file with shares
 */
export const shareFileWithUserService = async (
  fileId,
  userId,
  userIdToShareWith,
  expiresAt = null
) => {
  // Fetch file and target user in parallel
  const [file, userToShareWith] = await Promise.all([
    File.findById(fileId),
    User.findById(userIdToShareWith),
  ]);

  if (!file) {
    throw new Error('File not found.');
  }

  // Verify ownership
  if (file.user.toString() !== userId) {
    const error = new Error('You do not have permission to share this file.');
    error.statusCode = 403;
    throw error;
  }

  // Verify target user exists
  if (!userToShareWith) {
    throw new Error('User to share with not found.');
  }

  // Prevent self-sharing
  if (userIdToShareWith === userId) {
    const error = new Error('You cannot share a file with yourself.');
    error.statusCode = 400;
    throw error;
  }

  // Check recipient's preferences
  if (!userToShareWith.preferences?.canRecieveFiles) {
    const error = new Error(
      'This user is not accepting shared files at the moment.'
    );
    error.statusCode = 403;
    throw error;
  }

  // Check if already shared
  const existingShare = await FileShare.findOne({
    file: fileId,
    shareType: 'direct',
    sharedWith: userIdToShareWith,
  });

  if (existingShare) {
    const error = new Error('File is already shared with this user.');
    error.statusCode = 400;
    throw error;
  }

  // Create direct share
  await FileShare.create({
    file: fileId,
    owner: userId,
    shareType: 'direct',
    sharedWith: userIdToShareWith,
    expiresAt,
    createdBy: userId,
  });

  // Return file with populated shares
  const updatedFile = await File.findById(fileId)
    .populate('user', 'name avatar');

  const shares = await FileShare.findByFile(fileId);

  return { file: updatedFile, shares };
};

/**
 * Remove share access (owner revokes or user removes self)
 * 
 * @param {string} fileId - File ID
 * @param {string} userId - Current user ID
 * @param {string|null} userIdToRemove - Target user ID (for owner) or null (for self-removal)
 * @returns {Promise<Object>} Updated file with shares
 */
export const manageShareAccessService = async (
  fileId,
  userId,
  userIdToRemove = null
) => {
  const file = await File.findById(fileId);

  if (!file) {
    throw new Error('File not found.');
  }

  const isOwner = file.user.toString() === userId;
  let targetUserId = null;

  if (isOwner && userIdToRemove) {
    // Owner revoking access
    targetUserId = userIdToRemove;
  } else if (!isOwner && !userIdToRemove) {
    // User removing themselves
    targetUserId = userId;
  } else if (isOwner && !userIdToRemove) {
    const error = new Error(
      'Owner must specify a userIdToRemove when revoking access.'
    );
    error.statusCode = 400;
    throw error;
  } else {
    const error = new Error('You do not have permission to perform this action.');
    error.statusCode = 403;
    throw error;
  }

  // Delete the share
  await FileShare.deleteOne({
    file: fileId,
    shareType: 'direct',
    sharedWith: targetUserId,
  });

  // Return updated file with shares
  const updatedFile = await File.findById(fileId)
    .populate('user', 'name avatar');

  const shares = await FileShare.findByFile(fileId);

  return { file: updatedFile, shares };
};

/**
 * Bulk remove user from multiple file shares
 * 
 * @param {string[]} fileIds - Array of file IDs
 * @param {string} userId - User ID removing themselves
 * @returns {Promise<Object>} Success message with count
 */
export const bulkRemoveShareAccessService = async (fileIds, userId) => {
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    throw new Error('A non-empty array of fileIds must be provided.');
  }

  // Validate all file IDs
  const mongoose = await import('mongoose');
  for (const id of fileIds) {
    if (!mongoose.default.Types.ObjectId.isValid(id)) {
      const error = new Error(`Invalid file ID format: ${id}`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Delete all matching shares
  const result = await FileShare.deleteMany({
    file: { $in: fileIds },
    shareType: 'direct',
    sharedWith: userId,
  });

  return {
    message: `${result.deletedCount} file(s) successfully removed from your shared list.`,
    removedCount: result.deletedCount,
  };
};

// ============================================================================
// Class Share Service
// ============================================================================

/**
 * Share a file with a class (batch/semester/section)
 * 
 * @param {string} fileId - File ID
 * @param {string} userId - User ID (must be owner)
 * @param {Object} classDetails - Class details (batch, semester, section, subject)
 * @returns {Promise<Object>} Created class share
 */
export const shareFileWithClassService = async (
  fileId,
  userId,
  { batch, semester, section, subjectId }
) => {
  // Verify file ownership
  const file = await File.findOne({ _id: fileId, user: userId });
  if (!file) {
    throw new Error('File not found or you do not have permission.');
  }

  // Check if already shared with this class
  const existingShare = await FileShare.findOne({
    file: fileId,
    shareType: 'class',
    'classShare.batch': batch,
    'classShare.semester': semester,
    'classShare.section': section,
  });

  if (existingShare) {
    const error = new Error('File is already shared with this class.');
    error.statusCode = 400;
    throw error;
  }

  // Create class share
  const classShare = await FileShare.create({
    file: fileId,
    owner: userId,
    shareType: 'class',
    classShare: {
      subject: subjectId,
      batch,
      semester,
      section,
    },
    createdBy: userId,
  });

  await classShare.populate('classShare.subject', 'name code');

  return classShare;
};

/**
 * Remove class share
 * 
 * @param {string} shareId - FileShare ID
 * @param {string} userId - User ID (must be owner)
 * @returns {Promise<Object>} Success message
 */
export const removeClassShareService = async (shareId, userId) => {
  const share = await FileShare.findOne({
    _id: shareId,
    shareType: 'class',
  }).populate('file');

  if (!share) {
    throw new Error('Class share not found.');
  }

  // Verify ownership
  if (share.owner.toString() !== userId) {
    const error = new Error('You do not have permission to remove this share.');
    error.statusCode = 403;
    throw error;
  }

  await FileShare.deleteOne({ _id: shareId });

  return { message: 'Class share removed successfully.' };
};

// ============================================================================
// Share Listing Service
// ============================================================================

/**
 * Get all shares for a file
 * 
 * @param {string} fileId - File ID
 * @param {string} userId - User ID (must be owner)
 * @returns {Promise<Object[]>} Array of shares
 */
export const getFileSharesService = async (fileId, userId) => {
  // Verify ownership
  const file = await File.findOne({ _id: fileId, user: userId });
  if (!file) {
    throw new Error('File not found or you do not have permission.');
  }

  const shares = await FileShare.findByFile(fileId);

  return shares;
};

/**
 * Get all files shared with a user
 * 
 * @param {string} userId - User ID
 * @param {Object} user - User object with role and details
 * @returns {Promise<Object[]>} Array of shared files
 */
export const getFilesSharedWithUserService = async (userId, user) => {
  const shares = await FileShare.getFilesSharedWithUser(userId, user);

  return shares.map((share) => ({
    ...share.file.toObject(),
    shareType: share.shareType,
    sharedBy: share.owner,
    sharedAt: share.createdAt,
  }));
};
