# Services — Files Module

This document describes the service layer for the `files` module. Services contain core business logic and interact with the database and S3 service.

Location
- `backend/src/api/files/services/`

Primary service: `file.service.js`

Key exported functions
- `uploadFilesService(files, userId, parentId)`
  - Uploads provided files to S3 (via `services/s3`) and stores metadata in the `File` model.
  - Handles duplicate filename resolution, constructs S3 keys with a `personal` context, and populates `user` data.

- `getUserFilesService(userId, user, parentId)`
  - Builds permission-aware queries (owner + shared + class shares for students), fetches files and current folder, and constructs breadcrumbs.

- `getFileDownloadUrlService(fileId, userId)`
  - Validates access and returns a pre-signed S3 download URL (via `getDownloadUrl`).

- `getBulkDownloadFilesService(fileIds, userId)`
  - Validates that the requesting user has access to every requested file and returns file documents for streaming into a ZIP archive.

- `deleteFileService(fileId, userId)` and `bulkDeleteFilesService(fileIds, userId)`
  - Remove S3 objects and corresponding DB documents. Bulk delete ensures ownership for all files.

Implementation notes
- Services throw errors with messages and optional `statusCode` to allow controllers to map them to appropriate HTTP responses.
- Keep heavy I/O (S3 streams, large loops) in services or controller helpers to enable unit testing of pure logic separately.

Testing suggestions
- Unit-test each service function using a mocked `File` model and mocked S3 helpers (`getFileStream`, `uploadFile`, `deleteFile`).
- Integration tests should verify the end-to-end upload → list → download flows with test S3 (or a mocked S3 adapter).

See also
- Controller: `../controllers/file.controller.js`
- S3 helpers: `../../../services/s3/s3.service.js`
