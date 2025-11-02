# Routes — Files Module

This folder exposes Express route definitions for the files domain. Routes wire up request validation, policies, authentication, and controllers.

Location
- `backend/src/api/files/routes/`

Primary routes (file.routes.js)
- `POST /api/files/upload` — `protect`, `uploadFiles` (multer), validators, `canUploadToFolder`, `checkStorageQuota` → `file.controller.uploadFiles`
- `GET /api/files` — `protect`, validators → `file.controller.getUserFiles`
- `GET /api/files/:id/download` — `protect`, `hasReadAccess` → `file.controller.getDownloadLink`
- `POST /api/files/bulk-download` — `protect` → `file.controller.bulkDownloadFiles` (streams zip)
- `DELETE /api/files/:id` — `protect`, `isOwner` → `file.controller.deleteFile`
- `DELETE /api/files` — `protect`, validators → `file.controller.bulkDeleteFiles`

Implementation notes
- Routes typically import `protect` from the common middleware so they accept cookie-based httpOnly JWTs (or Authorization header as a fallback for non-browser clients).
- Keep route definitions declarative: validation and policy middleware should be listed before controller handlers to make intent clear.

Testing suggestions
- Integration tests should exercise the full route stack, including multer for uploads and streaming ZIP responses for bulk-download.
