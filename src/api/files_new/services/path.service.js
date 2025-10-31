// ============================================================================
// Path Service - Utilities for hierarchical path management
// ============================================================================

/**
 * Build a path string for a file/folder based on its parent
 * Path format: ",id1,id2,id3," where IDs represent ancestors from root to parent
 * 
 * @param {Object|null} parentFolder - Parent folder document (or null for root)
 * @returns {string} Path string
 */
export const buildPath = (parentFolder) => {
  if (!parentFolder) {
    return ','; // Root path
  }
  return parentFolder.path + parentFolder._id + ',';
};

/**
 * Extract ancestor IDs from a path string
 * 
 * @param {string} path - Path string like ",id1,id2,"
 * @returns {string[]} Array of ancestor IDs
 */
export const extractAncestorIds = (path) => {
  if (!path || path === ',') {
    return [];
  }
  return path.split(',').filter(id => id);
};

/**
 * Check if a folder is a descendant of another folder
 * 
 * @param {string} folderPath - Path of the folder to check
 * @param {string} folderId - ID of the folder to check
 * @param {string} potentialAncestorPath - Path of potential ancestor
 * @param {string} potentialAncestorId - ID of potential ancestor
 * @returns {boolean} True if folder is a descendant
 */
export const isDescendant = (folderPath, folderId, potentialAncestorPath, potentialAncestorId) => {
  const fullPath = folderPath + folderId + ',';
  const ancestorFullPath = potentialAncestorPath + potentialAncestorId + ',';
  return fullPath.startsWith(ancestorFullPath);
};

/**
 * Update paths for all descendants when a folder is moved
 * 
 * @param {string} oldPath - Old path of the moved folder
 * @param {string} newPath - New path of the moved folder
 * @param {string} descendantPath - Current path of a descendant
 * @returns {string} Updated path for the descendant
 */
export const updateDescendantPath = (oldPath, newPath, descendantPath) => {
  return descendantPath.replace(oldPath, newPath);
};

/**
 * Calculate folder depth (number of levels from root)
 * 
 * @param {string} path - Path string
 * @returns {number} Depth level (0 for root)
 */
export const calculateDepth = (path) => {
  return extractAncestorIds(path).length;
};

/**
 * Validate folder depth doesn't exceed limit
 * 
 * @param {string} path - Path string to check
 * @param {number} maxDepth - Maximum allowed depth (default: 2 for Phase 0)
 * @returns {boolean} True if depth is valid
 */
export const isValidDepth = (path, maxDepth = 2) => {
  return calculateDepth(path) < maxDepth;
};
