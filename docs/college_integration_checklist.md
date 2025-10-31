# Server.js Integration Checklist

## Overview

This checklist provides step-by-step instructions for integrating the new college domain refactoring into server.js.

**Estimated Time**: 30 minutes  
**Difficulty**: Easy  
**Breaking Changes**: Yes (requires frontend updates)

---

## Prerequisites

- [ ] All refactored domain files are in place
- [ ] No syntax errors in new code
- [ ] AttendanceRecord model is created
- [ ] Documentation has been reviewed

---

## Step 1: Add Route Imports

Add these imports near the top of server.js with other route imports:

```javascript
// New Domain Routes
import attendanceRoutes from './src/api/attendance/attendance.routes.js';
import feedbackRoutes from './src/api/feedback/feedback.routes.js';
import academicsRoutes from './src/api/academics/academics.routes.js';
import assignmentsRoutes from './src/api/assignments/assignments.routes.js';

// Socket Handler
import attendanceSocketHandler from './src/api/attendance/attendance.socket.js';
```

**Checklist**:
- [ ] Imports added
- [ ] No import errors
- [ ] Paths are correct

---

## Step 2: Mount New Routes

Add these route mounts after your existing app.use() statements:

```javascript
// === New College Domain Routes (Phase 0) ===
app.use('/api/attendance', attendanceRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/academics', academicsRoutes);
app.use('/api/assignments', assignmentsRoutes);
```

**Placement**: Add these BEFORE the error middleware, but AFTER authentication middleware setup.

**Checklist**:
- [ ] Routes mounted
- [ ] Placed in correct location
- [ ] No syntax errors

---

## Step 3: Initialize Socket.IO Handler

Find where Socket.IO is initialized (usually near the bottom of server.js) and add:

```javascript
// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true
  }
});

// === Initialize Attendance Socket Handler ===
attendanceSocketHandler.initialize(io);

// Make io available to routes (if not already done)
app.use((req, res, next) => {
  req.io = io;
  next();
});
```

**Note**: If `req.io` middleware already exists, just add the attendanceSocketHandler.initialize(io) line.

**Checklist**:
- [ ] Socket handler initialized
- [ ] io instance passed to handler
- [ ] req.io middleware present
- [ ] No socket errors on startup

---

## Step 4: Comment Out Old College Routes (Optional)

If you want to keep old routes temporarily for rollback:

```javascript
// === OLD College Routes (Deprecated) ===
// Kept temporarily for rollback if needed
// Remove after successful testing

// app.use('/api/college/teacher', oldTeacherRoutes);
// app.use('/api/college/student', oldStudentRoutes);
// app.use('/api/college/subjects', oldSubjectRoutes);
// app.use('/api/college/academic-files', oldAcademicFileRoutes);
```

**Checklist**:
- [ ] Old routes commented out (or removed)
- [ ] Server still starts successfully

---

## Step 5: Test Server Startup

```bash
npm start
```

**Expected Output**:
```
Server running on port 5000
MongoDB connected
Socket.IO initialized
```

**Checklist**:
- [ ] Server starts without errors
- [ ] MongoDB connects successfully
- [ ] Socket.IO initializes
- [ ] No import/syntax errors
- [ ] No missing dependencies

---

## Step 6: Test Health Check Endpoints

### Test Attendance Domain

```bash
curl http://localhost:5000/api/attendance
```

**Expected**: 404 or "Not Found" (no root route handler - expected)

```bash
# Test with authentication (replace YOUR_TOKEN)
curl http://localhost:5000/api/attendance/student/active-sessions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: 200 OK or 401 Unauthorized (authentication working)

**Checklist**:
- [ ] Attendance routes responding
- [ ] No 500 errors
- [ ] Authentication working

### Test Feedback Domain

```bash
curl http://localhost:5000/api/feedback
```

**Expected**: 404 or "Not Found" (expected)

```bash
# Test with authentication
curl http://localhost:5000/api/feedback/student/pending \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: 200 OK with data or 401 Unauthorized

**Checklist**:
- [ ] Feedback routes responding
- [ ] No 500 errors

### Test Academics Domain (Placeholder)

```bash
curl http://localhost:5000/api/academics
```

**Expected**: 
```json
{
  "success": true,
  "message": "Academics domain is under development",
  "status": "placeholder",
  ...
}
```

**Checklist**:
- [ ] Placeholder route responding
- [ ] Returns status information

### Test Assignments Domain (Placeholder)

```bash
curl http://localhost:5000/api/assignments
```

**Expected**: 
```json
{
  "success": true,
  "message": "Assignments domain is not yet implemented",
  "status": "placeholder",
  ...
}
```

**Checklist**:
- [ ] Placeholder route responding
- [ ] Returns roadmap information

### Test Subjects (Admin)

```bash
curl http://localhost:5000/api/admin/subjects \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected**: 200 OK with subjects list

**Checklist**:
- [ ] Subjects routes moved to admin
- [ ] Admin authentication required
- [ ] Returns data successfully

---

## Step 7: Test Socket.IO Connection

Create a simple test client:

```javascript
// test-socket.js
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: 'YOUR_TEACHER_TOKEN' }
});

socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
  
  // Test join session room
  socket.emit('join-session-room', { 
    sessionId: 'test123', 
    userRole: 'teacher' 
  });
});

socket.on('joined-session-room', (data) => {
  console.log('✅ Joined session room:', data);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});
