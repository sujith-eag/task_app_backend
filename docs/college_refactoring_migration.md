# College Domain Refactoring - Migration Guide

## Overview

This document provides a comprehensive guide for migrating from the monolithic college module to the new Phase 0 domain-driven architecture.

**Refactoring Date**: January 2024  
**Status**: Ready for Integration  
**Breaking Changes**: Yes (API endpoints changed)

## What Changed?

The monolithic college module has been refactored into **4 new domains**:

1. **Attendance Domain** (`/src/api/attendance/`) - Session management, attendance tracking, analytics
2. **Feedback Domain** (`/src/api/feedback/`) - Student feedback and teacher reflections
3. **Academics Domain** (`/src/api/academics/`) - Placeholder for future academic content features
4. **Assignments Domain** (`/src/api/assignments/`) - Placeholder for future assignment management
5. **Admin Domain** (updated) - Subject CRUD operations moved here

## File Structure Comparison

### Before (Monolithic College Module)

```
src/api/college/
├── attendence.socket.js          (~30 lines)
├── student.controller.js          (~250 lines)
├── teacher.controller.js          (~350 lines)
├── subject.controller.js          (~120 lines)
├── academicFile.controller.js     (~40 lines)
├── student.routes.js
├── teacher.routes.js
├── subject.routes.js
└── academicFile.routes.js
```

**Issues**:
- Mixed concerns (attendance, feedback, subjects all in one module)
- Embedded attendance records in ClassSession model
- No clear separation of business logic
- Limited code reusability
- Difficult to test and maintain

### After (Domain-Driven Architecture)

```
src/api/attendance/                  [~1,800 lines total]
├── controllers/
│   ├── teacher.controller.js       # Session management
│   ├── student.controller.js       # Attendance marking
│   └── stats.controller.js         # Analytics
├── services/
│   ├── session.service.js          # Session business logic
│   ├── marking.service.js          # Attendance marking logic
│   └── stats.service.js            # Statistics calculations
├── routes/
│   ├── teacher.routes.js
│   ├── student.routes.js
│   └── stats.routes.js
├── validators/
│   └── attendance.validators.js    # Input validation
├── policies/
│   └── attendance.policies.js      # Authorization rules
├── attendance.socket.js            # Socket.IO handlers
├── attendance.routes.js            # Main router
└── README.md                       # Comprehensive documentation

src/api/feedback/                    [~800 lines total]
├── controllers/
│   ├── student.controller.js       # Feedback submission
│   └── teacher.controller.js       # View feedback & reflections
├── services/
│   ├── feedback.service.js         # Feedback business logic
│   └── reflection.service.js       # Reflection management
├── routes/
│   ├── student.routes.js
│   └── teacher.routes.js
├── validators/
│   └── feedback.validators.js      # Input validation
├── feedback.routes.js              # Main router
└── README.md                       # Comprehensive documentation

src/api/academics/                   [Placeholder]
├── academics.routes.js             # Status endpoint
└── README.md                       # Future plans

src/api/assignments/                 [Placeholder]
├── assignments.routes.js           # Status endpoint
└── README.md                       # Implementation roadmap

src/api/admin/controllers/
├── subjects.controller.js          [~300 lines]
└── subjects.routes.js

src/models/
└── attendanceRecordModel.js        # New standalone model
```

**Benefits**:
- Clear separation of concerns
- Service layer for business logic
- Comprehensive validation and authorization
- Easier to test and maintain
- Better scalability
- Detailed documentation

## Database Changes

### New Model: AttendanceRecord

**Before**: Attendance records were embedded in ClassSession:

```javascript
ClassSession {
  // ... other fields
  attendanceRecords: [{
    student: ObjectId,
    status: String,
    markedAt: Date
  }]
}
```

**After**: Standalone AttendanceRecord model:

```javascript
AttendanceRecord {
  classSession: ObjectId,
  student: ObjectId,
  teacher: ObjectId,
  subject: ObjectId,
  batch: Number,
  semester: Number,
  section: String,
  status: String,
  markedAt: Date,
  markedMethod: String,
  hasSubmittedFeedback: Boolean,
  feedbackSubmittedAt: Date
}
```

