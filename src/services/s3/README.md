# S3 Service

Centralized AWS S3 interaction layer with structured key generation and file management utilities.

## Directory Structure

```
s3/
├── s3.service.js        # S3 operations (upload, delete, get URLs, streams)
└── keybuilder.js        # Structured S3 key generation
```

## Key Structure

All S3 objects follow a structured, hierarchical key format:

```
{env}/{context}/{ownerId}/{yyyy}/{mm}/{uuid}.{ext}
```

### Example Keys

```
production/personal/507f1f77bcf86cd799439011/2025/10/a3f8b9c2d1e4f5g6h7i8j9k0.pdf
development/academic_material/507f191e810c19729de860ea/2025/10/f9e8d7c6b5a4.docx
production/assignment_submission/612f1a77bcf86cd799439022/2025/11/1a2b3c4d5e6f.zip
```

### Benefits

1. **Environment Isolation**: Separate dev/staging/production data
2. **Context Separation**: Easily identify file purpose (personal, academic, assignments)
3. **User Grouping**: All files for a user are under their ID prefix
4. **Time Organization**: Year/month structure for archival and lifecycle policies
5. **Collision Prevention**: UUID ensures uniqueness

### Special Cases

**Avatars**: Simplified structure for user avatars
```
{env}/avatars/{userId}.{ext}
```

Example: `production/avatars/507f1f77bcf86cd799439011.jpg`

## API Reference

### Upload Operations

#### `uploadFile({ file, context, ownerId })`

Upload a file with structured key generation.

**Parameters:**
- `file` (Object): Multer file object (`req.file`)
  - `buffer`: File buffer
  - `originalname`: Original filename
  - `mimetype`: MIME type
- `context` (String): File context (`personal`, `academic_material`, `assignment_submission`)
- `ownerId` (String): User/owner MongoDB ObjectId

**Returns:** `Promise<string>` - S3 key of uploaded file

**Example:**
```javascript
import { uploadFile } from '../../services/s3/s3.service.js';

const fileKey = await uploadFile({
    file: req.file,
    context: 'personal',
    ownerId: req.user._id.toString()
});

// fileKey: "production/personal/507f.../2025/10/abc123.pdf"
```

#### `uploadAvatar(file, userId)`

Upload user avatar with simplified key structure.

**Parameters:**
- `file` (Object): Multer file object
- `userId` (String): User ID

**Returns:** `Promise<string>` - S3 key

**Example:**
```javascript
import { uploadAvatar } from '../../services/s3/s3.service.js';

const avatarKey = await uploadAvatar(req.file, req.user._id.toString());
// avatarKey: "production/avatars/507f1f77bcf86cd799439011.jpg"
```

### Delete Operations

#### `deleteFile(fileKey)`

Delete a single file from S3.

**Parameters:**
- `fileKey` (String): S3 key to delete

**Returns:** `Promise<void>`

**Example:**
```javascript
import { deleteFile } from '../../services/s3/s3.service.js';

await deleteFile('production/personal/507f.../2025/10/abc123.pdf');
```

#### `deleteMultipleFiles(fileKeys)`

Delete multiple files in parallel.

**Parameters:**
- `fileKeys` (Array<String>): Array of S3 keys

**Returns:** `Promise<void>`

**Example:**
```javascript
import { deleteMultipleFiles } from '../../services/s3/s3.service.js';

await deleteMultipleFiles([
    'production/personal/507f.../2025/10/file1.pdf',
    'production/personal/507f.../2025/10/file2.jpg'
]);
```

### URL Generation

#### `getDownloadUrl(fileKey, fileName, expiresIn = 60)`

Generate pre-signed URL that forces download with original filename.

**Parameters:**
- `fileKey` (String): S3 key
- `fileName` (String): Original filename for download header
- `expiresIn` (Number): URL expiration in seconds (default: 60)

**Returns:** `Promise<string>` - Pre-signed download URL

**Example:**
```javascript
import { getDownloadUrl } from '../../services/s3/s3.service.js';

const url = await getDownloadUrl(
    'production/personal/507f.../abc123.pdf',
    'My Report.pdf',
    60
);

// URL sets Content-Disposition: attachment; filename="My Report.pdf"
res.json({ downloadUrl: url });
```

#### `getPreviewUrl(fileKey, expiresIn = 60)`

Generate pre-signed URL for inline viewing (no forced download).

**Parameters:**
- `fileKey` (String): S3 key
- `expiresIn` (Number): URL expiration in seconds (default: 60)

**Returns:** `Promise<string>` - Pre-signed preview URL

**Example:**
```javascript
import { getPreviewUrl } from '../../services/s3/s3.service.js';

const url = await getPreviewUrl('production/personal/.../image.jpg', 60);
// URL allows inline viewing in browser
res.json({ previewUrl: url });
```

### Stream Operations

#### `getFileStream(fileKey)`

Get a readable stream for S3 object (useful for large files or creating archives).

**Parameters:**
- `fileKey` (String): S3 key

**Returns:** `Promise<ReadableStream>`

**Example:**
```javascript
import { getFileStream } from '../../services/s3/s3.service.js';

const stream = await getFileStream('production/personal/.../large-file.zip');
stream.pipe(res);
```

## Key Builder API

### `buildKey({ context, ownerId, filename, mimetype })`

Generate structured S3 key.

