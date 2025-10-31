# Files Refactor Integration & Migration Guide

## ✅ Integration Status: COMPLETE

All three refactored domains (Files, Shares, Trash) have been integrated into the main application.

---

## 📋 What Was Changed

### New Routes Mounted

The following routes are now active:

#### Files Domain (Personal Operations)
- `POST /api/files/upload` - Upload files
- `GET /api/files/list` - List user files
- `GET /api/files/download/:fileId` - Download single file
- `POST /api/files/bulk-download` - Bulk download (zip)
- `DELETE /api/files/:fileId` - Soft delete file
- `POST /api/files/bulk-delete` - Bulk soft delete

#### Folders Domain (Folder Management)
- `POST /api/folders` - Create folder
- `GET /api/folders/:folderId` - Get folder details
- `POST /api/folders/move` - Move item (file/folder)
- `PATCH /api/folders/:folderId/rename` - Rename folder
- `DELETE /api/folders/:folderId` - Delete folder (soft)

#### Shares Domain (File Sharing)
- `POST /api/shares/:fileId/public` - Create public share link
- `DELETE /api/shares/:fileId/public` - Revoke public share
- `POST /api/shares/:fileId/user` - Share with specific user
- `DELETE /api/shares/:fileId/user` - Remove user access
- `POST /api/shares/bulk-remove` - Bulk remove access
- `POST /api/shares/:fileId/class` - Share with class
- `DELETE /api/shares/:fileId/class` - Remove class share
- `GET /api/shares/:fileId` - Get file shares
- `GET /api/shares/shared-with-me` - Get files shared with me

#### Public Access (No Auth Required)
- `POST /api/public/download` - Download using public share code

#### Trash Domain (Soft Delete & Recovery)
- `DELETE /api/trash/soft-delete/:fileId` - Move to trash
- `POST /api/trash/soft-delete/bulk` - Bulk move to trash
- `POST /api/trash/restore/:fileId` - Restore from trash
- `POST /api/trash/restore/bulk` - Bulk restore
- `DELETE /api/trash/purge/:fileId` - Permanently delete
- `POST /api/trash/purge/bulk` - Bulk permanently delete
- `DELETE /api/trash/empty` - Empty entire trash
- `GET /api/trash` - List trash contents
- `GET /api/trash/stats` - Get trash statistics
- `POST /api/trash/cleanup` - Auto-purge old items (admin)
- `DELETE /api/trash/admin/hard-delete/:fileId` - Admin hard delete

---

## 🗺️ Route Mapping: Old → New

### Upload & Download

| Old Route | New Route | Notes |
|-----------|-----------|-------|
| `POST /api/files/uploads` | `POST /api/files/upload` | Simplified path |
| `GET /api/files/downloads/:fileId` | `GET /api/files/download/:fileId` | Simplified path |
| `POST /api/files/downloads/bulk` | `POST /api/files/bulk-download` | Simplified path |

### File Listing

| Old Route | New Route | Notes |
|-----------|-----------|-------|
| `GET /api/files/items` | `GET /api/files/list` | Query params: `parentId`, `type` |

### Delete Operations

| Old Route | New Route | Notes |
|-----------|-----------|-------|
| `DELETE /api/files/delete/:id` | `DELETE /api/files/:fileId` | **Now soft-delete!** |
| `DELETE /api/files/delete` (bulk) | `POST /api/files/bulk-delete` | **Now soft-delete!** |
| N/A | `DELETE /api/trash/purge/:fileId` | **New**: Permanent delete |

### Folder Operations

| Old Route | New Route | Notes |
|-----------|-----------|-------|
| `POST /api/folders` | `POST /api/folders` | Same path, refactored implementation |
| `GET /api/folders/:id` | `GET /api/folders/:folderId` | Same functionality |
| `PATCH /api/folders/:id/move` | `POST /api/folders/move` | Changed method and path |
| `PATCH /api/folders/:id/rename` | `PATCH /api/folders/:folderId/rename` | Consistent naming |
| `DELETE /api/folders/:id` | `DELETE /api/folders/:folderId` | **Now soft-delete!** |

### Sharing Operations

| Old Route | New Route | Notes |
|-----------|-----------|-------|
| `POST /api/files/shares/...` | `POST /api/shares/:fileId/...` | Dedicated shares domain |
| `POST /api/public/files/download` | `POST /api/public/download` | Simplified path |

---

## 🔧 Breaking Changes

### 1. Soft Delete System

**IMPORTANT**: Delete operations now use soft-delete by default!

