# Reports Sub-Domain

## Overview

The Reports sub-domain provides comprehensive analytics and reporting capabilities for attendance, feedback, and performance metrics. It uses advanced MongoDB aggregation pipelines to generate insights for administrators and HODs (Heads of Department) to monitor academic activities, student attendance, and teaching effectiveness.

## Architecture

This sub-domain follows the Phase 0 architecture pattern:

```
reports/
├── routes/
│   └── reports.routes.js      # Route definitions
├── controllers/
│   └── reports.controller.js  # Thin HTTP request handlers
├── services/
│   └── reports.service.js     # Complex aggregation pipelines
├── index.js                    # Entry point
└── README.md                   # This file
```

## Features

- **Attendance Statistics**: Aggregated attendance data by teacher, subject, batch, and section
- **Feedback Summary**: Aggregated student feedback ratings by teacher and subject
- **Feedback Reports**: Detailed feedback for specific class sessions with teacher reflections
- **Teacher Reports**: Comprehensive performance reports for individual teachers
- **Student Reports**: Detailed attendance reports for individual students
- **Advanced Filtering**: Filter reports by teacher, subject, semester, batch, section

## API Endpoints

### 1. Get Attendance Statistics

**Endpoint**: `GET /api/admin/reports/attendance-stats`

**Description**: Get aggregated attendance statistics across all classes

**Authorization**: Admin & HOD

**Query Parameters** (all optional):
- `teacherId`: Filter by specific teacher (MongoDB ObjectId)
- `subjectId`: Filter by specific subject (MongoDB ObjectId)
- `semester`: Filter by semester (1-4)

**Response (Success - 200)**:
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011-507f1f77bcf86cd799439022-2021-A",
      "teacherId": "507f1f77bcf86cd799439011",
      "subjectId": "507f1f77bcf86cd799439022",
      "teacherName": "Dr. Jane Smith",
      "subjectName": "Data Structures",
      "batch": 2021,
      "section": "A",
      "semester": 3,
      "totalStudents": 150,
      "presentStudents": 135,
      "attendancePercentage": 90.00
    }
  ]
}
```

**Aggregation Details**:
- Groups by teacher, subject, batch, section, semester
- Counts total student records and present students
- Calculates attendance percentage
- Populates teacher and subject names
- Sorted by subject name, then teacher name

### 2. Get Feedback Summary

**Endpoint**: `GET /api/admin/reports/feedback-summary`

**Description**: Get aggregated feedback ratings across all feedback submissions

**Authorization**: Admin & HOD

**Query Parameters** (all optional):
- `teacherId`: Filter by specific teacher
- `subjectId`: Filter by specific subject
- `semester`: Filter by semester

**Response (Success - 200)**:
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011-507f1f77bcf86cd799439022",
      "teacherId": "507f1f77bcf86cd799439011",
      "subjectId": "507f1f77bcf86cd799439022",
      "teacherName": "Dr. Jane Smith",
      "subjectName": "Data Structures",
      "feedbackCount": 45,
      "averageRatings": {
        "clarity": 4.5,
        "engagement": 4.2,
        "pace": 4.0,
        "knowledge": 4.8
      }
    }
  ]
}
```

**Aggregation Details**:
- Groups by teacher and subject
- Counts total feedback submissions
- Calculates average ratings for clarity, engagement, pace, knowledge
- Rounds averages to 2 decimal places
- Sorted by feedback count (descending)

### 3. Get Feedback Report for Class Session

**Endpoint**: `GET /api/admin/reports/feedback-report/:classSessionId`

**Description**: Get detailed feedback report for a specific class session, including student feedback summary and teacher reflection

**Authorization**: Admin & HOD

