# Post-Integration Checklist

## ✅ Completed

- [x] **Part 1: Files Domain** - Created all files, services, controllers, validators, policies, routes
- [x] **Part 2: Shares Domain** - Created FileShare model and complete sharing system
- [x] **Part 3: Trash Domain** - Implemented soft-delete with restore and purge
- [x] **File Model Update** - Added isDeleted, deletedAt, deletedBy fields
- [x] **Route Mounting** - Mounted all new routes in routes/index.js
- [x] **Old Files Removed** - Deleted deprecated controllers and routes
- [x] **Documentation** - Created comprehensive READMEs and migration guide
- [x] **Syntax Validation** - All files pass Node.js syntax check

## ⏳ Immediate Next Steps

### 1. Backend Testing

- [ ] Start the server (`npm run dev`)
- [ ] Test file upload endpoint
  ```bash
  POST /api/files/upload
  ```
- [ ] Test file listing
  ```bash
  GET /api/files/list
  ```
- [ ] Test soft delete
  ```bash
  DELETE /api/files/:fileId
  ```
- [ ] Test trash listing
  ```bash
  GET /api/trash
  ```
- [ ] Test restore
  ```bash
  POST /api/trash/restore/:fileId
  ```
- [ ] Test folder operations
  ```bash
  POST /api/folders
  POST /api/folders/move
  ```
- [ ] Test public share creation
  ```bash
  POST /api/shares/:fileId/public
  ```
- [ ] Test public download (no auth)
  ```bash
  POST /api/public/download
  ```
- [ ] Test direct user sharing
  ```bash
  POST /api/shares/:fileId/user
  ```
- [ ] Test class sharing
  ```bash
  POST /api/shares/:fileId/class
  ```

### 2. Database Updates

- [ ] Verify indexes exist (especially `isDeleted`)
  ```bash
  db.files.getIndexes()
  ```
- [ ] Add index if missing
  ```bash
  db.files.createIndex({ isDeleted: 1 })
  ```
- [ ] Optionally: Mark existing files as not deleted
  ```bash
  db.files.updateMany(
    { isDeleted: { $exists: false } },
    { $set: { isDeleted: false, deletedAt: null, deletedBy: null } }
  )
  ```

### 3. Setup Trash Cleanup Job

Add to your server.js or scheduler:

```javascript
import cron from 'node-cron';
import { cleanExpiredTrashService } from './src/api/trash/services/trash.service.js';

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    const result = await cleanExpiredTrashService(30); // 30 days retention
    console.log(`[CRON] Trash cleanup: ${result.purgedCount} items deleted`);
  } catch (error) {
    console.error('[CRON] Trash cleanup failed:', error);
  }
});
```

### 4. Update Other File Queries

Search and update all File.find() queries to exclude deleted files:

- [ ] Check admin routes (`src/api/admin/`)
- [ ] Check college routes (`src/api/college/`)
- [ ] Check any report generation code
- [ ] Check search functionality
- [ ] Add `isDeleted: false` to all relevant queries

Example locations to check:
```bash
grep -r "File.find" src/api/admin/
grep -r "File.find" src/api/college/
grep -r "File.find" src/api/tasks/
```

### 5. Frontend Updates

- [ ] Update API base URLs/endpoints
  - Change `/api/files/uploads` → `/api/files/upload`
  - Change `/api/files/downloads/:id` → `/api/files/download/:id`
  - Change `/api/files/items` → `/api/files/list`
  - Change `/api/files/delete/:id` → `/api/files/:id`
  - Change `/api/files/shares/*` → `/api/shares/*`
  - Change `/api/public/files/download` → `/api/public/download`

- [ ] Update UI for soft-delete
  - Change "Delete" button to "Move to Trash"
  - Add "Trash" view/section
  - Add "Restore" button in trash view
  - Add "Empty Trash" button
  - Add "Permanently Delete" option (for purge)

- [ ] Update sharing UI
  - Update share link generation
  - Handle new share types (public, direct, class)
  - Update share management interface

- [ ] Add trash statistics
  - Show trash size
  - Show number of items in trash
  - Show retention period info

- [ ] Test all file operations
  - Upload files
  - Download files
  - Move files to folders
  - Delete files (soft)
  - Restore files
  - Permanently delete files
  - Share files
  - Access public shares

## 🔍 Testing Scenarios