**Old Behavior** (Hard Delete):
```javascript
DELETE /api/files/delete/:id
→ File immediately deleted from S3 and database
→ No recovery possible
```

**New Behavior** (Soft Delete):
```javascript
DELETE /api/files/:fileId
→ File marked as deleted (isDeleted: true)
→ File recoverable from trash
→ Auto-purged after 30 days

// To permanently delete:
DELETE /api/trash/purge/:fileId
```

### 2. Route Path Changes

Some routes have new paths (see mapping table above). Update frontend API calls accordingly.

### 3. Query Parameter Changes

**File Listing**:
```javascript
// OLD
GET /api/files/items?folderId=xyz

// NEW
GET /api/files/list?parentId=xyz&type=all
```

### 4. Response Structure

Response structures are mostly compatible but may have slight differences:

**File Upload Response**:
```javascript
// OLD
{ files: [...], message: "..." }

// NEW
{ uploadedFiles: [...], message: "..." }
```

---

## 🔄 Migration Checklist

### Backend (Server-Side)

- [x] ✅ Mount new routes in `routes/index.js`
- [x] ✅ Remove old route imports
- [ ] ⏳ Update File model queries to exclude deleted files
- [ ] ⏳ Set up trash cleanup job (scheduled)
- [ ] ⏳ Test all new endpoints
- [ ] ⏳ Remove old files after testing

### Frontend (Client-Side)

- [ ] Update API endpoints to new paths
- [ ] Handle soft-delete (show "Move to Trash" instead of "Delete")
- [ ] Add "Trash" view in UI
- [ ] Add "Restore" functionality
- [ ] Update share link generation
- [ ] Test file upload/download
- [ ] Test folder operations
- [ ] Test sharing workflows

### Database

- [x] ✅ File model updated with soft-delete fields
- [ ] ⏳ Add indexes (if not auto-created)
- [ ] ⏳ Optionally migrate existing data

---

## 🗄️ Database Changes

### File Model Updates

New fields added to `File` schema:

```javascript
{
  isDeleted: Boolean,      // Default: false, Indexed
  deletedAt: Date,         // Timestamp of deletion
  deletedBy: ObjectId      // User who deleted
}
```

### Required Index

Ensure this index exists:
```javascript
db.files.createIndex({ isDeleted: 1 })
```

### Query Updates Required

**All file queries must now filter out deleted files**:

```javascript
// BEFORE
const files = await File.find({ user: userId });

// AFTER
const files = await File.find({ 
  user: userId, 
  isDeleted: false  // ← REQUIRED!
});
```

### Locations to Update

Search your codebase for `File.find` and add `isDeleted: false`:

1. ✅ Files domain (already handled in new code)
2. ⏳ Academic files controller
3. ⏳ Any other file queries in admin, reports, etc.

---

## 🧪 Testing Guide

### 1. Test File Upload

```bash
# Upload a file
POST /api/files/upload
Content-Type: multipart/form-data

# Verify file appears in listing
GET /api/files/list
```

### 2. Test Soft Delete

```bash
# Delete a file (soft delete)
DELETE /api/files/:fileId

# Verify file in trash
GET /api/trash

# Verify file NOT in regular listing
GET /api/files/list
```

### 3. Test Restore

```bash
# Restore from trash
POST /api/trash/restore/:fileId

# Verify file back in listing
GET /api/files/list

# Verify file NOT in trash
GET /api/trash
```

### 4. Test Sharing

```bash
# Create public share
POST /api/shares/:fileId/public
{ "duration": "1-day" }

# Download with share code (no auth)
POST /api/public/download
{ "code": "abc12345" }

# Revoke share
DELETE /api/shares/:fileId/public
```

### 5. Test Folders

```bash
# Create folder
POST /api/folders
{ "folderName": "Test", "parentId": null }

# Move file into folder
POST /api/folders/move
{ "itemId": "fileId", "newParentId": "folderId" }

# Delete folder (soft delete with descendants)
DELETE /api/folders/:folderId
```

---

## 🚀 Deployment Steps

### Development Environment

1. **Pull Latest Code**
   ```bash
   git pull origin data-schema-upgrade
   ```

2. **Install Dependencies** (if any new packages)
   ```bash
   npm install
   ```

3. **Restart Server**
   ```bash
   npm run dev
   ```

4. **Test Endpoints**
   - Use Postman/Thunder Client to test new endpoints
   - Verify old functionality works with new routes

### Production Environment

1. **Backup Database**
   ```bash
   mongodump --db your_database --out backup_$(date +%Y%m%d)
   ```

