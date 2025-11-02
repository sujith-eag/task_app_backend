# Services — Files Module

This document describes the service layer for the `files` module. Services encapsulate core business logic and perform DB + S3 interactions. They return or throw errors with optional `statusCode` so controllers can map HTTP responses.

Location
- `backend/src/api/files/services/`

Primary service: `file.service.js` (folder-specific logic lives in `folder.service.js`, path helpers in `path.service.js`)

Key exported functions (current)
- `uploadFilesService(files, userId, parentId)`
	- Uploads files to S3 and stores metadata in `File`.
	- Handles filename collisions (robust `generateUniqueFileName`) and uses `insertMany({ ordered:false })` with duplicate-key mapping to return friendly 409s when needed.

- `generateUniqueFileName(originalName, userId, parentId)`
	- Appends ` (n)` when duplicate names exist; correctly handles names without extension and dotfiles.

- `getUserFilesService(userId, user, parentId)`
	- Implements the optimized permission model: complex root query vs. fast child listing with parent access validation. Always filters `{ isDeleted: false }`.

- `getFileDownloadUrlService(fileId, userId, user?)` and `getFilePreviewUrlService(fileId, userId, user?)`
	- Validate permissions (owner / direct share w/ expiry / class share when `user` provided) and return signed S3 URLs for download or inline preview.

- `getBulkDownloadFilesService(fileIds, userId, user?)`
	- Fetches candidate files then enforces per-file permission checks (owner/direct share w/ expiry/class-share when `user` provided) before returning documents for zipping.

- `getDescendantFilesService(folderId, userId, user?)`
	- Validates the folder and read access then returns non-folder, non-deleted descendant files using the `path` materialized field.

- `searchFilesService(userId, user, q)`
	- Uses MongoDB text index on `fileName`, applies permission filters, and returns results sorted by text score.

- `deleteFileService` / `bulkDeleteFilesService` / `deleteFolderService`
	- Soft-delete implementations: set `isDeleted: true` and `deletedAt`. `deleteFolderService` marks descendants by `path`.

Implementation notes
- Services accept an optional `user` parameter when class-based share checks are necessary; controllers pass `req.user` in those cases.
- Be mindful of the partial unique index on `parentId+fileName` (partialFilterExpression: `{ isDeleted: false }`) when writing migrations or bulk updates.

Testing suggestions
- Unit-test services using mocked `File` model and mocked S3 helpers (`getFileStream`, `uploadFile`, `deleteFile`).
- Integration tests should verify upload → list → preview → download and folder zip flows.

See also
- Controller: `../controllers/file.controller.js`
- S3 helpers: `../../../services/s3/s3.service.js`

Last updated: 2025-11-02

*** End Patch
