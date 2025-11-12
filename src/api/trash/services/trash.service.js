import mongoose from 'mongoose';
import File from '../../../models/fileModel.js';
import FileShare from '../../../models/fileshareModel.js';
import { deleteFile as deleteFromS3 } from '../../../services/s3/s3.service.js';

// ============================================================================
// Soft Delete Operations
// ============================================================================

/**
 * Soft delete a file or folder
 * Sets isDeleted=true, records deletedAt and deletedBy
 * If folder, recursively soft-deletes all descendants
 * @param {string} fileId - File/folder ID to delete
 * @param {string} userId - User performing the deletion
 * @returns {Object} - Deletion result with count
 */
export const softDeleteFileService = async (fileId, userId) => {
  // Find the file/folder
  const file = await File.findById(fileId);
  if (!file) {
    throw new Error('File not found');
  }

  // Verify ownership
  if (file.user.toString() !== userId.toString()) {
    const error = new Error('Access denied: You are not the file owner');
    error.statusCode = 403;
    throw error;
  }

  // Check if already deleted
  if (file.isDeleted) {
    throw new Error('File is already in trash');
  }

  const now = new Date();
  let deletedCount = 0;

  if (file.isFolder) {
    // Recursively soft-delete all descendants using path
    const pathPattern = new RegExp(`^${file.path}${file._id},`);
    const result = await File.updateMany(
      {
        $or: [
          { _id: fileId }, // The folder itself
          { path: pathPattern, user: userId } // All descendants
        ],
        isDeleted: false
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: now,
          deletedBy: userId
        }
      }
    );
    deletedCount = result.modifiedCount;
  } else {
    // Single file soft-delete
    file.isDeleted = true;
    file.deletedAt = now;
    file.deletedBy = userId;
    await file.save();
    deletedCount = 1;
  }

  // Deactivate all shares for the deleted file(s)
  // This prevents accessing deleted files via share links
  if (file.isFolder) {
    const descendantIds = await File.find(
      { path: new RegExp(`^${file.path}${file._id},`), user: userId },
      { _id: 1 }
    ).lean();
    const allFileIds = [fileId, ...descendantIds.map(d => d._id)];
    
    // Deactivate public shares on the File documents (publicShare lives on File)
    await File.updateMany(
      { _id: { $in: allFileIds } },
      { $set: { 'publicShare.isActive': false } }
    );
  } else {
    // Deactivate public share for single file
    await File.updateOne(
      { _id: fileId },
      { $set: { 'publicShare.isActive': false } }
    );
  }

  return {
    message: file.isFolder 
      ? `Folder and ${deletedCount} items moved to trash`
      : 'File moved to trash',
    deletedCount,
    file: {
      _id: file._id,
      fileName: file.fileName,
      isFolder: file.isFolder,
      deletedAt: now
    }
  };
};

/**
 * Bulk soft delete multiple files/folders
 * @param {Array<string>} fileIds - Array of file IDs to delete
 * @param {string} userId - User performing the deletion
 * @returns {Object} - Deletion result with count
 */
export const bulkSoftDeleteService = async (fileIds, userId) => {
  // Find all files that belong to the user
  const files = await File.find({
    _id: { $in: fileIds },
    user: userId,
    isDeleted: false
  });

  if (files.length === 0) {
    throw new Error('No files found to delete');
  }

  // Security check: ensure user owns all files
  if (files.length !== fileIds.length) {
    const error = new Error('You do not have permission to delete one or more files');
    error.statusCode = 403;
    throw error;
  }

  const now = new Date();
  let totalDeleted = 0;

  // Process each file/folder
  for (const file of files) {
    if (file.isFolder) {
      // Get all descendants
      const pathPattern = new RegExp(`^${file.path}${file._id},`);
      const result = await File.updateMany(
        {
          $or: [
            { _id: file._id },
            { path: pathPattern, user: userId }
          ],
          isDeleted: false
        },
        {
          $set: {
            isDeleted: true,
            deletedAt: now,
            deletedBy: userId
          }
        }
      );
      totalDeleted += result.modifiedCount;
    } else {
      // Single file
      file.isDeleted = true;
      file.deletedAt = now;
      file.deletedBy = userId;
      await file.save();
      totalDeleted++;
    }
  }

  // Deactivate public shares on the File documents
  await File.updateMany(
    { _id: { $in: fileIds } },
    { $set: { 'publicShare.isActive': false } }
  );

  return {
    message: `${totalDeleted} items moved to trash`,
    deletedCount: totalDeleted
  };
};

// ============================================================================
// Restore Operations
// ============================================================================

