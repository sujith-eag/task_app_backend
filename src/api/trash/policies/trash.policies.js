import File from '../../../models/fileModel.js';

// ============================================================================
// Authorization Policies
// ============================================================================

/**
 * Load file and verify it exists
 * Attaches file to req.file
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

/**
 * Verify user is the file owner
 * Requires loadFile to be called first
 */
export const isFileOwner = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const file = req.file;

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (file.user.toString() !== userId.toString()) {
      return res.status(403).json({
        message: 'Access denied: You are not the file owner',
      });
    }

    next();
  } catch (error) {
    console.error('Error in isFileOwner policy:', error);
    res.status(500).json({ message: 'Error verifying ownership' });
  }
};

/**
 * Verify file is in trash (soft-deleted)
 * Required for restore and purge operations
 */
export const isInTrash = async (req, res, next) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (!file.isDeleted) {
      return res.status(400).json({
        message: 'File is not in trash',
      });
    }

    next();
  } catch (error) {
    console.error('Error in isInTrash policy:', error);
    res.status(500).json({ message: 'Error checking trash status' });
  }
};

/**
 * Verify file is NOT in trash
 * Required for soft-delete operations
 */
export const isNotInTrash = async (req, res, next) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (file.isDeleted) {
      return res.status(400).json({
        message: 'File is already in trash',
      });
    }

    next();
  } catch (error) {
    console.error('Error in isNotInTrash policy:', error);
    res.status(500).json({ message: 'Error checking trash status' });
  }
};

/**
 * Verify user has admin role
 * Required for admin operations (hard delete, cleanup)
 */
export const isAdmin = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user.roles || !user.roles.includes('admin')) {
      return res.status(403).json({
        message: 'Access denied: Admin privileges required',
      });
    }

    next();
  } catch (error) {
    console.error('Error in isAdmin policy:', error);
    res.status(500).json({ message: 'Error verifying admin privileges' });
  }
};

/**
 * Validate parent folder for restore operation
 * Ensures parent exists and is not deleted
 */
export const validateParentForRestore = async (req, res, next) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // If file has no parent (root level), it's valid
    if (!file.parentId) {
      next();
      return;
    }

    // Check if parent exists and is not deleted
    const parent = await File.findById(file.parentId);
    if (!parent) {
      return res.status(400).json({
        message: 'Cannot restore: Parent folder does not exist',
      });
    }

    if (parent.isDeleted) {
      return res.status(400).json({
        message: 'Cannot restore: Parent folder is deleted. Restore parent first.',
      });
    }

    next();
  } catch (error) {
    console.error('Error in validateParentForRestore policy:', error);
    res.status(500).json({ message: 'Error validating parent folder' });
  }
};

/**
 * Rate limit protection for bulk operations
 * Prevents abuse of bulk delete/restore/purge
 */
export const bulkOperationLimit = async (req, res, next) => {
  try {
    const { fileIds } = req.body;

    // Limit bulk operations to 100 items at a time
    const MAX_BULK_SIZE = 100;

    if (fileIds && fileIds.length > MAX_BULK_SIZE) {
      return res.status(400).json({
        message: `Bulk operation limited to ${MAX_BULK_SIZE} items at a time`,
      });
    }

    next();
  } catch (error) {
    console.error('Error in bulkOperationLimit policy:', error);
    res.status(500).json({ message: 'Error validating bulk operation' });
  }
};

/**
 * Verify cleanup operation parameters
 * Ensures retention days is reasonable
 */
export const validateCleanup = async (req, res, next) => {
  try {
    const { retentionDays = 30 } = req.body;

    // Prevent accidental immediate deletion
    const MIN_RETENTION = 1;
    const MAX_RETENTION = 365;

    if (retentionDays < MIN_RETENTION || retentionDays > MAX_RETENTION) {
      return res.status(400).json({
        message: `Retention days must be between ${MIN_RETENTION} and ${MAX_RETENTION}`,
      });
    }

    next();
  } catch (error) {
    console.error('Error in validateCleanup policy:', error);
    res.status(500).json({ message: 'Error validating cleanup parameters' });
  }
};
