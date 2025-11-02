# Shares — concise implementation notes

This file documents the actual, minimal sharing implementation used in this codebase.

Key facts
- Public shares are stored on the File document itself: `src/models/fileModel.js` — see `publicShare` subdocument (fields: `code`, `isActive`, `expiresAt`, `lastAccessedAt`).
- Direct user shares are small mapping documents in `src/models/fileshareModel.js` with fields: `fileId` (ref `File`), `userId` (ref `User`), and optional `expiresAt`.
- `FileShare` indexes: `{ fileId: 1, userId: 1 }` (unique) and `{ userId: 1, fileId: 1 }` for lookups.

Where to look (exact paths)
- Models: `src/models/fileModel.js`, `src/models/fileshareModel.js`
- Controllers: `src/api/shares/controllers/*.js` (`shares.controller.js`, `public.controller.js`)
- Service: `src/api/shares/services/shares.service.js`
- Routes: `src/api/shares/routes/*.js` (`shares.routes.js`, `public.routes.js`)
- Policies & validators: `src/api/shares/policies/shares.policies.js`, `src/api/shares/validators/shares.validators.js`

Routes (implemented / to check in route files)
- POST /api/shares/:fileId/public      — create/update public share (owner only)
- DELETE /api/shares/:fileId/public    — revoke public share (owner only)
- POST /api/public/download            — public endpoint: exchange `{ code }` for download URL (no auth)
- POST /api/shares/:fileId/user        — create direct share (creates `FileShare` doc)
- DELETE /api/shares/:fileId/user      — remove shared user (owner or self)
- GET  /api/shares/:fileId             — list file shares
- GET  /api/shares/shared-with-me      — list files shared with current user

Behavior notes
- Public-share metadata lives on the `File` doc. There is no separate "public" record in `FileShare` in this code.
- Direct shares are enforced unique per `fileId` + `userId` by the model index.
- Management endpoints require authentication/JWT and ownership checks; the public download endpoint intentionally requires no auth.

Recommended quick checks
- Confirm `publicShare.code` uniqueness and index behavior in `fileModel.js` before changing generation logic.
- Add a simple unit test asserting that creating two `FileShare` docs with same `fileId`+`userId` fails (index uniqueness).

Last updated: 2025-11-02
# Shares domain (summary + actual model mapping)

This file documents how sharing is implemented in this codebase (what lives where and how it should be used). I reviewed the implementation in `src/api/shares` and the related models in `src/models` and updated this README to reflect the actual code (short, accurate, and actionable).

## Quick summary

- Public shares (public, code-based links) are stored on the `File` document itself under `publicShare` (see `src/models/fileModel.js`).
- Direct user-to-file shares are stored in a small `FileShare` collection (`src/models/fileshareModel.js`) which maps a `fileId` to a `userId` and supports an optional `expiresAt` field and indexes for fast lookups.
- The code in `src/api/shares` provides controllers, routes, validators, policies, and a service layer that implement share creation, access checks, and revocation.

## Folder structure

```
src/api/shares/
├── controllers/
│   ├── public.controller.js    # public (unauthenticated) access handlers
│   └── shares.controller.js    # authenticated share management
├── services/
│   └── shares.service.js       # business logic
├── validators/
│   └── shares.validators.js    # request validation (Joi)
├── policies/
│   └── shares.policies.js      # authorization / loading helpers
├── routes/
│   ├── public.routes.js        # public endpoints (download by code)
│   └── shares.routes.js        # authenticated endpoints (create/revoke/share)
└── README.md                   # this file
```

## Models (actual code)

- `src/models/fileModel.js`
  - Contains a `publicShare` subdocument with fields like `code`, `isActive`, `expiresAt` and a `lastAccessedAt` timestamp.
  - Public-share logic (generate code, check expiration) is implemented to operate on this subdocument.

