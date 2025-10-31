# Management Sub-Domain

## Overview

The Management sub-domain handles all user, student, and faculty entity management operations. It provides comprehensive CRUD operations for student details, enrollment management, faculty promotions, and user queries. This is the central hub for administrative user management tasks.

## Architecture

This sub-domain follows the Phase 0 architecture pattern:

```
management/
├── routes/
│   └── management.routes.js      # Route definitions with validation
├── controllers/
│   └── management.controller.js  # Thin HTTP request handlers
├── services/
│   └── management.service.js     # Business logic layer
├── validators/
│   └── management.validator.js   # Joi validation schemas
├── index.js                       # Entry point
└── README.md                      # This file
```

## Features

- **User Queries**: Get users filtered by role (user, student, teacher, hod)
- **Teacher Listing**: Get all teachers and HODs with their assignments
- **Student Management**: Update student details (USN, batch, section, semester)
- **Enrollment Management**: Manage student subject enrollments with semester validation
- **Faculty Promotion**: Promote users to teacher/HOD roles with email notifications
- **Data Integrity**: Automatic cleanup when changing roles or semesters

## API Endpoints

### 1. Get Users by Role

**Endpoint**: `GET /api/admin/management/users?role=user`

**Description**: Retrieve all verified users with a specific role

**Authorization**: Admin only

**Query Parameters**:
- `role`: Required, must be one of: 'user', 'student', 'teacher', 'hod'

**Response (Success - 200)**:
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "studentDetails": {
        "usn": "1MS21CS001",
        "batch": 2021,
        "section": "A",
        "semester": 3
      }
    }
  ]
}
```

**Business Logic**:
- Only returns verified users (`isVerified: true`)
- Selects name, email, and studentDetails fields
- Filters by exact role match

### 2. Get All Teachers

**Endpoint**: `GET /api/admin/management/teachers`

**Description**: Retrieve all users with teacher or HOD role, including their assignments

**Authorization**: Admin only

**Response (Success - 200)**:
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Dr. Jane Smith",
      "email": "jane@example.com",
      "teacherDetails": {
        "staffId": "FAC001",
        "department": "Computer Science",
        "assignments": [
          {
            "_id": "507f1f77bcf86cd799439099",
            "subject": {
              "_id": "507f1f77bcf86cd799439022",
              "name": "Data Structures",
              "subjectCode": "CS301"
            },
            "sections": ["A", "B"],
            "batch": 2021,
            "semester": 3
          }
        ]
      }
    }
  ]
}
```

**Business Logic**:
- Finds users with role 'teacher' or 'hod'
- Populates subject details in assignments
- Returns complete teacher profile with assignments

### 3. Update Student Details

**Endpoint**: `PUT /api/admin/management/students/:studentId`

**Description**: Update a student's basic information (USN, batch, section, semester)

**Authorization**: Admin only

**Request Parameters**:
- `studentId` (URL param): MongoDB ObjectId of the student

**Request Body** (at least one field required):
```json
{
  "usn": "1MS21CS001",
  "batch": 2021,
  "section": "A",
  "semester": 3
}
```

**Validation Rules**:
- `usn`: Optional string, trimmed
- `batch`: Optional integer, minimum 2000
- `section`: Optional string, must be 'A', 'B', or 'C'
- `semester`: Optional integer, must be between 1 and 4
- **At least one field must be provided**

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "message": "Student details updated successfully.",
    "studentDetails": {
      "usn": "1MS21CS001",
      "batch": 2021,
      "section": "A",
      "semester": 3,
      "enrolledSubjects": [],
      "applicationStatus": "approved",
      "isStudentVerified": true
    }
  }
}
```

**Business Logic - Semester Change**:
- **CRITICAL**: If semester is changed, all enrolled subjects are automatically cleared
- This prevents students from being enrolled in subjects from the wrong semester
- Admin must re-enroll student in correct semester subjects after changing semester

### 4. Update Student Enrollment

**Endpoint**: `PUT /api/admin/management/students/:studentId/enrollment`

**Description**: Update a student's enrolled subjects with semester validation

**Authorization**: Admin only

**Request Parameters**:
- `studentId` (URL param): MongoDB ObjectId of the student

**Request Body**:
```json
{
  "subjectIds": [
    "507f1f77bcf86cd799439022",
    "507f1f77bcf86cd799439033"
  ]
}
```

**Validation Rules**:
- `subjectIds`: Required array of MongoDB ObjectIds (24-character hex strings)
- Can be empty array to clear all enrollments
- All subjects must exist and match student's current semester

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "message": "Student enrollment updated successfully.",
    "enrolledSubjects": [
      "507f1f77bcf86cd799439022",
      "507f1f77bcf86cd799439033"
    ]
  }
}
```