/**
 * Restore a soft-deleted file or folder
 * If folder, recursively restores all descendants
 * @param {string} fileId - File/folder ID to restore
 * @param {string} userId - User performing the restoration
 * @returns {Object} - Restoration result
 */
export const restoreFileService = async (fileId, userId) => {
  // Find the deleted file/folder
  const file = await File.findById(fileId);
  if (!file) {
    throw new Error('File not found');
  }

  // Verify ownership
  if (file.user.toString() !== userId.toString()) {
    const error = new Error('Access denied: You are not the file owner');
    error.statusCode = 403;
    throw error;
  }

  // Check if it's actually deleted
  if (!file.isDeleted) {
    throw new Error('File is not in trash');
  }

  // Check if parent folder exists and is not deleted
  if (file.parentId) {
    const parent = await File.findById(file.parentId);
    if (!parent || parent.isDeleted) {
      const error = new Error('Cannot restore: Parent folder is deleted or does not exist. Restore parent first or move to root.');
      error.statusCode = 400;
      throw error;
    }
  }

  let restoredCount = 0;

  if (file.isFolder) {
    // Recursively restore all descendants
    const pathPattern = new RegExp(`^${file.path}${file._id},`);
    const result = await File.updateMany(
      {
        $or: [
          { _id: fileId },
          { path: pathPattern, user: userId }
        ],
        isDeleted: true
      },
      {
        $set: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null
        }
      }
    );
    restoredCount = result.modifiedCount;
  } else {
    // Single file restore
    file.isDeleted = false;
    file.deletedAt = null;
    file.deletedBy = null;
    await file.save();
    restoredCount = 1;
  }

  return {
    message: file.isFolder
      ? `Folder and ${restoredCount} items restored`
      : 'File restored successfully',
    restoredCount,
    file: {
      _id: file._id,
      fileName: file.fileName,
      isFolder: file.isFolder,
      parentId: file.parentId
    }
  };
};

/**
 * Bulk restore multiple files/folders
 * @param {Array<string>} fileIds - Array of file IDs to restore
 * @param {string} userId - User performing the restoration
 * @returns {Object} - Restoration result
 */
export const bulkRestoreService = async (fileIds, userId) => {
  const files = await File.find({
    _id: { $in: fileIds },
    user: userId,
    isDeleted: true
  });

  if (files.length === 0) {
    throw new Error('No deleted files found to restore');
  }

  let totalRestored = 0;

  // Process each file/folder
  for (const file of files) {
    // Check parent validity
    if (file.parentId) {
      const parent = await File.findById(file.parentId);
      if (!parent || parent.isDeleted) {
        // Skip files with deleted/missing parents
        console.warn(`Skipping ${file.fileName}: parent folder unavailable`);
        continue;
      }
    }

    if (file.isFolder) {
      const pathPattern = new RegExp(`^${file.path}${file._id},`);
      const result = await File.updateMany(
        {
          $or: [
            { _id: file._id },
            { path: pathPattern, user: userId }
          ],
          isDeleted: true
        },
        {
          $set: {
            isDeleted: false,
            deletedAt: null,
            deletedBy: null
          }
        }
      );
      totalRestored += result.modifiedCount;
    } else {
      file.isDeleted = false;
      file.deletedAt = null;
      file.deletedBy = null;
      await file.save();
      totalRestored++;
    }
  }

  return {
    message: `${totalRestored} items restored from trash`,
    restoredCount: totalRestored,
    skipped: files.length - totalRestored
  };
};

// ============================================================================
// Permanent Delete (Purge) Operations
// ============================================================================

/**
 * Permanently delete a soft-deleted file
 * Removes from S3 and database
 * @param {string} fileId - File ID to purge
 * @param {string} userId - User performing the purge
 * @returns {Object} - Purge result
 */
