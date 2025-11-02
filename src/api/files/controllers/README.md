# Controllers — Files Module

This document summarizes the controller layer for the `files` module. Controllers are thin HTTP handlers that validate/parse request inputs, call the service layer, and stream/format responses.

Location
- `backend/src/api/files/controllers/`

Files
- `file.controller.js` — main controller for file operations (upload, list, download, bulk-download, delete).

Key controller functions
- `uploadFiles(req, res)`
  - Route: POST `/api/files/upload`
  - Auth: `protect` (cookie-first JWT)
  - Middleware: multipart parser (multer), validation, quota checks
  - Body: form-data `files` and optional `parentId`
  - Behavior: calls `uploadFilesService(files, req.user._id, parentId)` and returns created file documents.

- `getUserFiles(req, res)`
  - Route: GET `/api/files`
  - Auth: `protect`
  - Query: optional `parentId`
  - Behavior: calls `getUserFilesService(req.user._id, req.user, parentId)` and returns `{ files, currentFolder, breadcrumbs }`.

- `getDownloadLink(req, res)`
  - Route: GET `/api/files/:id/download`
  - Auth: `protect`, `hasReadAccess` policy
  - Behavior: calls `getFileDownloadUrlService(fileId, req.user._id)` and returns `{ url }` for an S3 signed URL.

- `bulkDownloadFiles(req, res)`
  - Route: POST `/api/files/bulk-download`
  - Auth: `protect`
  - Body: accepts either:
    - `application/json` { fileIds: ["id1","id2"] } (preferred), or
    - form-POST with a field `fileIds` containing a JSON-stringified array (legacy/form fallback).
  - Behavior: service validates access to each file, then streams a ZIP archive using `archiver` and the S3 `getFileStream` helper.
  - Response: streamed `application/zip` with `Content-Disposition: attachment; filename="EagleCampus-Files.zip"`.

- `deleteFile(req, res)` and `bulkDeleteFiles(req, res)`
  - Routes: DELETE `/api/files/:id` and DELETE `/api/files` (bulk)
  - Auth: `protect`, `isOwner` / internal checks
  - Behavior: call respective service methods to remove S3 objects and DB documents.

Behavioral notes
- Controllers intentionally keep business logic in the service layer. They handle parsing and I/O concerns like streaming archives.
- The `bulkDownloadFiles` controller is defensively coded to accept both modern JSON requests and legacy form POSTs to ease migration; clients should prefer the JSON/blob download flow.

Testing suggestions
- Unit-test each controller by mocking service methods and asserting responses and status codes.
- Integration test for `bulkDownloadFiles` should verify that both JSON-based downloads and form-post fallbacks work end-to-end (or at least exercise the parsing logic and stream pipeline).

See also
- Service layer: `../services/`
- Routes: `../routes/file.routes.js`
