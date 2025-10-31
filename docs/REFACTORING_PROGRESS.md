# Phase 0 Architecture Refactoring Progress

This document tracks the progress of refactoring the Eagle Campus backend from the current feature-based architecture to the new domain-driven Phase 0 architecture.

## Refactoring Status

### ✅ Completed

#### Foundation (Step 1)
- [x] Created `src/api/_common/` directory structure
- [x] Moved and refactored all middleware to `src/api/_common/middleware/`
  - `auth.middleware.js` - JWT authentication
  - `rbac.middleware.js` - Role-based access control (renamed from `role.middleware.js`)
  - `error.middleware.js` - Global error handler
  - `quota.middleware.js` - Storage quota enforcement (renamed from `storage.middleware.js`)
  - `rateLimit.middleware.js` - Rate limiting (renamed from `rateLimiter.middleware.js`)
  - `aiLimit.middleware.js` - AI generation limits (renamed from `checkAIDailyLimit.js`)
  - `file.middleware.js` - Multer configurations
- [x] Created `src/api/_common/http/` utilities
  - `asyncHandler.js` - Async route handler wrapper
  - `pagination.js` - Pagination helpers
- [x] Created `src/api/_common/utils/` utilities
  - `objectId.js` - MongoDB ObjectId validation
  - `sanitize.js` - Input sanitization
  - `caching.js` - In-memory cache wrapper
- [x] Refactored S3 service to `src/services/s3/`
  - `s3.service.js` - S3 operations with new structured API
  - `keybuilder.js` - Structured key generation ({env}/{context}/{ownerId}/{yyyy}/{mm}/{uuid})
- [x] Created `src/routes/index.js` - Central route registry
- [x] Documented `_common/` with comprehensive README
- [x] Documented S3 service with API reference and migration guide

### 🔄 In Progress

None currently.

### 📋 Pending

#### Domain Modules (Steps 2-N)

The following domains need to be refactored according to the Phase 0 architecture pattern:

1. **Files Module** (`src/api/files/`)
   - Move to new structure with routes/, controllers/, services/, validators/, policies/
   - Split into personal file operations only
   - Remove sharing logic (move to shares module)
   - Update imports to use new `_common/` and S3 service

2. **Shares Module** (`src/api/shares/`) - NEW
   - Create new module for all file sharing (FileShare model)
   - Includes public links, direct user share, class share
   - Move public.controller.js logic here

3. **Trash Module** (`src/api/trash/`) - NEW
   - Centralize soft-delete, restore, purge operations
   - Admin hard-delete functionality

4. **Academics Module** (`src/api/academics/`) - NEW
   - Materials listing backed by admin-owned folders/files
   - Context: 'academic_material'

5. **Assignments Module** (`src/api/assignments/`) - NEW
   - Assignment definition and management
   - Student submission workflows
   - Workspace service for permission flips

6. **Attendance Module** (`src/api/attendance/`) - NEW
   - New endpoints for AttendanceRecord model
   - Deprecate embedded records in ClassSession

7. **Admin Module** (`src/api/admin/`)
   - Refactor existing admin routes to new pattern
   - Keep existing sub-routes structure

8. **Users Module** (`src/api/users/`)
   - Refactor existing user routes
   - Add validators and policies

9. **Auth Module** (`src/api/auth/`)
   - Refactor existing auth routes
   - Add validators

10. **AI Module** (`src/api/ai/`)
    - Refactor existing AI routes
    - Add validators and policies

11. **Chat Module** (`src/api/chat/`)
    - Refactor existing chat/messaging routes
    - Split REST and Socket.IO logic

12. **Tasks Module** (`src/api/tasks/`)
    - Refactor existing task management routes
    - Add validators

13. **College Module** (`src/api/college/`)
    - Refactor student, teacher, subject routes
    - May split into separate modules

14. **Search Module** (`src/api/search/`) - NEW
    - Full-text search for personal files
    - Respects isDeleted flag

15. **Audit Module** (`src/api/audit/`) - NEW (Optional)
    - Append-only logging API
    - Admin viewing interface

## Migration Checklist (Per Domain)

When refactoring each domain, follow this checklist:

