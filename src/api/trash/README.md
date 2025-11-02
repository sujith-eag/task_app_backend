# Trash Domain

Comprehensive soft-delete and trash management system for the file management application. This domain handles moving files to trash, restoring them, and permanent deletion with configurable retention policies.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Soft Delete System](#soft-delete-system)
- [API Endpoints](#api-endpoints)
- [Service Layer](#service-layer)
- [Security & Authorization](#security--authorization)
- [Validation](#validation)
- [Usage Examples](#usage-examples)
- [Retention & Cleanup](#retention--cleanup)
- [Integration Notes](#integration-notes)

---

## Overview

The Trash domain provides:
- **Soft delete** - Files marked as deleted, not immediately removed
- **Restore functionality** - Recover files from trash
- **Permanent delete (purge)** - Irreversibly remove files from S3 and database
- **Bulk operations** - Efficient batch processing
- **Auto-cleanup** - Scheduled purging of old trash items
- **Admin tools** - Direct hard delete for administrators

### Key Benefits
- **Data safety** - Accidental deletions can be recovered
- **Storage management** - Old trash automatically purged
- **User experience** - Familiar trash/recycle bin pattern
- **Audit trail** - Track who deleted what and when

---

## Architecture

```
trash/
├── controllers/
│   └── trash.controller.js     # Request handlers
├── services/
│   └── trash.service.js        # Business logic for all trash operations
├── validators/
│   └── trash.validators.js     # Request validation (Joi schemas)
├── policies/
│   └── trash.policies.js       # Authorization checks
├── routes/
│   └── trash.routes.js         # Endpoint definitions
└── README.md                   # This file
```

**Flow**: Routes → Validators → Policies → Controllers → Services → Models

---

## Soft Delete System

### File Model Updates

The `File` model has been enhanced with soft-delete support:

```javascript
{
  // Existing fields...
  isDeleted: Boolean,        // Flag indicating file is in trash
  deletedAt: Date,           // When file was moved to trash
  deletedBy: ObjectId        // User who deleted the file
}
```

### How It Works

1. **Soft Delete**: File marked with `isDeleted: true`, not removed from database
2. **Retention Period**: Files kept in trash for configurable period (default: 30 days)
3. **Restore**: Clear `isDeleted` flag, file becomes accessible again
4. **Purge**: Permanent deletion from S3 and database after retention or manual action

### Folder Handling

When a folder is deleted/restored:
- All descendants are recursively affected
- Path-based queries ensure efficiency
- Descendant count shown in trash listings

### Share Deactivation

When files are soft-deleted:
- Public shares are automatically deactivated (`isActive: false`)
- Direct and class shares remain in database
- Shares are NOT restored when file is restored (security)
- Shares are permanently deleted when file is purged

---

## API Endpoints

### Soft Delete Endpoints

#### Move File to Trash

```http
DELETE /api/trash/soft-delete/:fileId
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

Middleware chain: `protect` -> `loadFile` -> `isFileOwner` -> `isNotInTrash`

Response 200:
{
  "message": "File moved to trash",
  "deletedCount": 1,
  "file": {
    "_id": "fileId",
    "fileName": "Document.pdf",
    "isFolder": false,
    "deletedAt": "2025-10-31T10:30:00.000Z"
  }
}
```

#### Bulk Move to Trash

```http
POST /api/trash/soft-delete/bulk
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

Middleware chain: `protect` -> `validate(bulkOperationSchema)` -> `bulkOperationLimit`

{
  "fileIds": ["fileId1", "fileId2", "fileId3"]
}

Response 200:
{
  "message": "15 items moved to trash",
  "deletedCount": 15
}
```

### Restore Endpoints

#### Restore File from Trash

```http
POST /api/trash/restore/:fileId
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

Response 200:
{
  "message": "File restored successfully",
  "restoredCount": 1,
  "file": {
    "_id": "fileId",
    "fileName": "Document.pdf",
    "isFolder": false,
    "parentId": "folderId"
  }
}
```

#### Bulk Restore

```http
POST /api/trash/restore/bulk
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "fileIds": ["fileId1", "fileId2", "fileId3"]
}

Response 200:
{
  "message": "10 items restored from trash",
  "restoredCount": 10,
  "skipped": 2
}

Note: Files with deleted/missing parents are skipped
```

### Permanent Delete (Purge) Endpoints

#### Purge Single File

```http
DELETE /api/trash/purge/:fileId
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

Response 200:
{
  "message": "File permanently deleted",
  "purgedCount": 1,
  "s3KeysDeleted": 1
}

Middleware chain: `protect` -> `loadFile` -> `isFileOwner` -> `isInTrash`
```

#### Bulk Purge

```http
POST /api/trash/purge/bulk
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "fileIds": ["fileId1", "fileId2", "fileId3"]
}

Response 200:
{
  "message": "25 items permanently deleted",
  "purgedCount": 25,
  "s3KeysDeleted": 25
}

Middleware chain: `protect` -> `validate(bulkOperationSchema)` -> `bulkOperationLimit`
```

#### Empty Trash

```http
DELETE /api/trash/empty
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

Response 200:
{
  "message": "Trash emptied successfully",
  "purgedCount": 42,
  "s3KeysDeleted": 42
}

Middleware: `protect` (only authenticated users can empty their own trash)
```

### Query Endpoints

#### List Trash Contents

```http
GET /api/trash
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

Response 200:
{
  "items": [
    {
      "_id": "fileId1",
      "fileName": "Old_Report.pdf",
      "fileType": "application/pdf",
      "size": 2048576,
      "isFolder": false,
      "deletedAt": "2025-10-25T08:00:00.000Z",
      "deletedBy": "userId"
    },
    {
      "_id": "folderId1",
      "fileName": "Archive",
      "isFolder": true,
      "deletedAt": "2025-10-20T14:30:00.000Z",
      "descendantCount": 15
    }
  ],
  "count": 2
}
```

#### Get Trash Statistics

```http
GET /api/trash/stats
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

Response 200:
{
  "fileCount": 35,
  "folderCount": 5,
  "totalItems": 40,
  "totalSize": 104857600,
  "totalSizeMB": "100.00"
}
```

### Admin Endpoints

#### Cleanup Old Trash

```http
POST /api/trash/cleanup
Auth: Browser: httpOnly cookie `jwt` (Admin only). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "retentionDays": 30
}

Response 200:
{
  "message": "Cleaned up 15 items older than 30 days",
  "purgedCount": 15,
  "s3KeysDeleted": 15,
  "cutoffDate": "2025-10-01T00:00:00.000Z"
}
```

#### Admin Hard Delete

```http
DELETE /api/trash/admin/hard-delete/:fileId
Auth: Browser: httpOnly cookie `jwt` (Admin only). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

Response 200:
{
  "message": "Admin hard delete: 1 items permanently removed",
  "deletedCount": 1,
  "s3KeysDeleted": 1,
  "performedBy": "adminUserId"
}

Note: Bypasses soft-delete requirement, directly deletes from S3 and DB
```

---

## Service Layer

Located at: `src/api/trash/services/trash.service.js`

### Soft Delete Services

#### `softDeleteFileService(fileId, userId)`
- Marks file as deleted (`isDeleted: true`)
- Sets `deletedAt` and `deletedBy`
- Recursively handles folders and descendants
- Deactivates public shares
- Returns deletion result with count

#### `bulkSoftDeleteService(fileIds, userId)`
- Batch soft-delete multiple files
- Verifies user owns all files
- Processes folders recursively
- Efficient bulk operations

### Restore Services

#### `restoreFileService(fileId, userId)`
- Clears `isDeleted` flag
- Validates parent folder exists and is not deleted
- Recursively restores folder contents
- Returns restoration result

#### `bulkRestoreService(fileIds, userId)`
- Batch restore multiple files
- Skips files with deleted/missing parents
- Returns count of restored and skipped items

### Purge Services

#### `purgeFileService(fileId, userId)`
- Permanently deletes from S3 and database
- Requires file to be soft-deleted first
- Deletes all associated FileShare documents
- Handles folders recursively
- Returns purge result with S3 count

#### `bulkPurgeService(fileIds, userId)`
- Batch permanent deletion
- Efficient parallel S3 deletion
- Security checks for ownership

#### `emptyTrashService(userId)`
- Purges all deleted files for a user
- Mass S3 deletion
- Mass database deletion
- Complete trash clearing

### Query Services

#### `listTrashService(userId)`
- Returns all deleted items for user
- Calculates descendant counts for folders
- Sorted by deletion date (newest first)

#### `getTrashStatsService(userId)`
- File and folder counts
- Total storage used by trash
- Quick overview statistics

### Maintenance Services

#### `cleanExpiredTrashService(retentionDays = 30)`
- Auto-purge items older than retention period
- Scheduled job function
- Returns cleanup statistics

#### `adminHardDeleteService(fileId, adminUserId)`
- Direct permanent deletion
- Bypasses soft-delete requirement
- Admin-only operation
- Use with caution

---

## Security & Authorization

### Policies (Middleware)

Located at: `src/api/trash/policies/trash.policies.js`

#### `loadFile`
- Loads file from database
- Attaches to `req.file`
- Returns 404 if not found

#### `isFileOwner`
- Verifies user owns the file
- Required for all operations

#### `isInTrash`
- Ensures file is soft-deleted
- Required for restore and purge

#### `isNotInTrash`
- Ensures file is NOT deleted
- Required for soft-delete

#### `isAdmin`
- Verifies user has admin role
- Required for cleanup and hard delete

#### `validateParentForRestore`
- Checks parent folder exists
- Ensures parent is not deleted
- Required for restore operations

#### `bulkOperationLimit`
- Limits bulk operations to 100 items
- Prevents abuse and performance issues

#### `validateCleanup`
- Ensures retention days is reasonable (1-365)
- Prevents accidental mass deletion

### Security Features

1. **Ownership Verification**: All operations verify user owns files
2. **State Validation**: Operations check file is in correct state (deleted/not deleted)
3. **Parent Validation**: Restore checks parent folder validity
4. **Bulk Limits**: Maximum 100 items per bulk operation
5. **Admin Protection**: Sensitive operations require admin role
6. **Cascade Safety**: Share deactivation prevents deleted file access
7. **Audit Trail**: `deletedBy` field tracks who deleted files

---

## Validation

Located at: `src/api/trash/validators/trash.validators.js`

### Schemas

- **bulkOperationSchema**: Array of fileIds, minimum 1
- **cleanupSchema**: retentionDays (1-365, default 30)
- **fileIdParamSchema**: Single fileId parameter validation

### Model-Level Validation

- `isDeleted` defaults to `false`
- `deletedAt` and `deletedBy` default to `null`
- All three fields updated atomically during soft-delete

---

## Usage Examples

### Example 1: User Accidentally Deletes File

```javascript
// User deletes file
DELETE /api/trash/soft-delete/:fileId
// File moved to trash, not permanently deleted

// User realizes mistake, restores file
POST /api/trash/restore/:fileId
// File restored to original location

// User can access file again
GET /api/files_new/list
// File appears in normal listing
```

### Example 2: Clean Up Old Projects

```javascript
// User selects multiple old project files
POST /api/trash/soft-delete/bulk
{
  "fileIds": ["file1", "file2", "folder1", ...]
}
// All items moved to trash

// After 30 days, automatic cleanup runs
POST /api/trash/cleanup
{
  "retentionDays": 30
}
// Old items permanently deleted from S3 and DB
```

### Example 3: Empty Trash to Free Storage

```javascript
// User views trash statistics
GET /api/trash/stats
// Response: 2.5GB in trash

// User empties entire trash
DELETE /api/trash/empty
// All trash items permanently deleted

// Storage quota freed
GET /api/trash/stats
// Response: 0 bytes in trash
```

### Example 4: Admin Emergency Deletion

```javascript
// Admin needs to immediately remove sensitive file
DELETE /api/trash/admin/hard-delete/:fileId
// File bypasses trash, immediately removed from S3 and DB

// No recovery possible
// Audit log shows admin action
```

### Example 5: Folder Hierarchy Handling

```javascript
// User deletes folder with 50 files
DELETE /api/trash/soft-delete/folderId
// Response: "Folder and 51 items moved to trash"

// User restores folder
POST /api/trash/restore/folderId
// Response: "Folder and 51 items restored"

// All descendants automatically handled
```

---

## Retention & Cleanup

### Default Retention Policy

- **Retention Period**: 30 days (configurable)
- **Auto-Cleanup**: Scheduled job purges expired items
- **Manual Cleanup**: Admins can trigger cleanup with custom retention

### Cleanup Job Setup

Add to your scheduler (e.g., node-cron):

```javascript
import cron from 'node-cron';
import { cleanExpiredTrashService } from './api/trash/services/trash.service.js';

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    const result = await cleanExpiredTrashService(30);
    console.log(`Trash cleanup: ${result.purgedCount} items deleted`);
  } catch (error) {
    console.error('Trash cleanup failed:', error);
  }
});
```

### Storage Management

```javascript
// Calculate trash storage impact
GET /api/trash/stats
// Shows total MB in trash

// If storage quota is tight, empty trash
DELETE /api/trash/empty
// Immediate storage recovery
```

### Retention Recommendations

- **Personal Files**: 30 days
- **Academic Materials**: 90 days
- **Admin/System Files**: 7 days (immediate review)
- **Large Files**: Consider shorter retention

---

## Integration Notes

### With Files Domain

Files domain now uses trash service instead of hard delete:

```javascript
// OLD (hard delete)
await File.findByIdAndDelete(fileId);
await deleteFromS3(s3Key);

// NEW (soft delete)
import { softDeleteFileService } from '../trash/services/trash.service.js';
await softDeleteFileService(fileId, userId);
```

### With Shares Domain

- Soft-delete automatically deactivates public shares
- Direct and class shares remain but file is inaccessible
- Purge permanently deletes all FileShare documents
- Restore does NOT reactivate shares (security feature)

### Query Modifications

All file queries should exclude deleted files:

```javascript
// Always filter out deleted files
const files = await File.find({
  user: userId,
  isDeleted: false  // ← Important!
});

// Or use a default scope (Mongoose plugin)
fileSchema.plugin(softDeletePlugin);
```

### Index Optimization

The `isDeleted` field is indexed for performance:

```javascript
// In File model
{
  isDeleted: {
    type: Boolean,
    default: false,
    index: true  // ← Efficient queries
  }
}
```

### Route Registration

Mount in central route registry:

```javascript
// In server.js or routes index
import trashRoutes from './api/trash/routes/trash.routes.js';

app.use('/api/trash', trashRoutes);
```

### Migration Considerations

If upgrading from hard-delete to soft-delete:

1. Add new fields to File model
2. Update all delete operations to use trash service
3. Add `isDeleted: false` filter to existing queries
4. Set up cleanup job
5. Inform users about new trash functionality

---

## Error Handling

All controllers use `asyncHandler` to catch errors. Common error responses:

### 400 Bad Request
- File is already in trash
- File is not in trash
- Parent folder is deleted/missing
- Invalid retention days
- Bulk operation exceeds limit

### 403 Forbidden
- User is not file owner
- User is not admin (for admin operations)
- Permission to delete multiple files denied

### 404 Not Found
- File not found

### 500 Internal Server Error
- S3 deletion failed
- Database operation failed

Example error response:
```json
{
  "message": "Cannot restore: Parent folder is deleted. Restore parent first."
}
```

---

## Testing Checklist

### Soft Delete
- [ ] Soft delete single file
- [ ] Soft delete folder with descendants
- [ ] Bulk soft delete
- [ ] Verify shares deactivated
- [ ] Verify ownership check
- [ ] Cannot delete already deleted file

### Restore
- [ ] Restore single file
- [ ] Restore folder with descendants
- [ ] Bulk restore
- [ ] Parent folder validation
- [ ] Skip files with deleted parents
- [ ] Cannot restore non-deleted file

### Purge
- [ ] Purge single file from trash
- [ ] Purge folder with descendants
- [ ] Bulk purge
- [ ] Empty entire trash
- [ ] Verify S3 deletion
- [ ] Verify share deletion
- [ ] Cannot purge non-deleted file

### Admin Operations
- [ ] Admin hard delete
- [ ] Cleanup with various retention days
- [ ] Non-admin blocked from admin operations

### Edge Cases
- [ ] Delete → Restore → Delete again
- [ ] Restore to deleted parent fails
- [ ] Bulk operation limit enforcement
- [ ] Empty trash when already empty
- [ ] Folder descendant count accuracy
- [ ] Concurrent operations handling

### Performance
- [ ] Large folder deletion (1000+ files)
- [ ] Bulk operations (100 items)
- [ ] Path-based queries efficient
- [ ] S3 deletion parallelization

---

## Performance Considerations

1. **Path-Based Queries**: Regex on indexed `path` field for efficient hierarchy operations
2. **Bulk S3 Deletion**: Parallel `Promise.all()` for multiple S3 keys
3. **Atomic Operations**: `updateMany()` for bulk soft-delete/restore
4. **Index Usage**: `isDeleted` index speeds up trash queries
5. **Batch Limits**: 100-item limit prevents timeout issues
6. **Lazy Descendant Counts**: Only calculated when listing trash

---

## Future Enhancements

- [ ] Trash size quotas (limit trash storage)
- [ ] Scheduled auto-purge per user preferences
- [ ] Trash search and filtering
- [ ] Restore to different location
- [ ] Version history for purged files
- [ ] Bulk operations progress tracking
- [ ] Email notifications for auto-purge
- [ ] Trash analytics dashboard
- [ ] Selective folder restore (restore only some descendants)
- [ ] Trash export before emptying

---

## Comparison: Hard Delete vs Soft Delete

| Feature | Hard Delete (Old) | Soft Delete (New) |
|---------|------------------|-------------------|
| **Recovery** | Impossible | Possible within retention period |
| **Storage** | Immediately freed | Freed after retention/manual purge |
| **User Experience** | Risky | Forgiving, familiar pattern |
| **S3 Calls** | Immediate | Delayed until purge |
| **Database** | Immediate removal | Flag-based filtering |
| **Shares** | Cascade deleted | Deactivated, then cascade deleted |
| **Admin Control** | Limited | Full control with admin tools |
| **Audit** | No trail | Full audit trail |

---

## Related Documentation

- **Files Domain**: `src/api/files_new/README.md` - Personal file operations
- **Shares Domain**: `src/api/shares/README.md` - Sharing functionality
- **File Model**: `src/models/fileModel.js` - Core file entity
- **S3 Service**: `src/services/s3.service.js` - File storage operations
- **Phase 0 Architecture**: `docs/phase_0_architecture.md` - Overall architecture

---

## Troubleshooting

### "Cannot restore: Parent folder is deleted"
**Solution**: Restore parent folder first, or manually update `parentId` to null (root)

### "File is already in trash"
**Solution**: Use restore endpoint instead, or purge if no longer needed

### "File must be in trash before permanent deletion"
**Solution**: Soft-delete first, then purge. Or use admin hard-delete (admin only)

### Large folder deletion times out
**Solution**: Break into smaller chunks, or increase server timeout for trash operations

### Cleanup job not running
**Solution**: Verify cron job is registered, check scheduler logs, ensure admin authentication

---

**Version**: 1.0.0  
**Last Updated**: 2025-10-31  
**Maintainer**: Backend Team