export const purgeFileService = async (fileId, userId) => {
  const file = await File.findById(fileId);
  if (!file) {
    throw new Error('File not found');
  }

  // Verify ownership
  if (file.user.toString() !== userId.toString()) {
    const error = new Error('Access denied: You are not the file owner');
    error.statusCode = 403;
    throw error;
  }

  // Must be soft-deleted first
  if (!file.isDeleted) {
    throw new Error('File must be in trash before permanent deletion');
  }

  let purgedCount = 0;
  const s3Keys = [];

  if (file.isFolder) {
    // Get all descendants
    const pathPattern = new RegExp(`^${file.path}${file._id},`);
    const descendants = await File.find({
      path: pathPattern,
      user: userId,
      isDeleted: true,
      isFolder: false // Only get actual files, not folders
    });

    // Collect S3 keys from descendants
    s3Keys.push(...descendants.map(d => d.s3Key).filter(Boolean));

    // Delete folder and all descendants from database
    const result = await File.deleteMany({
      $or: [
        { _id: fileId },
        { path: pathPattern, user: userId }
      ],
      isDeleted: true
    });
    purgedCount = result.deletedCount;
  } else {
    // Single file
    if (file.s3Key) {
      s3Keys.push(file.s3Key);
    }
    await File.findByIdAndDelete(fileId);
    purgedCount = 1;
  }

  // Delete from S3
  if (s3Keys.length > 0) {
    await Promise.all(s3Keys.map(key => deleteFromS3(key)));
  }

  // Delete all associated shares
  if (file.isFolder) {
    const descendantIds = await File.find(
      { path: new RegExp(`^${file.path}${file._id},`), user: userId },
      { _id: 1 }
    ).lean();
    const allFileIds = [fileId, ...descendantIds.map(d => d._id)];
  await FileShare.deleteMany({ fileId: { $in: allFileIds } });
  } else {
  await FileShare.deleteMany({ fileId: fileId });
  }

  return {
    message: file.isFolder
      ? `Folder and ${purgedCount} items permanently deleted`
      : 'File permanently deleted',
    purgedCount,
    s3KeysDeleted: s3Keys.length
  };
};

/**
 * Bulk permanently delete multiple files
 * @param {Array<string>} fileIds - Array of file IDs to purge
 * @param {string} userId - User performing the purge
 * @returns {Object} - Purge result
 */
export const bulkPurgeService = async (fileIds, userId) => {
  const files = await File.find({
    _id: { $in: fileIds },
    user: userId,
    isDeleted: true
  });

  if (files.length === 0) {
    throw new Error('No deleted files found to purge');
  }

  // Security check
  if (files.length !== fileIds.length) {
    const error = new Error('You do not have permission to delete one or more files');
    error.statusCode = 403;
    throw error;
  }

  let totalPurged = 0;
  const s3Keys = [];

  for (const file of files) {
    if (file.isFolder) {
      const pathPattern = new RegExp(`^${file.path}${file._id},`);
      const descendants = await File.find({
        path: pathPattern,
        user: userId,
        isDeleted: true,
        isFolder: false
      });

      s3Keys.push(...descendants.map(d => d.s3Key).filter(Boolean));

      const result = await File.deleteMany({
        $or: [
          { _id: file._id },
          { path: pathPattern, user: userId }
        ],
        isDeleted: true
      });
      totalPurged += result.deletedCount;
    } else {
      if (file.s3Key) {
        s3Keys.push(file.s3Key);
      }
      await File.findByIdAndDelete(file._id);
      totalPurged++;
    }
  }

  // Delete from S3
  if (s3Keys.length > 0) {
    await Promise.all(s3Keys.map(key => deleteFromS3(key)));
  }

  // Delete all associated shares
  await FileShare.deleteMany({ fileId: { $in: fileIds } });

  return {
    message: `${totalPurged} items permanently deleted`,
    purgedCount: totalPurged,
    s3KeysDeleted: s3Keys.length
  };
};

/**
 * Empty entire trash for a user
 * Permanently deletes all soft-deleted files
 * @param {string} userId - User ID
 * @returns {Object} - Empty trash result
 */
export const emptyTrashService = async (userId) => {
  // Find all deleted files
  const deletedFiles = await File.find({
    user: userId,
    isDeleted: true,
    isFolder: false // Only actual files with S3 keys
  });

  // Collect S3 keys
  const s3Keys = deletedFiles.map(f => f.s3Key).filter(Boolean);

  // Delete from S3
  if (s3Keys.length > 0) {
    await Promise.all(s3Keys.map(key => deleteFromS3(key)));
  }

  // Get all deleted file IDs for share cleanup
  const deletedFileIds = await File.find(
    { user: userId, isDeleted: true },
    { _id: 1 }
  ).lean();

  // Delete all files and folders from database
  const result = await File.deleteMany({
    user: userId,
    isDeleted: true
  });

  // Delete all associated shares
  await FileShare.deleteMany({
    fileId: { $in: deletedFileIds.map(f => f._id) }
  });

  return {
    message: 'Trash emptied successfully',
    purgedCount: result.deletedCount,
    s3KeysDeleted: s3Keys.length
  };
};

// ============================================================================
// Query/List Operations
// ============================================================================

/**
 * Get all items in trash for a user
 * Returns only top-level items (folders show descendant count)
 * @param {string} userId - User ID
 * @returns {Array} - List of deleted files/folders
 */
