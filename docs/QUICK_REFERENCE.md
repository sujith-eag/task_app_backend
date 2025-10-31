# Phase 0 Quick Reference

Quick reference for common patterns and imports in the new Phase 0 architecture.

## Import Cheat Sheet

### Middleware
```javascript
// Authentication & Authorization
import { protect, socketAuthMiddleware } from '../_common/middleware/auth.middleware.js';
import { isAdmin, isTeacher, isStudent, isHOD, isAdminOrHOD, hasRole } from '../_common/middleware/rbac.middleware.js';

// Resource Management
import { checkStorageQuota, QUOTAS } from '../_common/middleware/quota.middleware.js';
import { checkAIDailyLimit } from '../_common/middleware/aiLimit.middleware.js';

// Rate Limiting
import { authLimiter, generalApiLimiter, downloadLimiter, publicApiLimiter } from '../_common/middleware/rateLimit.middleware.js';

// File Handling
import { uploadFiles, uploadAvatar } from '../_common/middleware/file.middleware.js';

// Error Handling
import errorHandler from '../_common/middleware/error.middleware.js';
```

### HTTP Utilities
```javascript
import asyncHandler from '../_common/http/asyncHandler.js';
import { extractPaginationParams, getPaginationMeta, getSkip } from '../_common/http/pagination.js';
```

### General Utilities
```javascript
import { isValidObjectId, toObjectId, areValidObjectIds } from '../_common/utils/objectId.js';
import { sanitizeHtml, normalizeString, sanitizeFilename, deepSanitize } from '../_common/utils/sanitize.js';
import cache from '../_common/utils/caching.js';
```

### S3 Service
```javascript
import { 
    uploadFile, 
    uploadAvatar, 
    deleteFile, 
    deleteMultipleFiles,
    getDownloadUrl, 
    getPreviewUrl, 
    getFileStream,
    s3Client 
} from '../../services/s3/s3.service.js';

import { buildKey, buildAvatarKey, parseKey, buildFolderKey } from '../../services/s3/keybuilder.js';
```

## Common Patterns

### Basic Protected Route
```javascript
router.get('/resource', 
    protect, 
    asyncHandler(async (req, res) => {
        const data = await Model.find({ user: req.user._id });
        res.json(data);
    })
);
```

### Role-Based Protected Route
```javascript
router.delete('/resource/:id',
    protect,
    isAdmin, // or isTeacher, isStudent, isHOD, isAdminOrHOD
    asyncHandler(async (req, res) => {
        await Model.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted successfully' });
    })
);
```

### Custom Role Check
```javascript
router.post('/resource',
    protect,
    hasRole(['admin', 'hod', 'teacher']), // Multiple roles
    asyncHandler(async (req, res) => {
        const item = await Model.create(req.body);
        res.json(item);
    })
);
```

### File Upload with Quota
```javascript
router.post('/upload',
    protect,
    uploadFiles, // Handles up to 8 files
    checkStorageQuota, // Checks role-based limits
    asyncHandler(async (req, res) => {
        const files = [];
        for (const file of req.files) {
            const s3Key = await uploadFile({
                file,
                context: 'personal',
                ownerId: req.user._id.toString()
            });
            
            const fileDoc = await File.create({
                user: req.user._id,
                name: file.originalname,
                s3Key,
                size: file.size,
                mimeType: file.mimetype,
                context: 'personal'
            });
            
            files.push(fileDoc);
        }
        res.json({ files });
    })
);
```

### Avatar Upload
```javascript
router.post('/avatar',
    protect,
    uploadAvatar, // Single image file
    asyncHandler(async (req, res) => {
        // Delete old avatar if exists
        if (req.user.avatar) {
            await deleteFile(req.user.avatar);
        }
        
        // Upload new avatar
        const avatarKey = await uploadAvatar(req.file, req.user._id.toString());
        
        // Update user
        req.user.avatar = avatarKey;
        await req.user.save();
        
        res.json({ avatarKey });
    })
);
```

### File Download with Cache
```javascript
router.get('/download/:id',
    protect,
    downloadLimiter, // Rate limit downloads
    asyncHandler(async (req, res) => {
        const file = await File.findOne({ _id: req.params.id, user: req.user._id });
        
        if (!file) {
            res.status(404);
            throw new Error('File not found');
        }
        
        // Check cache
        const cacheKey = `download:${file._id}`;
        let url = cache.get(cacheKey);
        
        if (!url) {
            url = await getDownloadUrl(file.s3Key, file.name, 60);
            cache.set(cacheKey, url, 50);
        }
        
        res.json({ downloadUrl: url });
    })
);
```

### File Preview
```javascript
router.get('/preview/:id',
    protect,
    asyncHandler(async (req, res) => {
        const file = await File.findOne({ _id: req.params.id, user: req.user._id });
        
        if (!file) {
            res.status(404);
            throw new Error('File not found');
        }
        
        const cacheKey = `preview:${file._id}`;
        let url = cache.get(cacheKey);
        
        if (!url) {
            url = await getPreviewUrl(file.s3Key, 60);
            cache.set(cacheKey, url, 50);
        }
        
        res.json({ previewUrl: url });
    })
);
```

