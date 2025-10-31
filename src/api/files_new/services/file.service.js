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

  // Save all files to database
  let newFiles = await File.insertMany(filesMetadata);
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
    });

    if (existingFile) {
      counter++;
      const dotIndex = originalName.lastIndexOf('.');
      const name = originalName.substring(0, dotIndex);
      const extension = originalName.substring(dotIndex);
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

  // Build query for files user has permission to see
  let query = {
    $and: [
      { parentId: targetParentId },
      {
        $or: [
          { user: userId }, // User owns it
          { 'sharedWith.user': userId }, // Shared directly
          // Class share (for students)
          ...(user.role === 'student' && user.studentDetails
            ? [
                {
                  'sharedWithClass.batch': user.studentDetails.batch,
                  'sharedWithClass.section': user.studentDetails.section,
                  'sharedWithClass.semester': user.studentDetails.semester,
                },
              ]
            : []),
        ],
      },
    ],
  };

  // Fetch files and current folder in parallel
  const [files, currentFolder] = await Promise.all([
    File.find(query)
      .sort({ isFolder: -1, fileName: 1 }) // Folders first
      .populate('user', 'name avatar')
      .populate('sharedWith.user', 'name avatar'),

    targetParentId
      ? File.findById(targetParentId).select('fileName path')
      : null,
  ]);

  // Build breadcrumbs from path
  let breadcrumbs = [];
  if (currentFolder && currentFolder.path) {
    const ancestorIds = pathService.extractAncestorIds(currentFolder.path);

    if (ancestorIds.length > 0) {
      const ancestors = await File.find({
        _id: { $in: ancestorIds },
      }).select('fileName');

      // Map to preserve order
      const ancestorMap = new Map(
        ancestors.map((anc) => [anc._id.toString(), anc])
      );
      breadcrumbs = ancestorIds.map((id) => ancestorMap.get(id));
    }
  }

  return { files, currentFolder, breadcrumbs };
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
export const getFileDownloadUrlService = async (fileId, userId) => {
  const file = await File.findById(fileId);

  if (!file) {
    throw new Error('File not found.');
  }

  // Check permission
  const isOwner = file.user.toString() === userId;
  const isSharedWith = file.sharedWith.some(
    (share) =>
      share.user.toString() === userId &&
      (!share.expiresAt || share.expiresAt > new Date())
  );

  if (!isOwner && !isSharedWith) {
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
export const getBulkDownloadFilesService = async (fileIds, userId) => {
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    throw new Error('File IDs must be provided as an array.');
  }

  // Find files user has permission to access
  const accessibleFiles = await File.find({
    _id: { $in: fileIds },
    $or: [
      { user: userId }, // Owner
      { 'sharedWith.user': userId }, // Shared with
    ],
  });

  // Check if user has permission for all requested files
  if (accessibleFiles.length !== fileIds.length) {
    const error = new Error(
      'You do not have permission to download one or more of the selected files.'
    );
    error.statusCode = 403;
    throw error;
  }

  return accessibleFiles;
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

  // Only owner can delete
  if (file.user.toString() !== userId) {
    const error = new Error('You do not have permission to delete this file.');
    error.statusCode = 403;
    throw error;
  }

  // Delete from S3 (using old service for now)
  const { deleteFile: deleteFromS3 } = await import(
    '../../../services/s3.service.js'
  );
  await deleteFromS3(file.s3Key);

  // Delete from database
  await File.findByIdAndDelete(fileId);

  return { message: 'File deleted successfully.' };
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

  // Delete from S3 in parallel
  const { deleteFile: deleteFromS3 } = await import(
    '../../../services/s3.service.js'
  );
  const deleteS3Promises = filesToDelete.map((file) =>
    deleteFromS3(file.s3Key)
  );
  await Promise.all(deleteS3Promises);

  // Delete from database
  await File.deleteMany({
    _id: { $in: fileIds },
    user: userId,
  });

  return { message: `${filesToDelete.length} files deleted successfully.` };
};
