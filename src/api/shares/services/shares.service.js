import crypto from 'crypto';
import FileShare from '../../../models/fileshareModel.js';
import ClassShare from '../../../models/classShareModel.js';
import File from '../../../models/fileModel.js';
import User from '../../../models/userModel.js';
import Subject from '../../../models/subjectModel.js';
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
  // Prevent creating public shares for empty folders
  try {
    if (file.isFolder) {
      const folderRegex = (file.path || ',') + String(file._id) + ',';
      const hasDescendant = await File.exists({ path: { $regex: `^${folderRegex}` }, isFolder: false, isDeleted: false });
      if (!hasDescendant) {
        const err = new Error('Cannot create a public share for an empty folder.');
        err.statusCode = 400;
        throw err;
      }
    }
  } catch (e) {
    // If the DB check itself fails, surface a clear error
    if (e && e.statusCode) throw e;
    const err = new Error('Failed to validate folder contents for public share.');
    err.statusCode = 500;
    throw err;
  }

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

  // Update last accessed (single save only)
  file.lastAccessedAt = now;
  await file.save();

  // If the shared object is a folder, return a payload that indicates this
  // so the controller can expose a folder-download endpoint to the client.
  if (file.isFolder) {
    return {
      file: {
        _id: file._id,
        fileName: file.fileName,
        isFolder: true,
      },
      owner: {
        name: file.user?.name,
        avatar: file.user?.avatar,
      },
      // The controller will construct a public streaming URL the client can call
      url: null,
    };
  }

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
 * Share a file or folder with one or multiple classes
 * 
 * @param {string} fileId - File/folder ID
 * @param {string} userId - User ID (must be owner and teacher)
 * @param {Array} classShares - Array of class share objects
 * @param {string} description - Optional description for all shares
 * @returns {Promise<Object>} Created class shares
 * 
 * @example
 * classShares = [
 *   { batch: 2024, semester: 5, section: 'A', subjectId: '507f...', expiresAt: null },
 *   { batch: 2024, semester: 5, section: 'B', subjectId: '507f...', expiresAt: '2025-06-30' }
 * ]
 */
export const shareFileWithClassService = async (
  fileId,
  userId,
  classShares,
  description = null
) => {
  // 1. Validate input
  if (!Array.isArray(classShares) || classShares.length === 0) {
    const error = new Error('At least one class share must be provided.');
    error.statusCode = 400;
    throw error;
  }

  // 2. Fetch and validate file
  const file = await File.findOne({ _id: fileId, isDeleted: false });
  
  if (!file) {
    const error = new Error('File not found.');
    error.statusCode = 404;
    throw error;
  }

  // 3. Verify ownership
  if (String(file.user) !== String(userId)) {
    const error = new Error('You do not have permission to share this file.');
    error.statusCode = 403;
    throw error;
  }

  // 4. Verify user is a teacher
  const teacher = await User.findById(userId);
  if (!teacher || !Array.isArray(teacher.roles) || !teacher.roles.includes('teacher')) {
    const error = new Error('Only teachers can share files with classes.');
    error.statusCode = 403;
    throw error;
  }

  // 5. Validate each class share and check teacher authorization
  const validatedShares = [];
  const subjectIds = new Set();

  for (const share of classShares) {
    const { batch, semester, section, subjectId, expiresAt } = share;

    // Validate required fields
    if (!batch || !semester || !section || !subjectId) {
      const error = new Error('Each class share must include batch, semester, section, and subjectId.');
      error.statusCode = 400;
      throw error;
    }

    // Verify teacher is assigned to teach this subject
    const isAssigned = teacher.teacherDetails?.assignments?.some(
      assignment =>
        String(assignment.subject) === String(subjectId) &&
        assignment.batch === batch &&
        assignment.semester === semester &&
        assignment.sections.includes(section)
    );

    if (!isAssigned) {
      const error = new Error(
        `You are not assigned to teach this subject for Batch ${batch}, Semester ${semester}, Section ${section}.`
      );
      error.statusCode = 403;
      throw error;
    }

    subjectIds.add(String(subjectId));
    validatedShares.push({ batch, semester, section, subjectId, expiresAt });
  }

  // 6. Verify all subjects exist
  const subjects = await Subject.find({ _id: { $in: Array.from(subjectIds) } });
  if (subjects.length !== subjectIds.size) {
    const error = new Error('One or more subjects not found.');
    error.statusCode = 404;
    throw error;
  }

  // 7. Update file context if it's personal
  if (file.context === 'personal') {
    file.context = 'academic_material';
    await file.save();
  }

  // 8. Create or update class shares (use upsert to handle duplicates)
  const shareOperations = validatedShares.map(share => ({
    updateOne: {
      filter: {
        fileId,
        batch: share.batch,
        semester: share.semester,
        section: share.section,
        subject: share.subjectId
      },
      update: {
        $set: {
          sharedBy: userId,
          expiresAt: share.expiresAt || null,
          description: description || undefined
        }
      },
      upsert: true
    }
  }));

  const result = await ClassShare.bulkWrite(shareOperations);

  // 9. Fetch created/updated shares
  const createdShares = await ClassShare.find({
    fileId,
    sharedBy: userId
  })
    .populate('subject', 'name subjectCode')
    .populate('sharedBy', 'name email')
    .sort({ createdAt: -1 });

  return {
    message: `File shared with ${validatedShares.length} class(es) successfully.`,
    totalShares: createdShares.length,
    newShares: result.upsertedCount,
    updatedShares: result.modifiedCount,
    shares: createdShares,
    file: {
      _id: file._id,
      fileName: file.fileName,
      context: file.context
    }
  };
};