- [ ] Create domain directory with subdirectories (routes/, controllers/, services/, validators/, policies/)
- [ ] Move existing route files to new structure
- [ ] Move existing controller logic to new controllers/
- [ ] Extract business logic into services/
- [ ] Create Joi validators for all endpoints
- [ ] Create policy functions for authorization checks
- [ ] Update all imports to use new paths:
  - [ ] Update middleware imports to `../../_common/middleware/`
  - [ ] Update S3 service imports to `../../../services/s3/`
  - [ ] Update utility imports to `../../_common/utils/`
- [ ] Add new routes to `src/routes/index.js`
- [ ] Test all endpoints
- [ ] Create domain README.md
- [ ] Remove old files from `src/api/<old-path>/`

## Import Path Changes

### Middleware

```javascript
// OLD
import { protect } from '../middleware/auth.middleware.js';
import { isAdmin } from '../middleware/role.middleware.js';

// NEW
import { protect } from '../_common/middleware/auth.middleware.js';
import { isAdmin } from '../_common/middleware/rbac.middleware.js';
```

### S3 Service

```javascript
// OLD
import { uploadFile, getSignedUrl } from '../services/s3.service.js';

// NEW
import { uploadFile, getDownloadUrl, getPreviewUrl } from '../../services/s3/s3.service.js';
```

### Utilities

```javascript
// NEW (previously not available)
import asyncHandler from '../_common/http/asyncHandler.js';
import { extractPaginationParams } from '../_common/http/pagination.js';
import { isValidObjectId } from '../_common/utils/objectId.js';
import cache from '../_common/utils/caching.js';
```

## File Structure Reference

### Old Structure (Current)
```
src/
├── api/
│   ├── <feature>/
│   │   ├── <feature>.controller.js
│   │   └── <feature>.routes.js
├── middleware/
├── services/
└── models/
```

### New Structure (Phase 0)
```
src/
├── api/
│   ├── _common/                    # NEW - Shared components
│   │   ├── middleware/
│   │   ├── http/
│   │   └── utils/
│   ├── <domain>/                   # Refactored domain modules
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── validators/
│   │   ├── policies/
│   │   ├── mappers/               # Optional
│   │   └── README.md
├── services/
│   ├── s3/                        # NEW - Refactored with keybuilder
│   ├── logger/                    # TODO
│   ├── mailer/
│   └── jobs/                      # TODO
├── routes/
│   └── index.js                   # NEW - Central route registry
└── models/
```

## Key Architectural Changes

### 1. Structured S3 Keys
All new file uploads use structured keys:
- Format: `{env}/{context}/{ownerId}/{yyyy}/{mm}/{uuid}.{ext}`
- Enables lifecycle policies, better organization
- Context-aware (personal, academic_material, assignment_submission)

### 2. Context Enforcement
Files are categorized by context:
- `personal` - User's personal files
- `academic_material` - System-owned course materials
- `assignment_submission` - Student assignment work

### 3. Separation of Concerns
- **Controllers**: Request/response handling only
- **Services**: Business logic and orchestration
- **Validators**: Joi schemas for input validation
- **Policies**: Authorization logic
- **Mappers**: Response formatting (optional)

### 4. Shared Middleware
All cross-cutting concerns moved to `_common/`:
- Authentication, authorization
- Rate limiting, quota enforcement
- Error handling
- File upload configurations

### 5. Central Route Registry
All routes mounted via `src/routes/index.js` instead of scattered in `server.js`

## Testing Strategy

For each refactored domain:
1. Test all endpoints with Postman/Insomnia
2. Verify authentication/authorization
3. Check quota enforcement for file operations
4. Test error handling
5. Verify S3 operations (upload/download/delete)
6. Test pagination on list endpoints
7. Verify caching behavior

## Documentation Requirements

Each domain module should have:
- README.md with API documentation
- Examples of common operations
- Migration notes from old structure
- List of validators and policies

## Next Steps

1. Choose first domain to refactor (recommended: **Files Module**)
2. Follow migration checklist
3. Test thoroughly
4. Update this document
5. Move to next domain

## Notes

- Old middleware files remain in `src/middleware/` for backwards compatibility
- They should be removed once all domains are refactored
- Old `src/services/s3.service.js` remains until all usages are updated
- Test each domain refactoring in isolation before moving to the next

---

Last Updated: 2025-10-31