### Paginated List
```javascript
router.get('/list',
    protect,
    asyncHandler(async (req, res) => {
        const { page, limit, skip } = extractPaginationParams(req.query, { 
            page: 1, 
            limit: 20 
        });
        
        const items = await Model.find({ user: req.user._id })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .select('name size createdAt');
        
        const total = await Model.countDocuments({ user: req.user._id });
        
        res.json({
            items,
            meta: getPaginationMeta({ page, limit, total })
        });
    })
);
```

### Input Validation
```javascript
router.post('/create',
    protect,
    asyncHandler(async (req, res) => {
        // Validate ObjectId
        if (!isValidObjectId(req.body.parentId)) {
            res.status(400);
            throw new Error('Invalid parent ID');
        }
        
        // Sanitize inputs
        const name = sanitizeHtml(req.body.name);
        const email = normalizeString(req.body.email);
        
        const item = await Model.create({
            name,
            email,
            user: req.user._id
        });
        
        res.json(item);
    })
);
```

### Rate Limited Auth Endpoint
```javascript
router.post('/login',
    authLimiter, // Strict limit: 10 req/10min
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        const user = await User.findOne({ email: normalizeString(email) });
        
        if (!user || !(await user.matchPassword(password))) {
            res.status(401);
            throw new Error('Invalid credentials');
        }
        
        const token = generateToken(user._id);
        res.json({ token, user });
    })
);
```

### Public Endpoint
```javascript
router.post('/public/download',
    publicApiLimiter, // 70 req/10min
    asyncHandler(async (req, res) => {
        const { code } = req.body;
        
        const file = await File.findOne({ publicCode: code });
        
        if (!file) {
            res.status(404);
            throw new Error('File not found or code expired');
        }
        
        const url = await getDownloadUrl(file.s3Key, file.name, 60);
        res.json({ downloadUrl: url });
    })
);
```

### AI Rate Limited Endpoint
```javascript
router.post('/generate',
    protect,
    checkAIDailyLimit, // Checks daily quota
    asyncHandler(async (req, res) => {
        const result = await generateAIResponse(req.body.prompt);
        
        // Increment counter (middleware checked, now update)
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { 'aiGenerations.count': 1 }
        });
        
        res.json({ result });
    })
);
```

### Batch Delete with S3
```javascript
router.delete('/batch',
    protect,
    asyncHandler(async (req, res) => {
        const { fileIds } = req.body;
        
        if (!areValidObjectIds(fileIds)) {
            res.status(400);
            throw new Error('Invalid file IDs');
        }
        
        // Get files
        const files = await File.find({
            _id: { $in: fileIds },
            user: req.user._id
        });
        
        // Delete from S3
        const s3Keys = files.map(f => f.s3Key);
        await deleteMultipleFiles(s3Keys);
        
        // Delete from DB
        await File.deleteMany({ _id: { $in: fileIds } });
        
        res.json({ message: `${files.length} files deleted` });
    })
);
```

## Context Values

When uploading files, use these context values:

- `'personal'` - User's personal files
- `'academic_material'` - Course/subject materials (admin/teacher owned)
- `'assignment_submission'` - Student assignment submissions

## S3 Key Structure

```
{env}/{context}/{ownerId}/{yyyy}/{mm}/{uuid}.{ext}

Examples:
production/personal/507f1f77bcf86cd799439011/2025/10/a3f8b9c2d1e4.pdf
development/academic_material/507f191e810c19729de860ea/2025/10/f9e8d7c6.docx
```

## Storage Quotas

Defined in `quota.middleware.js`:

```javascript
user:     20 files,  50MB
student:  50 files, 200MB
teacher: 100 files, 500MB
hod:     unlimited
admin:   unlimited
```

## Cache TTL Defaults

- Default: 50 seconds (for S3 URLs, slightly less than 60s expiration)
- Custom: Pass as third argument to `cache.set(key, value, ttl)`

## Error Handling

All errors thrown in `asyncHandler` are caught and passed to the global error handler.

```javascript
// ✅ Good - Will be caught automatically
asyncHandler(async (req, res) => {
    res.status(404);
    throw new Error('Not found');
});

// ❌ Bad - Won't be caught (missing asyncHandler)
async (req, res) => {
    res.status(404);
    throw new Error('Not found'); // Uncaught!
};
```

## ObjectId Patterns

```javascript
// Check validity
if (!isValidObjectId(id)) {
    throw new Error('Invalid ID');
}

// Convert and validate in one step
const objectId = toObjectId(id, 'User ID'); // Throws if invalid

// Check multiple IDs
if (!areValidObjectIds([id1, id2, id3])) {
    throw new Error('Invalid IDs');
}
```

## File Extensions

The keybuilder handles extensions automatically. Common mappings:

- Image files: `.jpg`, `.png`, `.gif`, `.webp`, `.svg`
- Documents: `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx`
- Code files: `.py`, `.js`, `.ts`, `.java`, `.c`, `.cpp`, `.md`, `.sh`
- Archives: `.zip`, `.rar`, `.7z`
- Fallback: `.bin` for unknown types

---

**Tip:** Keep this file open while refactoring for quick copy-paste of common patterns!
