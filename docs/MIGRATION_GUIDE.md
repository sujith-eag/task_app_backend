# Phase 0 Foundation - Migration Guide

## Overview

This document provides a comprehensive guide for the foundation refactoring completed in Step 1 of the Phase 0 architecture migration.

## What Was Completed

### 1. Common Middleware Directory (`src/api/_common/`)

All shared middleware, utilities, and HTTP helpers have been moved to a central location:

```
src/api/_common/
├── middleware/          # All Express middleware
├── http/                # HTTP utilities (asyncHandler, pagination)
└── utils/               # General utilities (objectId, sanitize, caching)
```

### 2. Refactored S3 Service (`src/services/s3/`)

The S3 service has been completely refactored with:
- **Structured key generation** with environment, context, and time hierarchy
- **Separate functions** for download URLs vs preview URLs
- **Key builder utility** for consistent key generation
- **Better upload API** requiring context and ownerId

### 3. Central Route Registry (`src/routes/index.js`)

A new centralized route mounting system that will replace the scattered route mounts in `server.js`.

## Files Created

### Middleware Files
- ✅ `src/api/_common/middleware/auth.middleware.js` (moved from `src/middleware/`)
- ✅ `src/api/_common/middleware/rbac.middleware.js` (renamed from `role.middleware.js`)
- ✅ `src/api/_common/middleware/error.middleware.js` (moved)
- ✅ `src/api/_common/middleware/quota.middleware.js` (renamed from `storage.middleware.js`, enhanced)
- ✅ `src/api/_common/middleware/rateLimit.middleware.js` (renamed from `rateLimiter.middleware.js`)
- ✅ `src/api/_common/middleware/aiLimit.middleware.js` (renamed from `checkAIDailyLimit.js`)
- ✅ `src/api/_common/middleware/file.middleware.js` (moved)

### HTTP Utilities
- ✅ `src/api/_common/http/asyncHandler.js` (new - async error wrapper)
- ✅ `src/api/_common/http/pagination.js` (new - pagination helpers)

### General Utilities
- ✅ `src/api/_common/utils/objectId.js` (new - MongoDB ID validation)
- ✅ `src/api/_common/utils/sanitize.js` (new - input sanitization)
- ✅ `src/api/_common/utils/caching.js` (new - cache wrapper)

### S3 Service
- ✅ `src/services/s3/s3.service.js` (refactored)
- ✅ `src/services/s3/keybuilder.js` (new - structured key generation)

### Routes
- ✅ `src/routes/index.js` (new - central route registry)

### Documentation
- ✅ `src/api/_common/README.md` (comprehensive middleware and utilities guide)
- ✅ `src/services/s3/README.md` (S3 service API reference and migration guide)
- ✅ `docs/REFACTORING_PROGRESS.md` (progress tracking document)

## Breaking Changes

### 1. Import Paths

All imports need to be updated when refactoring domain modules:

#### Middleware Imports
```javascript
// ❌ OLD
import { protect } from '../middleware/auth.middleware.js';
import { isAdmin, isTeacher } from '../middleware/role.middleware.js';
import { checkStorageQuota } from '../middleware/storage.middleware.js';
import { authLimiter } from '../middleware/rateLimiter.middleware.js';
import { checkAIDailyLimit } from '../middleware/checkAIDailyLimit.js';

// ✅ NEW
import { protect } from '../_common/middleware/auth.middleware.js';
import { isAdmin, isTeacher } from '../_common/middleware/rbac.middleware.js';
import { checkStorageQuota } from '../_common/middleware/quota.middleware.js';
import { authLimiter } from '../_common/middleware/rateLimit.middleware.js';
import { checkAIDailyLimit } from '../_common/middleware/aiLimit.middleware.js';
```

### 2. S3 Service API

The S3 service has a new API with structured keys:

#### Upload API Changed
```javascript
// ❌ OLD
import { uploadFile } from '../services/s3.service.js';
const s3Key = await uploadFile(req.file);

// ✅ NEW
import { uploadFile } from '../../services/s3/s3.service.js';
const s3Key = await uploadFile({
    file: req.file,
    context: 'personal', // Required: personal, academic_material, assignment_submission
    ownerId: req.user._id.toString() // Required
});
```

