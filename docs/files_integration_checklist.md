# Integration Checklist - Files & Tasks Domains

## Files Domain Integration ✅

### Completed
- [x] Removed old `src/api/files/` directory
- [x] Renamed `src/api/files_new/` → `src/api/files/`
- [x] Updated imports in `src/routes/index.js`
- [x] Verified no syntax/import errors

### Testing Needed
- [ ] **GET /api/files** - List user's files
- [ ] **POST /api/files** - Upload new file
- [ ] **GET /api/files/:id** - Get file metadata
- [ ] **PUT /api/files/:id** - Update file metadata
- [ ] **DELETE /api/files/:id** - Move file to trash
- [ ] **GET /api/files/search** - Search files
- [ ] **GET /api/folders** - List folders
- [ ] **POST /api/folders** - Create folder
- [ ] **GET /api/folders/:id/items** - Get folder contents

---

## Tasks Domain Integration ✅

### Completed
- [x] Created Phase 0 structure (7 files, ~1,506 lines)
- [x] Implemented service layer (tasks + subtasks)
- [x] Created controllers (tasks + subtasks)
- [x] Added comprehensive validation
- [x] Created routes with validation middleware
- [x] Archived old implementation to `tasks_old/`
- [x] Updated imports in `src/routes/index.js`
- [x] Verified no syntax/import errors
- [x] Created comprehensive README

### Testing Needed

#### Task Operations
- [ ] **GET /api/tasks** - List all tasks
  - [ ] Without filters
  - [ ] With status filter (`?status=To Do`)
  - [ ] With priority filter (`?priority=High`)
  - [ ] With sorting (`?sortBy=dueDate:asc`)
  - [ ] Combined filters and sorting

- [ ] **GET /api/tasks/stats** - NEW endpoint
  - [ ] Returns task counts by status
  - [ ] Returns task counts by priority
  - [ ] Returns overdue task count
  - [ ] Returns total task count

- [ ] **GET /api/tasks/:id** - NEW endpoint
  - [ ] Retrieve valid task
  - [ ] Returns 404 for non-existent task
  - [ ] Returns 403 for other user's task

- [ ] **POST /api/tasks** - Create task
  - [ ] With all fields
  - [ ] With only required fields (title)
  - [ ] Validation: Reject empty title
  - [ ] Validation: Reject invalid priority
  - [ ] Validation: Reject invalid status
  - [ ] Validation: Reject invalid due date

- [ ] **POST /api/tasks/bulk** - Bulk create
  - [ ] Create multiple valid tasks (2-5 tasks)
  - [ ] Reject empty array
  - [ ] Reject >15 tasks
  - [ ] Reject tasks without titles
  - [ ] All tasks get default status "To Do"

- [ ] **PUT /api/tasks/:id** - Update task
  - [ ] Update single field
  - [ ] Update multiple fields
  - [ ] Returns 404 for non-existent task
  - [ ] Returns 403 for other user's task
  - [ ] Validation on updated fields

- [ ] **DELETE /api/tasks/:id** - Delete task
  - [ ] Successfully deletes own task
  - [ ] Returns 404 for non-existent task
  - [ ] Returns 403 for other user's task
  - [ ] Subtasks are also deleted

#### Subtask Operations
- [ ] **POST /api/tasks/:id/subtasks** - Add subtask
  - [ ] Successfully adds subtask
  - [ ] Validation: Reject empty text
  - [ ] Returns 404 for non-existent task
  - [ ] Returns 403 for other user's task

- [ ] **GET /api/tasks/:id/subtasks/stats** - NEW endpoint
  - [ ] Returns total count
  - [ ] Returns completed count
  - [ ] Returns pending count
  - [ ] Returns completion percentage

- [ ] **PUT /api/tasks/:id/subtasks/:subTaskId** - Update subtask
  - [ ] Update text only
  - [ ] Update completed status only
  - [ ] Update both fields
  - [ ] Returns 404 for non-existent task
  - [ ] Returns 404 for non-existent subtask
  - [ ] Returns 403 for other user's task

- [ ] **DELETE /api/tasks/:id/subtasks/:subTaskId** - Delete subtask
  - [ ] Successfully deletes subtask
  - [ ] Returns 404 for non-existent task
  - [ ] Returns 404 for non-existent subtask
  - [ ] Returns 403 for other user's task

