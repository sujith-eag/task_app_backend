import File from '../api/files/../../models/fileModel.js';
import * as pathService from '../api/files/services/path.service.js';

// Helper to stream files as a zip preserving folder structure
export const streamFolderZip = async (res, parentFolder, descendantFiles) => {
  const archiver = (await import('archiver')).default;
  const { getFileStream } = await import('./s3.service.js');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${parentFolder.fileName || 'folder'}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') throw err;
  });
  archive.on('error', (err) => { throw err; });

  archive.pipe(res);

  // Build folder name map
  const folderRegex = (parentFolder && parentFolder.path ? parentFolder.path : ',') + String(parentFolder._id) + ',';
  const folderDocs = await File.find({ path: { $regex: `^${folderRegex}` }, isFolder: true, isDeleted: false }).select('_id fileName').lean();
  const folderNameMap = new Map();
  if (parentFolder) folderNameMap.set(String(parentFolder._id), parentFolder.fileName);
  for (const fd of folderDocs) folderNameMap.set(String(fd._id), fd.fileName);

  for (const f of descendantFiles) {
    try {
      const stream = await getFileStream(f.s3Key);
      const ancestorIds = pathService.extractAncestorIds(f.path || '');
      const parentIdx = ancestorIds.indexOf(String(parentFolder._id));
      const relativeAncestorIds = parentIdx >= 0 ? ancestorIds.slice(parentIdx + 1) : [];
      const relPathParts = relativeAncestorIds.map(id => folderNameMap.get(String(id))).filter(Boolean);
      const entryName = relPathParts.length > 0 ? `${relPathParts.join('/')}/${f.fileName}` : f.fileName;
      archive.append(stream, { name: entryName });
    } catch (e) {
      throw e;
    }
  }

  await archive.finalize();
};

export default { streamFolderZip };
