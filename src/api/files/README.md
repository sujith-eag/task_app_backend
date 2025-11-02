# Files module (backend/src/api/files)

This module implements personal file & folder operations used by the backend API.

Summary of what is implemented here:
- File uploads (multipart, S3 upload)
- File listing (owned + shared + class-based for students)
- Single-file download (S3 download URL)
- Bulk-download as a streamed ZIP (archiver)
- Folder create / delete (hard delete for Phase 0)
- Move / rename folder operations with materialized path updates
- Validation (Joi) and lightweight authorization policies

This README documents the actual files and behavior in `backend/src/api/files`.

## On-disk structure

Files present in this folder (top-level):

```
controllers/
  file.controller.js
  folder.controller.js
policies/
  file.policies.js
routes/
  file.routes.js
  folder.routes.js
services/
  file.service.js
  folder.service.js
  path.service.js
validators/
  file.validators.js
README.md
```

## Key implementation details

- Routes are defined in `routes/*.js` and mounted under `/api/files` and `/api/folders` by the app.
- Controllers are thin wrappers (use `asyncHandler`) that call the service layer.
- Services contain business logic and interact with the `File` mongoose model.
- `path.service.js` implements a materialized path pattern. Path format: `,id1,id2,` (leading/trailing commas).
- Validation uses `Joi` schemas exported from `validators/file.validators.js` and a `validate(schema, source)` helper middleware.
- Policies in `policies/file.policies.js` provide `isOwner`, `hasReadAccess`, `canUploadToFolder`, `checkFileQuota` (placeholder) and `validateFileTypes` (placeholder).

## Exported service functions (used by controllers)

- file.service.js
  - uploadFilesService(files, userId, parentId)
  - getUserFilesService(userId, user, parentId)
  - getFileDownloadUrlService(fileId, userId)
  - getBulkDownloadFilesService(fileIds, userId)
  - deleteFileService(fileId, userId)           // hard delete (Phase 0)
  - bulkDeleteFilesService(fileIds, userId)     // hard delete (Phase 0)

- folder.service.js
  - createFolderService(folderName, userId, parentId)
  - deleteFolderService(folderId, userId)       // deletes folder + descendants (hard delete)
  - moveItemService(itemId, userId, newParentId)
  - getFolderDetailsService(folderId, userId)
  - renameFolderService(folderId, userId, newName)
  - isFolderNameAvailable(folderName, userId, parentId, excludeId)

- path.service.js
  - buildPath(parentFolder)
  - extractAncestorIds(path)
  - isDescendant(folderPath, folderId, potentialAncestorPath, potentialAncestorId)
  - updateDescendantPath(oldPath, newPath, descendantPath)
  - calculateDepth(path)
  - isValidDepth(path, maxDepth = 2)

## Routes and endpoints (what the code currently wires up)

- File routes (`routes/file.routes.js`)
  - POST  /api/files/upload           (protect, multer uploadFiles, validate(uploadFilesSchema), canUploadToFolder, checkStorageQuota)
  - GET   /api/files                  (protect, validate(listFilesSchema, 'query'))
  - GET   /api/files/:id/download     (protect, hasReadAccess)
  - POST  /api/files/bulk-download    (protect)
  - DELETE /api/files/:id             (protect, isOwner)
  - DELETE /api/files                 (protect, validate(bulkFileIdsSchema))

- Folder routes (`routes/folder.routes.js`)
  - POST   /api/folders               (protect, validate(createFolderSchema))
  - GET    /api/folders/:id           (protect, isOwner)
  - PATCH  /api/folders/:id/move      (protect, validate(moveItemSchema), isOwner)
  - PATCH  /api/folders/:id/rename    (protect, validate(renameFolderSchema), isOwner)
  - DELETE /api/folders/:id           (protect, isOwner)

Notes:
- Uploads use the shared multer middleware at `../../_common/middleware/file.middleware.js` (configured to allow up to 10 files per request).
- Quota enforcement uses `../../_common/middleware/quota.middleware.js`.
- S3 interactions are delegated to the project's S3 service (used via imports in the services; current code imports from `../../../services/s3/s3.service.js` or `../../../services/s3.service.js` depending on call site).
- Bulk-download streams files into a zip using `archiver` and streams S3 file streams directly into the archive (no temp files).

## Validation

- `validators/file.validators.js` exposes Joi schemas:
  - uploadFilesSchema
  - createFolderSchema
  - moveItemSchema
  - renameFolderSchema
  - bulkFileIdsSchema
  - listFilesSchema

It also exposes `validate(schema, source)` which is used as express middleware in the route definitions.

## Authorization & security

- `isOwner` verifies the authenticated user owns the requested file/folder and attaches the item as `req.item`.
- `hasReadAccess` allows owner or users explicitly shared with (honors expiration timestamps on shares).
- `canUploadToFolder` ensures the parent folder (if provided) exists and belongs to the uploading user.

## Behavioural notes & edge cases

- Duplicate filename handling: `uploadFilesService` generates a unique filename by appending ` (n)` before the extension when duplicates exist in the same parent folder.
- Path handling: paths are materialized; moving a folder updates descendant paths with a bulkWrite for efficiency.
- Depth enforcement: `isValidDepth` is used to prevent creating/moving folders beyond the Phase 0 limit (default maxDepth = 2).
- Deletes are currently hard deletes (files removed from S3 and DB). This will be replaced by soft-delete / Trash in a future iteration.

## Testing suggestions

- Unit tests: path utilities, folder rename/move logic, upload filename collision resolution, validator middleware.
- Integration tests: upload → list → download flow; folder create → move → rename → delete; bulk-download permissions.

## TODO / Future work

- Replace hard deletes with Trash (soft-delete) and move deletion logic into a Trash domain.
- Add file-type validation and virus/scan integration.
- Add preview/thumbnail generation and streaming previews.
- Add versioning and soft-restore flows.

---

Last updated: 2025-11-02

