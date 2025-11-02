import asyncHandler from '../../_common/http/asyncHandler.js';
import * as fileService from '../services/file.service.js';
import {
  softDeleteFileService,
  bulkSoftDeleteService
} from '../../trash/services/trash.service.js';

// ============================================================================
// File Upload Controllers
// ============================================================================

/**
 * @desc    Upload one or more files
 * @route   POST /api/files/upload
 * @access  Private
 */
export const uploadFiles = asyncHandler(async (req, res) => {
  const { parentId } = req.body;
  const files = req.files;

  const result = await fileService.uploadFilesService(
    files,
    req.user._id,
    parentId
  );

  res.status(201).json(result);
});

// ============================================================================
// File Listing Controllers
// ============================================================================

/**
 * @desc    Get all files/folders for user in a directory
 * @route   GET /api/files
 * @access  Private
 */
export const getUserFiles = asyncHandler(async (req, res) => {
  const { parentId } = req.query;

  const result = await fileService.getUserFilesService(
    req.user._id,
    req.user,
    parentId
  );

  res.status(200).json(result);
});

// ============================================================================
// File Download Controllers
// ============================================================================

/**
 * @desc    Get download link for a file
 * @route   GET /api/files/:id/download
 * @access  Private
 */
export const getDownloadLink = asyncHandler(async (req, res) => {
  const url = await fileService.getFileDownloadUrlService(
    req.params.id,
    req.user._id,
    req.user
  );

  res.status(200).json({ url });
});

/**
 * @desc    Get preview link for a file (inline view)
 * @route   GET /api/files/downloads/:id/preview
 * @access  Private
 */
export const getPreviewLink = asyncHandler(async (req, res) => {
  const url = await fileService.getFilePreviewUrlService(
    req.params.id,
    req.user._id,
    req.user
  );

  res.status(200).json({ url });
});

/**
 * @desc    Search files by text
 * @route   GET /api/files/search?q=...
 * @access  Private
 */
export const searchFiles = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const files = await fileService.searchFilesService(req.user._id, req.user, q);
  res.status(200).json({ files });
});

/**
 * @desc    Download multiple files as zip
 * @route   POST /api/files/bulk-download
 * @access  Private
 */
export const bulkDownloadFiles = asyncHandler(async (req, res) => {
  let fileIds;

  // Accept either an actual array (application/json) or a JSON-stringified value (form POST)
  if (Array.isArray(req.body.fileIds)) {
    fileIds = req.body.fileIds;
  } else if (typeof req.body.fileIds === 'string') {
    try {
      fileIds = JSON.parse(req.body.fileIds);
    } catch (e) {
      res.status(400);
      throw new Error('Invalid format for file IDs.');
    }
  } else {
    res.status(400);
    throw new Error('fileIds is required');
  }

  const accessibleFiles = await fileService.getBulkDownloadFilesService(fileIds, req.user._id);

  // Stream zip file
  const archiver = (await import('archiver')).default;
  const { getFileStream } = await import('../../../services/s3.service.js');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="EagleCampus-Files.zip"'
  );

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') throw err;
  });
  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(res);

  // Add files to archive
  for (const file of accessibleFiles) {
    if (!file.isFolder) {
      const stream = await getFileStream(file.s3Key);
      archive.append(stream, { name: file.fileName });
    }
  }

  await archive.finalize();
});

/**
 * @desc    Download a folder as a zip (synchronous streaming)
 * @route   POST /api/files/folders/:id/download
 * @access  Private
 */
export const downloadFolderAsZip = asyncHandler(async (req, res) => {
  const folderId = req.params.id;

  // Get descendant files that the user can access
  const accessibleFiles = await fileService.getDescendantFilesService(folderId, req.user._id, req.user);

  // Stream zip file (same logic as bulkDownloadFiles)
  const archiver = (await import('archiver')).default;
  const { getFileStream } = await import('../../../services/s3.service.js');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="EagleCampus-Folder.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') throw err;
  });
  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(res);

  for (const file of accessibleFiles) {
    if (!file.isFolder) {
      const stream = await getFileStream(file.s3Key);
      archive.append(stream, { name: file.fileName });
    }
  }

  await archive.finalize();
});

// ============================================================================
// File Deletion Controllers (Temporary - will be replaced by trash)
// ============================================================================

/**
 * @desc    Delete a single file
 * @route   DELETE /api/files/:id
 * @access  Private
 */
export const deleteFile = asyncHandler(async (req, res) => {
  // Rewired to use Trash domain (soft-delete)
  const result = await softDeleteFileService(req.params.id, req.user._id);
  res.status(200).json(result);
});

/**
 * @desc    Delete multiple files
 * @route   DELETE /api/files
 * @access  Private
 */
export const bulkDeleteFiles = asyncHandler(async (req, res) => {
  const { fileIds } = req.body;

  // Rewired to use Trash domain (bulk soft-delete)
  const result = await bulkSoftDeleteService(fileIds, req.user._id);
  res.status(200).json(result);
});