**Parameters:**
- `context` (String): File context
- `ownerId` (String): Owner ID
- `filename` (String): Original filename
- `mimetype` (String): MIME type

**Returns:** `string` - Structured S3 key

**Example:**
```javascript
import { buildKey } from '../../services/s3/keybuilder.js';

const key = buildKey({
    context: 'personal',
    ownerId: '507f1f77bcf86cd799439011',
    filename: 'report.pdf',
    mimetype: 'application/pdf'
});
// "production/personal/507f1f77bcf86cd799439011/2025/10/abc123.pdf"
```

### `buildAvatarKey(userId, filename, mimetype)`

Generate avatar key.

**Example:**
```javascript
import { buildAvatarKey } from '../../services/s3/keybuilder.js';

const key = buildAvatarKey(
    '507f1f77bcf86cd799439011',
    'avatar.jpg',
    'image/jpeg'
);
// "production/avatars/507f1f77bcf86cd799439011.jpg"
```

### `parseKey(key)`

Parse S3 key to extract metadata.

**Returns:** Object with `{ env, context, ownerId, year, month, filename, valid }`

**Example:**
```javascript
import { parseKey } from '../../services/s3/keybuilder.js';

const meta = parseKey('production/personal/507f.../2025/10/abc123.pdf');
// {
//   env: 'production',
//   context: 'personal',
//   ownerId: '507f1f77bcf86cd799439011',
//   year: '2025',
//   month: '10',
//   filename: 'abc123.pdf',
//   valid: true
// }
```

### `buildFolderKey({ context, ownerId, folderPath })`

Generate folder marker key (ends with `/`).

**Example:**
```javascript
import { buildFolderKey } from '../../services/s3/keybuilder.js';

const key = buildFolderKey({
    context: 'personal',
    ownerId: '507f1f77bcf86cd799439011',
    folderPath: 'documents/work'
});
// "production/personal/507f.../folders/documents/work/"
```

## Usage Patterns

### Standard File Upload

```javascript
import { uploadFile } from '../../services/s3/s3.service.js';
import File from '../../models/file.model.js';

// Upload to S3
const s3Key = await uploadFile({
    file: req.file,
    context: 'personal',
    ownerId: req.user._id.toString()
});

// Save metadata to database
const fileDoc = await File.create({
    user: req.user._id,
    name: req.file.originalname,
    s3Key,
    size: req.file.size,
    mimeType: req.file.mimetype,
    context: 'personal'
});

res.json({ file: fileDoc });
```

### Download with Caching

```javascript
import { getDownloadUrl } from '../../services/s3/s3.service.js';
import cache from '../../api/_common/utils/caching.js';

// Check cache first
const cacheKey = `download:${fileId}`;
let url = cache.get(cacheKey);

if (!url) {
    // Generate new URL
    url = await getDownloadUrl(file.s3Key, file.name, 60);
    // Cache for 50 seconds (less than expiration)
    cache.set(cacheKey, url, 50);
}

res.json({ downloadUrl: url });
```

### Bulk Delete

```javascript
import { deleteMultipleFiles } from '../../services/s3/s3.service.js';

// Get all file keys
const files = await File.find({ folder: folderId });
const s3Keys = files.map(f => f.s3Key);

// Delete from S3
await deleteMultipleFiles(s3Keys);

// Delete from database
await File.deleteMany({ folder: folderId });
```

## Environment Variables

Required environment variables:

```env
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_S3_BUCKET_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
NODE_ENV=production
```

## Migration Notes

### From Old S3 Service

**Old import:**
```javascript
import { uploadFile, getSignedUrl } from '../../services/s3.service.js';
```

**New imports:**
```javascript
import { uploadFile, getDownloadUrl, getPreviewUrl } from '../../services/s3/s3.service.js';
```

### Key Changes

1. **Upload signature changed:**
   ```javascript
   // Old
   const key = await uploadFile(req.file);
   
   // New (requires context and ownerId)
   const key = await uploadFile({
       file: req.file,
       context: 'personal',
       ownerId: req.user._id.toString()
   });
   ```

2. **URL generation split into download and preview:**
   ```javascript
   // Old
   const url = await getSignedUrl(s3Key, fileName);
   
   // New (choose based on use case)
   const downloadUrl = await getDownloadUrl(s3Key, fileName, 60);
   const previewUrl = await getPreviewUrl(s3Key, 60);
   ```

3. **Structured keys:** All new uploads use structured keys with context and time hierarchy

## Best Practices

1. **Always specify context** when uploading files
2. **Use preview URLs for images/PDFs** that should display inline
3. **Use download URLs for documents** that should trigger downloads
4. **Cache pre-signed URLs** (they're expensive to generate)
5. **Set appropriate expiration times** (balance security vs user experience)
6. **Use deleteMultipleFiles** for batch operations (more efficient)
7. **Parse keys** when you need to extract metadata without DB lookup

## Testing

```javascript
// Test upload
const testFile = {
    buffer: Buffer.from('test content'),
    originalname: 'test.txt',
    mimetype: 'text/plain'
};

const key = await uploadFile({
    file: testFile,
    context: 'personal',
    ownerId: 'test-user-id'
});

console.log('Uploaded:', key);

// Test URL generation
const url = await getDownloadUrl(key, 'test.txt', 60);
console.log('Download URL:', url);

// Cleanup
await deleteFile(key);
```