/**
 * Remove one or more class shares for a file
 * 
 * @param {string} fileId - File ID
 * @param {string} userId - User ID (must be owner)
 * @param {Array} classFilters - Array of class identifiers to remove (optional - removes all if empty)
 * @returns {Promise<Object>} Success message with count
 * 
 * @example
 * // Remove specific shares
 * classFilters = [
 *   { batch: 2024, semester: 5, section: 'A', subjectId: '507f...' },
 *   { batch: 2024, semester: 5, section: 'B', subjectId: '507f...' }
 * ]
 * 
 * // Remove all shares for this file
 * classFilters = []
 */
export const removeClassShareService = async (fileId, userId, classFilters = []) => {
  // 1. Verify file exists and user is owner
  const file = await File.findOne({ _id: fileId, user: userId, isDeleted: false });
  
  if (!file) {
    const error = new Error('File not found or you do not have permission.');
    error.statusCode = 404;
    throw error;
  }

  // 2. Build delete query
  const deleteQuery = { fileId, sharedBy: userId };

  // 3. If specific classes provided, add filters
  if (Array.isArray(classFilters) && classFilters.length > 0) {
    const orConditions = classFilters.map(filter => ({
      batch: filter.batch,
      semester: filter.semester,
      section: filter.section,
      subject: filter.subjectId
    }));
    deleteQuery.$or = orConditions;
  }

  // 4. Delete shares
  const result = await ClassShare.deleteMany(deleteQuery);

  return {
    message: result.deletedCount > 0 
      ? `Removed ${result.deletedCount} class share(s) successfully.`
      : 'No class shares found to remove.',
    deletedCount: result.deletedCount
  };
};

/**
 * Get all class shares for a file (teacher view)
 * 
 * @param {string} fileId - File ID
 * @param {string} userId - User ID (must be owner)
 * @returns {Promise<Array>} Array of class shares
 */
export const getFileClassSharesService = async (fileId, userId) => {
  // 1. Verify file exists and user is owner
  const file = await File.findOne({ _id: fileId, user: userId, isDeleted: false });
  
  if (!file) {
    return []; // Return empty array for non-existent or unauthorized files
  }

  // 2. Fetch all active class shares
  const shares = await ClassShare.find({
    fileId,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .populate('subject', 'name subjectCode')
    .populate('sharedBy', 'name email')
    .sort({ batch: 1, semester: 1, section: 1 });

  return shares;
};

/**
 * Get all files shared with a student's class
 * 
 * @param {Object} user - Student user object with studentDetails
 * @param {string} subjectId - Optional subject filter
 * @returns {Promise<Array>} Array of files with share details
 */
export const getClassMaterialsService = async (user, subjectId = null) => {
  // 1. Validate student details
  if (!user.studentDetails || !user.studentDetails.batch) {
    const error = new Error('Student enrollment details not found.');
    error.statusCode = 400;
    throw error;
  }

  const { batch, semester, section } = user.studentDetails;

  // 2. Build query
  const query = {
    batch,
    semester,
    section,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  };

  if (subjectId) {
    query.subject = subjectId;
  }

  // 3. Find all class shares for this student
  const shares = await ClassShare.find(query)
    .populate({
      path: 'fileId',
      match: { isDeleted: false }, // Only non-deleted files
      populate: {
        path: 'user',
        select: 'name email'
      }
    })
    .populate('subject', 'name subjectCode')
    .sort({ createdAt: -1 });

  // 4. Filter out null fileIds (deleted files) and format response
  const materials = shares
    .filter(share => share.fileId !== null)
    .map(share => ({
      ...share.fileId.toObject(),
      sharedBy: {
        name: share.sharedBy?.name,
        email: share.sharedBy?.email
      },
      subject: share.subject,
      shareDescription: share.description,
      sharedAt: share.createdAt,
      expiresAt: share.expiresAt
    }));

  return materials;
};

/**
 * Update class share expiration date
 * 
 * @param {string} shareId - ClassShare ID
 * @param {string} userId - User ID (must be owner)
 * @param {Date|null} expiresAt - New expiration date (null for no expiration)
 * @returns {Promise<Object>} Updated share
 */
export const updateClassShareExpirationService = async (shareId, userId, expiresAt) => {
  // 1. Find share
  const share = await ClassShare.findById(shareId).populate('fileId', 'user');

  if (!share) {
    const error = new Error('Class share not found.');
    error.statusCode = 404;
    throw error;
  }

  // 2. Verify ownership
  if (!share.fileId || String(share.fileId.user) !== String(userId)) {
    const error = new Error('You do not have permission to modify this share.');
    error.statusCode = 403;
    throw error;
  }

  // 3. Update expiration
  share.expiresAt = expiresAt;
  await share.save();

  return {
    message: 'Share expiration updated successfully.',
    share: await share.populate('subject', 'name subjectCode')
  };
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
  // Populate the file and its owner so the client can show "Shared by: <owner name>"
  const shares = await FileShare.find({ userId }).populate({ path: 'fileId', populate: { path: 'user', select: 'name avatar' } });

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
