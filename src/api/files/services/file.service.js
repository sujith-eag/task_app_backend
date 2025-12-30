import File from '../../../models/fileModel.js';
import FileShare from '../../../models/fileshareModel.js';
import ClassShare from '../../../models/classShareModel.js';
import { uploadFile as uploadToS3 } from '../../../services/s3/s3.service.js';
import { getDownloadUrl, getPreviewUrl } from '../../../services/s3/s3.service.js';
import * as pathService from './path.service.js';
import * as permissionService from './permission.service.js';
import mongoose from 'mongoose';

/**
 * Helper: determine whether a user has access to an item by ownership,
 * direct share, class share, or an ancestor folder being shared with them.
 * Accepts a File document (may be partial) and optional full `user` for class checks.
 * 
 * FIXED: Now properly converts IDs to ObjectId for MongoDB queries
 */
const userHasAccessTo = async (item, userId, user = null) => {
  if (!item) return false;
  
  const normalizedUserId = permissionService.extractStringId(userId);
  const ownerId = permissionService.extractStringId(item.user);
  
  // Owner always has access
  if (ownerId === normalizedUserId) return true;

  // Check direct share on the item itself or any ancestor in its path
  const ancestorIds = pathService.extractAncestorIds(item.path || '') || [];
  
  // Convert all IDs to ObjectId for proper MongoDB matching
  const idsToCheck = [item._id, ...ancestorIds]
    .map(permissionService.toObjectId)
    .filter(Boolean);
  
  const userObjectId = permissionService.toObjectId(userId);
  
  let fsDoc = null;
  try {
    // Include expiration check in the query
    fsDoc = await FileShare.findOne({ 
      fileId: { $in: idsToCheck }, 
      userId: userObjectId,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });
    if (fsDoc) return true;
  } catch (e) {
    // swallow and continue to class-share checks
  }

  // DEBUG: log permission check details in non-production for easier diagnosis
  try {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('userHasAccessTo:', {
        itemId: String(item._id),
        owner: ownerId,
        userId: normalizedUserId,
        idsChecked: idsToCheck.map(String),
        fileShareFound: !!fsDoc,
        path: item.path || null,
      });
    }
  } catch (e) {
    // ignore logging errors
  }

  // Class-share check when user is a student (using ClassShare collection)
  if (user && Array.isArray(user.roles) && user.roles.includes('student') && user.studentDetails) {
    try {
      const classShare = await ClassShare.exists({
        fileId: item._id,
        batch: user.studentDetails.batch,
        semester: user.studentDetails.semester,
        section: user.studentDetails.section,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      if (classShare) return true;
    } catch (e) {
      // Continue to return false
    }
  }

  return false;
};

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
  // Normalize parentId: frontend may send the string 'null' to indicate root.
  const targetParentId = parentId === 'null' ? null : (parentId || null);

  let finalFileName = originalName;
  let counter = 0;
  let fileExists = true;

  while (fileExists) {
    const existingFile = await File.findOne({
      user: userId,
      fileName: finalFileName,
      parentId: targetParentId,
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
    // Root view should only show items owned by the requesting user.
    // Shared files (direct shares or class shares) are returned by the
    // dedicated shares endpoints (e.g. /api/shares/shared-with-me).
    const rootQuery = {
      parentId: null,
      isDeleted: false,
      user: userId,
    };

    const files = await File.find(rootQuery)
      .sort({ isFolder: -1, fileName: 1 })
      .populate('user', 'name avatar');

    // Attach share metadata for files owned by the requesting user
    try {
      const ownedFileIds = files.filter(f => String(f.user?._id || f.user) === String(userId)).map(f => String(f._id));
      if (ownedFileIds.length > 0) {
        // Load FileShare records for these files
        const shares = await FileShare.find({ fileId: { $in: ownedFileIds } }).populate('userId', 'name avatar').lean();
        const sharesByFile = shares.reduce((acc, s) => {
          const k = String(s.fileId);
          acc[k] = acc[k] || [];
          acc[k].push(s);
          return acc;
        }, {});

        // Ensure expired publicShare entries are deactivated and attach sharedWith arrays
        const now = new Date();
        for (const f of files) {
          const fid = String(f._id);
          if (String(f.user?._id || f.user) === String(userId)) {
            const s = sharesByFile[fid] || [];
            f.sharedWith = s.map(sh => ({
              _id: sh._id,
              user: sh.userId || null,
              expiresAt: sh.expiresAt || null,
              createdAt: sh.createdAt,
            }));

            // If publicShare expired, persist deactivation
            try {
              if (f.publicShare && f.publicShare.isActive && f.publicShare.expiresAt) {
                const expires = new Date(f.publicShare.expiresAt);
                if (expires < now) {
                  await File.updateOne({ _id: f._id }, { $set: { 'publicShare.isActive': false, 'publicShare.code': null, 'publicShare.expiresAt': null } }).catch(() => null);
                  f.publicShare.isActive = false;
                  f.publicShare.code = null;
                  f.publicShare.expiresAt = null;
                }
              }
            } catch (e) {
              // ignore per-file update errors
            }
          }
        }
      }
    } catch (e) {
      // If share metadata fails for some reason, don't block the main listing
      console.error('FILES SERVICE: failed to attach share metadata', e && e.message ? e.message : e);
    }

    return { files, currentFolder: null, breadcrumbs: [] };
  }

  // If parentId provided: fetch the parent folder and enforce permission check
  const parentFolder = await File.findOne({ _id: targetParentId, isDeleted: false, isFolder: true });
  if (!parentFolder) {
    const error = new Error('Folder not found.');
    error.statusCode = 404;
    throw error;
  }

    // Permission check: owner OR direct share (including ancestor shares) OR class share
    const hasAccess = await userHasAccessTo(parentFolder, userId, user);
    if (!hasAccess) {
      const error = new Error('You do not have permission to view this folder.');
      error.statusCode = 403;
      throw error;
    }

  // Authorized: return children with a simple, fast query (permission inheritance)
  const files = await File.find({ parentId: targetParentId, isDeleted: false })
    .sort({ isFolder: -1, fileName: 1 })
    .populate('user', 'name avatar');

  // Build breadcrumbs from parentFolder.path
  // IMPORTANT: For shared folders, only show breadcrumbs starting from the shared folder
  // to prevent users from seeing/clicking on parent folders they don't have access to
  let breadcrumbs = [];
  const normalizedUserId = permissionService.extractStringId(userId);
  const ownerId = permissionService.extractStringId(parentFolder.user);
  const isOwner = ownerId === normalizedUserId;
  let shareRootId = null; // Track the root of the share for navigation

  if (parentFolder && parentFolder.path) {
    const ancestorIds = pathService.extractAncestorIds(parentFolder.path);
    if (ancestorIds.length > 0) {
      const ancestors = await File.find({ _id: { $in: ancestorIds }, isDeleted: false }).select('fileName path');
      const ancestorMap = new Map(ancestors.map((anc) => [anc._id.toString(), anc]));
      
      if (isOwner) {
        // Owner sees full breadcrumb trail
        breadcrumbs = ancestorIds.map((id) => ancestorMap.get(id)).filter(Boolean);
      } else {
        // Shared user: find the topmost ancestor they have direct access to
        // and only show breadcrumbs from that point
        const userObjectId = permissionService.toObjectId(userId);
        const allIdsToCheck = [parentFolder._id, ...ancestorIds].map(permissionService.toObjectId).filter(Boolean);
        
        // Find all shares for this user in the ancestor chain
        const shares = await FileShare.find({
          fileId: { $in: allIdsToCheck },
          userId: userObjectId,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
        }).select('fileId');
        
        const sharedFolderIds = new Set(shares.map(s => String(s.fileId)));
        
        // Find the topmost shared ancestor (the share root)
        let shareRootIndex = -1;
        for (let i = 0; i < ancestorIds.length; i++) {
          if (sharedFolderIds.has(String(ancestorIds[i]))) {
            shareRootIndex = i;
            shareRootId = ancestorIds[i]; // Store the share root ID
            break; // Found the topmost shared ancestor
          }
        }
        
        if (shareRootIndex >= 0) {
          // Only include ancestors from shareRoot onwards (not including shareRoot itself, 
          // as that will be shown as the "root" in shared context)
          breadcrumbs = ancestorIds.slice(shareRootIndex + 1).map((id) => ancestorMap.get(id)).filter(Boolean);
        } else if (sharedFolderIds.has(String(parentFolder._id))) {
          // The current folder itself is the share root, no breadcrumbs needed
          shareRootId = String(parentFolder._id);
          breadcrumbs = [];
        } else {
          // Fallback: show no breadcrumbs for safety
          breadcrumbs = [];
        }
      }
    }
  } else if (!isOwner) {
    // No path but not owner - this folder itself is the share root
    shareRootId = String(parentFolder._id);
  }

  // Add a flag to indicate if this is a shared context (for frontend UI)
  const isSharedContext = !isOwner;

  return { files, currentFolder: parentFolder, breadcrumbs, isSharedContext, shareRootId };
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

  const hasAccess = await userHasAccessTo(file, userId, user);
  if (!hasAccess) {
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

  // Validate permission per-file using helper that also checks ancestor shares
  const unauthorized = [];
  for (const f of candidateFiles) {
    const ok = await userHasAccessTo(f, userId, user);
    if (!ok) unauthorized.push(String(f._id));
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

  const hasAccess = await userHasAccessTo(file, userId, user);
  if (!hasAccess) {
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
 * Uses ClassShare collection to find files shared with student's class
 */
export const searchFilesService = async (userId, user, q) => {
  if (!q || typeof q !== 'string' || q.trim() === '') return [];
  const searchText = q.trim();

  // Use FileShare to find file IDs shared with the user
  const sharedFileIds = await FileShare.find({ userId }).distinct('fileId');

  // Use ClassShare to find files shared with student's class
  let classSharedFileIds = [];
  if (Array.isArray(user.roles) && user.roles.includes('student') && user.studentDetails) {
    classSharedFileIds = await ClassShare.find({
      batch: user.studentDetails.batch,
      semester: user.studentDetails.semester,
      section: user.studentDetails.section,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    }).distinct('fileId');
  }

  const baseOr = [
    { user: userId },
  ];
  if (sharedFileIds && sharedFileIds.length > 0) baseOr.push({ _id: { $in: sharedFileIds } });
  if (classSharedFileIds && classSharedFileIds.length > 0) baseOr.push({ _id: { $in: classSharedFileIds } });

  const query = {
    $text: { $search: searchText },
    isDeleted: false,
    $or: baseOr,
  };

  const files = await File.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, isFolder: -1, fileName: 1 })
    .limit(200)
    .populate('user', 'name avatar')
    ;

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
  // Permission check: owner OR direct share (including ancestor shares) OR class share
  const hasAccess = await userHasAccessTo(parentFolder, userId, user);
  if (!hasAccess) {
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
    ;

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
 * Rename a file (owner only)
 *
 * @param {string} fileId
 * @param {string} userId
 * @param {string} newName
 * @returns {Promise<Object>} Updated file document
 */
export const renameFileService = async (fileId, userId, newName) => {
  const file = await File.findOne({ _id: fileId, user: userId, isDeleted: false, isFolder: false });

  if (!file) {
    const error = new Error('File not found or you do not have permission.');
    error.statusCode = 404;
    throw error;
  }

  // Check for existing name conflict within same parent
  const existing = await File.findOne({
    user: userId,
    fileName: newName,
    parentId: file.parentId || null,
    isDeleted: false,
  });

  if (existing && String(existing._id) !== String(file._id)) {
    const error = new Error('A file or folder with that name already exists in this location.');
    error.statusCode = 400;
    throw error;
  }

  file.fileName = newName;
  try {
    await file.save();
  } catch (err) {
    if (err && err.code === 11000) {
      const error = new Error('A file with that name already exists in this location.');
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }

  return file;
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
