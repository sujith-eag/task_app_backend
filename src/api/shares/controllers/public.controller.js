import asyncHandler from '../../_common/http/asyncHandler.js';
import * as sharesService from '../services/shares.service.js';
import File from '../../../models/fileModel.js';
import * as pathService from '../../files/services/path.service.js';

// For streaming zips
const archiverImport = async () => (await import('archiver')).default;
const s3ServiceImport = async () => await import('../../../services/s3/s3.service.js');

// ============================================================================
// Public Access Controllers (No Authentication Required)
// ============================================================================

/**
 * @desc    Get a download link for a publicly shared file
 * @route   POST /api/public/download
 * @access  Public
 */
export const getPublicDownloadLink = asyncHandler(async (req, res) => {
  const { code } = req.body;

  const result = await sharesService.getPublicDownloadLinkService(code);

  // If the shared object is a folder, provide a public streaming endpoint URL
  if (result && result.file && result.file.isFolder) {
    const host = req.get('host');
    const proto = req.protocol;
    // Public folder download route (POST with { code } body)
    // Include the code as a query parameter so the returned URL can be visited directly
    // e.g. /api/public/folders/:id/download?code=abcd
    result.url = `${proto}://${host}/api/public/folders/${result.file._id}/download?code=${encodeURIComponent(code)}`;
  }

  res.status(200).json(result);
});


/**
 * @desc    Stream a folder as a ZIP for a public share code
 * @route   POST /api/public/folders/:id/download
 * @access  Public
 */
export const downloadPublicFolder = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const folderId = req.params.id;

  if (!code) {
    res.status(400);
    throw new Error('Share code is required.');
  }

  // Find the file by public code
  const file = await File.findOne({ 'publicShare.code': code.trim(), 'publicShare.isActive': true, isDeleted: false });
  if (!file) {
    res.status(404);
    throw new Error('Invalid or expired share code.');
  }

  // Must match requested folder id
  if (String(file._id) !== String(folderId)) {
    res.status(403);
    throw new Error('Share code does not match the requested folder.');
  }

  if (!file.isFolder) {
    res.status(400);
    throw new Error('Requested resource is not a folder.');
  }

  // Update last accessed
  file.lastAccessedAt = new Date();
  await file.save();

  // Build descendant files (non-folder, non-deleted)
  const parentFolder = await File.findById(folderId).select('_id fileName path').lean();
  if (!parentFolder) {
    res.status(404);
    throw new Error('Folder not found.');
  }

  const folderRegex = (parentFolder && parentFolder.path ? parentFolder.path : ',') + String(parentFolder._id) + ',';
  const descendantFiles = await File.find({ path: { $regex: `^${folderRegex}` }, isFolder: false, isDeleted: false }).select('_id fileName s3Key path').lean();

  if (!descendantFiles || descendantFiles.length === 0) {
    res.status(400);
    throw new Error('Folder is empty. Cannot download an empty folder.');
  }

  // Stream zip using shared zip service
  const { streamFolderZip } = await import('../../../services/zip.service.js');
  await streamFolderZip(res, parentFolder, descendantFiles);
});
