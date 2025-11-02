import File from '../../../models/fileModel.js';
import { uploadFile as uploadToS3 } from '../../../services/s3/s3.service.js';
import { getDownloadUrl, getPreviewUrl } from '../../../services/s3/s3.service.js';
import * as pathService from './path.service.js';
import mongoose from 'mongoose';

// ============================================================================
// File Upload Service
// ============================================================================

/**
 * Upload files to S3 and save metadata to database
 * Handles duplicate filename detection with counter suffix
 * 
 * @param {Object[]} files - Array of files from multer
 * @param {string} userId - User ID
 * @param {string|null} parentId - Parent folder ID (null for root)
 * @returns {Promise<Object[]>} Array of created file documents
 */
export const uploadFilesService = async (files, userId, parentId) => {
  if (!files || files.length === 0) {
    throw new Error('No files uploaded.');
  }

  // Validate and fetch parent folder if provided
  let parentFolder = null;
  let newPath = ','; // Default to root path

  if (parentId && parentId !== 'null') {
    parentFolder = await File.findOne({
      _id: parentId,
      user: userId,
      isFolder: true,
      isDeleted: false,
    });

    if (!parentFolder) {
      throw new Error('Parent folder not found.');
    }

    newPath = pathService.buildPath(parentFolder);
  }

  // Upload all files to S3 in parallel
  const uploadPromises = files.map(async (file) => {
    // Generate unique filename if duplicate exists
    const finalFileName = await generateUniqueFileName(
      file.originalname,
      userId,
      parentId
    );

    // Upload to S3 with context
    const s3Key = await uploadToS3({
      file,
      context: 'personal',
      ownerId: userId,
    });

    return {
      user: userId,
      fileName: finalFileName,
      s3Key: s3Key,
      fileType: file.mimetype,
      size: file.size,
      isFolder: false,
      parentId: parentFolder ? parentFolder._id : null,
      path: newPath,
    };
  });

  const filesMetadata = await Promise.all(uploadPromises);

  // Save all files to database. Use ordered:false so one duplicate won't block other inserts.
  let newFiles;
  try {
    newFiles = await File.insertMany(filesMetadata, { ordered: false });
  } catch (err) {
    // Translate duplicate-key into a friendly 409 so callers can surface a user-friendly message.
    // insertMany with ordered:false may still include writeErrors; map those to 409 as appropriate.
    if (err && (err.code === 11000 || (err.writeErrors && err.writeErrors.some(e => e.code === 11000)))) {
      const error = new Error('One or more files could not be uploaded due to name conflicts. Please retry with different names.');
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }

  newFiles = await File.populate(newFiles, {
    path: 'user',
    select: 'name avatar',
  });

  return newFiles;
};

/**
 * Generate unique filename by appending counter if duplicate exists
 * 
 * @param {string} originalName - Original filename
 * @param {string} userId - User ID
 * @param {string|null} parentId - Parent folder ID
 * @returns {Promise<string>} Unique filename
 */
const generateUniqueFileName = async (originalName, userId, parentId) => {
  let finalFileName = originalName;
  let counter = 0;
  let fileExists = true;

  while (fileExists) {
    const existingFile = await File.findOne({
      user: userId,
      fileName: finalFileName,
      parentId: parentId || null,
      isDeleted: false,
    });

    if (existingFile) {
      counter++;
      const dotIndex = originalName.lastIndexOf('.');
      // Handle filenames without extensions and dotfiles correctly.
      let name;
      let extension = '';
      if (dotIndex > 0) {
        name = originalName.substring(0, dotIndex);
        extension = originalName.substring(dotIndex); // includes the '.'
      } else {
        // No extension (including dotfiles like `.env`), treat the whole name as base
        name = originalName;
        extension = '';
      }
      finalFileName = `${name} (${counter})${extension}`;
    } else {
      fileExists = false;
    }
  }

  return finalFileName;
};

// ============================================================================
// File Listing Service
// ============================================================================

/**
 * Get files and folders for a user in a specific directory
 * Includes owned files and files shared with user (direct + class shares)
 * 
 * @param {string} userId - User ID
 * @param {Object} user - User object with role and details
 * @param {string|null} parentId - Parent folder ID (null for root)
 * @returns {Promise<Object>} Files, current folder, and breadcrumbs
 */
export const getUserFilesService = async (userId, user, parentId) => {
  const targetParentId =
    parentId === 'null' || !parentId ? null : parentId;
  // If parentId is null (root view): run big query to find all root items the
  // user owns OR are shared with them (directly or via class share).
  if (targetParentId === null) {
    const rootQuery = {
      parentId: null,
      isDeleted: false,
      $or: [
        { user: userId },
        { 'sharedWith.user': userId },
        ...(Array.isArray(user.roles) && user.roles.includes('student') && user.studentDetails
          ? [
              {
                'sharedWithClass.batch': user.studentDetails.batch,
                'sharedWithClass.section': user.studentDetails.section,
                'sharedWithClass.semester': user.studentDetails.semester,
              },
            ]
          : []),
      ],
    };

    const files = await File.find(rootQuery)
      .sort({ isFolder: -1, fileName: 1 })
      .populate('user', 'name avatar')
      .populate('sharedWith.user', 'name avatar');

    return { files, currentFolder: null, breadcrumbs: [] };
  }

  // If parentId provided: fetch the parent folder and enforce permission check
  const parentFolder = await File.findOne({ _id: targetParentId, isDeleted: false, isFolder: true });
  if (!parentFolder) {
    const error = new Error('Folder not found.');
    error.statusCode = 404;
    throw error;
  }

  // Permission check: owner OR direct share OR class share
  const normalizedUserId = String(userId);
  const ownerId = parentFolder.user ? String(parentFolder.user) : null;
  let isOwner = ownerId === normalizedUserId;
  let isSharedWith = false;
  if (Array.isArray(parentFolder.sharedWith) && parentFolder.sharedWith.length > 0) {
    isSharedWith = parentFolder.sharedWith.some((s) => {
      const sid = s.user ? String(s.user) : String(s);
      const notExpired = !s.expiresAt || s.expiresAt > new Date();
      return sid === normalizedUserId && notExpired;
    });
  }
  let isClassShared = false;
  if (!isOwner && !isSharedWith && Array.isArray(user.roles) && user.roles.includes('student') && user.studentDetails) {
    const swc = parentFolder.sharedWithClass;
    if (swc && typeof swc === 'object') {
      isClassShared =
        swc.batch === user.studentDetails.batch &&
        swc.section === user.studentDetails.section &&
        swc.semester === user.studentDetails.semester;
    }
  }

  if (!isOwner && !isSharedWith && !isClassShared) {
    const error = new Error('You do not have permission to view this folder.');
    error.statusCode = 403;
    throw error;
  }

  // Authorized: return children with a simple, fast query (permission inheritance)
  const files = await File.find({ parentId: targetParentId, isDeleted: false })
    .sort({ isFolder: -1, fileName: 1 })
    .populate('user', 'name avatar')
    .populate('sharedWith.user', 'name avatar');

  // Build breadcrumbs from parentFolder.path
  let breadcrumbs = [];
  if (parentFolder && parentFolder.path) {
    const ancestorIds = pathService.extractAncestorIds(parentFolder.path);
    if (ancestorIds.length > 0) {
      const ancestors = await File.find({ _id: { $in: ancestorIds }, isDeleted: false }).select('fileName');
      const ancestorMap = new Map(ancestors.map((anc) => [anc._id.toString(), anc]));
      breadcrumbs = ancestorIds.map((id) => ancestorMap.get(id));
    }
  }

  return { files, currentFolder: parentFolder, breadcrumbs };
};

// ============================================================================
// File Download Service
// ============================================================================

/**
 * Get download URL for a file
 * Verifies user has permission to access the file
 * 
 * @param {string} fileId - File ID
 * @param {string} userId - User ID
 * @returns {Promise<string>} Download URL
 */
export const getFileDownloadUrlService = async (fileId, userId, user = null) => {
  const file = await File.findById(fileId);

  if (!file) {
    throw new Error('File not found.');
  }

  // Do not expose soft-deleted files
  if (file.isDeleted) {
    const error = new Error('File not found.');
    error.statusCode = 404;
    throw error;
  }

  // Helper to extract string id from ObjectId or populated document
  const extractId = (val) => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (val._id) return String(val._id);
    return String(val);
  };

  // Check permission
  // Normalize comparison by stringifying the incoming userId (may be ObjectId)
  const normalizedUserId = String(userId);
  const ownerId = extractId(file.user);
  const isOwner = ownerId === normalizedUserId;
  const isSharedWith = (file.sharedWith || []).some((share) => {
    const sharedUserId = extractId(share.user);
    const notExpired = !share.expiresAt || share.expiresAt > new Date();
    return sharedUserId === normalizedUserId && notExpired;
  });

  // Class-share check (optional): callers can provide the `user` object so we can evaluate
  // class-based shares (batch/section/semester). If caller doesn't provide `user`, we fall
  // back to owner/direct-share only.
  let isClassShared = false;
  if (!isOwner && !isSharedWith && user && Array.isArray(user.roles) && user.roles.includes('student') && user.studentDetails) {
    const swc = file.sharedWithClass;
    if (swc && typeof swc === 'object') {
      isClassShared =
        swc.batch === user.studentDetails.batch &&
        swc.section === user.studentDetails.section &&
        swc.semester === user.studentDetails.semester;
    }
  }

  if (!isOwner && !isSharedWith && !isClassShared) {
    const error = new Error('You do not have permission to access this file.');
    error.statusCode = 403;
    throw error;
  }

  // Generate download URL using S3 service
  const downloadUrl = await getDownloadUrl(file.s3Key, file.fileName);

  return downloadUrl;
};

