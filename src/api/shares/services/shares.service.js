import crypto from 'crypto';
import FileShare from '../../../models/fileshareModel.js';
import File from '../../../models/fileModel.js';
import User from '../../../models/userModel.js';
import mongoose from 'mongoose';

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
  // Implement public share as a subdocument on the File model
  const file = await File.findOne({ _id: fileId, user: userId });
  if (!file) {
    // Diagnostic: try to determine whether the file exists and who owns it
    try {
      const fallback = await File.findById(fileId).select('_id isDeleted user').lean().catch(() => null);
      console.error('SHARES DEBUG: createPublicShare fallback:', { fileId, fallback });
      if (fallback) {
        if (fallback.isDeleted) {
          const err = new Error('File not found.');
          err.statusCode = 404;
          throw err;
        }
        // File exists but owner mismatch
        const err = new Error('You do not have permission to create a public share for this file.');
        err.statusCode = 403;
        throw err;
      }
    } catch (logErr) {
      // swallow logging errors
    }

    const err = new Error('File not found or you do not have permission.');
    err.statusCode = 404;
    throw err;
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

  // Generate a unique code and write to the File.publicShare subdocument
  let code;
  for (let i = 0; i < 5; i++) {
    code = crypto.randomBytes(4).toString('hex');
    // attempt to assign; uniqueness enforced by file schema index
    file.publicShare = {
      code,
      isActive: true,
      expiresAt,
    };
    file.lastAccessedAt = null;
    try {
      await file.save();
      break;
    } catch (err) {
      // If duplicate key on code, retry
      if (err.code === 11000 && i < 4) continue;
      throw err;
    }
  }

  return { code: file.publicShare.code, isActive: file.publicShare.isActive, expiresAt: file.publicShare.expiresAt };
};

/**
 * Revoke a public share link
 * 
 * @param {string} fileId - File ID
 * @param {string} userId - User ID (must be owner)
 * @returns {Promise<Object>} Success message
 */
export const revokePublicShareService = async (fileId, userId) => {
  const file = await File.findOne({ _id: fileId, user: userId });
  if (!file) {
    const err = new Error('File not found or you do not have permission.');
    err.statusCode = 404;
    throw err;
  }

  if (!file.publicShare || !file.publicShare.isActive) {
    return { message: 'No public share found for this file.' };
  }

  file.publicShare.isActive = false;
  await file.save();

  return { message: 'Public share link has been revoked.', publicShare: { code: file.publicShare.code, isActive: file.publicShare.isActive } };
};

/**
 * Get public download link using share code
 * 
 * @param {string} code - Public share code
 * @returns {Promise<Object>} File details and download URL
 */