export const listTrashService = async (userId) => {
  // Get all deleted items for the user
  const deletedItems = await File.find({
    user: userId,
    isDeleted: true
  })
    .select('fileName fileType size isFolder parentId path deletedAt deletedBy')
    .sort({ deletedAt: -1 })
    .lean();

  // For each folder, calculate descendant count
  const itemsWithCounts = await Promise.all(
    deletedItems.map(async (item) => {
      if (item.isFolder) {
        const pathPattern = new RegExp(`^${item.path}${item._id},`);
        const descendantCount = await File.countDocuments({
          path: pathPattern,
          user: userId,
          isDeleted: true
        });
        return { ...item, descendantCount };
      }
      return item;
    })
  );

  return {
    items: itemsWithCounts,
    count: itemsWithCounts.length
  };
};

/**
 * Get trash statistics for a user
 * @param {string} userId - User ID
 * @returns {Object} - Trash statistics
 */
export const getTrashStatsService = async (userId) => {
  const deletedFiles = await File.find({
    user: userId,
    isDeleted: true,
    isFolder: false
  }).select('size');

  const folderCount = await File.countDocuments({
    user: userId,
    isDeleted: true,
    isFolder: true
  });

  const totalSize = deletedFiles.reduce((sum, file) => sum + (file.size || 0), 0);

  return {
    fileCount: deletedFiles.length,
    folderCount,
    totalItems: deletedFiles.length + folderCount,
    totalSize,
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
  };
};

// ============================================================================
// Cleanup/Maintenance Operations
// ============================================================================

/**
 * Clean up old deleted files (auto-purge)
 * Permanently deletes files that have been in trash longer than retention period
 * @param {number} retentionDays - Number of days to keep in trash (default: 30)
 * @returns {Object} - Cleanup result
 */
export const cleanExpiredTrashService = async (retentionDays = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Find expired deleted files
  const expiredFiles = await File.find({
    isDeleted: true,
    deletedAt: { $lt: cutoffDate },
    isFolder: false
  });

  // Collect S3 keys
  const s3Keys = expiredFiles.map(f => f.s3Key).filter(Boolean);

  // Get all expired file IDs (including folders)
  const expiredFileIds = await File.find(
    { isDeleted: true, deletedAt: { $lt: cutoffDate } },
    { _id: 1 }
  ).lean();

  // Delete from S3
  if (s3Keys.length > 0) {
    await Promise.all(s3Keys.map(key => deleteFromS3(key)));
  }

  // Delete from database
  const result = await File.deleteMany({
    isDeleted: true,
    deletedAt: { $lt: cutoffDate }
  });

  // Delete associated shares
  await FileShare.deleteMany({
    fileId: { $in: expiredFileIds.map(f => f._id) }
  });

  return {
    message: `Cleaned up ${result.deletedCount} items older than ${retentionDays} days`,
    purgedCount: result.deletedCount,
    s3KeysDeleted: s3Keys.length,
    cutoffDate
  };
};

/**
 * Admin hard delete (bypass soft-delete)
 * Direct permanent deletion without requiring soft-delete first
 * USE WITH CAUTION - Admin only
 * @param {string} fileId - File ID
 * @param {string} adminUserId - Admin user ID
 * @returns {Object} - Deletion result
 */
export const adminHardDeleteService = async (fileId, adminUserId) => {
  const file = await File.findById(fileId);
  if (!file) {
    throw new Error('File not found');
  }

  let deletedCount = 0;
  const s3Keys = [];

  if (file.isFolder) {
    const pathPattern = new RegExp(`^${file.path}${file._id},`);
    const descendants = await File.find({
      path: pathPattern,
      isFolder: false
    });

    s3Keys.push(...descendants.map(d => d.s3Key).filter(Boolean));

    const result = await File.deleteMany({
      $or: [
        { _id: fileId },
        { path: pathPattern }
      ]
    });
    deletedCount = result.deletedCount;
  } else {
    if (file.s3Key) {
      s3Keys.push(file.s3Key);
    }
    await File.findByIdAndDelete(fileId);
    deletedCount = 1;
  }

  // Delete from S3
  if (s3Keys.length > 0) {
    await Promise.all(s3Keys.map(key => deleteFromS3(key)));
  }

  // Delete shares
  await FileShare.deleteMany({ fileId: fileId });

  return {
    message: `Admin hard delete: ${deletedCount} items permanently removed`,
    deletedCount,
    s3KeysDeleted: s3Keys.length,
    performedBy: adminUserId
  };
};

export default {
  // Soft-delete / purge / restore
  softDeleteFileService,
  bulkSoftDeleteService,
  restoreFileService,
  bulkRestoreService,
  purgeFileService,
  bulkPurgeService,
  emptyTrashService,
  // Listing / stats / maintenance
  listTrashService,
  getTrashStatsService,
  cleanExpiredTrashService,
  // Admin
  adminHardDeleteService
};
