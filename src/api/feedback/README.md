# Feedback Domain (Phase 0)

The Feedback domain handles anonymous student feedback and teacher session reflections for continuous improvement of teaching quality.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Models](#models)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [Business Rules](#business-rules)

## Overview

The Feedback domain is responsible for:

- **Student Feedback**: Anonymous feedback submission for attended sessions
- **Teacher Reflections**: Self-assessment and post-session reflections
- **Analytics**: Aggregated feedback summaries and teacher reflection analytics
- **Integration**: Seamless integration with Attendance domain

## Architecture

```
src/api/feedback/
├── controllers/              # Request handlers
│   ├── student.controller.js
│   └── teacher.controller.js
├── services/                 # Business logic
│   ├── feedback.service.js
│   └── reflection.service.js
├── routes/                   # Route definitions
│   ├── student.routes.js
│   └── teacher.routes.js
├── validators/               # Input validation
│   └── feedback.validators.js
└── feedback.routes.js        # Main router
```

## Features

### 1. Student Feedback

- **Anonymous Submission**: Students provide anonymous feedback for sessions they attended
- **Rating System**: 1-5 star rating with optional comments
- **Eligibility**: Only students who attended (marked present) can submit feedback
- **One-time Submission**: Each student can submit feedback only once per session
- **Transaction Safety**: Uses MongoDB transactions for atomicity

### 2. Teacher Reflections

- **Self-Assessment**: Teachers reflect on what went well and what could improve
- **Engagement Rating**: Rate student engagement level (1-5)
- **Topics to Revisit**: List topics that need more attention
- **Update Support**: Reflections can be updated after initial submission
- **Session Linking**: Directly linked to specific class sessions

### 3. Analytics

- **Feedback Summary**: Aggregated ratings, comments, and distribution
- **Teacher Stats**: Overall feedback statistics across subjects
- **Reflection Analytics**: Engagement trends and improvement areas
- **Historical Data**: Track feedback and reflection patterns over time

## Models

### Feedback

```javascript
{
  sessionId: ObjectId,          // Reference to ClassSession
  teacher: ObjectId,            // Reference to User (teacher)
  subject: ObjectId,            // Reference to Subject
  batch: Number,                // Batch year
  semester: Number,             // Semester (1-8)
  section: String,              // Section ('A', 'B', 'C')
  rating: Number,               // Rating (1-5)
  comment: String               // Optional comment (max 1000 chars)
}
```

### TeacherSessionReflection

```javascript
{
  sessionId: ObjectId,          // Reference to ClassSession
  teacher: ObjectId,            // Reference to User (teacher)
  subject: ObjectId,            // Reference to Subject
  batch: Number,                // Batch year
  semester: Number,             // Semester (1-8)
  section: String,              // Section ('A', 'B', 'C')
  whatWentWell: String,         // Positive aspects (10-1000 chars)
  whatCouldImprove: String,     // Areas for improvement (10-1000 chars)
  studentEngagement: Number,    // Engagement rating (1-5)
  topicsToRevisit: [String],    // Topics needing review
  additionalNotes: String       // Optional notes (max 1000 chars)
}
```

## API Endpoints

### Student Routes (`/api/feedback/student`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/submit` | Submit anonymous feedback for a session |
| GET | `/pending` | Get sessions eligible for feedback |

### Teacher Routes (`/api/feedback/teacher`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sessions/:sessionId/summary` | Get aggregated feedback summary |
| GET | `/stats` | Get overall feedback statistics |
| POST | `/sessions/:sessionId/reflection` | Create/update session reflection |
| GET | `/sessions/:sessionId/reflection` | Get reflection for a session |
| DELETE | `/sessions/:sessionId/reflection` | Delete a reflection |
| GET | `/reflections/pending` | Get sessions needing reflection |
| GET | `/reflections/history` | Get reflection history |
| GET | `/reflections/analytics` | Get reflection analytics |

## Usage Examples

### Submit Feedback (Student)

```javascript
POST /api/feedback/student/submit
Authorization: Bearer <token>

{
  "sessionId": "507f1f77bcf86cd799439011",
  "rating": 4,
  "comment": "Great session! The examples were very helpful."
}

// Response
{
  "success": true,
  "message": "Feedback submitted successfully. Thank you for your input!",
  "data": {
    "feedback": { ... },
    "session": {
      "_id": "...",
      "subject": { "name": "Data Structures", "code": "CS301" },
      "topic": "Binary Trees"
    }
  }
}
```

### Get Pending Feedback Sessions (Student)

```javascript
GET /api/feedback/student/pending
Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "sessions": [
      {
        "recordId": "...",
        "session": {
          "_id": "...",
          "subject": { "name": "Data Structures", "code": "CS301" },
          "teacher": { "name": "Dr. John Smith" },
          "topic": "Binary Trees",
          "sessionType": "lecture",
          "date": "2024-01-20T09:00:00.000Z"
        }
      },
      ...
    ],
    "total": 5
  }
}
```

### Submit Reflection (Teacher)

```javascript
POST /api/feedback/teacher/sessions/507f1f77bcf86cd799439011/reflection
Authorization: Bearer <token>

{
  "whatWentWell": "Students actively participated in discussions and grasped the concept of tree traversal quickly.",
  "whatCouldImprove": "Need to allocate more time for hands-on coding exercises. Some students struggled with recursion.",
  "studentEngagement": 4,
  "topicsToRevisit": ["Recursion basics", "Stack overflow scenarios"],
  "additionalNotes": "Consider creating a follow-up lab session for advanced tree operations."
}

// Response
{
  "success": true,
  "message": "Reflection saved successfully",
  "data": {
    "reflection": { ... }
  }
}
```

### Get Feedback Summary (Teacher)

```javascript
GET /api/feedback/teacher/sessions/507f1f77bcf86cd799439011/summary
Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "session": {
      "_id": "...",
      "subject": { "name": "Data Structures", "code": "CS301" },
      "topic": "Binary Trees",
      "sessionType": "lecture",
      "date": "2024-01-20T09:00:00.000Z"
    },
    "feedbackSummary": {
      "totalResponses": 28,
      "averageRating": 4.25,
      "ratingBreakdown": {
        "1": 0,
        "2": 1,
        "3": 5,
        "4": 12,
        "5": 10
      },
      "comments": [
        "Great session!",
        "Examples were very helpful",
        ...
      ]
    },
    "teacherReflection": {
      "whatWentWell": "...",
      "whatCouldImprove": "...",
      "studentEngagement": 4,
      ...
    }
  }
}
```

### Get Teacher Feedback Statistics

```javascript
GET /api/feedback/teacher/stats?subjectId=507f1f77bcf86cd799439011
Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "stats": [
      {
        "subjectId": "...",
        "totalFeedbacks": 150,
        "averageRating": 4.3,
        "ratingBreakdown": {
          "1": 2,
          "2": 5,
          "3": 18,
          "4": 65,
          "5": 60
        },
        "subjectDetails": {
          "name": "Data Structures",
          "code": "CS301"
        }
      }
    ]
  }
}
```

### Get Pending Reflections (Teacher)

```javascript
GET /api/feedback/teacher/reflections/pending?limit=10
Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "sessions": [
      {
        "_id": "...",
        "subject": { "name": "Data Structures", "code": "CS301" },
        "topic": "Binary Trees",
        "sessionType": "lecture",
        "status": "completed",
        "createdAt": "2024-01-20T09:00:00.000Z",
        "attendanceSummary": {
          "totalStudents": 45,
          "presentCount": 40,
          "attendanceRate": 88.89
        },
        "hasReflection": false
      },
      ...
    ],
    "total": 7
  }
}
```

### Get Reflection Analytics (Teacher)

```javascript
GET /api/feedback/teacher/reflections/analytics?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "totalReflections": 25,
    "averageEngagement": 3.8,
    "topicsToRevisitCount": 45,
    "engagementBreakdown": {
      "1": 0,
      "2": 2,
      "3": 8,
      "4": 10,
      "5": 5
    }
  }
}
```

## Business Rules

### Feedback Submission

1. **Eligibility**: Only students who attended the session (status = 'present') can submit feedback
2. **Anonymity**: Feedback is completely anonymous - no student identifiers stored in feedback records
3. **One-time Submission**: Students can submit feedback only once per session
4. **Session Status**: Can only submit feedback for completed sessions
5. **Atomicity**: Uses MongoDB transactions to ensure feedback submission and attendance record update are atomic

### Teacher Reflections

1. **Session Ownership**: Teachers can only create/view reflections for their own sessions
2. **Session Status**: Can only reflect on completed sessions
3. **Update Support**: Reflections can be updated multiple times (upsert pattern)
4. **No Deletion Cascade**: Deleting a reflection doesn't affect the session or feedback

### Authorization

- **Students**: Can submit feedback and view their pending sessions
- **Teachers**: Can view aggregated feedback (not individual responses) and manage their own reflections
- **Anonymity Protection**: Student identity is never exposed in feedback data

### Data Integrity

1. Feedback submission updates `AttendanceRecord.hasSubmittedFeedback` flag atomically
2. Feedback records don't contain student identifiers for anonymity
3. Reflections have unique constraint on `sessionId`
4. Both feedback and reflections are linked to sessions for audit trail

### Validation

- **Rating**: Must be between 1 and 5
- **Comment**: Maximum 1000 characters (optional)
- **What Went Well**: 10-1000 characters (required)
- **What Could Improve**: 10-1000 characters (required)
- **Student Engagement**: Must be between 1 and 5
- **Topics to Revisit**: Array of strings, each 2-200 characters

## Integration with Attendance Domain

The Feedback domain is tightly integrated with the Attendance domain:

1. **Eligibility Check**: Feedback service queries `AttendanceRecord` to verify student attendance
2. **Flag Update**: Upon feedback submission, `AttendanceRecord.hasSubmittedFeedback` is set to true
3. **Pending Sessions**: Queries attendance records to find sessions where student was present but hasn't submitted feedback
4. **Session Linkage**: Both domains reference the same `ClassSession` model

```javascript
// Workflow: Attendance → Feedback
1. Student marks attendance (Attendance Domain)
2. Session is finalized (Attendance Domain)
3. Student sees session in pending feedback list (Feedback Domain)
4. Student submits feedback (Feedback Domain)
5. Attendance record is updated atomically (Cross-domain transaction)
```

## Error Handling

Common error scenarios:

- **Not Attended**: "Can only submit feedback for sessions you attended"
- **Already Submitted**: "Feedback already submitted for this session"
- **Session Not Completed**: "Session not found, not completed, or unauthorized"
- **Unauthorized**: "Session not found or unauthorized" (for teacher routes)

All errors are handled by centralized error middleware.

## Performance Considerations

### Aggregation Pipelines

- Feedback summary uses aggregation for efficient rating calculations
- Rating breakdown computed in-memory to avoid multiple queries
- Teacher stats grouped by subject for efficient analytics

### Indexes

- Index on `(sessionId, student)` for fast feedback eligibility checks
- Index on `teacher` for teacher statistics queries
- Index on `sessionId` for reflection lookups

### Query Optimization

- Populate only required fields to reduce data transfer
- Use `.select()` to exclude sensitive fields
- Limit results with configurable limits

## Testing

Key test scenarios:

1. **Feedback Lifecycle**: Attend session → Session complete → Submit feedback → Verify flag update
2. **Anonymity**: Verify student identity not exposed in feedback data
3. **Reflection CRUD**: Create → Update → Read → Delete
4. **Authorization**: Students can't access teacher routes, teachers can't see student-specific data
5. **Transaction Rollback**: Verify rollback on feedback submission failure
6. **Edge Cases**: Duplicate submission, feedback without attendance, reflection for active session

## Migration from Old College Module

The Feedback domain replaces the following methods from old files:

**From `src/api/college/student.controller.js`:**
- `submitFeedback()` → `src/api/feedback/services/feedback.service.js`
- `getSessionsForFeedback()` → `src/api/feedback/services/feedback.service.js`

**From `src/api/college/teacher.controller.js`:**
- `getFeedbackSummaryForSession()` → `src/api/feedback/services/feedback.service.js`
- `upsertSessionReflection()` → `src/api/feedback/services/reflection.service.js`

Key improvements:
- Separated feedback and reflection into dedicated services
- Added comprehensive analytics and reporting
- Improved transaction handling for atomicity
- Enhanced validation and error handling

## Future Enhancements

- Sentiment analysis on feedback comments
- AI-generated reflection suggestions based on feedback patterns
- Peer feedback system (student-to-student)
- Feedback response templates for teachers
- Export feedback reports (PDF/Excel)
- Email notifications for pending reflections
- Dashboard widgets for feedback trends

---

**Last Updated**: January 2024  
**Phase**: 0 (Foundation)  
**Status**: Production Ready