**Migration**: No automatic data migration required. Old sessions will continue to work with embedded records. New sessions will use the new model.

## API Endpoint Changes

### Attendance Endpoints

#### Teacher Routes

| Old Endpoint | New Endpoint | Method | Changes |
|-------------|--------------|--------|---------|
| `/api/college/teacher/class-data` | `/api/attendance/teacher/class-data` | GET | None |
| `/api/college/teacher/session` | `/api/attendance/teacher/sessions` | POST | None |
| `/api/college/teacher/session/:id/roster` | `/api/attendance/teacher/sessions/:sessionId/roster` | GET | Param renamed |
| `/api/college/teacher/session/:id/finalize` | `/api/attendance/teacher/sessions/:sessionId/finalize` | POST | Param renamed |
| `/api/college/teacher/attendance/:recordId` | `/api/attendance/teacher/records/:recordId` | PATCH | Path changed |
| N/A | `/api/attendance/teacher/records/bulk` | PATCH | **New** |
| `/api/college/teacher/history` | `/api/attendance/teacher/history` | GET | None |

#### Student Routes

| Old Endpoint | New Endpoint | Method | Changes |
|-------------|--------------|--------|---------|
| `/api/college/student/mark-attendance` | `/api/attendance/student/mark` | POST | Path changed |
| `/api/college/student/active-sessions` | `/api/attendance/student/active-sessions` | GET | None |
| `/api/college/student/dashboard` | `/api/attendance/student/stats` | GET | Path changed |
| N/A | `/api/attendance/student/stats/:subjectId` | GET | **New** |
| N/A | `/api/attendance/student/trend` | GET | **New** |
| `/api/college/student/profile` | `/api/attendance/student/profile` | GET | None |

#### Stats Routes (New)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/attendance/stats/class` | GET | **New** - Get class statistics |
| `/api/attendance/stats/session/:sessionId` | GET | **New** - Get session summary |
| `/api/attendance/stats/low-attendance` | GET | **New** - Get students below threshold |
| `/api/attendance/stats/export` | GET | **New** - Export attendance data |

### Feedback Endpoints

#### Student Routes

| Old Endpoint | New Endpoint | Method | Changes |
|-------------|--------------|--------|---------|
| `/api/college/student/feedback` | `/api/feedback/student/submit` | POST | Path changed |
| `/api/college/student/feedback-sessions` | `/api/feedback/student/pending` | GET | Path changed |

#### Teacher Routes

| Old Endpoint | New Endpoint | Method | Changes |
|-------------|--------------|--------|---------|
| `/api/college/teacher/session/:id/feedback` | `/api/feedback/teacher/sessions/:sessionId/summary` | GET | Path changed |
| `/api/college/teacher/reflection` | `/api/feedback/teacher/sessions/:sessionId/reflection` | POST | Path changed |
| N/A | `/api/feedback/teacher/sessions/:sessionId/reflection` | GET | **New** |
| N/A | `/api/feedback/teacher/sessions/:sessionId/reflection` | DELETE | **New** |
| N/A | `/api/feedback/teacher/stats` | GET | **New** |
| N/A | `/api/feedback/teacher/reflections/pending` | GET | **New** |
| N/A | `/api/feedback/teacher/reflections/history` | GET | **New** |
| N/A | `/api/feedback/teacher/reflections/analytics` | GET | **New** |

### Subject Management Endpoints

| Old Endpoint | New Endpoint | Method | Changes |
|-------------|--------------|--------|---------|
| `/api/college/subjects` | `/api/admin/subjects` | GET, POST | Module changed |
| `/api/college/subjects/:id` | `/api/admin/subjects/:id` | GET, PATCH, DELETE | Module changed |
| N/A | `/api/admin/subjects/:id/usage` | GET | **New** - Get usage stats |

### Academic File Sharing

**Note**: The academicFile.controller.js functionality (`shareFileWithClass`) is already covered by the existing **Shares domain**:

