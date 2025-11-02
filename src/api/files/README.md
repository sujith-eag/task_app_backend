# Files module (backend/src/api/files)

This module implements personal file & folder operations used by the backend API.

Summary of what is implemented here:
- File uploads (multipart, S3 upload)
- File listing (owned + shared + class-based for students)
- Single-file download (S3 download URL)
- Bulk-download as a streamed ZIP (archiver)
## Behavior & Notes

- Duplicate names: Database-level partial unique index ensures non-deleted names are unique per parent; services catch `E11000` and return `409 Conflict` where appropriate.
- Upload concurrency: `generateUniqueFileName` attempts to avoid collisions; `insertMany` uses `ordered:false` and duplicate-key errors are surfaced as 409. Consider retry/rename strategies for high-concurrency uploads.
- Depth limits & context locks: Creating or moving items enforces a max depth (default 2) and prevents moving items across contexts (personal vs academic). Academic items are generally not movable.
- Search: `searchFilesService` uses MongoDB text index on `fileName` and filters by `isDeleted:false` and ownership/shares.
- Preview: `getPreviewUrl` in the S3 service returns a signed URL without forcing download so browsers can preview inline.

## Migration & schema notes

- A migration script (`backend/scripts/migrate_files_stage1.js`) was introduced to populate Stage‑1 fields for existing records and handle collisions safely (per‑document resolution to avoid partial unique index conflicts). The migration tracks completion in a `migrations` collection.

## Testing suggestions

- Unit tests: path utils, permission checks, filename generation, search service.
- Integration tests: upload → list → preview → download flows and folder zip download.

## Future work

- Reintroduce async folder downloads using a Job worker for large exports.
- Add pagination for large folder listing and server-side stream backpressure handling.
- Add end-to-end tests for S3 integration and preview rendering.

---

Last updated: 2025-11-02

## Testing suggestions

- Unit tests: path utilities, folder rename/move logic, upload filename collision resolution, validator middleware.
- Integration tests: upload → list → download flow; folder create → move → rename → delete; bulk-download permissions.

## TODO / Future work

- Replace hard deletes with Trash (soft-delete) and move deletion logic into a Trash domain.
 - Replace hard deletes with Trash (soft-delete) and move deletion logic into a Trash domain.
	 - Status: Completed — `DELETE /api/files/:id` and `DELETE /api/files` now call the Trash service (`softDeleteFileService` / `bulkSoftDeleteService`). The Files controllers were rewired to delegate deletion to `src/api/trash/services/trash.service.js`.
	 - Note: The Trash routes are mounted at `/api/trash`. See `src/api/trash/README.md` for full details.
- Add file-type validation and virus/scan integration.
- Add preview/thumbnail generation and streaming previews.
- Add versioning and soft-restore flows.

---

Last updated: 2025-11-02