/**
 * Get multiple files for bulk download
 * Returns accessible files that user can download
 * 
 * @param {string[]} fileIds - Array of file IDs
 * @param {string} userId - User ID
 * @returns {Promise<Object[]>} Array of accessible file documents
 */
export const getBulkDownloadFilesService = async (fileIds, userId, user = null) => {
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    throw new Error('File IDs must be provided as an array.');
  }

  // Find candidate files (we'll enforce permissions in JS so class-shares can be honored)
  const candidateFiles = await File.find({ _id: { $in: fileIds }, isDeleted: false });

  if (candidateFiles.length !== fileIds.length) {
    const error = new Error(
      'One or more files were not found or have been deleted.'
    );
    error.statusCode = 404;
    throw error;
  }

  // Validate permission per-file (owner OR direct share with non-expired OR class-share if user provided)
  const normalizedUserId = String(userId);
  const unauthorized = [];
  for (const f of candidateFiles) {
    const ownerId = f.user ? String(f.user) : null;
    const isOwner = ownerId === normalizedUserId;
    const isSharedWith = (f.sharedWith || []).some((s) => {
      const sid = s.user ? String(s.user) : String(s);
      const notExpired = !s.expiresAt || s.expiresAt > new Date();
      return sid === normalizedUserId && notExpired;
    });

    let isClassShared = false;
    if (!isOwner && !isSharedWith && user && Array.isArray(user.roles) && user.roles.includes('student') && user.studentDetails) {
      const swc = f.sharedWithClass;
      if (swc && typeof swc === 'object') {
        isClassShared =
          swc.batch === user.studentDetails.batch &&
          swc.section === user.studentDetails.section &&
          swc.semester === user.studentDetails.semester;
      }
    }

    if (!isOwner && !isSharedWith && !isClassShared) {
      unauthorized.push(String(f._id));
    }
  }

  if (unauthorized.length > 0) {
    const error = new Error(
      'You do not have permission to download one or more of the selected files.'
    );
    error.statusCode = 403;
    throw error;
  }

  return candidateFiles;
};