export const getPublicDownloadLinkService = async (code) => {
  if (!code) throw new Error('Share code is required.');

  const now = new Date();
  const file = await File.findOne({
    'publicShare.code': code.trim(),
    'publicShare.isActive': true,
    isDeleted: false
  }).populate('user', 'name avatar');

  if (!file) throw new Error('Invalid or expired share code.');

  if (file.publicShare.expiresAt && file.publicShare.expiresAt < now) {
    throw new Error('Share code has expired.');
  }

  // Update last accessed
  file.lastAccessedAt = now;
  await file.save();

  const { getDownloadUrl } = await import('../../../services/s3/s3.service.js');
  const downloadUrl = await getDownloadUrl(file.s3Key, file.fileName);

  return {
    file: {
      _id: file._id,
      fileName: file.fileName,
      fileType: file.fileType,
      size: file.size,
    },
    owner: {
      name: file.user?.name,
      avatar: file.user?.avatar,
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
  const [file, userToShareWith] = await Promise.all([File.findById(fileId), User.findById(userIdToShareWith)]);
  if (!file || file.isDeleted) {
    // Add diagnostic logging to help debug why a valid-looking fileId returns null
    try {
      console.error('SHARES DEBUG: file lookup failed', { fileId, isValidObjectId: mongoose.Types.ObjectId.isValid(fileId), userIdToShareWith });
      // Try a fallback findOne to capture any soft-delete or unusual state
      const fallback = await File.findOne({ _id: fileId }).select('_id isDeleted user').lean().catch(() => null);
      console.error('SHARES DEBUG: fallback findOne result:', fallback);
    } catch (logErr) {
      // swallow logging errors
    }
    const error = new Error('File not found.');
    error.statusCode = 404;
    throw error;
  }
  if (String(file.user) !== String(userId)) {
    const error = new Error('You do not have permission to share this file.');
    error.statusCode = 403;
    throw error;
  }
  if (!userToShareWith) {
    const error = new Error('User to share with not found.');
    error.statusCode = 404;
    throw error;
  }
  if (String(userIdToShareWith) === String(userId)) {
    const error = new Error('You cannot share a file with yourself.');
    error.statusCode = 400;
    throw error;
  }
  if (!userToShareWith.preferences?.canRecieveFiles) {
    const error = new Error('This user is not accepting shared files at the moment.');
    error.statusCode = 403;
    throw error;
  }

  // Check if already shared using FileShare collection
  const existing = await FileShare.findOne({ fileId, userId: userIdToShareWith });
  if (existing) {
    const error = new Error('File is already shared with this user.');
    error.statusCode = 400;
    throw error;
  }

  const created = await FileShare.create({ fileId, userId: userIdToShareWith, expiresAt });

  // Build a file-shaped payload so the frontend reducers can update state
  const fileDoc = await File.findById(fileId).lean();
  const shares = await FileShare.find({ fileId }).populate('userId', 'name avatar').lean();

  // Map shares to a lightweight `sharedWith` array that the frontend expects
  fileDoc.sharedWith = shares.map((s) => ({
    _id: s._id,
    user: s.userId || null,
    expiresAt: s.expiresAt || null,
    createdAt: s.createdAt
  }));

  return fileDoc;

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
  if (!file || file.isDeleted) {
    const error = new Error('File not found.');
    error.statusCode = 404;
    throw error;
  }

  const isOwner = String(file.user) === String(userId);
  let targetUserId = null;

  if (isOwner && userIdToRemove) targetUserId = userIdToRemove;
  else if (!isOwner && !userIdToRemove) targetUserId = userId;
  else if (isOwner && !userIdToRemove) {
    const error = new Error('Owner must specify a userIdToRemove when revoking access.');
    error.statusCode = 400;
    throw error;
  } else {
    const error = new Error('You do not have permission to perform this action.');
    error.statusCode = 403;
    throw error;
  }

  // Delete the share record only
  const result = await FileShare.deleteOne({ fileId, userId: targetUserId });

  // Return a file-shaped payload so frontend reducers can update/remove accordingly
  const freshFile = await File.findById(fileId).lean();
  const shares = await FileShare.find({ fileId }).populate('userId', 'name avatar').lean();
  freshFile.sharedWith = shares.map((s) => ({
    _id: s._id,
    user: s.userId || null,
    expiresAt: s.expiresAt || null,
    createdAt: s.createdAt
  }));

  return freshFile;
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

  // Delete all matching shares from FileShare collection only
  const result = await FileShare.deleteMany({ fileId: { $in: fileIds }, userId });

  // Return the ids removed so the frontend can filter them out
  return { ids: fileIds, message: `${result.deletedCount} file(s) successfully removed from your shared list.`, removedCount: result.deletedCount };
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
  // Class sharing is not supported in the Stage 3 two-model architecture
  const err = new Error('Class sharing is not supported in this deployment.');
  err.statusCode = 501;
  throw err;
};

/**
 * Remove class share
 * 
 * @param {string} shareId - FileShare ID
 * @param {string} userId - User ID (must be owner)
 * @returns {Promise<Object>} Success message
 */
export const removeClassShareService = async (shareId, userId) => {
  const err = new Error('Class sharing is not supported in this deployment.');
  err.statusCode = 501;
  throw err;
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
  try {
    // Ensure file exists and caller is owner
    const file = await File.findById(fileId).select('user');
    if (!file) {
      // Return empty array when file does not exist to avoid bubbling UI errors
      return [];
    }

    if (String(file.user) !== String(userId)) {
      // Non-owners should not see share lists; return empty array
      return [];
    }

    const shares = await FileShare.find({ fileId }).populate('userId', 'name avatar');
    return shares;
  } catch (e) {
    // On unexpected errors, return empty list to avoid breaking UI flows
    return [];
  }
};

/**
 * Get all files shared with a user
 * 
 * @param {string} userId - User ID
 * @param {Object} user - User object with role and details
 * @returns {Promise<Object[]>} Array of shared files
 */
export const getFilesSharedWithUserService = async (userId, user) => {
  const shares = await FileShare.find({ userId }).populate('fileId');

  return shares.map((share) => ({
    ...(share.fileId ? share.fileId.toObject() : {}),
    sharedAt: share.createdAt,
  }));
};

/**
 * Get files owned by this user that have been shared (direct shares or active public shares)
 * @param {string} userId - Owner user id
 * @returns {Promise<Array>} Array of file documents (lean) with `sharedWith` array and `publicShare` where applicable
 */
export const getFilesSharedByUserService = async (userId) => {
  // Populate owner info so the frontend can perform ownership checks reliably
  const ownedFiles = await File.find({ user: userId }).populate('user', 'name avatar').lean();
  if (!ownedFiles || ownedFiles.length === 0) return [];

  const fileIds = ownedFiles.map((f) => String(f._id));

  // Find all FileShare records for these files
  const shares = await FileShare.find({ fileId: { $in: fileIds } }).populate('userId', 'name avatar').lean();

  // Group shares by fileId
  const sharesByFile = shares.reduce((acc, s) => {
    const key = String(s.fileId);
    acc[key] = acc[key] || [];
    acc[key].push(s);
    return acc;
  }, {});

  // Ensure expired publicShare entries are treated as inactive and persist that state.
  // Any file whose publicShare.expiresAt < now will have its publicShare.isActive set to false
  const now = new Date();
  for (const f of ownedFiles) {
    try {
      if (f.publicShare && f.publicShare.isActive && f.publicShare.expiresAt) {
        const expires = new Date(f.publicShare.expiresAt);
        if (expires < now) {
          // Mark as inactive in DB and in the returned object
          await File.updateOne({ _id: f._id }, { $set: { 'publicShare.isActive': false, 'publicShare.code': null, 'publicShare.expiresAt': null } }).catch(() => null);
          f.publicShare.isActive = false;
          f.publicShare.code = null;
          f.publicShare.expiresAt = null;
        }
      }
    } catch (e) {
      // swallow per-file update errors to avoid failing the whole listing
    }
  }

  // Build result: include only files that have direct shares or active publicShare
  const result = ownedFiles
    .map((file) => {
      // Normalize owner into an object with string _id so frontend comparisons like
      // `file.user._id === userId` work consistently (some code expects an object).
      const f = { ...file };
      if (f.user && f.user._id) {
        f.user = { _id: String(f.user._id), name: f.user.name, avatar: f.user.avatar };
      } else if (f.user) {
        // fallback: ensure _id is a string
        f.user = { _id: String(f.user) };
      }

      const s = sharesByFile[String(file._id)] || [];
      f.sharedWith = s.map((sh) => ({
        _id: sh._id,
        user: sh.userId || null,
        expiresAt: sh.expiresAt || null,
        createdAt: sh.createdAt,
      }));
      return f;
    })
    .filter((f) => (Array.isArray(f.sharedWith) && f.sharedWith.length > 0) || (f.publicShare && f.publicShare.isActive));

  return result;
};