**Business Logic - Semester Validation**:
1. Student must have a semester assigned
2. All subject IDs must reference existing subjects in database
3. All subjects must have same semester as student's current semester
4. **Replaces** existing enrollments (not additive)

### 5. Promote User to Faculty

**Endpoint**: `PATCH /api/admin/management/users/:userId/promote`

**Description**: Promote a user to teacher or HOD role

**Authorization**: Admin only

**Request Parameters**:
- `userId` (URL param): MongoDB ObjectId of the user

**Request Body**:
```json
{
  "role": "teacher",
  "staffId": "FAC001",
  "department": "Computer Science"
}
```

**Validation Rules**:
- `role`: Required, must be 'teacher' or 'hod'
- `staffId`: Required string, trimmed (must be unique)
- `department`: Required string, trimmed

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "message": "John Doe has been promoted to teacher.",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "role": "teacher",
      "teacherDetails": {
        "staffId": "FAC001",
        "department": "Computer Science",
        "assignments": []
      }
    }
  }
}
```

**Business Logic - Promotion Flow**:
1. Validates user exists
2. Checks staffId is unique (not assigned to another user)
3. Changes user's role to 'teacher' or 'hod'
4. Creates teacherDetails with staffId, department, empty assignments
5. **Clears student data**: Resets studentDetails to default state
6. Sends promotion email asynchronously (non-blocking)

**Email Notification**:
- Template: `facultyPromotion.html`
- Subject: "Your Account Role has been Updated"
- Data: name, newRole, loginUrl
- Errors are logged but don't block response

## Data Models

### User Model

```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  role: String,                              // 'user', 'student', 'teacher', 'hod'
  isVerified: Boolean,
  
  // Student-specific fields
  studentDetails: {
    usn: String,                             // University Seat Number
    batch: Number,                           // Year (e.g., 2021)
    section: String,                         // 'A', 'B', 'C'
    semester: Number,                        // 1-4
    enrolledSubjects: [ObjectId],            // References to Subject model
    applicationStatus: String,               // 'not_applied', 'pending', 'approved', 'rejected'
    isStudentVerified: Boolean
  },
  
  // Faculty-specific fields
  teacherDetails: {
    staffId: String,                         // Unique staff identifier
    department: String,
    assignments: [                           // Teacher-subject assignments
      {
        _id: ObjectId,
        subject: ObjectId,                   // Reference to Subject
        sections: [String],
        batch: Number,
        semester: Number
      }
    ]
  }
}
```

### Subject Model

```javascript
{
  _id: ObjectId,
  name: String,
  subjectCode: String,
  semester: Number                           // 1-4
}
```

## Validation

This sub-domain uses **Joi** for validation:

### Student Details Update
- `usn`: Optional string
- `batch`: Optional integer, min 2000
- `section`: Optional string, must be 'A', 'B', or 'C'
- `semester`: Optional integer, 1-4
- **At least one field required**

### Enrollment Update
- `subjectIds`: Required array of 24-character hex strings

### Faculty Promotion
- `role`: Required, must be 'teacher' or 'hod'
- `staffId`: Required non-empty string
- `department`: Required non-empty string

### Role Query
- `role`: Required, must be 'user', 'student', 'teacher', or 'hod'

### ID Parameters
- `userId`, `studentId`: MongoDB ObjectId pattern (24 hex characters)

## Error Responses

**Validation Errors** (400):
```json
{
  "message": "At least one field (usn, batch, semester or section) must be provided to update."
}
```

```json
{
  "message": "Role must be one of: user, student, teacher, hod"
}
```

**Business Logic Errors** (400):
```json
{
  "message": "Cannot enroll subjects for a student with no assigned semester."
}
```

```json
{
  "message": "One or more subjects do not match the student's current semester."
}
```

```json
{
  "message": "This Staff ID is already assigned to another user."
}
```

**Not Found Errors** (404):
```json
{
  "message": "Student not found."
}
```

```json
{
  "message": "User not found."
}
```

## Business Rules

### Student Management Rules

1. **Role Verification**: Only users with role 'student' can be managed as students
2. **Semester Change Impact**: Changing semester clears all enrollments
3. **Section Values**: Only 'A', 'B', 'C' are valid sections
4. **Batch Constraints**: Batch year must be >= 2000
5. **Semester Range**: Must be between 1 and 4

### Enrollment Rules

1. **Semester Required**: Student must have assigned semester before enrollment
2. **Subject Validation**: All subjects must exist in database
3. **Semester Matching**: All enrolled subjects must match student's semester
4. **Replacement Logic**: New enrollment replaces old (not additive)
5. **Empty Array**: Allowed to clear all enrollments

### Faculty Promotion Rules

1. **Unique Staff ID**: Staff ID cannot be assigned to multiple users
2. **Role Limitation**: Can only promote to 'teacher' or 'hod'
3. **Data Cleanup**: Student data is cleared on promotion
4. **Email Notification**: Sent asynchronously after successful promotion
5. **Empty Assignments**: New faculty start with no assignments

### User Query Rules

1. **Verified Only**: Only returns users with `isVerified: true`
2. **Exact Role Match**: No partial or multi-role filtering (except teachers endpoint)
3. **Teachers Endpoint**: Special endpoint returns both 'teacher' and 'hod' roles

## Dependencies

### Internal
- `User` model - For all user operations
- `Subject` model - For subject validation in enrollments
- `emailTemplate` utility - For populating email templates
- `email.service` - For sending emails
- `express-async-handler` - For async error handling

### External
- `express` - Routing
- `joi` - Validation
- `mongoose` - Database operations

## Environment Variables

- `FRONTEND_URL` - Used in promotion email for login link (defaults to `http://localhost:3000`)

