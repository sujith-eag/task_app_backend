# Policies — Files Module

Policies are small authorization helpers that enforce per-resource access rules (owner-only operations, read access checks, folder upload permissions, etc.). They are used as route middleware before controllers run.

Location
- `backend/src/api/files/policies/`

Common policies
- `isOwner` — Ensures the acting user is the owner of the resource (used for delete/move/rename operations).
- `hasReadAccess` — Ensures the user can read the file (owner or explicitly shared; honors expiration on shares).
- `canUploadToFolder` — Validates the target folder exists and the user has permission to upload into it.

Behavioral notes
- Policies should be fast and return early with a 403 when authorization fails.
- Keep policy logic independent of controllers so they can be reused across routes.

Testing suggestions
- Unit-test policy functions by creating file/folder stubs and asserting correct allow/deny behavior.