// ============================================================================
// Preview & Search Services (Phase 1.5)
// ============================================================================

/**
 * Get preview URL for a file (inline preview, no attachment)
 * Honors same permission checks as download URL. Accepts optional `user` for class-share checks.
 */
export const getFilePreviewUrlService = async (fileId, userId, user = null) => {
  const file = await File.findById(fileId);

  if (!file) {
    throw new Error('File not found.');
  }

  if (file.isDeleted) {
    const error = new Error('File not found.');
    error.statusCode = 404;
    throw error;
  }

  const extractId = (val) => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (val._id) return String(val._id);
    return String(val);
  };

  const normalizedUserId = String(userId);
  const ownerId = extractId(file.user);
  const isOwner = ownerId === normalizedUserId;
  const isSharedWith = (file.sharedWith || []).some((share) => {
    const sharedUserId = extractId(share.user);
    const notExpired = !share.expiresAt || share.expiresAt > new Date();
    return sharedUserId === normalizedUserId && notExpired;
  });

  let isClassShared = false;
  if (!isOwner && !isSharedWith && user && Array.isArray(user.roles) && user.roles.includes('student') && user.studentDetails) {
    const swc = file.sharedWithClass;
    if (swc && typeof swc === 'object') {
      isClassShared =
        swc.batch === user.studentDetails.batch &&
        swc.section === user.studentDetails.section &&
        swc.semester === user.studentDetails.semester;
    }
  }

  if (!isOwner && !isSharedWith && !isClassShared) {
    const error = new Error('You do not have permission to access this file.');
    error.statusCode = 403;
    throw error;
  }

  // Use S3 preview URL helper
  const previewUrl = await getPreviewUrl(file.s3Key);
  return previewUrl;
};

/**
 * Search files (text search on fileName). Honors ownership, direct share and optional class-share when `user` provided.
 */
