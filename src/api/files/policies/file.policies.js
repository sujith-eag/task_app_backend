import File from '../../../models/fileModel.js';
import FileShare from '../../../models/fileshareModel.js';
import * as pathService from '../services/path.service.js';
import mongoose from 'mongoose';

// ============================================================================
// Authorization Policies for Files Module
// ============================================================================

/**
 * Check if user is the owner of a file/folder
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Express next function
 */
export const isOwner = async (req, res, next) => {
  try {
    const itemId = req.params.id;
    const userId = req.user._id;

    const item = await File.findById(itemId);

    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (item.user.toString() !== userId.toString()) {
      return res.status(403).json({
        message: 'You do not have permission to access this item.',
      });
    }

    // Attach item to request for use in controller
    req.item = item;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user has read access to a file (owner or shared with)
 * FIXED: Now checks ancestor folder shares for inherited access
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Express next function
 */
export const hasReadAccess = async (req, res, next) => {
  try {
    const itemId = req.params.id;
    const userId = req.user._id;

    const item = await File.findById(itemId);

    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    // Check 1: Owner always has access
    const isOwner = item.user.toString() === userId.toString();
    if (isOwner) {
      req.item = item;
      return next();
    }

    // Check 2: Direct share OR inherited ancestor share
    const ancestorIds = pathService.extractAncestorIds(item.path || '');
    
    // Convert all IDs to ObjectId for proper MongoDB matching
    const idsToCheck = [item._id, ...ancestorIds.map(id => 
      mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
    )];
    
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;

    let isSharedWith = false;
    try {
      const fsDoc = await FileShare.findOne({ 
        fileId: { $in: idsToCheck }, 
        userId: userObjectId,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      });
      isSharedWith = !!fsDoc;
    } catch (e) {
      isSharedWith = false;
    }

    // Check 3: Class share (for students) - use ClassShare collection
    if (!isSharedWith && req.user && Array.isArray(req.user.roles) && req.user.roles.includes('student') && req.user.studentDetails) {
      const ClassShare = (await import('../../../models/classShareModel.js')).default;
      try {
        const classShare = await ClassShare.exists({
          fileId: item._id,
          batch: req.user.studentDetails.batch,
          semester: req.user.studentDetails.semester,
          section: req.user.studentDetails.section,
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
          ]
        });
        if (classShare) {
          isSharedWith = true;
        }
      } catch (e) {
        // Continue with isSharedWith = false
      }
    }

    if (!isSharedWith) {
      return res.status(403).json({
        message: 'You do not have permission to access this item.',
      });
    }

    // Attach item to request
    req.item = item;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user is within their storage quota
 * Uses the quota middleware from _common, but this is a placeholder
 * for any files-specific quota logic
 */
export const checkFileQuota = async (req, res, next) => {
  // This will be handled by the quota.middleware.js in _common
  // But we can add files-specific logic here if needed
  next();
};

/**
 * Check if user has permission to upload to a folder
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Express next function
 */
export const canUploadToFolder = async (req, res, next) => {
  try {
    const { parentId } = req.body;

    // If no parent (root), allow
    if (!parentId || parentId === 'null') {
      return next();
    }

    const userId = req.user._id;
    const folder = await File.findOne({
      _id: parentId,
      user: userId,
      isFolder: true,
    });

    if (!folder) {
      return res.status(404).json({
        message:
          'Parent folder not found or you do not have permission to upload here.',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validate file types are allowed
 * This is a placeholder - implement based on your requirements
 */
export const validateFileTypes = (req, res, next) => {
  // Add file type validation logic here if needed
  // For now, accept all file types
  next();
};