**Request Parameters**:
- `classSessionId` (URL param): MongoDB ObjectId of the class session

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "sessionDetails": {
      "_id": "507f1f77bcf86cd799439099",
      "teacher": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Dr. Jane Smith"
      },
      "subject": {
        "_id": "507f1f77bcf86cd799439022",
        "name": "Data Structures",
        "subjectCode": "CS301"
      },
      "date": "2025-10-30T10:00:00.000Z",
      "batch": 2021,
      "section": "A"
    },
    "studentFeedbackSummary": {
      "feedbackCount": 30,
      "averageRatings": {
        "clarity": 4.5,
        "engagement": 4.2,
        "pace": 4.0,
        "knowledge": 4.8
      },
      "positiveComments": [
        "Great explanation of linked lists",
        "Interactive session with good examples"
      ],
      "improvementSuggestions": [
        "Could slow down a bit",
        "More practice problems needed"
      ]
    },
    "teacherReflection": {
      "_id": "507f1f77bcf86cd799439088",
      "classSession": "507f1f77bcf86cd799439099",
      "reflection": "Students grasped the concept well. Need to add more hands-on exercises.",
      "createdAt": "2025-10-30T14:00:00.000Z"
    }
  }
}
```

**Aggregation Details**:
- Fetches class session with populated teacher and subject
- Aggregates anonymous student feedback (ratings and comments)
- Filters out empty comments/suggestions
- Fetches teacher's self-reflection for the session
- All queries run in parallel for performance

### 4. Get Teacher Report

**Endpoint**: `GET /api/admin/reports/teacher/:teacherId`

**Description**: Get comprehensive performance report for a specific teacher including attendance and feedback metrics

**Authorization**: Admin & HOD

**Request Parameters**:
- `teacherId` (URL param): MongoDB ObjectId of the teacher

**Query Parameters** (optional filters):
- `subjectId`: Filter by specific subject
- `semester`: Filter by semester

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "teacher": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Dr. Jane Smith",
      "teacherDetails": {
        "staffId": "FAC001",
        "department": "Computer Science"
      }
    },
    "attendance": [
      {
        "subjectId": "507f1f77bcf86cd799439022",
        "subjectName": "Data Structures",
        "sessionCount": 15,
        "attendancePercentage": 90.00
      },
      {
        "subjectId": "507f1f77bcf86cd799439033",
        "subjectName": "Algorithms",
        "sessionCount": 12,
        "attendancePercentage": 88.50
      }
    ],
    "feedback": [
      {
        "subjectId": "507f1f77bcf86cd799439022",
        "feedbackCount": 45,
        "avgClarity": 4.5,
        "avgEngagement": 4.2
      }
    ]
  }
}
```

**Aggregation Details**:
- Attendance: Groups sessions by subject, counts unique sessions, calculates attendance percentage
- Feedback: Groups by subject, counts feedback, averages clarity and engagement ratings
- Teacher details: Name, staff ID, department
- All queries run in parallel

### 5. Get Student Report

**Endpoint**: `GET /api/admin/reports/student/:studentId`

**Description**: Get detailed attendance report for a specific student across all their enrolled subjects

**Authorization**: Admin & HOD

**Request Parameters**:
- `studentId` (URL param): MongoDB ObjectId of the student

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "student": {
      "_id": "507f1f77bcf86cd799439044",
      "name": "John Doe",
      "studentDetails": {
        "usn": "1MS21CS001",
        "batch": 2021,
        "section": "A",
        "semester": 3
      }
    },
    "attendance": [
      {
        "subjectId": "507f1f77bcf86cd799439022",
        "subjectName": "Data Structures",
        "totalClasses": 15,
        "attendedClasses": 13,
        "attendancePercentage": 86.67
      },
      {
        "subjectId": "507f1f77bcf86cd799439033",
        "subjectName": "Algorithms",
        "totalClasses": 12,
        "attendedClasses": 12,
        "attendancePercentage": 100.00
      }
    ]
  }
}
```

**Aggregation Details**:
- Filters attendance records for specific student
- Groups by subject
- Counts total classes and attended classes
- Calculates attendance percentage per subject
- Sorted by attendance percentage (ascending - shows lowest first)

## Data Models

### ClassSession Model
```javascript
{
  _id: ObjectId,
  teacher: ObjectId,                         // Reference to User (teacher)
  subject: ObjectId,                         // Reference to Subject
  date: Date,
  batch: Number,
  section: String,
  semester: Number,
  attendanceRecords: [
    {
      student: ObjectId,                     // Reference to User (student)
      status: Boolean                        // true = present, false = absent
    }
  ]
}
```

### Feedback Model
```javascript
{
  _id: ObjectId,
  classSession: ObjectId,                    // Reference to ClassSession
  teacher: ObjectId,                         // Denormalized for faster queries
  subject: ObjectId,                         // Denormalized for faster queries
  semester: Number,                          // Denormalized for faster queries
  ratings: {
    clarity: Number,                         // 1-5
    engagement: Number,                      // 1-5
    pace: Number,                            // 1-5
    knowledge: Number                        // 1-5
  },
  positiveFeedback: String,
  improvementSuggestions: String
}
```

### TeacherSessionReflection Model
```javascript
{
  _id: ObjectId,
  classSession: ObjectId,                    // Reference to ClassSession
  reflection: String,                        // Teacher's self-reflection
  createdAt: Date
}
```

## Aggregation Pipeline Details

### Attendance Stats Pipeline
1. **$match**: Filter by query parameters (teacher, subject, semester)
2. **$unwind**: Deconstruct attendanceRecords array
3. **$group**: Group by teacher, subject, batch, section, semester
4. **$lookup**: Join with users and subjects collections
5. **$project**: Shape final output with calculated fields
6. **$sort**: Sort by subject name, teacher name

### Feedback Summary Pipeline
1. **$match**: Filter by query parameters
2. **$group**: Group by teacher and subject, calculate averages
3. **$lookup**: Join with users and subjects collections
4. **$project**: Shape output with rounded averages
5. **$sort**: Sort by feedback count (descending)

### Feedback Report Pipeline
- Parallel execution of 3 queries:
  1. Fetch session details (with populate)
  2. Aggregate student feedback with filtering
  3. Fetch teacher reflection

### Teacher Report Pipeline
- Parallel execution of 3 queries:
  1. Aggregate attendance by subject
  2. Aggregate feedback by subject
  3. Fetch teacher details

### Student Report Pipeline
- Parallel execution of 2 queries:
  1. Fetch student details
  2. Aggregate attendance across all subjects

## Error Responses

**Not Found Errors** (404):
```json
{
  "message": "Class session not found."
}
```

```json
{
  "message": "Teacher not found"
}
```

```json
{
  "message": "Student not found"
}
```

## Business Rules

### Access Control
- **Admin**: Full access to all reports
- **HOD**: Full access to all reports (may be restricted by department in future)

### Data Privacy
- Student feedback is anonymous (no student identifiers in feedback summary)
- Only aggregated ratings shown, not individual feedback records
- Comments are filtered to remove empty strings

### Filtering Rules
- All query filters are optional
- Multiple filters can be combined (AND logic)
- Invalid ObjectIds return empty results (not errors)

### Calculation Rules
- Attendance percentage: (presentStudents / totalStudents) × 100
- Averages rounded to 2 decimal places
- Division by zero returns 0 (not error)

## Dependencies

### Internal Models
- `User` - For teacher and student details
- `ClassSession` - For attendance data
- `Feedback` - For student feedback data
- `TeacherSessionReflection` - For teacher reflections
- `Subject` - For subject details (via lookup)

### External
- `express` - Routing
- `mongoose` - Aggregation pipelines
- `express-async-handler` - Error handling

## Performance Considerations

### Aggregation Optimization
1. **Early Filtering**: $match stages at the beginning reduce dataset size
2. **Parallel Queries**: Multiple aggregations run in parallel using Promise.all
3. **Indexed Fields**: Ensure indexes on teacher, subject, student fields
4. **Denormalization**: Feedback model has denormalized fields (teacher, subject, semester) for faster queries

### Recommended Indexes
```javascript
// ClassSession
{ teacher: 1, subject: 1, semester: 1 }
{ 'attendanceRecords.student': 1 }