### Scenario 1: Basic File Operations
1. Upload a file
2. Verify it appears in file list
3. Download the file
4. Delete the file (soft)
5. Verify it appears in trash
6. Verify it does NOT appear in file list
7. Restore the file
8. Verify it's back in file list
9. Delete again
10. Permanently delete from trash
11. Verify it's gone from trash

### Scenario 2: Folder Operations
1. Create a folder
2. Upload files into the folder
3. Create a subfolder
4. Move files between folders
5. Delete the parent folder
6. Verify all descendants are in trash
7. Restore the parent folder
8. Verify all descendants are restored

### Scenario 3: Sharing Workflow
1. Upload a file
2. Create a public share link (1-day duration)
3. Test downloading with share code (no auth)
4. Share file with specific user
5. Share file with class
6. Delete the file (soft)
7. Verify public share is deactivated
8. Restore the file
9. Verify public share remains deactivated (security)
10. Revoke all shares
11. Permanently delete the file
12. Verify all shares are deleted

### Scenario 4: Bulk Operations
1. Upload 10 files
2. Bulk delete 5 files
3. Verify 5 in trash, 5 in file list
4. Bulk restore 3 files
5. Verify 3 back in file list, 2 in trash
6. Empty trash
7. Verify trash is empty

### Scenario 5: Edge Cases
1. Try to restore file with deleted parent → Should fail
2. Try to delete already deleted file → Should fail
3. Try to purge non-deleted file → Should fail
4. Try to share deleted file → Should fail
5. Try to access deleted file via share link → Should fail
6. Delete folder with 100+ files → Should handle efficiently

## 📊 Performance Tests

- [ ] Test large file upload (100MB+)
- [ ] Test bulk operations (100 files)
- [ ] Test folder with deep nesting (2 levels max enforced)
- [ ] Test listing with many files (1000+)
- [ ] Test trash listing with many items
- [ ] Monitor query performance (check indexes)
- [ ] Test concurrent operations

## 🔒 Security Tests

- [ ] Verify ownership checks work
- [ ] Try to delete another user's file → Should fail
- [ ] Try to access another user's share → Should fail (unless shared)
- [ ] Verify public share expiration works
- [ ] Verify share deactivation on delete
- [ ] Test admin hard-delete (admin only)
- [ ] Test cleanup job (admin only)

## 📝 Documentation Review

- [ ] Read Files Domain README
- [ ] Read Shares Domain README
- [ ] Read Trash Domain README
- [ ] Review Migration Guide
- [ ] Review Integration Summary
- [ ] Check Phase 0 Architecture doc

## 🚀 Deployment Preparation

- [ ] Review all changes in git
- [ ] Create backup of database
- [ ] Test on development environment
- [ ] Test on staging environment (if available)
- [ ] Update API documentation (Swagger/Postman)
- [ ] Inform team of breaking changes
- [ ] Prepare rollback plan
- [ ] Schedule deployment window

## 🐛 Known Issues / Limitations

### Current Limitations
- Maximum folder depth: 2 levels (Phase 0 constraint)
- Bulk operations limited to 100 items
- Public share codes are 8 characters (not customizable)
- Trash retention period: 30 days (configurable)
- No folder sharing yet (files only)
- No permission levels (full access or no access)

### Future Enhancements
- Add folder sharing
- Add permission levels (view, download, edit)
- Add share analytics
- Add email notifications
- Add password-protected shares
- Add custom retention periods per user
- Add trash size quotas

## ✅ Sign-Off Checklist

Before marking complete, verify:

- [ ] All endpoints return expected responses
- [ ] No errors in server logs
- [ ] Database queries are efficient
- [ ] Frontend can interact with all endpoints
- [ ] Soft-delete system works correctly
- [ ] Restore functionality works
- [ ] Sharing works for all types
- [ ] Trash cleanup job is scheduled
- [ ] Documentation is accurate
- [ ] Team is informed of changes

## 📞 Support

If you encounter issues:

1. Check server logs for errors
2. Review the migration guide
3. Check the domain-specific READMEs
4. Test endpoints with Postman/curl
5. Verify database indexes exist
6. Check that old routes are removed

## 🎯 Success Metrics

Track these metrics after deployment:

- [ ] Zero errors in production logs
- [ ] All file operations working
- [ ] Users can recover deleted files
- [ ] Sharing functionality working
- [ ] Trash cleanup running successfully
- [ ] No performance degradation
- [ ] User feedback is positive

---

**Last Updated**: 2025-10-31  
**Next Review**: After testing phase  
**Owner**: Backend Team
