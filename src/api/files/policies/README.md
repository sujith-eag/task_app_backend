
# Policies — Files Module

Policies are small authorization helpers used as route middleware to enforce per-resource access rules (owner-only operations, read access checks, folder upload permissions, etc.).

Location
- `backend/src/api/files/policies/`

Common policies
- `isOwner` — Ensures the acting user is the owner of the resource (used for delete/move/rename operations).
- `hasReadAccess` — Ensures the user can read the file (owner or explicitly shared; honors expiration on shares and supports class-based shares when the `user` object is provided to services).
- `canUploadToFolder` — Validates the target folder exists and the user has permission to upload into it.

Behavioral notes
- Policies are designed to be fast and return early with a 403 when authorization fails. They should avoid heavy DB work and delegate complex permission composition to services when necessary.

Testing suggestions
- Unit-test policy functions with file/folder stubs and coverage of owner, shared, expired-share, and class-share cases.

Last updated: 2025-11-02