```

Run:
```bash
node test-socket.js
```

**Expected Output**:
```
✅ Socket connected: [socket-id]
✅ Joined session room: { sessionId: 'test123', ... }
```

**Checklist**:
- [ ] Socket connects successfully
- [ ] join-session-room event works
- [ ] No connection errors

---

## Step 8: Verify Database Models

Check that the new AttendanceRecord model is accessible:

```javascript
// In node REPL or test file
import AttendanceRecord from './src/models/attendanceRecordModel.js';
console.log(AttendanceRecord.modelName); // Should print "AttendanceRecord"
```

**Checklist**:
- [ ] AttendanceRecord model loads
- [ ] No model errors
- [ ] Indexes created (check MongoDB)

---

## Step 9: Test Complete Workflow (Manual)

### Create Class Session (Teacher)

```bash
curl -X POST http://localhost:5000/api/attendance/teacher/sessions \
  -H "Authorization: Bearer TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "SUBJECT_ID",
    "batch": 2020,
    "semester": 5,
    "section": "A",
    "topic": "Test Topic",
    "sessionType": "lecture"
  }'
```

**Expected**: 201 Created with attendance code

**Checklist**:
- [ ] Session created successfully
- [ ] Attendance code generated
- [ ] AttendanceRecords created for enrolled students

### Mark Attendance (Student)

```bash
curl -X POST http://localhost:5000/api/attendance/student/mark \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "attendanceCode": "12345678" }'
```

**Expected**: 200 OK with success message

**Checklist**:
- [ ] Attendance marked successfully
- [ ] Socket event emitted (if connected)
- [ ] AttendanceRecord updated in DB

### Submit Feedback (Student)

```bash
curl -X POST http://localhost:5000/api/feedback/student/submit \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID",
    "rating": 5,
    "comment": "Great session!"
  }'
```

**Expected**: 201 Created with feedback

**Checklist**:
- [ ] Feedback submitted successfully
- [ ] AttendanceRecord.hasSubmittedFeedback updated
- [ ] Transaction successful

---

## Step 10: Monitor Logs

Watch for any errors or warnings:

```bash
# In development
npm run dev

# Watch logs
tail -f logs/error.log  # If you have logging
```

**Look for**:
- ✅ No 500 errors
- ✅ No uncaught exceptions
- ✅ No promise rejections
- ✅ No MongoDB errors

**Checklist**:
- [ ] No errors in logs
- [ ] All requests complete successfully
- [ ] No memory leaks

---

## Step 11: Update Environment Variables (if needed)

Check if any new environment variables are needed:

```bash
# .env file
CLIENT_URL=http://localhost:3000  # For CORS
MONGODB_URI=mongodb://localhost:27017/taskapp
JWT_SECRET=your-secret-key
```

**Checklist**:
- [ ] All required env vars present
- [ ] CORS configured correctly
- [ ] MongoDB connection string correct

---

## Step 12: Create Backup

Before going to production:

```bash
# Backup database
mongodump --db taskapp --out ./backup-$(date +%Y%m%d)

# Backup old code
git checkout -b backup-old-college-module
git add -A
git commit -m "Backup: Old college module before refactoring integration"
git checkout main
```

**Checklist**:
- [ ] Database backed up
- [ ] Old code backed up in git branch
- [ ] Can rollback if needed

---

## Rollback Procedure (If Needed)

If something goes wrong:

1. **Quick Rollback**:
   ```javascript
   // In server.js, comment out new routes
   // app.use('/api/attendance', attendanceRoutes);
   // app.use('/api/feedback', feedbackRoutes);
   
   // Uncomment old routes
   app.use('/api/college/teacher', oldTeacherRoutes);
   app.use('/api/college/student', oldStudentRoutes);
   ```

2. **Restore Database** (if migrations were run):
   ```bash
   mongorestore --db taskapp ./backup-YYYYMMDD/taskapp
   ```

3. **Git Rollback**:
   ```bash
   git checkout backup-old-college-module
   ```

---

## Troubleshooting

### Issue: Module not found errors

**Solution**: Check import paths. Should be:
```javascript
import attendanceRoutes from './src/api/attendance/attendance.routes.js';
// Not: './api/attendance/...'  (missing 'src')
```

### Issue: Socket.IO not working

**Solution**: 
1. Check CORS configuration
2. Verify io instance is passed to routes
3. Check client connection URL

### Issue: 404 on new routes

**Solution**:
1. Verify routes are mounted in server.js
2. Check route paths match (e.g., `/api/attendance/...`)
3. Test with Postman or curl

### Issue: Authentication errors

**Solution**:
1. Verify auth middleware is applied to parent router
2. Check JWT token is valid
3. Verify user roles match required roles

---

## Success Criteria

✅ **All checks passed** when:

- [ ] Server starts without errors
- [ ] All 4 new domain routes respond
- [ ] Socket.IO connects successfully
- [ ] Attendance workflow works end-to-end
- [ ] Feedback workflow works end-to-end
- [ ] Subject management (admin) works
- [ ] No errors in logs
- [ ] Database operations successful
- [ ] Rollback procedure tested and works

---

## Next Steps After Integration

1. **Frontend Updates**: Update API endpoint URLs (see migration guide)
2. **Testing**: Run comprehensive test suite
3. **Documentation**: Update API documentation
4. **Deployment**: Deploy to staging environment
5. **Monitoring**: Watch for errors in production

---

## Support

**If you encounter issues**:
1. Check this checklist again
2. Review migration guide: `docs/college_refactoring_migration.md`
3. Check domain READMEs for specific issues
4. Contact development team

---

**Last Updated**: January 2024  
**Estimated Time**: 30 minutes  
**Difficulty**: Easy  
**Status**: Ready for integration
