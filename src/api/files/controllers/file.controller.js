import asyncHandler from '../../_common/http/asyncHandler.js';
import * as fileService from '../services/file.service.js';
import File from '../../../models/fileModel.js';
import * as pathService from '../services/path.service.js';
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
  // We'll track which file IDs we've already added to avoid duplicates
  const addedFileIds = new Set();


  const selectedFolders = accessibleFiles.filter((f) => f.isFolder);

  // Preload descendants + folder metadata for each selected folder once.
  // This avoids duplicate service/DB calls and allows an early, informative failure
  // if any selected folder is empty.
  const folderDataMap = new Map(); // folderId -> { parentFolder, folderNameMap, descendants }
  for (const folder of selectedFolders) {
    const descendants = await fileService.getDescendantFilesService(folder._id, req.user._id, req.user);
    if (!descendants || descendants.length === 0) {
      res.status(400);
      throw new Error(`Folder "${folder.fileName}" is empty. Remove empty folders before downloading.`);
    }

    const parentFolder = await File.findById(folder._id).select('_id fileName path').lean();
    if (!parentFolder) {
      res.status(500);
      throw new Error(`Folder metadata missing for "${folder._id}".`);
    }

    const folderRegex = (parentFolder && parentFolder.path ? parentFolder.path : ',') + String(parentFolder._id) + ',';
    const folderDocs = await File.find({ path: { $regex: `^${folderRegex}` }, isFolder: true, isDeleted: false }).select('_id fileName').lean();
    const folderNameMap = new Map();
    folderNameMap.set(String(parentFolder._id), parentFolder.fileName);
    for (const fd of folderDocs) folderNameMap.set(String(fd._id), fd.fileName);

    folderDataMap.set(String(folder._id), { parentFolder, folderNameMap, descendants });
  }

  // Iterate preloaded folder data and append descendant file streams
  for (const [folderId, data] of folderDataMap.entries()) {
    const { parentFolder, folderNameMap, descendants } = data;
    for (const f of descendants) {
      if (addedFileIds.has(String(f._id))) continue; // skip duplicates
      try {
        const stream = await getFileStream(f.s3Key);
        const ancestorIds = pathService.extractAncestorIds(f.path || '');
        const parentIdx = ancestorIds.indexOf(String(parentFolder._id));
        const relativeAncestorIds = parentIdx >= 0 ? ancestorIds.slice(parentIdx + 1) : [];
        const relPathParts = relativeAncestorIds.map((id) => folderNameMap.get(String(id))).filter(Boolean);
        const entryName = relPathParts.length > 0 ? `${parentFolder.fileName}/${relPathParts.join('/')}/${f.fileName}` : `${parentFolder.fileName}/${f.fileName}`;
        archive.append(stream, { name: entryName });
        addedFileIds.add(String(f._id));
      } catch (e) {
        // If one file stream errors, still abort the archive to surface error
        throw e;
      }
    }
  }

  // Then, process any selected individual files (that were not part of selected folders)
  const selectedFilesOnly = accessibleFiles.filter(f => !f.isFolder);
  for (const file of selectedFilesOnly) {
    if (addedFileIds.has(String(file._id))) continue; // already included via a selected folder
    const stream = await getFileStream(file.s3Key);
    // Attempt to preserve minimal folder context if file.path indicates it's inside a folder
    try {
      const ancestorIds = pathService.extractAncestorIds(file.path || '');
      // If the file lives inside some parent folders that are NOT part of the selection,
      // we will include it at top-level (file.fileName) to match user expectation of explicitly selected files.
      archive.append(stream, { name: file.fileName });
      addedFileIds.add(String(file._id));
    } catch (e) {
      archive.append(stream, { name: file.fileName });
      addedFileIds.add(String(file._id));
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

  if (!accessibleFiles || accessibleFiles.length === 0) {
    res.status(400);
    throw new Error('Folder is empty. Cannot download an empty folder.');
  }

  // Stream zip file using shared zip service
  const parentFolder = await File.findById(folderId).select('_id fileName path').lean();
  if (!parentFolder) {
    res.status(404);
    throw new Error('Folder not found.');
  }
  const { streamFolderZip } = await import('../../../services/zip.service.js');
  await streamFolderZip(res, parentFolder, accessibleFiles.filter(f => !f.isFolder));
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