- `src/models/fileshareModel.js` (the `FileShare` collection)
  - Current schema fields (from the repo):
    - `fileId: ObjectId` (ref: `File`) — required
    - `userId: ObjectId` (ref: `User`) — required
    - `expiresAt: Date` — optional
  - Indexes: compound index on `{ fileId: 1, userId: 1 }` with `{ unique: true }` and another index `{ userId: 1, fileId: 1 }` for lookups.
  - Purpose: small mapping document for direct user shares (fast existence checks, unique per file+user).

Note: Because public shares are on the `File` document, there is not (in this code) a separate `public` type entry in `FileShare` — the system keeps public share data alongside the file itself.

## How sharing is implemented (high level)

- Public share flow:
  1. Owner requests a public share (controller triggers service).
 2. Service generates/updates `file.publicShare.code`, sets `expiresAt` and `isActive` on that `File` document.
 3. Public download endpoint (`public.controller.js` / `public.routes.js`) accepts a code, looks up the owning `File` by `publicShare.code`, checks `isActive` and `expiresAt`, and returns a presigned S3 link (or 401 on invalid/expired).

- Direct user share flow:
 1. Owner calls a route to share a file with a registered user.
 2. The service creates a `FileShare` document with `{ fileId, userId, expiresAt }` (unique per file+user).
 3. When a user requests `shared-with-me` or attempts access, the code checks the `FileShare` collection and the `File` owner to determine access.

## What to expect in `src/api/shares`

- `shares.controller.js` — endpoints for authenticated share management: create direct shares, revoke user shares, list shares for a file.
- `public.controller.js` — endpoint to exchange a public `code` for a download URL; intentionally does not require JWT.
- `shares.service.js` — contains the core logic: create/update public share on `File`, create `FileShare` docs, revoke shares, query shares.
- `shares.validators.js` — Joi schemas used by routes to validate incoming requests.
- `shares.policies.js` — middleware functions to load `File` and check ownership/permissions before controller logic.

## Key implementation notes & assumptions

- The `File` model (see `src/models/fileModel.js`) stores `publicShare` details: this is where public link codes and expiry are handled.
- The `FileShare` model is intentionally minimal and used for direct user shares. The unique compound index ensures the same user isn't duplicated for the same file.
- The codebase favors putting public link metadata on `File` rather than duplicating a `public` entry in `FileShare`.
- The `File` model also contains fields for `sharedWithClass` and `lastAccessedAt` (useful for class sharing and analytics) — confirm intended behavior if you add class-share APIs.

## Routes / common endpoints (implementation may vary slightly — check route files)

- POST /api/shares/:fileId/public — create/update a public share (owner only)
- DELETE /api/shares/:fileId/public — revoke public share (owner only)
- POST /api/public/download — exchange `{ code }` for a download URL (no auth)
- POST /api/shares/:fileId/user — share file with a user (creates `FileShare` doc)
- DELETE /api/shares/:fileId/user — remove a shared user (owner or self)
- GET /api/shares/:fileId — list shares for a file (owner or authorized users)
- GET /api/shares/shared-with-me — list files shared with current user (uses `FileShare` and `File.sharedWithClass` checks)

Always check `src/api/shares/routes/*.js` for exact parameter names and response shapes.

## Security & validation

- Auth: all management endpoints require a valid JWT (cookie-based `jwt` in browser flows is used across the codebase). The public download endpoint intentionally requires no auth.
- Authorisation: `shares.policies.js` contains middleware to ensure only owners can create/revoke certain share types and users can only remove themselves (unless owner).
- Validation: `shares.validators.js` contains request schemas; controllers should reject invalid inputs with 400.

## Maintenance notes / TODOs (recommended)

- Add unit tests for `FileShare` uniqueness (create duplicate should fail).
- Add integration tests for the `public` flow (create public code → public download endpoint returns presigned URL → expiry enforcement).
- Consider consolidating public-share logic: keep single place in `shares.service.js` to mutate `File.publicShare` (already practiced but validate boundaries).
- If class-share functionality is required beyond `File.sharedWithClass`, discuss whether a separate collection is needed for large-scale class operations.

