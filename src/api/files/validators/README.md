# Validators — Files Module

This folder contains Joi schemas and validation middleware for file-related requests. Validators ensure request bodies and query parameters are well-formed before controllers execute business logic.

Location
- `backend/src/api/files/validators/`

Typical validators
- `uploadFilesSchema` — validates multipart/form-data fields like optional `parentId` and enforces limits documented in the upload route.
- `bulkFileIdsSchema` — validates that `fileIds` is present and is an array (used for API-based callers). Note that controller parsing also accepts a stringified `fileIds` for form POSTs.
- `listFilesSchema` — validates `parentId` in the query string.

Behavioral notes
- Validation is applied as route middleware (see `routes/file.routes.js`) so controllers can assume shape of request data.

Testing suggestions
- Unit-test validator schemas against expected valid and invalid payloads.
