import File from '../../../models/fileModel.js';
import FileShare from '../../../models/fileshareModel.js';

// ============================================================================
// Authorization Policies
// ============================================================================

/**
 * Check if user is file owner
 * Attached to req.file by previous middleware
 */
export const isFileOwner = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    // Check if file already loaded by previous middleware
    let file = req.file;
    if (!file) {
      file = await File.findById(fileId);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      req.file = file;
    }

    // Check ownership
    if (file.uploadedBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: 'Access denied: You are not the file owner' });
    }

    next();
  } catch (error) {
    console.error('Error in isFileOwner policy:', error);
    res.status(500).json({ message: 'Error verifying file ownership' });
  }
};

/**
 * Check if user can share the file
 * (For direct and class shares)
 */
export const canShareFile = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    // Check if file already loaded
    let file = req.file;
    if (!file) {
      file = await File.findById(fileId);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      req.file = file;
    }

    // Only owner can share files
    if (file.uploadedBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: 'Access denied: Only file owner can share files' });
    }

    // Can't share files in trash
    if (file.isDeleted) {
      return res
        .status(400)
        .json({ message: 'Cannot share files that are in trash' });
    }

    next();
  } catch (error) {
    console.error('Error in canShareFile policy:', error);
    res.status(500).json({ message: 'Error verifying share permissions' });
  }
};

/**
 * Check if user can access public share
 * Used for revoking public shares
 */
export const canAccessPublicShare = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    // Load file if not already loaded
    let file = req.file;
    if (!file) {
      file = await File.findById(fileId);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      req.file = file;
    }

    // Only file owner can manage public shares
    if (file.uploadedBy.toString() !== userId.toString()) {
      return res.status(403).json({
        message: 'Access denied: Only file owner can manage public shares',
      });
    }

    next();
  } catch (error) {
    console.error('Error in canAccessPublicShare policy:', error);
    res.status(500).json({ message: 'Error verifying share access' });
  }
};

/**
 * Validate share permissions for managing access
 * (Used when owner removes user or user removes self)
 */
export const validateSharePermissions = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;
    const { userIdToRemove } = req.body;

    // Load file
    let file = req.file;
    if (!file) {
      file = await File.findById(fileId);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      req.file = file;
    }

    const isOwner = file.uploadedBy.toString() === userId.toString();

    // If removing self, always allowed (if shared with user)
    if (
      !userIdToRemove ||
      userIdToRemove.toString() === userId.toString()
    ) {
      // User removing self - verify they have access
      const hasAccess = await FileShare.userHasAccess(fileId, userId);
      if (!hasAccess && !isOwner) {
        return res.status(403).json({
          message: 'You do not have access to this file',
        });
      }
      next();
      return;
    }

    // If removing someone else, must be owner
    if (!isOwner) {
      return res.status(403).json({
        message: 'Access denied: Only file owner can remove other users',
      });
    }

    next();
  } catch (error) {
    console.error('Error in validateSharePermissions policy:', error);
    res.status(500).json({ message: 'Error validating share permissions' });
  }
};

/**
 * Check if user can view file shares
 * (Owner or users with access)
 */
export const canViewFileShares = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    // Load file
    let file = req.file;
    if (!file) {
      file = await File.findById(fileId);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      req.file = file;
    }

    const isOwner = file.uploadedBy.toString() === userId.toString();

    // Owner can always view
    if (isOwner) {
      next();
      return;
    }

    // Check if user has access to the file
    const hasAccess = await FileShare.userHasAccess(fileId, userId);
    if (!hasAccess) {
      return res.status(403).json({
        message: 'Access denied: You do not have access to this file',
      });
    }

    next();
  } catch (error) {
    console.error('Error in canViewFileShares policy:', error);
    res.status(500).json({ message: 'Error verifying view permissions' });
  }
};

/**
 * Load file and attach to request
 * Reusable middleware for file loading
 */
export const loadFile = async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    req.file = file;
    next();
  } catch (error) {
    console.error('Error loading file:', error);
    res.status(500).json({ message: 'Error loading file' });
  }
};