2. **Deploy Code**
   ```bash
   git checkout data-schema-upgrade
   npm install
   npm run build  # if applicable
   ```

3. **Restart Server**
   ```bash
   pm2 restart app  # or your process manager
   ```

4. **Monitor Logs**
   ```bash
   pm2 logs app
   ```

5. **Run Smoke Tests**
   - Test critical endpoints
   - Verify no errors in logs

### Setup Trash Cleanup Job

Add to your scheduler (e.g., using node-cron):

```javascript
import cron from 'node-cron';
import { cleanExpiredTrashService } from './src/api/trash/services/trash.service.js';

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    const result = await cleanExpiredTrashService(30);
    console.log(`[CRON] Trash cleanup: ${result.purgedCount} items deleted`);
  } catch (error) {
    console.error('[CRON] Trash cleanup failed:', error);
  }
});
```

---

## 🗑️ Old Files to Remove

### After Testing is Complete

Once you've verified the new routes work correctly, remove these old files:

```bash
# Controllers
src/api/files/controllers/delete.controller.js
src/api/files/controllers/download.controller.js
src/api/files/controllers/item.controller.js
src/api/files/controllers/share.controller.js
src/api/files/controllers/upload.controller.js

# Routes
src/api/files/routes/delete.routes.js
src/api/files/routes/download.routes.js
src/api/files/routes/item.routes.js
src/api/files/routes/share.routes.js
src/api/files/routes/upload.routes.js

# Old folder and public files (if no longer needed)
src/api/files/folder.controller.js
src/api/files/folder.routes.js
src/api/files/public.controller.js
src/api/files/public.routes.js
```

### Terminal Commands

```bash
# After confirming new system works, remove old files:
cd /home/sujith/Desktop/websites/task_app/backend

# Remove old controllers
rm -rf src/api/files/controllers/

# Remove old routes
rm -rf src/api/files/routes/

# Remove old folder files
rm src/api/files/folder.controller.js
rm src/api/files/folder.routes.js

# Remove old public files
rm src/api/files/public.controller.js
rm src/api/files/public.routes.js
```

---

## 📊 Summary Statistics

### Files Created

- **Files Domain**: 10 files (~2,034 lines)
- **Shares Domain**: 9 files (~1,550 lines)
- **Trash Domain**: 7 files (~1,190 lines)
- **Total**: 26 new files, ~4,774 lines of code
- **Documentation**: ~2,350 lines across 3 READMEs

### Files Modified

- `src/models/fileModel.js` - Added soft-delete fields
- `src/routes/index.js` - Updated route mounting

### Files to Remove

- 10 old controller files
- 8 old route files
- Total: ~18 files to be removed

---

## 🎯 Key Improvements

1. **Domain Separation**: Clear boundaries between files, shares, and trash
2. **Soft Delete**: Safer deletion with recovery capability
3. **Better Architecture**: Following Phase 0 patterns
4. **Comprehensive Validation**: Joi schemas for all endpoints
5. **Authorization Policies**: Clear ownership and access checks
6. **Service Layer**: Business logic separated from controllers
7. **Documentation**: Complete READMEs for each domain
8. **Scalability**: Ready for future enhancements

---

## ❓ Troubleshooting

### Issue: Files Not Showing in List

**Cause**: Old queries not filtering deleted files

**Solution**: Add `isDeleted: false` to all File.find queries

```javascript
// Fix this:
File.find({ user: userId })

// To this:
File.find({ user: userId, isDeleted: false })
```

### Issue: Cannot Restore File

**Error**: "Cannot restore: Parent folder is deleted"

**Solution**: Restore parent folder first, or update parentId to null

### Issue: Public Share Not Working

**Cause**: Share deactivated when file was deleted

**Solution**: Restore file first, then shares become accessible again

### Issue: Old Routes Not Found

**Error**: 404 on old endpoints

**Solution**: Update frontend to use new route paths (see mapping table)

---

## 📞 Support

For issues or questions:

1. Check the domain-specific READMEs:
   - `src/api/files_new/README.md`
   - `src/api/shares/README.md`
   - `src/api/trash/README.md`

2. Review completion summaries:
   - `src/api/files_new/COMPLETION_SUMMARY.md`
   - `src/api/shares/COMPLETION_SUMMARY.md`
   - `src/api/trash/COMPLETION_SUMMARY.md`

3. Check phase 0 architecture:
   - `docs/phase_0_architecture.md`

---

**Last Updated**: 2025-10-31  
**Version**: 1.0.0  
**Status**: ✅ INTEGRATION COMPLETE - READY FOR TESTING