#### URL Generation Split
```javascript
// ❌ OLD
import { getSignedUrl } from '../services/s3.service.js';
const url = await getSignedUrl(s3Key, fileName);

// ✅ NEW - Use appropriate function
import { getDownloadUrl, getPreviewUrl } from '../../services/s3/s3.service.js';

// For files that should download (docs, archives)
const downloadUrl = await getDownloadUrl(s3Key, fileName, 60);

// For files that should preview inline (images, PDFs)
const previewUrl = await getPreviewUrl(s3Key, 60);
```

### 3. Structured S3 Keys

All new uploads generate structured keys:

```
Old format: random-hex-string
New format: production/personal/507f1f77bcf86cd799439011/2025/10/abc123.pdf
            {env}/{context}/{ownerId}/{year}/{month}/{uuid}.{ext}
```

**Migration Strategy:**
- Old keys remain valid and functional
- New uploads automatically use new format
- Update any hardcoded key parsing logic

## New Capabilities

### 1. Async Handler Wrapper

Eliminates try-catch boilerplate in route handlers:

```javascript
import asyncHandler from '../_common/http/asyncHandler.js';

// ❌ OLD - Manual error handling
router.get('/users', async (req, res, next) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// ✅ NEW - Automatic error handling
router.get('/users', asyncHandler(async (req, res) => {
    const users = await User.find();
    res.json(users);
}));
```

### 2. Pagination Helpers

Consistent pagination across all list endpoints:

```javascript
import { extractPaginationParams, getPaginationMeta } from '../_common/http/pagination.js';

const { page, limit, skip } = extractPaginationParams(req.query);
const items = await Model.find().skip(skip).limit(limit);
const total = await Model.countDocuments();

res.json({
    items,
    meta: getPaginationMeta({ page, limit, total })
});
```

### 3. ObjectId Validation

```javascript
import { isValidObjectId, toObjectId } from '../_common/utils/objectId.js';

if (!isValidObjectId(req.params.id)) {
    throw new Error('Invalid ID format');
}

const objectId = toObjectId(req.params.id, 'User ID');
```

### 4. Input Sanitization

```javascript
import { sanitizeHtml, normalizeString } from '../_common/utils/sanitize.js';

const safeContent = sanitizeHtml(req.body.content);
const email = normalizeString(req.body.email); // trim + lowercase
```

### 5. Response Caching

```javascript
import cache from '../_common/utils/caching.js';

// Check cache first
const cacheKey = `download:${fileId}`;
let url = cache.get(cacheKey);

if (!url) {
    url = await getDownloadUrl(s3Key, fileName, 60);
    cache.set(cacheKey, url, 50); // Cache for 50s (less than URL expiration)
}

res.json({ downloadUrl: url });
```

## Migration Workflow

When refactoring a domain module, follow this process:

### Step 1: Plan
1. Read `docs/phase_0_architecture.md` for the domain structure
2. Identify all existing routes, controllers, and logic
3. Plan service layer extraction

### Step 2: Create Structure
```bash
mkdir -p src/api/{domain}/routes
mkdir -p src/api/{domain}/controllers
mkdir -p src/api/{domain}/services
mkdir -p src/api/{domain}/validators
mkdir -p src/api/{domain}/policies
```

### Step 3: Update Imports
1. Change all middleware imports to `_common/`
2. Update S3 service imports and API calls
3. Add new utility imports where beneficial

### Step 4: Refactor
1. Move route files to `routes/`
2. Split controllers into smaller, focused controllers
3. Extract business logic to `services/`
4. Create Joi validators
5. Create policy functions for auth checks

### Step 5: Test
1. Test all endpoints
2. Verify authentication/authorization
3. Check quota enforcement
4. Test error handling
5. Verify S3 operations

### Step 6: Document
1. Create domain README.md
2. Update `docs/REFACTORING_PROGRESS.md`
3. Add JSDoc comments

### Step 7: Clean Up
1. Remove old files
2. Update `src/routes/index.js`
3. Update server.js (or wait until all domains are done)

## Backwards Compatibility

### Old Middleware Files
The old middleware files in `src/middleware/` still exist and should remain until ALL domains are refactored. This ensures:
- No breaking changes to existing code
- Gradual migration possible
- Easy rollback if needed