// Feedback
{ teacher: 1, subject: 1, semester: 1 }
{ classSession: 1 }

// TeacherSessionReflection
{ classSession: 1 }
```

### Caching Considerations
- Reports data changes frequently (after each class)
- Consider short-term caching (5-10 minutes) for attendance stats
- No caching for real-time reports (feedback report, student/teacher reports)

## Usage Examples

```javascript
// Get attendance stats for a specific teacher
const stats = await fetch('/api/admin/reports/attendance-stats?teacherId=507f1f77bcf86cd799439011', {
  headers: { 'Authorization': 'Bearer <token>' }
});

// Get feedback summary for semester 3
const summary = await fetch('/api/admin/reports/feedback-summary?semester=3', {
  headers: { 'Authorization': 'Bearer <token>' }
});

// Get detailed feedback for a class session
const feedback = await fetch('/api/admin/reports/feedback-report/507f1f77bcf86cd799439099', {
  headers: { 'Authorization': 'Bearer <token>' }
});

// Get teacher performance report
const teacherReport = await fetch('/api/admin/reports/teacher/507f1f77bcf86cd799439011', {
  headers: { 'Authorization': 'Bearer <token>' }
});

// Get student attendance report
const studentReport = await fetch('/api/admin/reports/student/507f1f77bcf86cd799439044', {
  headers: { 'Authorization': 'Bearer <token>' }
});
```

## Testing Considerations

When testing this sub-domain:
1. Test with and without query filters
2. Verify empty results don't cause errors
3. Test with invalid ObjectIds
4. Verify division by zero handling
5. Test parallel query execution
6. Verify comment filtering (empty strings removed)
7. Test sorting orders
8. Verify percentage calculations
9. Test with missing teacher reflections (should return null)
10. Load test aggregations with large datasets

## Integration Notes

- **Parent Router**: Mounted at `/api/admin/reports` by admin parent router
- **Middleware**: Requires `protect` and `isAdminOrHOD` middleware from parent
- **Related Domains**: Uses data from college domain (ClassSession, Feedback models)

## Future Enhancements

- Export reports to PDF/Excel
- Scheduled report generation and email delivery
- Custom date range filtering
- Comparison reports (semester-over-semester)
- Department-level filtering for HODs
- Real-time dashboards with WebSockets
- Predictive analytics (at-risk students)
- Trend analysis over time
- Report templates and customization
- Data visualization endpoints for charts
