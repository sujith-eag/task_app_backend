# Common Shared Components

This directory contains shared middleware, utilities, and HTTP helpers used across all domain modules in the application.

## Directory Structure

```
_common/
├── middleware/          # Express middleware functions
│   ├── auth.middleware.js       # JWT authentication (protect, socketAuthMiddleware)
│   ├── rbac.middleware.js       # Role-Based Access Control (isAdmin, isTeacher, etc.)
│   ├── error.middleware.js      # Global error handler
│   ├── quota.middleware.js      # Storage quota enforcement
│   ├── rateLimit.middleware.js  # Rate limiting configurations
│   ├── aiLimit.middleware.js    # Daily AI generation limits
│   └── file.middleware.js       # Multer configurations for file uploads
│
├── http/                # HTTP utilities
│   ├── asyncHandler.js          # Async route handler wrapper
│   └── pagination.js            # Pagination helpers
│
└── utils/               # General utilities
    ├── objectId.js              # MongoDB ObjectId validation
    ├── sanitize.js              # Input sanitization
    └── caching.js               # In-memory cache wrapper (node-cache)
```

## Middleware

### Authentication

- **`protect`**: Validates JWT from Authorization header or request body, attaches `req.user`
- **`socketAuthMiddleware`**: Validates JWT for Socket.IO connections, attaches `socket.user`

### Authorization (RBAC)

- **`isAdmin`**: Requires admin role
- **`isTeacher`**: Requires teacher role
- **`isStudent`**: Requires student role
- **`isHOD`**: Requires HOD role
- **`isAdminOrHOD`**: Requires admin or HOD role
- **`hasRole(roles)`**: Generic role checker accepting array of allowed roles

### Resource Management

- **`checkStorageQuota`**: Enforces role-based storage limits (file count and size)
  - Only applies to `context: 'personal'` files
  - Uses highest-role logic for quota calculation
  - Configurable quotas in `QUOTAS` constant

### Rate Limiting

- **`authLimiter`**: Strict limits for auth endpoints (10 req/10min)
- **`generalApiLimiter`**: Lenient limits for general API (100 req/10min)
- **`downloadLimiter`**: Moderate limits for downloads (20 req/10min)
- **`publicApiLimiter`**: Public endpoint limits (70 req/10min)

### File Handling

- **`uploadFiles`**: Multer middleware for general file uploads (up to 8 files, 20MB each)
- **`uploadAvatar`**: Multer middleware for avatar uploads (single file, 5MB max)

### Other

- **`checkAIDailyLimit`**: Enforces daily AI generation quota per user
- **`errorHandler`**: Global error handler with custom Multer error messages

## HTTP Utilities

### asyncHandler

Wraps async route handlers to eliminate try-catch boilerplate:

```javascript
import asyncHandler from './_common/http/asyncHandler.js';

router.get('/users', asyncHandler(async (req, res) => {
    const users = await User.find();
    res.json(users);
}));
```

### Pagination

```javascript
import { extractPaginationParams, getPaginationMeta } from './_common/http/pagination.js';

const { page, limit, skip } = extractPaginationParams(req.query);
const items = await Model.find().skip(skip).limit(limit);
const total = await Model.countDocuments();
const meta = getPaginationMeta({ page, limit, total });

res.json({ items, meta });
```

## Utilities

### ObjectId Validation

```javascript
import { isValidObjectId, toObjectId } from './_common/utils/objectId.js';

if (!isValidObjectId(req.params.id)) {
    throw new Error('Invalid ID format');
}

const objectId = toObjectId(req.params.id, 'User ID');
```

### Sanitization

```javascript
import { sanitizeHtml, normalizeString, sanitizeFilename } from './_common/utils/sanitize.js';

const safeHtml = sanitizeHtml(userInput);
const email = normalizeString(req.body.email); // trim + lowercase
const safeName = sanitizeFilename(file.originalname);
```

### Caching

```javascript
import cache from './_common/utils/caching.js';

// Set with default TTL (50s)
cache.set('key', value);

// Set with custom TTL
cache.set('key', value, 120); // 120 seconds

// Get
const value = cache.get('key');

// Check existence
if (cache.has('key')) { /* ... */ }

// Delete
cache.del('key');

// Get stats
const stats = cache.getStats();
```

## Usage Examples

### Protected Route with RBAC

```javascript
import { protect } from './_common/middleware/auth.middleware.js';
import { isAdmin } from './_common/middleware/rbac.middleware.js';
import asyncHandler from './_common/http/asyncHandler.js';

router.delete('/users/:id', 
    protect, 
    isAdmin,
    asyncHandler(async (req, res) => {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted' });
    })
);
```

### File Upload with Quota Check

```javascript
import { protect } from './_common/middleware/auth.middleware.js';
import { uploadFiles } from './_common/middleware/file.middleware.js';
import { checkStorageQuota } from './_common/middleware/quota.middleware.js';

router.post('/upload',
    protect,
    uploadFiles, // Multer processes files first
    checkStorageQuota, // Then check quota
    asyncHandler(async (req, res) => {
        // req.files contains uploaded files
        // Upload to S3 and save to database
    })
);
```

### Rate Limited Public Endpoint

```javascript
import { publicApiLimiter } from './_common/middleware/rateLimit.middleware.js';

router.post('/public/download',
    publicApiLimiter,
    asyncHandler(async (req, res) => {
        // Handle public file download
    })
);
```

## Best Practices

1. **Always use `protect` middleware** before any middleware that requires `req.user`
2. **Chain middleware in logical order**: auth → rbac → quota/rate-limit → business logic
3. **Use `asyncHandler`** for all async route handlers to avoid try-catch boilerplate
4. **Sanitize user input** before database operations
5. **Validate ObjectIds** before querying MongoDB
6. **Use pagination helpers** for list endpoints
7. **Cache expensive operations** (especially S3 pre-signed URLs)

## Migration Notes

All middleware has been moved from `src/middleware/` to `src/api/_common/middleware/` with the following changes:

- `auth.middleware.js` → No changes, just moved
- `role.middleware.js` → Renamed to `rbac.middleware.js`, added `hasRole` export
- `error.middleware.js` → No changes, just moved
- `storage.middleware.js` → Renamed to `quota.middleware.js`, added context filtering
- `rateLimiter.middleware.js` → Renamed to `rateLimit.middleware.js`
- `checkAIDailyLimit.js` → Renamed to `aiLimit.middleware.js`
- `file.middleware.js` → No changes, just moved

Update all imports when refactoring domain modules:

```javascript
// Old
import { protect } from '../middleware/auth.middleware.js';

// New
import { protect } from '../_common/middleware/auth.middleware.js';
```