export const searchFilesService = async (userId, user, q) => {
  if (!q || typeof q !== 'string' || q.trim() === '') return [];
  const searchText = q.trim();

  const baseOr = [
    { user: userId },
    { 'sharedWith.user': userId },
  ];

  // Class-share clause when user is student
  if (Array.isArray(user.roles) && user.roles.includes('student') && user.studentDetails) {
    baseOr.push({
      'sharedWithClass.batch': user.studentDetails.batch,
      'sharedWithClass.section': user.studentDetails.section,
      'sharedWithClass.semester': user.studentDetails.semester,
    });
  }

  const query = {
    $text: { $search: searchText },
    isDeleted: false,
    $or: baseOr,
  };

  const files = await File.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, isFolder: -1, fileName: 1 })
    .limit(200)
    .populate('user', 'name avatar')
    .populate('sharedWith.user', 'name avatar');

  return files;
};

/**
 * Get all descendant files for a folder if the user has read access.
 * Returns only non-folder, non-deleted files.
 */
export const getDescendantFilesService = async (folderId, userId, user = null) => {
  const parentFolder = await File.findOne({ _id: folderId, isDeleted: false, isFolder: true });
  if (!parentFolder) {
    const error = new Error('Folder not found.');
    error.statusCode = 404;
    throw error;
  }

  // Permission check (owner OR direct share OR class share)
  const normalizedUserId = String(userId);
  const ownerId = parentFolder.user ? String(parentFolder.user) : null;
  let isOwner = ownerId === normalizedUserId;

  let isSharedWith = false;
  if (Array.isArray(parentFolder.sharedWith) && parentFolder.sharedWith.length > 0) {
    isSharedWith = parentFolder.sharedWith.some((s) => {
      const sid = s.user ? String(s.user) : String(s);
      const notExpired = !s.expiresAt || s.expiresAt > new Date();
      return sid === normalizedUserId && notExpired;
    });
  }

  let isClassShared = false;
  if (!isOwner && !isSharedWith && user && Array.isArray(user.roles) && user.roles.includes('student') && user.studentDetails) {
    const swc = parentFolder.sharedWithClass;
    if (swc && typeof swc === 'object') {
      isClassShared =
        swc.batch === user.studentDetails.batch &&
        swc.section === user.studentDetails.section &&
        swc.semester === user.studentDetails.semester;
    }
  }

  if (!isOwner && !isSharedWith && !isClassShared) {
    const error = new Error('You do not have permission to view this folder.');
    error.statusCode = 403;
    throw error;
  }

  // Find descendants using materialized path. The path stores ancestor ids
  // as a comma-separated string (e.g., ",a,b,c,") so matching parentFolder.path + parentFolder._id
  // will find children/descendants.
  const regex = parentFolder.path + String(parentFolder._id);
  const descendants = await File.find({ path: { $regex: regex }, isFolder: false, isDeleted: false })
    .sort({ isFolder: -1, fileName: 1 })
    .populate('user', 'name avatar')
    .populate('sharedWith.user', 'name avatar');

  return descendants;
};

// ============================================================================
// File Deletion Service (Personal context only)
// ============================================================================

/**
 * Delete a single file (owner only)
 * NOTE: This will be replaced by soft-delete in Part 3 (Trash domain)
 * 
 * @param {string} fileId - File ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Success message
 */
export const deleteFileService = async (fileId, userId) => {
  const file = await File.findById(fileId);

  if (!file) {
    throw new Error('File not found.');
  }

  // Only owner can delete (soft-delete)
  if (file.user.toString() !== userId) {
    const error = new Error('You do not have permission to delete this file.');
    error.statusCode = 403;
    throw error;
  }

  // Soft-delete: mark isDeleted and deletedAt. Do NOT remove S3 objects yet.
  await File.updateOne({ _id: fileId }, { $set: { isDeleted: true, deletedAt: new Date() } });

  return { message: 'File moved to Trash (soft-deleted).' };
};

/**
 * Delete multiple files in bulk (owner only)
 * NOTE: This will be replaced by soft-delete in Part 3 (Trash domain)
 * 
 * @param {string[]} fileIds - Array of file IDs
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Success message
 */
export const bulkDeleteFilesService = async (fileIds, userId) => {
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    throw new Error('File IDs must be provided as an array.');
  }
  // Find files owned by user
  const filesToDelete = await File.find({
    _id: { $in: fileIds },
    user: userId,
  });

  // Security check
  if (filesToDelete.length !== fileIds.length) {
    const error = new Error(
      'You do not have permission to delete one or more of the selected files.'
    );
    error.statusCode = 403;
    throw error;
  }

  // Soft-delete: mark as deleted with timestamp. Do NOT remove S3 objects yet.
  await File.updateMany({ _id: { $in: fileIds }, user: userId }, { $set: { isDeleted: true, deletedAt: new Date() } });

  return { message: `${filesToDelete.length} files moved to Trash (soft-deleted).` };
};
