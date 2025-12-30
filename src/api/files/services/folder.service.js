import File from '../../../models/fileModel.js';
import FileShare from '../../../models/fileshareModel.js';
import ClassShare from '../../../models/classShareModel.js';
import mongoose from 'mongoose';
import * as pathService from './path.service.js';
import * as permissionService from './permission.service.js';

// ============================================================================
// Folder Creation Service
// ============================================================================

/**
 * Create a new folder
 * 
 * @param {string} folderName - Name of the folder
 * @param {string} userId - User ID
 * @param {string|null} parentId - Parent folder ID (null for root)
 * @returns {Promise<Object>} Created folder document
 */
export const createFolderService = async (folderName, userId, parentId) => {
  let parentFolder = null;
  let newPath = ','; // Default path for root

  if (parentId) {
    parentFolder = await File.findOne({
      _id: parentId,
      user: userId,
      isFolder: true,
      isDeleted: false,
    });

    if (!parentFolder) {
      throw new Error(
        'Parent folder not found or you do not have permission to access it.'
      );
    }

    newPath = pathService.buildPath(parentFolder);

    // Validate depth (Phase 0: max 2 levels)
    if (!pathService.isValidDepth(newPath, 2)) {
      const error = new Error(
        'Maximum folder depth (2 levels) exceeded. Cannot create folder here.'
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // Create folder document
  try {
    let newFolder = await File.create({
      user: userId,
      fileName: folderName,
      isFolder: true,
      parentId: parentId || null,
      path: newPath,
      // Required fields for schema (not relevant for folders)
      s3Key: new mongoose.Types.ObjectId().toString(),
      fileType: 'folder',
      size: 0,
    });

    newFolder = await newFolder.populate('user', 'name avatar');
    return newFolder;
  } catch (err) {
    // Map duplicate name errors from Mongo to a 409 Conflict for the API
    if (err && err.code === 11000) {
      const error = new Error('A folder with that name already exists in this location.');
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }
};

// ============================================================================
// Folder Deletion Service
// ============================================================================

/**
 * Delete a folder and all its contents recursively
 * NOTE: This will be replaced by soft-delete in Part 3 (Trash domain)
 * 
 * @param {string} folderId - Folder ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Success message
 */
export const deleteFolderService = async (folderId, userId) => {
  // Find the folder
  const folder = await File.findOne({
    _id: folderId,
    user: userId,
    isFolder: true,
    isDeleted: false,
  });

  if (!folder) {
    throw new Error('Folder not found.');
  }

  // Find all non-deleted descendants using path
  const descendants = await File.find({
    user: userId,
    path: { $regex: `^${folder.path}${folderId},` },
    isDeleted: false,
  });

  // Soft-delete: mark folder and its descendants as deleted with timestamp.
  const allIdsToMark = [...descendants.map((d) => d._id), folder._id];

  await File.updateMany(
    { _id: { $in: allIdsToMark }, user: userId },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );

  return {
    message: 'Folder and all its contents moved to Trash (soft-deleted).',
    deletedCount: allIdsToMark.length,
  };
};

// ============================================================================
// Folder Move Service
// ============================================================================

/**
 * Move a file or folder to a new location
 * Updates paths for all descendants if moving a folder
 * 
 * @param {string} itemId - ID of item to move
 * @param {string} userId - User ID
 * @param {string|null} newParentId - New parent folder ID (null for root)
 * @returns {Promise<Object>} Success message
 */
export const moveItemService = async (itemId, userId, newParentId) => {
  // Fetch item and destination in parallel
  const [itemToMove, destinationFolder] = await Promise.all([
    File.findOne({ _id: itemId, user: userId, isDeleted: false }),
    newParentId
      ? File.findOne({ _id: newParentId, user: userId, isFolder: true, isDeleted: false })
      : Promise.resolve('root'), // 'root' placeholder
  ]);

  // Validation checks
  if (!itemToMove) {
    throw new Error('Item to move not found or you do not have permission.');
  }

  if (!destinationFolder) {
    throw new Error(
      'Destination folder not found or you do not have permission.'
    );
  }

  // --- Business rules: Context lock & academic lock ---
  const itemContext = itemToMove.context || 'personal';
  const destinationContext = destinationFolder === 'root' ? 'personal' : destinationFolder.context || 'personal';

  // Context lock: cannot move items between contexts
  if (itemContext !== destinationContext) {
    const error = new Error('Cannot move items between contexts.');
    error.statusCode = 403;
    throw error;
  }

  // Academic lock: non-personal items cannot be moved
  if (itemToMove.context && itemToMove.context !== 'personal') {
    const error = new Error('Academic folders and files cannot be moved.');
    error.statusCode = 403;
    throw error;
  }

  if (itemId === newParentId) {
    const error = new Error('Cannot move an item into itself.');
    error.statusCode = 400;
    throw error;
  }

  // Prevent moving folder into its own child
  if (
    itemToMove.isFolder &&
    destinationFolder !== 'root' &&
    pathService.isDescendant(
      itemToMove.path,
      itemToMove._id.toString(),
      destinationFolder.path,
      destinationFolder._id.toString()
    )
  ) {
    const error = new Error(
      'Cannot move a folder into one of its own subfolders.'
    );
    error.statusCode = 400;
    throw error;
  }

  // Calculate new path
  const oldPath = itemToMove.path;
  const newPath =
    destinationFolder === 'root'
      ? ','
      : pathService.buildPath(destinationFolder);

  // Validate depth if moving to non-root location
  if (destinationFolder !== 'root' && !pathService.isValidDepth(newPath, 2)) {
    const error = new Error(
      'Maximum folder depth (2 levels) exceeded. Cannot move item here.'
    );
    error.statusCode = 400;
    throw error;
  }

  // Update the item itself
  itemToMove.parentId = newParentId || null;
  itemToMove.path = newPath;
  try {
    await itemToMove.save();
  } catch (err) {
    if (err && err.code === 11000) {
      const error = new Error('A file or folder with that name already exists at the destination.');
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }

  // If it's a folder, update all descendants' paths
  if (itemToMove.isFolder) {
    const descendants = await File.find({
      user: userId,
      path: { $regex: `^${oldPath}${itemToMove._id},` },
      isDeleted: false,
    });

    if (descendants.length > 0) {
      const bulkOps = descendants.map((descendant) => {
        const updatedPath = pathService.updateDescendantPath(
          oldPath,
          newPath,
          descendant.path
        );
        return {
          updateOne: {
            filter: { _id: descendant._id },
            update: { $set: { path: updatedPath } },
          },
        };
      });

      try {
        await File.bulkWrite(bulkOps);
      } catch (err) {
        if (err && err.code === 11000) {
          const error = new Error('A naming conflict occurred while updating descendants.');
          error.statusCode = 409;
          throw error;
        }
        throw err;
      }
    }
  }

  return {
    message: 'Item moved successfully.',
    updatedDescendants: itemToMove.isFolder
      ? await File.countDocuments({
          user: userId,
          path: { $regex: `^${newPath}${itemToMove._id},` },
        })
      : 0,
  };
};

// ============================================================================
// Folder Information Service
// ============================================================================

/**
 * Get folder details with statistics
 * 
 * @param {string} folderId - Folder ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Folder details with stats
 */
export const getFolderDetailsService = async (folderId, userId, user = null) => {
  // Use centralized permission check instead of custom logic
  const accessCheck = await permissionService.checkReadAccess(folderId, userId, user);
  
  if (!accessCheck.hasAccess) {
    const error = new Error('You do not have permission to view this folder.');
    error.statusCode = 403;
    throw error;
  }

  const folder = accessCheck.file;

  // Ensure it's actually a folder
  if (!folder.isFolder) {
    throw new Error('Item is not a folder.');
  }

  // Get statistics
  // Use the folder owner's id when computing stats — files inside the folder are owned by the folder owner
  const ownerIdForStats = folder.user?._id ? String(folder.user._id) : (folder.user ? String(folder.user) : null);
  const [fileCount, folderCount, totalSize] = await Promise.all([
    File.countDocuments({
      user: ownerIdForStats,
      path: { $regex: `^${folder.path}${folderId},` },
      isFolder: false,
      isDeleted: false,
    }),

    File.countDocuments({
      user: ownerIdForStats,
      path: { $regex: `^${folder.path}${folderId},` },
      isFolder: true,
      isDeleted: false,
    }),

    File.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(ownerIdForStats),
          path: { $regex: `^${folder.path}${folderId},` },
          isFolder: false,
          isDeleted: false,
        },
      },
      { $group: { _id: null, totalSize: { $sum: '$size' } } },
    ]),
  ]);

  return {
    folder,
    stats: {
      fileCount,
      folderCount,
      totalSize: totalSize[0]?.totalSize || 0,
    },
  };
};

/**
 * Validate folder name is unique within parent
 * 
 * @param {string} folderName - Folder name to check
 * @param {string} userId - User ID
 * @param {string|null} parentId - Parent folder ID
 * @param {string|null} excludeFolderId - Folder ID to exclude (for rename)
 * @returns {Promise<boolean>} True if name is available
 */
export const isFolderNameAvailable = async (
  folderName,
  userId,
  parentId,
  excludeFolderId = null
) => {
  const query = {
    user: userId,
    fileName: folderName,
    isFolder: true,
    parentId: parentId || null,
    isDeleted: false,
  };

  if (excludeFolderId) {
    query._id = { $ne: excludeFolderId };
  }

  const existing = await File.findOne(query);
  return !existing;
};

/**
 * Rename a folder
 * 
 * @param {string} folderId - Folder ID
 * @param {string} userId - User ID
 * @param {string} newName - New folder name
 * @returns {Promise<Object>} Updated folder document
 */
export const renameFolderService = async (folderId, userId, newName) => {
  const folder = await File.findOne({
    _id: folderId,
    user: userId,
    isFolder: true,
  });

  if (!folder) {
    // Use error code for reliable error type detection
    const error = new Error('Folder not found or you do not have permission.');
    error.code = 'FOLDER_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  // Check if name is available
  const nameAvailable = await isFolderNameAvailable(
    newName,
    userId,
    folder.parentId,
    folderId
  );

  if (!nameAvailable) {
    const error = new Error(
      'A folder with this name already exists in this location.'
    );
    error.statusCode = 400;
    throw error;
  }

  folder.fileName = newName;
  try {
    await folder.save();
  } catch (err) {
    if (err && err.code === 11000) {
      const error = new Error('A folder with that name already exists in this location.');
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }

  return folder;
};
