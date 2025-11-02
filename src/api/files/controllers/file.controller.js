import asyncHandler from '../../_common/http/asyncHandler.js';
import * as fileService from '../services/file.service.js';

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
    req.user._id
  );

  res.status(200).json({ url });
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

// ============================================================================
// File Deletion Controllers (Temporary - will be replaced by trash)
// ============================================================================

/**
 * @desc    Delete a single file
 * @route   DELETE /api/files/:id
 * @access  Private
 */
export const deleteFile = asyncHandler(async (req, res) => {
  const result = await fileService.deleteFileService(
    req.params.id,
    req.user._id
  );

  res.status(200).json(result);
});

/**
 * @desc    Delete multiple files
 * @route   DELETE /api/files
 * @access  Private
 */
export const bulkDeleteFiles = asyncHandler(async (req, res) => {
  const { fileIds } = req.body;

  const result = await fileService.bulkDeleteFilesService(
    fileIds,
    req.user._id
  );

  res.status(200).json(result);
});