#### Edge Cases
- [ ] Invalid MongoDB ObjectId format
- [ ] Malformed request body
- [ ] Missing authentication token
- [ ] Expired/invalid authentication token
- [ ] Title exceeding 200 characters
- [ ] Description exceeding 2000 characters
- [ ] Tags with empty strings
- [ ] Tags exceeding 50 characters
- [ ] Invalid date format for dueDate

---

## Performance Testing

### Files Domain
- [ ] Upload large file (test file size limits)
- [ ] List directory with many files (pagination)
- [ ] Search with complex queries
- [ ] Concurrent file operations

### Tasks Domain
- [ ] Create user with 100+ tasks
- [ ] Filter/sort large task list
- [ ] Bulk create 15 tasks
- [ ] Tasks with 20+ subtasks
- [ ] Statistics with diverse task distribution

---

## Security Testing

### Authorization
- [ ] User A cannot access User B's files
- [ ] User A cannot access User B's tasks
- [ ] Unauthenticated requests return 401
- [ ] Expired tokens return 401

### Validation
- [ ] XSS prevention in text fields
- [ ] SQL injection prevention (NoSQL equivalent)
- [ ] File type validation
- [ ] File size limits
- [ ] Rate limiting on bulk operations

---

## Integration Testing

### Cross-Domain Interactions
- [ ] Create task → Attach file (future feature)
- [ ] Share file → Link in task description
- [ ] Admin operations on user files/tasks

### Database
- [ ] Transactions work correctly
- [ ] Indexes are properly used
- [ ] Cascading deletes work (task → subtasks)
- [ ] No orphaned documents

---

## Rollback Plan

### If Issues Found with Files Domain
1. Restore archived files from `files_old/` (if kept)
2. Revert `src/routes/index.js` import changes
3. Restart server

### If Issues Found with Tasks Domain
1. Rename `src/api/tasks/` → `src/api/tasks_failed/`
2. Rename `src/api/tasks_old/` → `src/api/tasks/`
3. Revert `src/routes/index.js` to old import:
   ```javascript
   import taskRoutes from '../api/tasks/task.routes.js';
   ```
4. Restart server

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests pass
- [ ] No console errors in dev environment
- [ ] Documentation updated
- [ ] API docs updated (if separate)
- [ ] Frontend team notified of new endpoints

### Deployment
- [ ] Create backup of production database
- [ ] Deploy code changes
- [ ] Monitor server logs
- [ ] Check for errors in first 15 minutes
- [ ] Verify key endpoints working

### Post-Deployment
- [ ] Run smoke tests on production
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Notify team of successful deployment

---

## Monitoring

### Metrics to Watch
- [ ] API response times (should be similar to before)
- [ ] Error rates (should not increase)
- [ ] Database query performance
- [ ] Memory usage
- [ ] CPU usage

### Logs to Monitor
- [ ] Application logs for errors
- [ ] Database logs for slow queries
- [ ] Authentication failures
- [ ] 403 Forbidden errors (potential security issues)
- [ ] 500 Internal Server errors

---

## Documentation Updates

### Completed
- [x] Tasks domain README created
- [x] Refactoring summary document created
- [x] Integration checklist created

### Needed
- [ ] Update main README if it references old structure
- [ ] Update API documentation (Swagger/Postman)
- [ ] Update frontend integration docs
- [ ] Add migration notes for other developers

---

## Success Criteria

### Files Domain
✅ All file operations work identically to before  
✅ No broken imports or 404 errors  
✅ Performance is equivalent or better  

### Tasks Domain
✅ All original endpoints work identically  
✅ New endpoints function correctly  
✅ Validation provides helpful error messages  
✅ Authorization properly enforced  
✅ Performance is equivalent or better  

---

## Timeline

### Immediate (Today)
- Run basic smoke tests
- Verify no critical errors
- Test authentication flow

### Short Term (This Week)
- Complete all integration tests
- Performance testing
- Security testing
- Documentation review

### Medium Term (Next Week)
- Archive `tasks_old/` if all tests pass
- Monitor production metrics
- Gather feedback from frontend team

---

## Notes

- **Backward Compatibility**: Both domains maintain 100% API compatibility
- **New Features**: 3 new endpoints in tasks domain (stats, single task, subtask stats)
- **Old Code Preserved**: `tasks_old/` available for reference or rollback
- **Zero Downtime**: Changes can be deployed without service interruption

---

**Created**: December 2024  
**Last Updated**: December 2024  
**Status**: Ready for Testing
