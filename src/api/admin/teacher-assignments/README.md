# Teacher-Assignments Sub-Domain

## Overview

The Teacher-Assignments sub-domain manages the assignment of teachers/HODs to subjects, classes, and sections. It handles the workflow of creating and deleting teacher-subject-class assignments for academic management.

## Architecture

This sub-domain follows the Phase 0 architecture pattern:

```
teacher-assignments/
├── routes/
│   └── teacher-assignments.routes.js      # Route definitions with validation
├── controllers/
│   └── teacher-assignments.controller.js  # Thin HTTP request handlers
├── services/
│   └── teacher-assignments.service.js     # Business logic layer
├── validators/
│   └── teacher-assignments.validator.js   # Joi validation schemas
├── index.js                                # Entry point
└── README.md                               # This file
```

## Features

- **Create Assignments**: Assign teachers/HODs to subjects for specific sections, batches, and semesters
- **Delete Assignments**: Remove teacher-subject assignments
- **Validation**: Ensures subject exists and semester matches
- **Duplication Prevention**: Prevents identical assignments
- **Multi-Role Support**: Works with both 'teacher' and 'hod' roles

## API Endpoints

### 1. Create/Update Teacher Assignment

**Endpoint**: `POST /api/admin/teacher-assignments/:teacherId`

**Description**: Add a new subject assignment to a teacher or HOD

**Authorization**: Admin only

**Request Parameters**:
- `teacherId` (URL param): MongoDB ObjectId of the teacher/HOD

**Request Body**:
```json
{
  "subject": "507f1f77bcf86cd799439011",
  "sections": ["A", "B"],
  "batch": 2021,
  "semester": 3
}
```

**Validation Rules**:
- `subject`: Required, must be a valid 24-character hex string (MongoDB ObjectId)
- `sections`: Required array of strings, minimum 1 section
- `batch`: Required integer (year)
- `semester`: Required integer between 1 and 4
- `teacherId`: Must be a valid MongoDB ObjectId

**Response (Success - 201)**:
```json
{
  "success": true,
  "data": {
    "message": "Teacher assignment updated successfully.",
    "teacherDetails": {
      "staffId": "FAC001",
      "department": "Computer Science",
      "assignments": [
        {
          "_id": "507f1f77bcf86cd799439099",
          "subject": {
            "_id": "507f1f77bcf86cd799439011",
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
}
```

**Business Logic**:
1. Validates subject exists in database
2. Ensures subject's semester matches request semester
3. Verifies user is a teacher or HOD
4. Checks for duplicate assignments (same subject, batch, semester, sections)
5. Adds new assignment to teacher's assignments array
6. Populates subject details in response

### 2. Delete Teacher Assignment

**Endpoint**: `DELETE /api/admin/teacher-assignments/:teacherId/:assignmentId`

**Description**: Remove a specific subject assignment from a teacher/HOD

**Authorization**: Admin only

**Request Parameters**:
- `teacherId` (URL param): MongoDB ObjectId of the teacher/HOD
- `assignmentId` (URL param): MongoDB ObjectId of the assignment subdocument

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "message": "Assignment removed successfully."
  }
}
```

**Business Logic**:
1. Validates teacher/HOD exists
2. Verifies assignment exists in teacher's assignments array
3. Removes assignment subdocument using Mongoose `.pull()` method

## Data Models

### User Model - Teacher Details

```javascript
{
  role: String,                              // 'teacher' or 'hod'
  teacherDetails: {
    staffId: String,                         // Unique staff identifier
    department: String,                      // Department name
    assignments: [                           // Array of assignment subdocuments
      {
        _id: ObjectId,                       // Auto-generated assignment ID
        subject: ObjectId,                   // Reference to Subject model
        sections: [String],                  // e.g., ["A", "B", "C"]
        batch: Number,                       // Year (e.g., 2021)
        semester: Number                     // 1-4
      }
    ]
  }
}
```

### Subject Model

```javascript
{
  _id: ObjectId,
  name: String,                              // Subject name
  subjectCode: String,                       // Subject code
  semester: Number                           // 1-4
}
```

## Validation

This sub-domain uses **Joi** for validation:

### Teacher Assignment Validation
- `subject`: 24-character hex string (MongoDB ObjectId format)
- `sections`: Non-empty array of strings
- `batch`: Integer (year)
- `semester`: Integer between 1 and 4
- `teacherId`: MongoDB ObjectId pattern
- `assignmentId`: MongoDB ObjectId pattern

### Error Responses

**Validation Errors** (400):
```json
{
  "message": "Semester must be between 1 and 4"
}
```

**Business Logic Errors** (400):
```json
{
  "message": "Invalid Subject ID. Subject does not exist."
}
```

```json
{
  "message": "Semester mismatch: The selected subject 'Data Structures' belongs to semester 3, not 2."
}
```

```json
{
  "message": "This exact assignment already exists for this teacher."
}
```

**Not Found Errors** (404):
```json
{
  "message": "Teacher not found."
}
```

```json
{
  "message": "Assignment not found for this faculty member."
}
```

## Business Rules

### Assignment Creation Rules

1. **Subject Must Exist**: The subject ID must reference an existing subject in the database
2. **Semester Consistency**: The subject's semester must match the assignment's semester
3. **Role Requirements**: Only users with role 'teacher' or 'hod' can have assignments
4. **No Duplicates**: Cannot create identical assignments (same subject, batch, semester, and sections)
5. **Sections Array**: Must provide at least one section

### Assignment Deletion Rules

1. **Faculty Verification**: User must exist and have role 'teacher' or 'hod'
2. **Assignment Exists**: Assignment ID must exist in the teacher's assignments array
3. **Clean Removal**: Uses Mongoose `.pull()` for safe subdocument removal

## Dependencies

### Internal
- `User` model - For querying and updating teacher/HOD records
- `Subject` model - For validating subject existence and semester
- `express-async-handler` - For async error handling

### External
- `express` - Routing
- `joi` - Validation
- `mongoose` - Database operations

## Error Handling

All controller methods use `express-async-handler` to catch async errors automatically. Errors are passed to the global error middleware.

Service layer throws descriptive errors that are caught and formatted by the controller/middleware.

## Usage Example

```javascript
// Create a new assignment
const response = await fetch('/api/admin/teacher-assignments/507f1f77bcf86cd799439011', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <admin-token>'
  },
  body: JSON.stringify({
    subject: '507f1f77bcf86cd799439022',
    sections: ['A', 'B'],
    batch: 2021,
    semester: 3
  })
});

// Delete an assignment
const deleteResponse = await fetch(
  '/api/admin/teacher-assignments/507f1f77bcf86cd799439011/507f1f77bcf86cd799439099',
  {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer <admin-token>'
    }
  }
);
```

## Testing Considerations

When testing this sub-domain:
1. Ensure subject exists before creating assignment
2. Verify semester matching between subject and assignment
3. Test duplicate prevention (identical assignments)
4. Test both teacher and HOD roles
5. Verify assignment deletion with valid/invalid IDs
6. Test validation errors (invalid ObjectIds, missing fields, out-of-range semester)
7. Verify populated subject details in response

## Integration Notes

- **Parent Router**: Mounted at `/api/admin/teacher-assignments` by admin parent router
- **Middleware**: Requires `protect` and `isAdmin` middleware from parent
- **Related Domains**: Works with `subjects` sub-domain for subject validation

## Future Enhancements

- Batch assignment creation (assign multiple subjects at once)
- Assignment history tracking
- Conflict detection (same teacher, same time slot)
- Assignment templates by department
- Bulk assignment deletion
- Assignment transfer between teachers
- Workload calculation based on assignments
