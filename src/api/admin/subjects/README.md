# Subjects Sub-Domain

## Overview

The Subjects sub-domain manages academic subjects/courses in the system. It provides comprehensive CRUD operations for subjects with automatic cascading updates to remove stale references when subjects are modified or deleted. This ensures data integrity across teacher assignments and student enrollments.

## Architecture

This sub-domain follows the Phase 0 architecture pattern:

```
subjects/
├── routes/
│   └── subjects.routes.js      # Route definitions with validation
├── controllers/
│   └── subjects.controller.js  # Thin HTTP request handlers
├── services/
│   └── subjects.service.js     # Business logic with cascading operations
├── validators/
│   └── subjects.validator.js   # Joi validation schemas
├── index.js                     # Entry point
└── README.md                    # This file
```

## Features

- **Create Subjects**: Add new subjects with unique subject codes
- **List Subjects**: Get all subjects with optional semester filtering
- **Get Subject Details**: Retrieve single subject by ID
- **Update Subjects**: Modify subject details with automatic cascade handling
- **Delete Subjects**: Remove subjects with automatic cleanup of all references
- **Data Integrity**: Automatic removal from teacher assignments and student enrollments

## API Endpoints

### 1. Create Subject

**Endpoint**: `POST /api/admin/subjects`

**Description**: Create a new subject

**Authorization**: Admin only

**Request Body**:
```json
{
  "name": "Data Structures",
  "subjectCode": "CS301",
  "semester": 3,
  "department": "Computer Science"
}
```

**Validation Rules**:
- `name`: Required non-empty string
- `subjectCode`: Required non-empty string (must be unique)
- `semester`: Required integer between 1 and 4
- `department`: Required non-empty string

**Response (Success - 201)**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Data Structures",
    "subjectCode": "CS301",
    "semester": 3,
    "department": "Computer Science",
    "createdAt": "2025-10-31T10:00:00.000Z",
    "updatedAt": "2025-10-31T10:00:00.000Z"
  }
}
```

**Business Logic**:
- Validates subject code uniqueness
- Creates new subject document

### 2. Get All Subjects

**Endpoint**: `GET /api/admin/subjects`

**Description**: Retrieve all subjects with optional semester filter

**Authorization**: Admin only

**Query Parameters**:
- `semester` (optional): Integer between 1 and 4 to filter by semester

**Examples**:
- Get all subjects: `GET /api/admin/subjects`
- Get semester 3 subjects: `GET /api/admin/subjects?semester=3`

**Response (Success - 200)**:
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Data Structures",
      "subjectCode": "CS301",
      "semester": 3,
      "department": "Computer Science"
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Operating Systems",
      "subjectCode": "CS302",
      "semester": 3,
      "department": "Computer Science"
    }
  ]
}
```

### 3. Get Subject by ID

**Endpoint**: `GET /api/admin/subjects/:id`

**Description**: Retrieve a single subject by its ID

**Authorization**: Admin only

**Request Parameters**:
- `id` (URL param): MongoDB ObjectId of the subject

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Data Structures",
    "subjectCode": "CS301",
    "semester": 3,
    "department": "Computer Science",
    "createdAt": "2025-10-31T10:00:00.000Z",
    "updatedAt": "2025-10-31T10:00:00.000Z"
  }
}
```

### 4. Update Subject

**Endpoint**: `PUT /api/admin/subjects/:id`

**Description**: Update a subject's details with automatic cascading

**Authorization**: Admin only

**Request Parameters**:
- `id` (URL param): MongoDB ObjectId of the subject

**Request Body** (at least one field required):
```json
{
  "name": "Advanced Data Structures",
  "semester": 4
}
```

**Validation Rules**:
- `name`: Optional string
- `subjectCode`: Optional string
- `semester`: Optional integer between 1 and 4
- `department`: Optional string
- **At least one field must be provided**

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Advanced Data Structures",
    "subjectCode": "CS301",
    "semester": 4,
    "department": "Computer Science",
    "updatedAt": "2025-10-31T11:00:00.000Z"
  }
}
```

**Business Logic - Semester Change Cascade**:

**CRITICAL**: When a subject's semester is changed, the system automatically:

1. **Removes from Teacher Assignments**: All teacher assignments for this subject are removed from all teachers
2. **Removes from Student Enrollments**: All student enrollments for this subject are removed from all students

This prevents data inconsistency where:
- A teacher is assigned to teach a semester 3 subject but the subject is now in semester 4
- A student is enrolled in a semester 3 subject but they're currently in semester 2

**Example Cascade**:
```
Before: Subject "CS301" is semester 3
- Teacher A assigned to teach CS301 (semester 3)
- Student B enrolled in CS301 (semester 3)

Admin updates: CS301 semester → 4

After: Subject "CS301" is semester 4
- Teacher A: Assignment removed (automatic)
- Student B: Enrollment removed (automatic)
- Admin must re-assign teacher and re-enroll student if needed
```

### 5. Delete Subject

**Endpoint**: `DELETE /api/admin/subjects/:id`

**Description**: Delete a subject and remove all references to it

**Authorization**: Admin only

**Request Parameters**:
- `id` (URL param): MongoDB ObjectId of the subject

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "message": "Subject and all its associations removed successfully."
  }
}
```

**Business Logic - Deletion Cascade**:

When a subject is deleted, the system automatically:

1. **Removes from ALL Teacher Assignments**: Scans all users with teacher/HOD role and removes assignments referencing this subject
2. **Removes from ALL Student Enrollments**: Scans all students and removes this subject from their enrolledSubjects array

This ensures no orphaned references remain in the database.

## Data Models

### Subject Model

```javascript
{
  _id: ObjectId,
  name: String,                              // Subject name
  subjectCode: String,                       // Unique subject code
  semester: Number,                          // 1-4
  department: String,                        // Department name
  createdAt: Date,                           // Auto-generated
  updatedAt: Date                            // Auto-generated
}
```

### Related Models Affected by Cascading

**User Model - Teacher Details**:
```javascript
{
  teacherDetails: {
    assignments: [
      {
        subject: ObjectId,                   // Reference to Subject - removed on cascade
        sections: [String],
        batch: Number,
        semester: Number
      }
    ]
  }
}
```

**User Model - Student Details**:
```javascript
{
  studentDetails: {
    enrolledSubjects: [ObjectId],            // References to Subject - removed on cascade
    semester: Number
  }
}
```

## Validation

This sub-domain uses **Joi** for validation:

### Create Subject Validation
- `name`: Required non-empty string
- `subjectCode`: Required non-empty string
- `semester`: Required integer, 1-4
- `department`: Required non-empty string

### Update Subject Validation
- All fields optional
- At least one field must be provided
- `semester`: If provided, must be integer 1-4
- `id`: Must be valid MongoDB ObjectId (24 hex characters)

### Query Validation
- `semester`: Optional integer, 1-4

## Error Responses

**Validation Errors** (400):
```json
{
  "message": "Subject code is required"
}
```

```json
{
  "message": "Semester must be between 1 and 4"
}
```

```json
{
  "message": "At least one field must be provided to update"
}
```

**Business Logic Errors** (400):
```json
{
  "message": "Subject with code CS301 already exists."
}
```

**Not Found Errors** (404):
```json
{
  "message": "Subject not found."
}
```

## Business Rules

### Subject Creation Rules

1. **Unique Subject Code**: Subject codes must be unique across all subjects
2. **Semester Range**: Semester must be between 1 and 4
3. **Required Fields**: All fields (name, subjectCode, semester, department) are required

### Subject Update Rules

1. **Semester Change Impact**: Changing semester triggers cascading removal
2. **At Least One Field**: Must provide at least one field to update
3. **Preservation**: Fields not provided in update remain unchanged

### Subject Deletion Rules

1. **Cascading Cleanup**: Automatically removes from all teacher assignments
2. **Cascading Cleanup**: Automatically removes from all student enrollments
3. **No Rollback**: Deletion is permanent (no soft delete)

### Cascading Operation Details

**On Semester Change**:
```javascript
// Remove from teacher assignments
await User.updateMany(
  { 'teacherDetails.assignments.subject': subjectId },
  { $pull: { 'teacherDetails.assignments': { subject: subjectId } } }
);

