# Users Module

This module handles all user profile management, authentication-related user operations, and student applications.

## Directory Structure

```
users/
├── routes/
│   └── users.routes.js          # Route definitions with validators
├── controllers/
│   └── users.controller.js      # Request/response handlers (thin layer)
├── services/
│   └── users.service.js         # Business logic and database operations
├── validators/
│   └── users.validators.js      # Joi validation schemas
├── policies/
│   └── users.policies.js        # Authorization policies
└── README.md
```

## Features

### Profile Management
- Get current user profile
- Update profile (name, bio, preferences)
- Change password
- Update avatar
- View storage usage

### User Discovery
- Get list of discoverable users
- Privacy controls via preferences

### Student Applications
- Submit student application
- Application validation
- Email notifications

## API Endpoints

### GET /api/users/me
Get current user's full profile

**Authentication:** Required  
**Authorization:** Self only

**Response:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "avatar": "https://...",
  "bio": "Software developer",
  "preferences": {
    "theme": "dark",
    "isDiscoverable": true,
    "canRecieveMessages": true,
    "canRecieveFiles": true
  },
  "studentDetails": {
    "applicationStatus": "not_applied"
  },
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### PUT /api/users/me
Update current user's profile

**Authentication:** Required  
**Authorization:** Self only

**Request Body:**
```json
{
  "name": "John Doe",
  "bio": "Full-stack developer",
  "preferences": {
    "theme": "dark",
    "isDiscoverable": false
  }
}
```

**Validation:**
- `name`: 2-50 characters (optional)
- `bio`: max 250 characters (optional)
- `preferences.theme`: "light" or "dark" (optional)
- `preferences.isDiscoverable`: boolean (optional)
- `preferences.canRecieveMessages`: boolean (optional)
- `preferences.canRecieveFiles`: boolean (optional)

### PUT /api/users/password
Change user password

**Authentication:** Required  
**Authorization:** Self only

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

**Response:**
```json
{
  "message": "Password updated successfully"
}
```

### PUT /api/users/me/avatar
Update user avatar

**Authentication:** Required  
**Authorization:** Self only

**Request:** Multipart form-data
- Field name: `avatar`
- File type: Image only
- Max size: 5MB

**Response:**
```json
{
  "avatar": "https://bucket.s3.region.amazonaws.com/production/avatars/507f1f77bcf86cd799439011.jpg"
}
```

### GET /api/users/discoverable
Get list of discoverable users

**Authentication:** Required  
**Authorization:** Verified users only

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Jane Smith",
    "avatar": "https://...",
    "bio": "Teacher"
  }
]
```

**Filters:**
- Only verified users
- Only users with `preferences.isDiscoverable = true`
- Excludes current user

### POST /api/users/apply-student
Submit student application

**Authentication:** Required  
**Authorization:** Basic users only (role: 'user')

**Request Body:**
```json
{
  "usn": "1CR20CS001",
  "section": "A",
  "batch": 2020,
  "semester": 3
}
```

**Validation:**
- `usn`: Required, must be unique among approved students
- `section`: Must be 'A', 'B', or 'C'
- `batch`: Year between 2000-2100
- `semester`: Number between 1-8

**Response:** Updated user object with pending application

**Side Effects:**
- Sends confirmation email
- Sets `applicationStatus` to 'pending'

### GET /api/users/me/storage
Get storage usage and quota

**Authentication:** Required  
**Authorization:** Self only

**Response:**
```json
{
  "usageBytes": 10485760,
  "quotaBytes": 52428800,
  "fileCount": 15,
  "fileLimit": 20,
  "usagePercent": 20
}
```

**Quota by Role:**
- `user`: 20 files, 50MB
- `student`: 50 files, 200MB
- `teacher`: 100 files, 500MB
- `hod`: Unlimited
- `admin`: Unlimited

## Validators

### updateProfileSchema
Validates profile update requests

**Fields:**
- `name`: String, 2-50 characters
- `bio`: String, max 250 characters, can be empty
- `preferences`: Object with theme, discovery, and messaging settings

### changePasswordSchema
Validates password change requests

**Fields:**
- `currentPassword`: Required
- `newPassword`: Must match password pattern
- `confirmPassword`: Must match newPassword

### studentApplicationSchema
Validates student application requests

**Fields:**
- `usn`: Required, string
- `section`: Required, 'A', 'B', or 'C'
- `batch`: Required, integer year
- `semester`: Required, 1-8

## Policies

### isSelf
Ensures user can only access their own resources

**Use Cases:**
- Profile updates
- Password changes
- Avatar updates

### canApplyAsStudent
Checks if user is eligible to submit a student application

**Conditions:**
- User role must be 'user' (not already student/teacher/admin)
- No pending application
- Not already approved

### isVerified
Ensures user has verified their email

**Use Cases:**
- User discovery
- Messaging features

### isActive
Ensures user account is active (not banned/deactivated)

**Use Cases:**
- All authenticated routes

## Service Layer

### getUserProfile(userId)
Retrieves complete user profile data

**Returns:** User object with safe fields (no password)

### updateUserProfile(userId, updates)
Updates user profile fields

**Logic:**
- Merges preferences instead of replacing
- Validates data before update
- Returns updated profile

### changeUserPassword(userId, currentPassword, newPassword)
Changes user password with security checks

**Logic:**
- Verifies current password
- Hashes new password with bcrypt
- Updates password reset timestamp
- Resets login attempt counters

### getDiscoverableUsers(currentUserId)
Gets list of users available for discovery

**Filters:**
- Discoverable preference enabled
- Email verified
- Excludes current user

### updateAvatar(userId, file)
Updates user avatar, handling S3 operations

**Logic:**
- Deletes old avatar from S3
- Uploads new avatar with structured key
- Updates user document
- Returns new avatar URL

### submitStudentApplication(userId, applicationData)
Processes student application submission

**Logic:**
- Validates USN uniqueness
- Updates user document
- Sends confirmation email (async)
- Returns updated user

### getStorageUsage(userId, userRole)
Calculates storage usage and quota information

**Logic:**
- Aggregates file sizes and counts
- Gets role-based quota
- Calculates usage percentage
- Returns detailed storage info

## Error Handling

All errors are handled by the global error handler. Service layer throws descriptive errors with optional `statusCode` property.

**Common Errors:**
- `400`: Validation errors, business logic errors
- `401`: Incorrect password
- `403`: Unauthorized access, account not active
- `404`: User not found

## Usage Examples

### Update Profile
```javascript
import { updateUserProfile } from '../services/users.service.js';