## Where to look in the code

- Controllers: `src/api/shares/controllers/*.js`
- Routes: `src/api/shares/routes/*.js`
- Policies (auth/ownership): `src/api/shares/policies/shares.policies.js`
- Service: `src/api/shares/services/shares.service.js`
- Validators: `src/api/shares/validators/shares.validators.js`
- Models: `src/models/fileModel.js`, `src/models/fileshareModel.js`

---

If you'd like, I can also:
- add short example curl requests for the real route parameter names used in `shares.routes.js`, or
- add a small set of tests (Jest/Mocha) for the public-share flow.

Last updated: 2025-11-02


## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [FileShare Model](#fileshare-model)
- [Share Types](#share-types)
- [API Endpoints](#api-endpoints)
- [Service Layer](#service-layer)
- [Security & Authorization](#security--authorization)
- [Validation](#validation)
- [Usage Examples](#usage-examples)
- [Integration Notes](#integration-notes)

---

## Overview

The Shares domain is responsible for:
- **Public sharing** via time-limited share codes
- **Direct user sharing** with optional expiration
- **Class sharing** for batch/semester/section groups
- **Access tracking** and analytics
- **Share management** (revoke, remove, bulk operations)

This domain uses a dedicated `FileShare` model to completely separate sharing concerns from the main `File` model.

---

## Architecture

```
shares/
├── controllers/
│   ├── shares.controller.js    # Authenticated share operations
│   └── public.controller.js    # Unauthenticated public access
├── services/
│   └── shares.service.js       # Business logic for all share types
├── validators/
│   └── shares.validators.js    # Request validation (Joi schemas)
├── policies/
│   └── shares.policies.js      # Authorization checks
├── routes/
│   ├── shares.routes.js        # Protected share endpoints
│   └── public.routes.js        # Public access endpoint
└── README.md                   # This file
```

**Flow**: Routes → Validators → Policies → Controllers → Services → Models

---

## FileShare Model

Located at: `src/models/fileshareModel.js`

### Schema

```javascript
{
  file: ObjectId,              // Reference to File model
  owner: ObjectId,             // Reference to User (file owner)
  shareType: String,           // 'public' | 'direct' | 'class'
  
  // Public share fields
  publicCode: String,          // 8-char hex code
  isActive: Boolean,           // Can be deactivated
  expiresAt: Date,            // Time-limited access
  
  // Direct share fields
  sharedWith: [ObjectId],      // Array of User references
  
  // Class share fields
  classShare: {
    subject: ObjectId,         // Reference to Subject
    batch: Number,             // Year (e.g., 2024)
    semester: Number,          // 1-8
    section: String            // 'A', 'B', etc.
  },
  
  // Analytics
  accessCount: Number,
  lastAccessedAt: Date,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

```javascript
// Efficient querying
{ file: 1, shareType: 1 }           // Find shares by file and type
{ file: 1, sharedWith: 1 }          // Check user access
{ publicCode: 1 }                   // Lookup by share code
{ shareType: 1, isActive: 1, expiresAt: 1 }  // Find active shares
{ 'classShare.batch': 1, 'classShare.semester': 1, 'classShare.section': 1 }  // Class lookups
```

### Instance Methods

```javascript
// Check if share is currently valid
share.isValid()  // Returns boolean

// Record access (increment count, update timestamp)
await share.recordAccess()

// Deactivate share (soft delete for public shares)
await share.deactivate()
```

### Static Methods

```javascript
// Find all shares for a file
FileShare.findByFile(fileId, shareType)

// Find valid public share by code
FileShare.findValidPublicShare(code)

// Check if user has access to file
FileShare.userHasAccess(fileId, userId)

// Get all files shared with a user
FileShare.getFilesSharedWithUser(userId)

// Clean up expired shares
FileShare.cleanExpired()
```

---

## Share Types

### 1. Public Share

**Purpose**: Create shareable links for anyone with the code  
**Duration Options**: `1-hour`, `1-day`, `7-days`  
**Code Format**: 8-character hex string (e.g., `a3f9c82d`)

**Characteristics**:
- No authentication required for download
- Time-limited with automatic expiration
- Can be manually deactivated by owner
- Tracks access count and last access time
- One public share per file (updated if exists)

**Use Cases**:
- Quick file sharing with external users
- Temporary access for collaborators
- Time-sensitive document distribution

### 2. Direct Share

**Purpose**: Share files with specific registered users  
**Expiration**: Optional (can be permanent or time-limited)

**Characteristics**:
- Requires user account and authentication
- One share document can have multiple users in `sharedWith` array
- Users can remove themselves from shares
- Owner can revoke access for specific users
- Supports bulk operations

**Use Cases**:
- Sharing with known collaborators
- Persistent file access for team members
- Controlled access with revocation capability

### 3. Class Share

**Purpose**: Share academic materials with entire class groups  
**Grouping**: `batch` + `semester` + `section` + `subject`

**Characteristics**:
- Shares with all students matching class criteria
- Automatically available to new students added to class
- Teachers can share course materials efficiently
- Batch format: 2000-2100 (year range)
- Semester: 1-8

**Use Cases**:
- Distributing course materials
- Sharing lecture notes with class
- Academic resource distribution

---

## API Endpoints

### Public Share Endpoints

#### Create Public Share

```http
POST /api/shares/:fileId/public
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "duration": "1-day"
}

Response 200:
{
  "message": "Public share created successfully",
  "share": {
    "_id": "...",
    "publicCode": "a3f9c82d",
    "expiresAt": "2024-01-15T10:30:00.000Z",
    "shareUrl": "https://app.com/download?code=a3f9c82d"
  }
}
```

#### Revoke Public Share

```http
DELETE /api/shares/:fileId/public
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

Response 200:
{
  "message": "Public share revoked successfully"
}
```

### Direct User Share Endpoints

#### Share with User

```http
POST /api/shares/:fileId/user
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "userIdToShareWith": "userId123",
  "expiresAt": "2024-06-01T00:00:00.000Z"  // Optional
}

Response 200:
{
  "message": "File shared successfully with user",
  "share": {
    "_id": "...",
    "file": "fileId",
    "sharedWith": ["userId123"],
    "expiresAt": "2024-06-01T00:00:00.000Z"
  }
}
```

#### Remove User Access

```http
DELETE /api/shares/:fileId/user
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "userIdToRemove": "userId123"  // Optional (null = remove self)
}

Response 200:
{
  "message": "User removed from share successfully"
}
```

#### Bulk Remove Access

```http
POST /api/shares/bulk-remove
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "fileIds": ["fileId1", "fileId2", "fileId3"]
}

Response 200:
{
  "message": "Successfully removed from 3 shared files"
}
```

### Class Share Endpoints

#### Share with Class

```http
POST /api/shares/:fileId/class
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "batch": 2024,
  "semester": 5,
  "section": "A",
  "subjectId": "subjectId123"
}

Response 200:
{
  "message": "File shared successfully with class",
  "share": {
    "_id": "...",
    "file": "fileId",
    "classShare": {
      "subject": "subjectId123",
      "batch": 2024,
      "semester": 5,
      "section": "A"
    }
  }
}
```

#### Remove Class Share

```http
DELETE /api/shares/:fileId/class
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

Response 200:
{
  "message": "Class share removed successfully"
}
```

### Query Endpoints

#### Get File Shares

```http
GET /api/shares/:fileId
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

Response 200:
{
  "shares": [
    {
      "_id": "...",
      "shareType": "public",
      "publicCode": "a3f9c82d",
      "expiresAt": "2024-01-15T10:30:00.000Z",
      "isActive": true,
      "accessCount": 5
    },
    {
      "_id": "...",
      "shareType": "direct",
      "sharedWith": [{ "_id": "...", "name": "John Doe", "email": "john@example.com" }]
    },
    {
      "_id": "...",
      "shareType": "class",
      "classShare": {
        "batch": 2024,
        "semester": 5,
        "section": "A",
        "subject": { "_id": "...", "name": "Data Structures" }
      }
    }
  ]
}
```

#### Get Files Shared With Me

```http
GET /api/shares/shared-with-me
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

Response 200:
{
  "files": [
    {
      "_id": "fileId",
      "name": "Lecture_Notes.pdf",
      "size": 2048576,
      "mimeType": "application/pdf",
      "sharedBy": {
        "_id": "userId",
        "name": "Prof. Smith"
      },
      "shareType": "direct",
      "sharedAt": "2024-01-10T08:00:00.000Z"
    }
  ],
  "count": 15
}
```

### Public Access Endpoint

#### Get Public Download

```http
POST /api/public/download
Content-Type: application/json
# NO AUTHENTICATION REQUIRED

{
  "code": "a3f9c82d"
}

Response 200:
{
  "downloadUrl": "https://s3.amazonaws.com/...",
  "fileName": "Document.pdf",
  "expiresIn": 3600
}

Response 401:
{
  "message": "Invalid or expired share code"
}
```

---

## Service Layer

Located at: `src/api/shares/services/shares.service.js`

### Public Share Services

#### `createPublicShareService(fileId, userId, duration)`
- Creates or updates public share
- Generates 8-char hex code
- Calculates expiration based on duration
- Returns share with shareUrl

#### `revokePublicShareService(fileId, userId)`
- Deactivates public share
- Only owner can revoke
- Soft delete (keeps record)

#### `getPublicDownloadLinkService(code)`
- Validates share code
- Checks expiration and active status
- Records access (count + timestamp)
- Generates S3 presigned URL (1 hour)

### Direct Share Services

#### `shareFileWithUserService(fileId, userIdToShareWith, expiresAt, currentUserId)`
- Validates both users exist
- Prevents self-sharing
- Prevents sharing with file owner
- Creates or updates share
- Adds user to `sharedWith` array

#### `manageShareAccessService(fileId, userIdToRemove, currentUserId)`
- Owner removes specific user OR user removes self
- Updates `sharedWith` array
- Deletes share if array becomes empty

#### `bulkRemoveShareAccessService(fileIds, userId)`
- Removes user from multiple shares at once
- Efficient bulk operation
- Returns count of affected shares

### Class Share Services

#### `shareFileWithClassService(fileId, userId, classData)`
- Validates subject exists
- Creates class share with batch/semester/section
- One class share per file
- Accessible by all students in that class

#### `removeClassShareService(fileId, userId)`
- Deletes class share
- Only owner can remove

### Query Services

#### `getFileSharesService(fileId, currentUserId)`
- Returns all shares for a file
- Populates user and subject data
- Accessible by owner or users with access

#### `getFilesSharedWithUserService(userId)`
- Returns all files shared with user (direct + class)
- Matches user ID in `sharedWith` array
- Matches user's batch/semester/section for class shares
- Populates file and owner data

---

## Security & Authorization

### Policies (Middleware)

Located at: `src/api/shares/policies/shares.policies.js`

#### `loadFile`
- Loads file from database
- Attaches to `req.file`
- Returns 404 if not found

#### `isFileOwner`
- Checks if current user owns the file
- Required for public share revocation, class share removal

#### `canShareFile`
- Verifies user is file owner
- Ensures file is not in trash
- Required for creating shares

#### `canAccessPublicShare`
- Verifies user is file owner
- Required for managing public shares

#### `validateSharePermissions`
- Complex permission check for removing users
- Allows user to remove self from any share
- Only owner can remove other users

#### `canViewFileShares`
- Owner can always view
- Users with access can view shares

### Security Features

1. **Authentication**: All share management requires JWT token (except public download)
2. **Authorization**: Ownership and access checks prevent unauthorized operations
3. **Validation**: Joi schemas sanitize and validate all inputs
4. **Expiration**: Automatic time-based access control
5. **Deactivation**: Manual revocation capability for public shares
6. **Access Tracking**: Monitor share usage with counts and timestamps
7. **Isolation**: FileShare model prevents File model pollution

---

## Validation

Located at: `src/api/shares/validators/shares.validators.js`

### Schemas

- **createPublicShareSchema**: Duration must be '1-hour', '1-day', or '7-days'
- **publicDownloadSchema**: Code must be non-empty string
- **shareWithUserSchema**: userIdToShareWith required, optional expiresAt ISO date
- **removeUserAccessSchema**: Optional userIdToRemove (null = remove self)
- **bulkRemoveSchema**: Array of fileIds, minimum 1
- **shareWithClassSchema**: batch (2000-2100), semester (1-8), section (uppercase string), subjectId required

### Custom Validation

Model-level validation in `FileShare.pre('save')`:
- Public shares require `publicCode`, `isActive`, `expiresAt`
- Direct shares require `sharedWith` array with at least 1 user
- Class shares require all 4 classShare fields
- Unused fields are cleared based on `shareType`

---

## Usage Examples

### Example 1: Teacher Shares Lecture Notes with Class

```javascript
// Teacher uploads file
POST /api/files_new/upload

// Teacher shares with class
POST /api/shares/:fileId/class
{
  "batch": 2024,
  "semester": 5,
  "section": "A",
  "subjectId": "cs301"
}

// Student views shared files
GET /api/shares/shared-with-me
// Response includes lecture notes if student matches batch/semester/section
```

### Example 2: Quick Public Link for External Reviewer

```javascript
// Create 1-day public link
POST /api/shares/:fileId/public
{
  "duration": "1-day"
}
// Response: { publicCode: "a3f9c82d", shareUrl: "..." }

// External user downloads (no auth)
POST /api/public/download
{
  "code": "a3f9c82d"
}
// Response: { downloadUrl: "https://s3...", fileName: "..." }

// Owner revokes after review
DELETE /api/shares/:fileId/public
```

### Example 3: Collaborate with Team Members

```javascript
// Share with first team member
POST /api/shares/:fileId/user
{
  "userIdToShareWith": "user1",
  "expiresAt": null  // Permanent access
}

// Add second team member
POST /api/shares/:fileId/user
{
  "userIdToShareWith": "user2"
}
// Both users now in sharedWith array

// Team member leaves, removes self
DELETE /api/shares/:fileId/user
{
  "userIdToRemove": null  // Remove self
}

// Owner removes another user
DELETE /api/shares/:fileId/user
{
  "userIdToRemove": "user2"
}
```

### Example 4: Student Cleans Up Shared Files

```javascript
// Student views all shared files
GET /api/shares/shared-with-me
// Response: 20 files

// Student bulk removes self from old courses
POST /api/shares/bulk-remove
{
  "fileIds": ["file1", "file2", "file3", ..., "file10"]
}
// Removed from 10 shares at once
```

---

## Integration Notes

### With Files Domain

- Files domain handles personal file operations (upload, download, organize)
- Shares domain handles all sharing operations
- Shared files use Files domain download endpoints with added access checks
- File model does NOT store sharing data anymore

### With Trash Domain (Future)

- Files in trash cannot be shared (checked in `canShareFile` policy)
- Deleting file should cascade delete all associated shares
- Restoring file from trash should NOT restore shares (security)

### Model Relationships

```javascript
FileShare → File (many-to-one)
FileShare → User (many-to-one for owner)
FileShare → User (many-to-many via sharedWith array)
FileShare → Subject (many-to-one for class shares)
```

### Cleanup Job

Recommended: Run periodic cleanup job to delete expired shares

```javascript
// In a cron job or scheduler
import { FileShare } from './models/fileshareModel.js';

// Daily cleanup
setInterval(async () => {
  const result = await FileShare.cleanExpired();
  console.log(`Cleaned up ${result.deletedCount} expired shares`);
}, 24 * 60 * 60 * 1000);  // 24 hours
```

### Route Registration

Mount in central route registry:

```javascript
// In server.js or routes index
import sharesRoutes from './api/shares/routes/shares.routes.js';
import publicRoutes from './api/shares/routes/public.routes.js';

app.use('/api/shares', sharesRoutes);
app.use('/api/public', publicRoutes);
```

---

## Error Handling

All controllers use `asyncHandler` to catch errors. Common error responses:

- **400 Bad Request**: Validation errors, invalid share state
- **401 Unauthorized**: Missing or invalid token, expired share code
- **403 Forbidden**: Insufficient permissions (not owner, not shared with user)
- **404 Not Found**: File not found, share not found, user not found
- **500 Internal Server Error**: Database errors, S3 errors

Example error response:
```json
{
  "message": "Access denied: Only file owner can share files"
}
```

---

## Testing Checklist

### Public Shares
- [ ] Create public share with all duration options
- [ ] Download using valid code
- [ ] Verify expiration blocking
- [ ] Revoke active share
- [ ] Track access count
- [ ] Update existing public share
- [ ] Invalid code returns 401

### Direct Shares
- [ ] Share with valid user
- [ ] Prevent self-sharing
- [ ] Prevent sharing with owner
- [ ] Add multiple users to same share
- [ ] User removes self
- [ ] Owner removes specific user
- [ ] Bulk remove from multiple files
- [ ] Optional expiration works

### Class Shares
- [ ] Share with valid class
- [ ] Validate subject exists
- [ ] Students see shared files
- [ ] Remove class share
- [ ] One class share per file

### Authorization
- [ ] Non-owners cannot create shares
- [ ] Non-owners cannot revoke public shares
- [ ] Users can only remove self (not others)
- [ ] Files in trash cannot be shared
- [ ] Shared users can view file shares

### Edge Cases
- [ ] Share already exists (update vs error)
- [ ] Expired shares not accessible
- [ ] Deleted files cascade delete shares
- [ ] Invalid user IDs handled gracefully
- [ ] Empty sharedWith array deletes share

---

## Performance Considerations

1. **Indexes**: Compound indexes optimize common queries
2. **Batch Operations**: `bulkRemoveShareAccess` uses `$pull` for efficiency
3. **Minimal Populates**: Only populate needed fields in responses
4. **Access Checks**: Static method `userHasAccess` uses indexed query
5. **Cleanup Job**: Periodic deletion prevents database bloat

---

## Future Enhancements

- [ ] Permission levels (view-only, download, edit)
- [ ] Share folders (not just individual files)
- [ ] Email notifications when file is shared
- [ ] Share analytics dashboard
- [ ] Password-protected public shares
- [ ] Custom expiration dates
- [ ] Share templates for common scenarios
- [ ] Audit log for share operations

---

## Related Documentation

- **Files Domain**: `src/api/files_new/README.md` - Personal file operations
- **File Model**: `src/models/fileModel.js` - Core file entity
- **FileShare Model**: `src/models/fileshareModel.js` - Share entity
- **Auth Middleware**: `src/middleware/auth.middleware.js` - JWT authentication
- **S3 Service**: `src/services/s3.service.js` - File storage operations

> Note: Authentication and middleware have been consolidated. The canonical auth middleware now lives at `src/api/_common/middleware/auth.middleware.js` and the system issues an httpOnly cookie named `jwt` for browser sessions. Runtime code should prefer the cookie (via `withCredentials`) — legacy `src/middleware/auth.middleware.js` is retained as a compatibility shim that re-exports the centralized implementation and emits a deprecation warning. For non-browser clients, Authorization header remains supported.

---

**Version**: 1.0.0  
**Last Updated**: 2024-01-14  
**Maintainer**: Backend Team
