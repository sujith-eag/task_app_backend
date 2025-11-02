import File from '../../../models/fileModel.js';
import FileShare from '../../../models/fileshareModel.js';

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

    const isOwner = item.user.toString() === userId.toString();

    // Check direct shares in FileShare collection
    let isSharedWith = false;
    try {
      const fsDoc = await FileShare.findOne({ fileId: item._id, userId });
      if (fsDoc) {
        isSharedWith = !fsDoc.expiresAt || fsDoc.expiresAt > new Date();
      }
    } catch (e) {
      isSharedWith = false;
    }

    if (!isOwner && !isSharedWith) {
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
