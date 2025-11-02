# Applications Sub-Domain

## Overview

The Applications sub-domain manages student application reviews and approvals. It handles the workflow of students applying for student role verification, allowing administrators to approve or reject applications.

## Architecture

This sub-domain follows the Phase 0 architecture pattern:

```
applications/
├── routes/
│   └── applications.routes.js      # Route definitions with validation
├── controllers/
│   └── applications.controller.js  # Thin HTTP request handlers
├── services/
│   └── applications.service.js     # Business logic layer
├── validators/
│   └── applications.validator.js   # Joi validation schemas
└── README.md                        # This file
```

## Features

- **View Pending Applications**: List all student applications awaiting review
- **Approve Applications**: Approve student applications and grant student role
- **Reject Applications**: Reject student applications and clear student details
- **Email Notifications**: Automatic email notifications on approval

## API Endpoints

### 1. Get Pending Applications

**Endpoint**: `GET /api/admin/applications`

**Description**: Retrieve all student applications with pending status

**Authorization**: Admin only

**Response**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "studentDetails": {
        "applicationStatus": "pending",
        "usn": "1MS21CS001",
        "batch": "2021-2025",
        "section": "A"
      }
    }
  ]
}
```

### 2. Review Application

**Endpoint**: `PATCH /api/admin/applications/:userId/review`

**Description**: Approve or reject a student application

**Authorization**: Admin only

**Request Parameters**:
- `userId` (URL param): MongoDB ObjectId of the user

**Request Body**:
```json
{
  "action": "approve" // or "reject"
}
```

**Validation Rules**:
- `action`: Required, must be either "approve" or "reject"
- `userId`: Required, must be a valid MongoDB ObjectId (24 hex characters)

**Response (Approval)**:
```json
{
  "success": true,
  "data": {
    "message": "Application approved successfully",
    "userId": "507f1f77bcf86cd799439011",
    "role": "student",
    "applicationStatus": "approved"
  }
}
```

**Response (Rejection)**:
```json
{
  "success": true,
  "data": {
    "message": "Application rejected successfully",
    "userId": "507f1f77bcf86cd799439011",
    "role": "user",
    "applicationStatus": "rejected"
  }
}
```

## Business Logic

### Application Approval Flow

When an application is **approved**:
1. User's `role` is changed to `"student"`
2. `studentDetails.applicationStatus` is set to `"approved"`
3. `studentDetails.isStudentVerified` is set to `true`
4. An approval email is sent asynchronously (non-blocking)
5. Student details (USN, batch, section) are preserved

### Application Rejection Flow

When an application is **rejected**:
1. `studentDetails.applicationStatus` is set to `"rejected"`
2. `studentDetails.usn` is cleared (set to `null`)
3. `studentDetails.batch` is cleared (set to `null`)
4. `studentDetails.section` is cleared (set to `null`)
5. User's `role` remains `"user"`

### Email Notifications

On approval, an email is automatically sent to the student using:
- **Template**: `studentApplicationApproved.html`
- **Subject**: "Student Application Approved"
- **Data**: Student name and login URL
- **Error Handling**: Email failures are logged but don't block the approval process

## Data Models

### User Model (studentDetails subdocument)

```javascript
{
  role: String,                                    // 'user' or 'student'
  studentDetails: {
    applicationStatus: String,                     // 'pending', 'approved', 'rejected'
    isStudentVerified: Boolean,                    // true after approval
    usn: String,                                   // University Seat Number
    batch: String,                                 // e.g., "2021-2025"
    section: String                                // e.g., "A", "B"
  }
}
```

## Validation

This sub-domain uses **Joi** for validation:

### Review Application Validation
- `action`: Must be string, either "approve" or "reject", required
- `userId`: Must match MongoDB ObjectId pattern (24 hex chars), required

### Error Responses

**Validation Errors** (400):
```json
{
  "message": "Action must be either \"approve\" or \"reject\""
}
```

**Business Logic Errors** (500 or custom):
```json
{
  "message": "User not found"
}
```

```json
{
  "message": "Application has already been reviewed"
}
```

## Dependencies

### Internal
- `User` model - For querying and updating user records
- `emailTemplate` utility - For populating email templates
- `email.service` - For sending emails
- `express-async-handler` - For async error handling

### External
- `express` - Routing
- `joi` - Validation

## Environment Variables

- `FRONTEND_URL` - Used in approval email for login link (defaults to `http://localhost:3000`)

## Error Handling

All controller methods use `express-async-handler` to catch async errors automatically. Errors are passed to the global error middleware.

## Usage Example

```javascript
// Approve an application (browser clients)
// Use the central apiClient (axios) configured with `withCredentials: true` so the httpOnly `jwt` cookie is sent automatically.
const response = await apiClient.patch('/api/admin/applications/507f1f77bcf86cd799439011/review', { action: 'approve' });

// Get pending applications (browser)
const applications = await apiClient.get('/api/admin/applications');

// If you must use fetch(), ensure credentials are included so the cookie is sent:
// fetch('/api/admin/applications', { credentials: 'include' })
```

## Auth & Session (notes for implementers)

- Browser sessions use an httpOnly cookie named `jwt` as the authoritative credential. Do not rely on client-side access to the token. Frontend code should use a central `apiClient` configured with `withCredentials: true` or `fetch(..., { credentials: 'include' })`.
- Server middleware (canonical) lives under `src/api/_common/middleware/` (use `protect` and role-checking middleware from there). Legacy shims remain under `src/middleware/` and emit deprecation warnings.
- This sub-domain should write audit events for approval/rejection actions using the `_common` audit service (e.g., `logAudit`) so admin actions are traceable.

## Testing Considerations

When testing this sub-domain:
1. Ensure user exists before reviewing application
2. Verify application is in `pending` state before review
3. Test both approval and rejection flows
4. Verify email sending doesn't block response (async)
5. Test validation errors (invalid action, invalid userId format)
6. Test idempotency (reviewing already-reviewed application)

## Future Enhancements

- Batch approval/rejection
- Application comments/notes
- Application history tracking
- Notification to student on rejection
- Re-application workflow
- Application expiry after X days