### Old S3 Service
The old `src/services/s3.service.js` should remain until all usages are updated.

### Route Mounting
Both old (in `server.js`) and new (in `src/routes/index.js`) route mounting coexist until migration is complete.

## Testing Checklist

After foundation setup, verify:

- [x] All new middleware files created and working
- [x] All HTTP utilities available and documented
- [x] All general utilities available and documented
- [x] S3 service refactored with new API
- [x] Key builder generates correct structured keys
- [x] Central route registry created
- [x] Documentation complete

## Next Domain Recommendations

Based on the Phase 0 architecture, the recommended order for domain refactoring:

1. **Files Module** - Most fundamental, affects many others
2. **Shares Module** - Depends on Files
3. **Trash Module** - Depends on Files
4. **Users Module** - Relatively independent
5. **Auth Module** - Relatively independent
6. **Tasks Module** - Relatively independent
7. **Academics Module** - New module
8. **Assignments Module** - New module, depends on Files
9. **Attendance Module** - New module
10. **Admin Module** - Complex, depends on many others
11. **College Module** - May split into multiple modules
12. **Chat Module** - Complex real-time logic
13. **AI Module** - Relatively independent
14. **Search Module** - New module
15. **Audit Module** - Optional, new module

## Common Patterns

### Protected Route with RBAC
```javascript
import { protect } from '../_common/middleware/auth.middleware.js';
import { isAdmin } from '../_common/middleware/rbac.middleware.js';
import asyncHandler from '../_common/http/asyncHandler.js';

router.delete('/:id',
    protect,
    isAdmin,
    asyncHandler(async (req, res) => {
        // Handler logic
    })
);
```

### File Upload with Quota
```javascript
import { protect } from '../_common/middleware/auth.middleware.js';
import { uploadFiles } from '../_common/middleware/file.middleware.js';
import { checkStorageQuota } from '../_common/middleware/quota.middleware.js';
import asyncHandler from '../_common/http/asyncHandler.js';

router.post('/upload',
    protect,
    uploadFiles,
    checkStorageQuota,
    asyncHandler(async (req, res) => {
        // Upload to S3 and save to DB
    })
);
```

### Paginated List
```javascript
import { protect } from '../_common/middleware/auth.middleware.js';
import { extractPaginationParams, getPaginationMeta } from '../_common/http/pagination.js';
import asyncHandler from '../_common/http/asyncHandler.js';

router.get('/',
    protect,
    asyncHandler(async (req, res) => {
        const { page, limit, skip } = extractPaginationParams(req.query);
        
        const items = await Model.find({ user: req.user._id })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });
            
        const total = await Model.countDocuments({ user: req.user._id });
        
        res.json({
            items,
            meta: getPaginationMeta({ page, limit, total })
        });
    })
);
```

## Troubleshooting

### Import Errors
**Problem:** Module not found errors after moving files

**Solution:** 
1. Count the `..` in relative paths carefully
2. Use absolute paths from `src/` as reference
3. Remember: `_common` is inside `api/`

### S3 Upload Errors
**Problem:** Missing context or ownerId

**Solution:**
```javascript
// ✅ Always provide both
const s3Key = await uploadFile({
    file: req.file,
    context: 'personal', // Don't forget!
    ownerId: req.user._id.toString() // Convert ObjectId to string
});
```

### Middleware Order
**Problem:** `req.user` is undefined

**Solution:** Ensure `protect` middleware runs before any middleware that needs `req.user`:
```javascript
router.post('/upload',
    protect, // MUST be first
    uploadFiles,
    checkStorageQuota, // Uses req.user
    handler
);
```

## Resources

- `src/api/_common/README.md` - Middleware and utilities reference
- `src/services/s3/README.md` - S3 service API reference
- `docs/phase_0_architecture.md` - Target architecture specification
- `docs/REFACTORING_PROGRESS.md` - Progress tracking
- `docs/shared_patterns.md` - Current architecture (for comparison)

## Support

When refactoring each domain:
1. Follow the checklist in `REFACTORING_PROGRESS.md`
2. Reference examples in this guide
3. Check existing middleware/utilities before creating new ones
4. Document as you go

---

**Status:** ✅ Foundation Complete
**Next Step:** Choose first domain to refactor (recommended: Files Module)
**Last Updated:** 2025-10-31