const updatedUser = await updateUserProfile(userId, {
    name: 'New Name',
    bio: 'Updated bio',
    preferences: {
        theme: 'dark'
    }
});
```

### Change Password
```javascript
import { changeUserPassword } from '../services/users.service.js';

await changeUserPassword(userId, 'OldPass123!', 'NewPass123!');
// Throws error if current password is incorrect
```

### Upload Avatar
```javascript
import { updateAvatar } from '../services/users.service.js';

const avatarUrl = await updateAvatar(userId, req.file);
// Handles S3 upload and cleanup
```

## Testing

### Test Routes
```bash
# Get profile
GET /api/users/me

# Update profile
PUT /api/users/me
{
  "name": "Test User",
  "bio": "Test bio"
}

# Change password
PUT /api/users/password
{
  "currentPassword": "Test123!",
  "newPassword": "NewTest123!",
  "confirmPassword": "NewTest123!"
}

# Get discoverable users
GET /api/users/discoverable

# Submit student application
POST /api/users/apply-student
{
  "usn": "1CR20CS001",
  "section": "A",
  "batch": 2020,
  "semester": 3
}

# Get storage info
GET /api/users/me/storage
```

## Dependencies

### Internal
- `User` model (`../../models/userModel.js`)
- `File` model (`../../models/fileModel.js`)
- S3 service (`../../services/s3/s3.service.js`)
- Email service (`../../services/email.service.js`)
- Email template utility (`../../utils/emailTemplate.js`)

### Common Middleware
- `protect` - Authentication
- `uploadAvatar` - File upload
- `QUOTAS` - Storage quotas

### External
- `bcryptjs` - Password hashing
- `joi` - Validation
- `express` - Routing

## Security Notes

1. **Password Hashing:** All passwords hashed with bcrypt (salt rounds: 10)
2. **Password Reset:** Timestamps tracked, login attempts reset on password change
3. **Avatar Cleanup:** Old avatars automatically deleted from S3
4. **Email Validation:** Enforced at model level
5. **Role-Based Access:** Student applications restricted to 'user' role
6. **Account Status:** Active account check on all routes

## Future Enhancements

- [ ] Profile picture cropping/resizing
- [ ] Email change with verification
- [ ] Account deletion
- [ ] Two-factor authentication
- [ ] Password history (prevent reuse)
- [ ] Session management
- [ ] Activity log
- [ ] Bulk user operations (admin)

---

**Status:** ✅ Refactored to Phase 0 architecture  
**Last Updated:** October 31, 2025
