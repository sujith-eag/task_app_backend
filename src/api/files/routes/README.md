
# Routes — Files Module

This folder defines the Express routes for the files domain and wires middleware (auth, validators, policies) to controllers.

Location
- `backend/src/api/files/routes/`

Primary routes (file.routes.js)
- `POST /api/files/upload` — `protect`, `uploadFiles` (multer), `validate(uploadFilesSchema)`, `canUploadToFolder`, `checkStorageQuota` → `file.controller.uploadFiles`
- `GET /api/files` — `protect`, `validate(listFilesSchema, 'query')` → `file.controller.getUserFiles`
- `GET /api/files/:id/download` — `protect`, `hasReadAccess` → `file.controller.getDownloadLink`
- `GET /api/files/downloads/:id/preview` — `protect`, `hasReadAccess` → `file.controller.getPreviewLink`
- `GET /api/files/search?q=...` — `protect` → `file.controller.searchFiles`
- `POST /api/files/bulk-download` — `protect` → `file.controller.bulkDownloadFiles` (streams zip)
- `POST /api/files/folders/:id/download` — `protect` → `file.controller.downloadFolderAsZip` (synchronous zip stream)
- `DELETE /api/files/:id` — `protect`, `isOwner` → `file.controller.deleteFile`
- `DELETE /api/files` — `protect`, `validate(bulkFileIdsSchema)` → `file.controller.bulkDeleteFiles`

Implementation notes
- Middleware order matters: validators and policies run before controllers. Routes use `protect` from the common middleware so both cookie-based and header-based JWTs are supported.

Testing suggestions
- Integration tests should exercise validation, policies, and streaming behavior (bulk & folder zip). Ensure `hasReadAccess` and `isOwner` policies are exercised.

Last updated: 2025-11-02
