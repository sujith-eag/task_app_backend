/**
 * Permission Service - Centralized access control for files and folders
 * 
 * This service is the single source of truth for all permission checks.
 * It handles:
 * - Ownership checks
 * - Direct file/folder shares (FileShare model)
 * - Inherited folder shares (ancestor traversal)
 * - Class shares (for students)
 * - Share expiration
 */

import mongoose from 'mongoose';
import File from '../../../models/fileModel.js';
import FileShare from '../../../models/fileshareModel.js';
import ClassShare from '../../../models/classShareModel.js';
import * as pathService from './path.service.js';

/**
 * Convert a string or ObjectId to ObjectId for consistent MongoDB queries
 * @param {string|ObjectId} id 
 * @returns {ObjectId|string}
 */
export const toObjectId = (id) => {
  if (!id) return null;
  if (typeof id === 'object' && id._id) {
    id = id._id;
  }
  const strId = String(id);
  return mongoose.Types.ObjectId.isValid(strId) 
    ? new mongoose.Types.ObjectId(strId) 
    : strId;
};

/**
 * Extract string ID from various ID formats
 * @param {string|ObjectId|Object} val 
 * @returns {string|null}
 */
export const extractStringId = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (val._id) return String(val._id);
  return String(val);
};

/**
 * Check if a user has read access to a file/folder
 * 
 * Access is granted if:
 * 1. User is the owner
 * 2. User has a direct FileShare for this file
 * 3. User has a FileShare for any ancestor folder
 * 4. User is a student and file has matching class share
 * 
 * @param {string|ObjectId} fileId - File/folder ID
 * @param {string|ObjectId} userId - User ID
 * @param {Object|null} user - Full user object (for class share checks)
 * @returns {Promise<{hasAccess: boolean, reason: string, file?: Object, sharedVia?: ObjectId}>}
 */
export const checkReadAccess = async (fileId, userId, user = null) => {
  const file = await File.findById(fileId);
  
  if (!file) {
    return { hasAccess: false, reason: 'not_found' };
  }
  
  if (file.isDeleted) {
    return { hasAccess: false, reason: 'deleted' };
  }

  const normalizedUserId = extractStringId(userId);
  const ownerId = extractStringId(file.user);
  
  // Check 1: Ownership
  if (ownerId === normalizedUserId) {
    return { hasAccess: true, reason: 'owner', file };
  }

  // Check 2 & 3: Direct share or inherited ancestor share
  const ancestorIds = pathService.extractAncestorIds(file.path || '');
  const idsToCheck = [fileId, ...ancestorIds].map(toObjectId).filter(Boolean);
  const userObjectId = toObjectId(userId);

  try {
    const share = await FileShare.findOne({
      fileId: { $in: idsToCheck },
      userId: userObjectId,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (share) {
      const isDirect = extractStringId(share.fileId) === extractStringId(fileId);
      return { 
        hasAccess: true, 
        reason: isDirect ? 'direct_share' : 'inherited_share',
        sharedVia: share.fileId,
        file 
      };
    }
  } catch (e) {
    // Log but continue to class-share checks
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Permission] FileShare check error:', e.message);
    }
  }

  // Check 4: Class share (using ClassShare collection)
  if (user && Array.isArray(user.roles) && user.roles.includes('student') && user.studentDetails) {
    try {
      const classShare = await ClassShare.findOne({
        fileId,
        batch: user.studentDetails.batch,
        semester: user.studentDetails.semester,
        section: user.studentDetails.section,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      if (classShare) {
        return { 
          hasAccess: true, 
          reason: 'class_share', 
          file,
          sharedVia: classShare._id
        };
      }

      // Also check ancestor folders for class shares
      if (ancestorIds.length > 0) {
        const ancestorClassShare = await ClassShare.findOne({
          fileId: { $in: idsToCheck },
          batch: user.studentDetails.batch,
          semester: user.studentDetails.semester,
          section: user.studentDetails.section,
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
          ]
        });

        if (ancestorClassShare) {
          return {
            hasAccess: true,
            reason: 'inherited_class_share',
            file,
            sharedVia: ancestorClassShare.fileId
          };
        }
      }
    } catch (e) {
      // Log but don't fail the request
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Permission] ClassShare check error:', e.message);
      }
    }
  }

  return { hasAccess: false, reason: 'no_access', file };
};

/**
 * Check if a user has write access (modify, rename, move, delete) to a file/folder
 * 
 * Write access is only granted to the owner.
 * 
 * @param {string|ObjectId} fileId - File/folder ID
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<{hasAccess: boolean, reason: string, file?: Object}>}
 */
export const checkWriteAccess = async (fileId, userId) => {
  const file = await File.findById(fileId);
  
  if (!file) {
    return { hasAccess: false, reason: 'not_found' };
  }
  
  if (file.isDeleted) {
    return { hasAccess: false, reason: 'deleted' };
  }

  const normalizedUserId = extractStringId(userId);
  const ownerId = extractStringId(file.user);

  if (ownerId === normalizedUserId) {
    return { hasAccess: true, reason: 'owner', file };
  }

  return { hasAccess: false, reason: 'not_owner', file };
};

/**
 * Check read access for multiple files at once
 * Returns arrays of accessible and denied file IDs
 * 
 * @param {Array<string|ObjectId>} fileIds - Array of file IDs
 * @param {string|ObjectId} userId - User ID
 * @param {Object|null} user - Full user object (for class share checks)
 * @returns {Promise<{accessible: Array, denied: Array, results: Map}>}
 */
export const checkBulkReadAccess = async (fileIds, userId, user = null) => {
  const results = new Map();
  const accessible = [];
  const denied = [];

  // Process in parallel for performance
  const checks = await Promise.all(
    fileIds.map(async (fileId) => {
      const result = await checkReadAccess(fileId, userId, user);
      return { fileId, result };
    })
  );

  for (const { fileId, result } of checks) {
    results.set(extractStringId(fileId), result);
    if (result.hasAccess) {
      accessible.push(fileId);
    } else {
      denied.push(fileId);
    }
  }

  return { accessible, denied, results };
};

/**
 * Check if user has access to a file through any ancestor folder share
 * This is a lower-level helper for cases where you already have the file
 * 
 * @param {Object} file - File document (must have path field)
 * @param {string|ObjectId} userId - User ID
 * @param {Object|null} user - Full user object
 * @returns {Promise<boolean>}
 */
export const hasInheritedAccess = async (file, userId, user = null) => {
  if (!file) return false;
  
  const result = await checkReadAccess(file._id, userId, user);
  return result.hasAccess;
};

export default {
  checkReadAccess,
  checkWriteAccess,
  checkBulkReadAccess,
  hasInheritedAccess,
  toObjectId,
  extractStringId
};