```javascript
// Use this instead:
POST /api/shares/class
{
  "itemId": "fileId",
  "batch": 2020,
  "semester": 5,
  "section": "A"
}
```

## Socket.IO Changes

### Before

```javascript
// Old socket handler
socket.on('join-session-room', (data) => {
  // Limited functionality
});
```

### After

```javascript
// New comprehensive socket handler
import attendanceSocketHandler from './api/attendance/attendance.socket.js';

// Initialize
attendanceSocketHandler.initialize(io);

// Events emitted:
// - 'attendance-marked' - Student marks attendance
// - 'attendance-updated' - Teacher updates attendance
// - 'session-finalized' - Session closed
// - 'code-regenerated' - New code generated
```

## Integration Steps

### 1. Install Dependencies (if any new ones)

```bash
npm install
```

### 2. Update server.js

Add new route imports and mount points:

```javascript
// Import new domains
import attendanceRoutes from './api/attendance/attendance.routes.js';
import feedbackRoutes from './api/feedback/feedback.routes.js';
import academicsRoutes from './api/academics/academics.routes.js';
import assignmentsRoutes from './api/assignments/assignments.routes.js';

// Import socket handler
import attendanceSocketHandler from './api/attendance/attendance.socket.js';

// Mount routes
app.use('/api/attendance', attendanceRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/academics', academicsRoutes);
app.use('/api/assignments', assignmentsRoutes);

// Initialize Socket.IO handler
attendanceSocketHandler.initialize(io);
```

### 3. Remove Old College Routes

Remove or comment out old college module routes:

```javascript
// Remove these:
// app.use('/api/college/teacher', teacherRoutes);
// app.use('/api/college/student', studentRoutes);
// app.use('/api/college/subjects', subjectRoutes);
```

### 4. Update Frontend API Calls

#### Attendance API Calls

**Before**:
```javascript
// Old
const response = await fetch('/api/college/student/mark-attendance', {
  method: 'POST',
  body: JSON.stringify({ attendanceCode })
});
```

**After**:
```javascript
// New
const response = await fetch('/api/attendance/student/mark', {
  method: 'POST',
  body: JSON.stringify({ attendanceCode })
});
```

#### Feedback API Calls

**Before**:
```javascript
// Old
const response = await fetch('/api/college/student/feedback', {
  method: 'POST',
  body: JSON.stringify({ sessionId, rating, comment })
});
```

**After**:
```javascript
// New
const response = await fetch('/api/feedback/student/submit', {
  method: 'POST',
  body: JSON.stringify({ sessionId, rating, comment })
});
```

#### Subject Management

**Before**:
```javascript
// Old
const response = await fetch('/api/college/subjects');
```

**After**:
```javascript
// New
const response = await fetch('/api/admin/subjects');
```

### 5. Update Socket.IO Frontend

**Before**:
```javascript
// Old
socket.emit('join-session-room', { sessionId });
```

**After**:
```javascript
// New
socket.emit('join-session-room', { 
  sessionId, 
  userRole: 'teacher' 
});

// Listen for new events
socket.on('attendance-marked', (data) => {
  // Handle real-time attendance update
});

socket.on('attendance-updated', (data) => {
  // Handle manual attendance update
});

socket.on('session-finalized', (data) => {
  // Handle session finalization
});
```

### 6. Test All Endpoints

Run comprehensive tests for each domain:

```bash
# Test attendance endpoints
npm run test:attendance

# Test feedback endpoints
npm run test:feedback

# Test admin subject endpoints
npm run test:admin
```

Or test manually:

```bash
# Test attendance marking
curl -X POST http://localhost:5000/api/attendance/student/mark \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"attendanceCode":"12345678"}'

# Test feedback submission
curl -X POST http://localhost:5000/api/feedback/student/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"xxx","rating":5,"comment":"Great!"}'
```

### 7. Database Migration (Optional)

If you want to migrate old embedded attendance records to the new model:

```javascript
// migration script (optional)
import ClassSession from './models/classSessionModel.js';
import AttendanceRecord from './models/attendanceRecordModel.js';

async function migrateAttendanceRecords() {
  const sessions = await ClassSession.find({ 
    'attendanceRecords.0': { $exists: true } 
  });
  
  for (const session of sessions) {
    const records = session.attendanceRecords.map(record => ({
      classSession: session._id,
      student: record.student,
      teacher: session.teacher,
      subject: session.subject,
      batch: session.batch,
      semester: session.semester,
      section: session.section,
      status: record.status,
      markedAt: record.markedAt,
      markedMethod: 'code', // default
      hasSubmittedFeedback: record.hasSubmittedFeedback || false
    }));
    
    await AttendanceRecord.insertMany(records);
    
    // Optional: Clear embedded records
    // session.attendanceRecords = [];
    // await session.save();
  }
  
  console.log(`Migrated ${sessions.length} sessions`);
}
```

**Note**: This migration is **optional**. The new code will work without migrating old data.

## Rollback Plan

If you need to rollback:

1. **Keep Old Files**: Don't delete old college module files immediately
2. **Database**: No schema changes were made, so no rollback needed
3. **Routes**: Comment out new routes, uncomment old routes in server.js
4. **Frontend**: Revert API endpoint changes

```javascript
// Rollback in server.js
// Comment out new routes
// app.use('/api/attendance', attendanceRoutes);
// app.use('/api/feedback', feedbackRoutes);

// Uncomment old routes
app.use('/api/college/teacher', teacherRoutes);
app.use('/api/college/student', studentRoutes);
```

## Testing Checklist

### Attendance Domain
- [ ] Teacher can create class session
- [ ] Student can mark attendance with 8-digit code
- [ ] Code expires after 60 seconds
- [ ] Teacher can view live roster updates (Socket.IO)
- [ ] Teacher can manually update attendance
- [ ] Teacher can finalize session
- [ ] Student can view attendance statistics
- [ ] Teacher can view session history

### Feedback Domain
- [ ] Student can submit feedback for attended sessions
- [ ] Feedback is anonymous (no student ID exposed)
- [ ] Student can't submit duplicate feedback
- [ ] Teacher can view aggregated feedback summary
- [ ] Teacher can create session reflection
- [ ] Teacher can update existing reflection
- [ ] Teacher can view pending reflections
- [ ] Feedback submission updates attendance record atomically

### Admin Domain (Subjects)
- [ ] Admin can create new subject
- [ ] Admin can list all subjects
- [ ] Admin can update subject
- [ ] Changing semester removes teacher/student associations
- [ ] Admin can delete subject
- [ ] Deleting subject removes all associations
- [ ] Admin can view subject usage statistics

### Socket.IO
- [ ] Teacher can join session room
- [ ] Real-time updates work when student marks attendance
- [ ] Real-time updates work when teacher updates attendance
- [ ] Teacher receives session finalized event
- [ ] Code regenerated event works

## Performance Improvements

The new architecture provides several performance benefits:

1. **Indexes**: Comprehensive indexes on AttendanceRecord for fast queries
2. **Aggregation**: Optimized aggregation pipelines for statistics
3. **Service Layer**: Business logic separated for easier caching
4. **Query Optimization**: Lean queries and selective field population

## Documentation

Each domain includes comprehensive README documentation:

- `/src/api/attendance/README.md` - Complete attendance domain guide
- `/src/api/feedback/README.md` - Feedback and reflection documentation
- `/src/api/academics/README.md` - Planned features and roadmap
- `/src/api/assignments/README.md` - Implementation plan

## Support & Questions

For questions or issues:

1. Check domain-specific README files
2. Review this migration guide
3. Contact development team
4. Create GitHub issue with `[migration]` tag

## Timeline

- **Week 1**: Backend integration and testing
- **Week 2**: Frontend API updates
- **Week 3**: User acceptance testing
- **Week 4**: Production deployment

---

**Last Updated**: January 2024  
**Status**: Ready for Integration  
**Next Steps**: Server.js integration and frontend updates
