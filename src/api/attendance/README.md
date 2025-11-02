# Attendance Domain (Phase 0)

The Attendance domain handles all attendance tracking, class session management, and attendance analytics for the educational platform.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Models](#models)
- [API Endpoints](#api-endpoints)
- [Real-time Events](#real-time-events)
- [Usage Examples](#usage-examples)
- [Business Rules](#business-rules)

## Overview

The Attendance domain is responsible for:

- **Session Management**: Create and manage class sessions with time-limited attendance codes
- **Attendance Marking**: Students mark attendance using 8-digit codes, teachers can update manually
- **Real-time Updates**: Socket.IO integration for live attendance roster updates
- **Analytics**: Comprehensive attendance statistics and reporting
- **Access Control**: Role-based policies ensuring proper authorization

## Architecture

```
src/api/attendance/
├── controllers/           # Request handlers
│   ├── teacher.controller.js
│   ├── student.controller.js
│   └── stats.controller.js
├── services/             # Business logic
│   ├── session.service.js
│   ├── marking.service.js
│   └── stats.service.js
├── routes/               # Route definitions
│   ├── teacher.routes.js
│   ├── student.routes.js
│   └── stats.routes.js
├── validators/           # Input validation
│   └── attendance.validators.js
├── policies/             # Authorization rules
│   └── attendance.policies.js
├── attendance.routes.js  # Main router
└── attendance.socket.js  # Socket.IO handlers
```

## Features

### 1. Class Session Management

- **Create Sessions**: Teachers create sessions with auto-generated 8-digit codes
- **Active Session**: One active session per teacher at a time
- **Time-Limited Codes**: Attendance codes expire after 60 seconds
- **Code Regeneration**: Teachers can regenerate codes during active sessions
- **Session Finalization**: Close attendance window and view summary

### 2. Attendance Marking

- **Student Self-Marking**: Students enter 8-digit code to mark attendance
- **Manual Updates**: Teachers can manually update attendance status
- **Bulk Operations**: Update multiple attendance records at once
- **Status Types**: Present, Absent, Late

### 3. Real-time Updates

- **Socket.IO Integration**: Live attendance updates to teacher's roster
- **Room-based Broadcasting**: Session-specific rooms for targeted updates
- **Event Types**: attendance-marked, attendance-updated, session-finalized, code-regenerated

### 4. Analytics & Reporting

- **Student Statistics**: Overall and subject-wise attendance percentages
- **Class Statistics**: Attendance summary for entire class sections
- **Attendance Trends**: Historical attendance patterns over time
- **Low Attendance Alerts**: Identify students below attendance threshold
- **Data Export**: Export attendance data for reporting

## Models

### AttendanceRecord

```javascript
{
  classSession: ObjectId,      // Reference to ClassSession
  student: ObjectId,            // Reference to User (student)
  teacher: ObjectId,            // Reference to User (teacher)
  subject: ObjectId,            // Reference to Subject
  batch: Number,                // Batch year (e.g., 2020)
  semester: Number,             // Semester (1-8)
  section: String,              // Section ('A', 'B', 'C')
  status: String,               // 'present', 'absent', 'late'
  markedAt: Date,               // When attendance was marked
  markedMethod: String,         // 'code', 'manual', 'late_mark'
  hasSubmittedFeedback: Boolean,
  feedbackSubmittedAt: Date
}
```

**Key Methods:**
- `markPresent(method)` - Mark attendance as present
- `markManually(status)` - Update attendance status manually
- `recordFeedbackSubmission()` - Record feedback submission

**Static Methods:**
- `getSessionRecords(sessionId)` - Get all records for a session
- `getStudentStats(studentId, subjectId)` - Get student attendance statistics
- `createForSession(sessionId, studentIds, sessionData)` - Bulk create records
- `getSessionSummary(sessionId)` - Get session attendance summary

## API Endpoints

### Teacher Routes (`/api/attendance/teacher`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/class-data` | Get teacher's assigned subjects |
| POST | `/sessions` | Create a new class session |
| GET | `/active-session` | Get teacher's current active session |
| GET | `/sessions/:sessionId/roster` | Get session attendance roster |
| POST | `/sessions/:sessionId/finalize` | Finalize session and close attendance |
| POST | `/sessions/:sessionId/regenerate-code` | Generate new attendance code |
| DELETE | `/sessions/:sessionId` | Delete a session |
| PATCH | `/records/:recordId` | Update single attendance record |
| PATCH | `/records/bulk` | Bulk update attendance records |
| GET | `/history` | Get session history with filters |

### Student Routes (`/api/attendance/student`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mark` | Mark attendance using code |
| GET | `/active-sessions` | Get active sessions for student |
| GET | `/stats` | Get overall and subject-wise statistics |
| GET | `/stats/:subjectId` | Get statistics for specific subject |
| GET | `/trend` | Get attendance trend over time |
| GET | `/profile` | Get student profile with attendance |

### Stats Routes (`/api/attendance/stats`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/class` | Get class attendance statistics |
| GET | `/session/:sessionId` | Get session summary |
| GET | `/low-attendance` | Get students below threshold |
| GET | `/export` | Export attendance data |

## Real-time Events

### Socket Events

#### Client → Server

```javascript
// Join session room
socket.emit('join-session-room', { 
  sessionId: 'xxx', 
  userRole: 'teacher' 
});

// Leave session room
socket.emit('leave-session-room', { 
  sessionId: 'xxx' 
});
```

#### Server → Client

```javascript
// Attendance marked by student
socket.on('attendance-marked', (data) => {
  // data: { recordId, studentId, status, markedAt }
});

// Attendance updated by teacher
socket.on('attendance-updated', (data) => {
  // data: { recordId, studentId, status }
});

// Session finalized
socket.on('session-finalized', (data) => {
  // data: { sessionId, attendanceSummary }
});

// Code regenerated
socket.on('code-regenerated', (data) => {
  // data: { attendanceCode, codeExpiresAt }
});
```

## Usage Examples

### Creating a Class Session (Teacher)

```javascript
POST /api/attendance/teacher/sessions
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

{
  "subject": "507f1f77bcf86cd799439011",
  "batch": 2020,
  "semester": 5,
  "section": "A",
  "topic": "Introduction to Data Structures",
  "sessionType": "lecture"
}

// Response
{
  "success": true,
  "message": "Class session created successfully",
  "data": {
    "session": { ... },
    "totalStudents": 45,
    "attendanceCode": "12345678",
    "codeExpiresAt": "2024-01-20T10:01:00.000Z"
  }
}
```

### Marking Attendance (Student)

```javascript
POST /api/attendance/student/mark
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

{
  "attendanceCode": "12345678"
}

// Response
{
  "success": true,
  "message": "Attendance marked successfully",
  "data": {
    "record": { ... },
    "session": {
      "_id": "...",
      "subject": { "name": "Data Structures", "code": "CS301" },
      "topic": "Introduction to Data Structures"
    }
  }
}
```

### Getting Student Statistics

```javascript
GET /api/attendance/student/stats
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.

// Response
{
  "success": true,
  "data": {
    "overall": {
      "totalClasses": 120,
      "presentCount": 95,
      "lateCount": 5,
      "absentCount": 20,
      "attendancePercentage": 79.17
    },
    "bySubject": [
      {
        "subjectId": "...",
        "subjectName": "Data Structures",
        "subjectCode": "CS301",
        "totalClasses": 30,
        "presentCount": 25,
        "attendancePercentage": 83.33
      },
      ...
    ]
  }
}
```

### Real-time Attendance Updates (Teacher Frontend)

```javascript
import io from 'socket.io-client';

// Connect to socket
// Note: Do NOT send the httpOnly JWT from client-side JS. The server reads the cookie.
// Optionally provide a non-sensitive deviceId for per-device tracking and ensure cookies are sent.
const socket = io('http://localhost:5000', {
  auth: { deviceId: 'device-123' },
  withCredentials: true,
});

// Join session room
socket.emit('join-session-room', { 
  sessionId: activeSessionId, 
  userRole: 'teacher' 
});

// Listen for attendance updates
socket.on('attendance-marked', (data) => {
  console.log('Student marked attendance:', data);
  // Update roster UI in real-time
  updateRosterUI(data);
});

socket.on('attendance-updated', (data) => {
  console.log('Attendance updated:', data);
  // Update roster UI
  updateRosterUI(data);
});
```

## Business Rules

### Session Creation

1. Teachers can only have ONE active session at a time
2. Teachers must be assigned to the class (subject + batch + semester + section)
3. At least one student must be enrolled in the class
4. Attendance codes are valid for 60 seconds after generation

### Attendance Marking

1. Students can only mark attendance for active sessions
2. Students must be enrolled in the class
3. Attendance codes must be valid (not expired)
4. Students cannot mark attendance twice for the same session
5. Teachers can manually update attendance at any time

### Authorization

- **Teachers**: Can access only their own sessions and assigned classes
- **Students**: Can mark attendance only for their enrolled classes
- **Stats**: Teachers can view stats only for their assigned classes

### Data Integrity

1. AttendanceRecord has unique constraint on (classSession, student)
2. Attendance records are automatically created for all enrolled students when session is created
3. Deleting a session cascades to delete all associated attendance records
4. Composite indexes ensure efficient querying

### Validation

- **Batch**: Must be between 2000 and 2100
- **Semester**: Must be between 1 and 8
- **Section**: Must be 'A', 'B', or 'C'
- **Status**: Must be 'present', 'absent', or 'late'
- **Session Type**: Must be 'lecture', 'lab', 'tutorial', or 'seminar'
- **Attendance Code**: Must be exactly 8 digits

## Error Handling

All controllers use centralized error handling via `next(error)`:

```javascript
try {
  // Operation
} catch (error) {
  next(error); // Handled by error middleware
}
```

Common error scenarios:
- Invalid or expired attendance codes
- Unauthorized access to sessions
- Already marked attendance
- Session not found
- Teacher already has active session

## Performance Considerations

### Indexes

- Composite index on `(classSession, student)` for uniqueness and fast lookups
- Index on `student` for student statistics queries
- Index on `teacher` for teacher session queries
- Index on `(batch, semester, section, subject)` for class statistics

### Query Optimization

- Use aggregation pipelines for statistics calculations
- Populate only required fields to reduce data transfer
- Limit query results with configurable limits
- Use lean queries where Mongoose documents aren't needed

## Testing

Key test scenarios:

1. **Session Lifecycle**: Create → Active → Mark Attendance → Finalize
2. **Code Validation**: Valid code, expired code, invalid format
3. **Real-time Updates**: Socket event emissions and receipt
4. **Authorization**: Teacher-only routes, student-only routes
5. **Statistics**: Accuracy of attendance percentage calculations
6. **Edge Cases**: Duplicate marking, concurrent updates

## Migration from Old College Module

The Attendance domain replaces the following old files:

- `src/api/college/attendence.socket.js` → `src/api/attendance/attendance.socket.js`
- `src/api/college/student.controller.js` (attendance methods) → `src/api/attendance/controllers/student.controller.js`
- `src/api/college/teacher.controller.js` (session methods) → `src/api/attendance/controllers/teacher.controller.js`

Key changes:
- Extracted attendance logic from monolithic controllers
- Separated embedded `ClassSession.attendanceRecords` into standalone `AttendanceRecord` model
- Service layer for business logic separation
- Comprehensive validators and policies
- Improved real-time socket integration

## Future Enhancements

- GPS-based attendance verification
- Face recognition integration
- Attendance prediction using ML
- Parent/guardian notifications
- Attendance reports generation (PDF)
- QR code-based attendance marking
- Attendance appeal system

---

**Last Updated**: January 2024  
**Phase**: 0 (Foundation)  
**Status**: Production Ready