## Error Handling

All controller methods use `express-async-handler` to catch async errors automatically. Service layer throws descriptive errors that are caught and formatted by the controller/middleware.

Email failures are logged but do not affect the response or rollback the promotion.

## Usage Examples

```javascript
// Get all students
const students = await fetch('/api/admin/management/users?role=student', {
  headers: { 'Authorization': 'Bearer <admin-token>' }
});

// Update student details
const updateStudent = await fetch('/api/admin/management/students/507f1f77bcf86cd799439011', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <admin-token>'
  },
  body: JSON.stringify({
    semester: 4,
    section: 'B'
  })
});

// Update enrollment
const updateEnrollment = await fetch(
  '/api/admin/management/students/507f1f77bcf86cd799439011/enrollment',
  {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer <admin-token>'
    },
    body: JSON.stringify({
      subjectIds: ['507f1f77bcf86cd799439022', '507f1f77bcf86cd799439033']
    })
  }
);

// Promote to faculty
const promote = await fetch('/api/admin/management/users/507f1f77bcf86cd799439011/promote', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <admin-token>'
  },
  body: JSON.stringify({
    role: 'teacher',
    staffId: 'FAC001',
    department: 'Computer Science'
  })
});
```

## Testing Considerations

When testing this sub-domain:
1. Test semester change clears enrollments
2. Verify subject-semester validation in enrollments
3. Test staff ID uniqueness constraint
4. Verify student data is cleared on promotion
5. Test email sending doesn't block promotion
6. Verify "at least one field" validation for student updates
7. Test role query with different valid/invalid roles
8. Verify only verified users are returned in queries
9. Test empty subject array for enrollment (should succeed)

## Integration Notes

- **Parent Router**: Mounted at `/api/admin/management` by admin parent router
- **Middleware**: Requires `protect` and `isAdmin` middleware from parent
- **Related Domains**: 
  - Works with `applications` for student verification flow
  - Works with `teacher-assignments` for faculty assignment management
  - Works with `subjects` for enrollment validation

## Future Enhancements

- Batch user operations (bulk promotions, bulk enrollments)
- Student transfer between batches/sections
- Faculty demotion workflow
- Audit trail for role changes
- Department-based user filtering
- Student graduation workflow
- Faculty workload limits
- Enrollment history tracking
- Role change approval workflow
- Automated semester progression