// Remove from student enrollments
await User.updateMany(
  { 'studentDetails.enrolledSubjects': subjectId },
  { $pull: { 'studentDetails.enrolledSubjects': subjectId } }
);
```

**On Deletion**:
```javascript
// Remove from ALL teacher assignments (all users)
await User.updateMany(
  {},
  { $pull: { 'teacherDetails.assignments': { subject: subjectId } } }
);

// Remove from ALL student enrollments
await User.updateMany(
  { 'studentDetails.enrolledSubjects': subjectId },
  { $pull: { 'studentDetails.enrolledSubjects': subjectId } }
);
```

## Dependencies

### Internal
- `Subject` model - For CRUD operations
- `User` model - For cascading updates to teachers and students
- `express-async-handler` - For async error handling

### External
- `express` - Routing
- `joi` - Validation
- `mongoose` - Database operations

## Error Handling

All controller methods use `express-async-handler` to catch async errors automatically. Service layer throws descriptive errors that are caught and formatted by the controller/middleware.

Cascading operations are performed synchronously to ensure data consistency before responding to the client.

## Usage Examples
```javascript
// Using a central apiClient (axios) configured with `withCredentials: true`
// Example apiClient (defined elsewhere):
// const apiClient = axios.create({ baseURL: '/api', withCredentials: true });

// Create a new subject
const createResponse = await apiClient.post('/admin/subjects', {
  name: 'Data Structures',
  subjectCode: 'CS301',
  semester: 3,
  department: 'Computer Science'
});

// Get subjects by semester
const subjects = await apiClient.get('/admin/subjects', { params: { semester: 3 } });

// Update subject
const updateResponse = await apiClient.put('/admin/subjects/507f1f77bcf86cd799439011', {
  semester: 4  // This will trigger cascade removal
});

// Delete subject
const deleteResponse = await apiClient.delete('/admin/subjects/507f1f77bcf86cd799439011');
```

## Testing Considerations

When testing this sub-domain:
1. Verify subject code uniqueness constraint
2. Test semester change triggers cascade (check teacher assignments and student enrollments removed)
3. Test subject deletion removes all references
4. Verify at least one field required for updates
5. Test semester range validation (1-4)
6. Verify cascade operations don't fail silently
7. Test filtering by semester query parameter

## Integration Notes

- **Parent Router**: Mounted at `/api/admin/subjects` by admin parent router
- **Middleware**: Requires `protect` and `isAdmin` middleware from parent
- **Related Domains**:
  - Works with `teacher-assignments` for assignment validation
  - Works with `management` for enrollment validation
  - Affects `reports` when subject data changes

## Auth & Session (cookie-first)

- Browser sessions use an httpOnly cookie named `jwt` set by the server. The cookie is authoritative; clients must not read or forward the raw JWT value from JavaScript.
- Server middleware precedence: cookie.jwt -> Authorization header (for non-browser clients) -> body token. Use the canonical middleware from `src/api/_common/middleware` (import `protect`, `isAdmin`/RBAC helpers).
- Client examples below use a central `apiClient` configured with `withCredentials: true`. If using fetch directly, include `credentials: 'include'`.


## Performance Considerations

**Cascading Operations**:
- Update/delete operations scan all users to remove subject references
- For large databases, consider:
  - Adding indexes on `teacherDetails.assignments.subject` and `studentDetails.enrolledSubjects`
  - Using background jobs for cleanup (not blocking)
  - Implementing soft delete with scheduled cleanup

**Current Implementation**:
- Cascading is synchronous and blocking
- Ensures immediate data consistency
- May take longer for large datasets

## Future Enhancements

- Soft delete with archive functionality
- Transaction support for atomic cascading
- Background job queue for large-scale cascades
- Subject history tracking
- Subject duplication for quick setup
- Batch subject import/export
- Subject prerequisites/dependencies
- Credit hours and grading schemes
- Subject categories/tags
- Course syllabus attachment
