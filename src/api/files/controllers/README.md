
# Controllers — Files Module

This document summarizes the controller layer for the `files` module. Controllers are thin HTTP handlers that parse inputs, call the service layer, and manage I/O like streaming archives.

Location
- `backend/src/api/files/controllers/`

Files
- `file.controller.js` — main controller for file operations (upload, listing, download, preview, search, folder zip download, delete).

Key controller functions (current)
- `uploadFiles(req, res)`
  - POST `/api/files/upload` — handles multipart uploads, validation, quota checks, and returns created file docs.

- `getUserFiles(req, res)`
  - GET `/api/files` — list files/folders for a user. Uses optimized permission model: root uses a shared/owned query; folder view validates access on parent then returns children.

- `getDownloadLink(req, res)`
  - GET `/api/files/:id/download` — returns a signed S3 download URL. Controller passes `req.user` so services can evaluate class-based shares.

- `getPreviewLink(req, res)`
  - GET `/api/files/downloads/:id/preview` — returns an inline preview signed URL (no attachment header).

- `searchFiles(req, res)`
  - GET `/api/files/search?q=...` — performs text search on `fileName` and returns permission-filtered results.

- `bulkDownloadFiles(req, res)`
  - POST `/api/files/bulk-download` — accepts a list of `fileIds` (JSON or stringified form), validates access and streams a ZIP archive using `archiver` and S3 streams.

- `downloadFolderAsZip(req, res)`
  - POST `/api/files/folders/:id/download` — synchronous folder export: validates read access on the folder, gathers descendant files, and streams them as a single ZIP. This replaces the earlier job-based stub.

- `deleteFile` / `bulkDeleteFiles`
  - DELETE endpoints perform soft-delete semantics (set `isDeleted` + `deletedAt`) and ensure ownership when required.

Behavioral notes
- Controllers keep heavy business logic in services. They handle request parsing and streaming responsibilities.
- Controllers now pass the `req.user` object into service functions where class-share checks are required (download/preview/search/bulk-download).

Testing suggestions
- Unit-test controllers by stubbing services. Integration tests should exercise streaming endpoints (bulk & folder zip), preview, and search.

See also
- Service layer: `../services/`
- Routes: `../routes/file.routes.js`
