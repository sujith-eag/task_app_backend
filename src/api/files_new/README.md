# Files Module (Personal Files & Folders)

## Overview

The Files module handles **personal file and folder operations** for the Eagle Campus application. This module focuses exclusively on:
- File uploads and downloads
- Folder creation and management
- Hierarchical path navigation
- Storage quota enforcement

**Note:** This module does NOT handle sharing (see `shares` module) or deletion/trash (see `trash` module).

## Directory Structure

```
files_new/
├── routes/
│   ├── file.routes.js          # File operations routes
│   └── folder.routes.js        # Folder operations routes
├── controllers/
│   ├── file.controller.js      # File request handlers
│   └── folder.controller.js    # Folder request handlers
├── services/
│   ├── file.service.js         # File business logic
│   ├── folder.service.js       # Folder business logic
│   └── path.service.js         # Path computation utilities
├── validators/
│   └── file.validators.js      # Joi validation schemas
├── policies/
│   └── file.policies.js        # Authorization checks
└── README.md                    # This file
```

## Features

### 1. File Upload
- **Endpoint**: `POST /api/files/upload`
- **Access**: Private (authenticated users only)
- **Features**:
  - Multiple file upload (max 10 files at once)
  - Automatic duplicate filename handling (appends counter)
  - S3 structured key generation (context: 'personal')
  - Storage quota enforcement
  - Parent folder validation
  
### 2. File Listing
- **Endpoint**: `GET /api/files?parentId={id}`
- **Access**: Private
- **Features**:
  - List files and folders in a directory
  - Includes owned files + files shared with user
  - Class-based sharing support (for students)
  - Breadcrumb generation from path
  - Sorted (folders first, then files)

### 3. File Download
- **Endpoint**: `GET /api/files/:id/download`
- **Access**: Private
- **Features**:
  - Generates temporary S3 signed URL
  - Permission check (owner or shared with)
  - Respects share expiration dates

### 4. Bulk Download
- **Endpoint**: `POST /api/files/bulk-download`
- **Access**: Private
- **Features**:
  - Download multiple files as ZIP archive
  - Streaming zip creation (no temp files)
  - Permission check for all requested files
  - Excludes folders (only downloads files)

### 5. Folder Creation
- **Endpoint**: `POST /api/folders`
- **Access**: Private
- **Features**:
  - Create folders at any level
  - Depth limit enforcement (max 2 levels in Phase 0)
  - Automatic path computation
  - Unique dummy s3Key for folder documents

### 6. Folder Navigation
- **Endpoint**: `GET /api/folders/:id`
- **Access**: Private
- **Features**:
  - Get folder details with statistics
  - File count, folder count, total size
  - Populated user information

### 7. Move Items
- **Endpoint**: `PATCH /api/folders/:id/move`
- **Access**: Private (owner only)
- **Features**:
  - Move files or folders to new location
  - Recursive path updates for folder descendants
  - Prevents moving folder into its own child
  - Depth validation

### 8. Rename Folder
- **Endpoint**: `PATCH /api/folders/:id/rename`
- **Access**: Private (owner only)
- **Features**:
  - Rename folder
  - Uniqueness check within parent
  - Simple name update (no path changes)

### 9. Delete Operations (Temporary)
- **Endpoints**: 
  - `DELETE /api/files/:id` (single file)
  - `DELETE /api/files` (bulk delete)
  - `DELETE /api/folders/:id` (folder with contents)
- **Access**: Private (owner only)
- **Note**: These are HARD deletes. Will be replaced by soft-delete in Part 3 (Trash module)

## Architecture

### Service Layer

#### `path.service.js` - Path Utilities
Core utilities for hierarchical path management:

```javascript
buildPath(parentFolder)              // Build path string from parent
extractAncestorIds(path)             // Extract IDs from path
isDescendant(folderPath, ...)        // Check if folder is child of another
updateDescendantPath(old, new, ...)  // Update paths when moving
calculateDepth(path)                 // Get folder depth level
isValidDepth(path, maxDepth)         // Validate depth limit
```

**Path Format**: `,id1,id2,id3,`
- Leading and trailing commas
- IDs separated by commas
- Represents hierarchy from root to parent

#### `file.service.js` - File Operations
Business logic for file operations:

```javascript
uploadFilesService(files, userId, parentId)
  → Upload files to S3, save metadata

getUserFilesService(userId, user, parentId)
  → Get files/folders with permission filtering

getFileDownloadUrlService(fileId, userId)
  → Generate download URL with permission check

getBulkDownloadFilesService(fileIds, userId)
  → Get accessible files for bulk download

deleteFileService(fileId, userId)          // Temporary
bulkDeleteFilesService(fileIds, userId)    // Temporary
```

#### `folder.service.js` - Folder Operations
Business logic for folder management:

```javascript
createFolderService(folderName, userId, parentId)
  → Create folder with path and depth validation

deleteFolderService(folderId, userId)
  → Delete folder recursively (temporary)

moveItemService(itemId, userId, newParentId)
  → Move item with recursive path updates

getFolderDetailsService(folderId, userId)
  → Get folder with statistics

renameFolderService(folderId, userId, newName)
  → Rename folder with uniqueness check

isFolderNameAvailable(name, userId, parentId, excludeId)
  → Check name availability
```

### Controller Layer

Thin request/response handlers using `asyncHandler`:
- Extract parameters from req (body, query, params)
- Call service layer
- Return JSON response

### Validator Layer

Joi schemas for request validation:
- `uploadFilesSchema` - parentId optional
- `createFolderSchema` - folderName (1-100 chars) + parentId
- `moveItemSchema` - newParentId required
- `renameFolderSchema` - newName (1-100 chars)
- `bulkFileIdsSchema` - fileIds array (min 1)
- `listFilesSchema` - parentId query param

### Policy Layer

Authorization middleware:
- `isOwner` - Check user owns the item
- `hasReadAccess` - Check user can read (owner or shared)
- `canUploadToFolder` - Validate folder exists and user owns it
- `validateFileTypes` - Placeholder for file type restrictions

## Data Flow

### Upload Flow
```
Client → Multer → Validator → Policy → Quota Check → Controller
  → Service:
      - Validate parent folder
      - Generate unique filenames
      - Upload to S3 (context: 'personal')
      - Save metadata to DB
  → Response: Array of file documents
```

### List Flow
```
Client → Validator → Controller → Service:
  - Build query (owned + shared + class shares)
  - Fetch files + current folder in parallel
  - Extract ancestor IDs from path
  - Fetch breadcrumb ancestors
  - Map ancestors to breadcrumbs
→ Response: { files, currentFolder, breadcrumbs }
```

### Move Flow
```
Client → Validator → Policy → Controller → Service:
  - Validate item and destination exist
  - Check permissions
  - Prevent circular moves
  - Validate depth
  - Update item path
  - If folder: bulk update all descendants' paths
→ Response: { message, updatedDescendants }
```

## Path Management

### Hierarchical Structure
Files uses a **materialized path pattern** for efficient hierarchy queries:

```javascript
// Root folder
path: ","

// First level folder (id: abc123)
path: ",abc123,"

// Second level folder (parent: abc123, id: def456)
path: ",abc123,def456,"

// File in second level (parent: def456)
path: ",abc123,def456,"
```

### Benefits
1. **Fast Queries**: Find all descendants with regex: `^,abc123,`
2. **Efficient Breadcrumbs**: Extract ancestor IDs by splitting path
3. **Simple Validation**: Check depth by counting commas
4. **Atomic Updates**: Move operations update paths in bulk

### Depth Limit (Phase 0)
- **Maximum**: 2 levels of folders
- **Enforcement**: `isValidDepth(path, 2)` in service layer
- **Rationale**: Keep file structure simple, prevent deep nesting

## Dependencies

### Internal
- `File` model (fileModel.js)
- S3 service (services/s3/)
- asyncHandler (HTTP utility)
- Protect middleware (authentication)
- Quota middleware (storage limits)
- File middleware (multer config)

### External
- `joi` (^17.x) - Request validation
- `archiver` (^5.x) - ZIP file creation for bulk download
- `mongoose` (^7.x) - MongoDB ODM

## Environment Variables

```env
# S3 Configuration (used by s3.service)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=your-bucket

# Node environment for S3 key generation
NODE_ENV=development  # or production
```

## API Endpoints

### File Operations

#### Upload Files
```http
POST /api/files/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body (form-data):
  files: [File, File, ...]
  parentId: "folder-id" or null

Response: 201 Created
[
  {
    "_id": "...",
    "fileName": "document.pdf",
    "fileType": "application/pdf",
    "size": 123456,
    "s3Key": "dev/personal/user-id/2025/10/uuid.pdf",
    "user": { "name": "...", "avatar": "..." },
    "isFolder": false,
    "parentId": "...",
    "path": ",parent-id,"
  }
]
```

#### List Files
```http
GET /api/files?parentId=folder-id
Authorization: Bearer {token}

Response: 200 OK
{
  "files": [...],
  "currentFolder": {
    "_id": "...",
    "fileName": "My Folder",
    "path": ",ancestor1,"
  },
  "breadcrumbs": [
    { "_id": "ancestor1", "fileName": "Parent" }
  ]
}
```

#### Get Download Link
```http
GET /api/files/:id/download
Authorization: Bearer {token}

Response: 200 OK
{
  "url": "https://s3.amazonaws.com/bucket/key?signature=..."
}
```

#### Bulk Download
```http
POST /api/files/bulk-download
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "fileIds": ["id1", "id2", "id3"]
}

Response: 200 OK (application/zip)
Binary ZIP file stream
```

### Folder Operations

#### Create Folder
```http
POST /api/folders
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "folderName": "My Folder",
  "parentId": "parent-id" or null
}

Response: 201 Created
{
  "_id": "...",
  "fileName": "My Folder",
  "isFolder": true,
  "parentId": "...",
  "path": ",parent-id,",
  "user": { "name": "...", "avatar": "..." }
}
```

#### Get Folder Details
```http
GET /api/folders/:id
Authorization: Bearer {token}

Response: 200 OK
{
  "folder": {
    "_id": "...",
    "fileName": "My Folder",
    "isFolder": true,
    "path": ",",
    "user": { "name": "...", "avatar": "..." }
  },
  "stats": {
    "fileCount": 10,
    "folderCount": 3,
    "totalSize": 5242880
  }
}
```

#### Move Item
```http
PATCH /api/folders/:id/move
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "newParentId": "target-folder-id" or null
}

Response: 200 OK
{
  "message": "Item moved successfully.",
  "updatedDescendants": 5
}
```

#### Rename Folder
```http
PATCH /api/folders/:id/rename
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "newName": "New Folder Name"
}

Response: 200 OK
{
  "_id": "...",
  "fileName": "New Folder Name",
  "isFolder": true,
  ...
}
```

#### Delete Folder
```http
DELETE /api/folders/:id
Authorization: Bearer {token}

Response: 200 OK
{
  "message": "Folder and all its contents deleted successfully.",
  "deletedCount": 15
}
```

## Error Handling

All controllers use `asyncHandler` for consistent error handling:
- **400 Bad Request**: Validation errors, invalid operations
- **403 Forbidden**: Permission denied
- **404 Not Found**: Item not found
- **500 Internal Server Error**: Unexpected errors

Service layer throws errors with:
- Error message (always)
- Optional `statusCode` property for HTTP status

## Security Features

### Authentication
- All endpoints require JWT authentication (`protect` middleware)
- User verification and active status checked in `protect`

### Authorization
- Ownership checks via `isOwner` policy
- Read access checks via `hasReadAccess` policy
- Folder upload permission checks

### Storage Quota
- Enforced by `checkStorageQuota` middleware
- Applied to personal file uploads only
- Role-based quotas (student: 2GB, teacher: 5GB, admin: unlimited)

### File Validation
- Max 10 files per upload
- Multer file size limits (configured in file.middleware)
- Placeholder for file type validation

## Known Limitations (Phase 0)

1. **Depth Limit**: Maximum 2 levels of folders
2. **Hard Delete**: Files are permanently deleted (will be fixed in Part 3)
3. **No Sharing**: Sharing handled by separate `shares` module (Part 2)
4. **No Versioning**: File overwrites replace original
5. **No Tags/Search**: Full-text search in separate module

## Migration Notes

### From Old Structure
The Files module consolidates logic from:
- `upload.controller.js` → `file.service.js` + `file.controller.js`
- `item.controller.js` → `file.service.js` (getUserFilesService)
- `folder.controller.js` → `folder.service.js` + `folder.controller.js`
- `download.controller.js` → `file.service.js` + `file.controller.js`
- `delete.controller.js` → Temporarily in `file.service.js` (will move to trash)

### Breaking Changes
None - API endpoints remain compatible

### S3 Service Updates
- Now uses new structured S3 service from `services/s3/`
- Uploads use `context: 'personal'` parameter
- Uses `getDownloadUrl` instead of old `getSignedUrl`

## Testing Considerations

### Unit Tests
- Path utility functions (buildPath, extractAncestorIds, etc.)
- Service layer methods (mocked File model)
- Validator schemas
- Policy functions

### Integration Tests
- Full upload → list → download flow
- Folder creation → move → rename → delete
- Bulk operations
- Permission checks
- Quota enforcement

### Edge Cases
- Duplicate filenames (counter logic)
- Moving folder into itself/descendant
- Depth limit enforcement
- Concurrent path updates
- Share expiration

## Future Enhancements

### Phase 1+
- [ ] Soft-delete integration (trash module)
- [ ] File versioning
- [ ] Thumbnail generation for images
- [ ] Preview URLs for documents
- [ ] File tags and metadata
- [ ] Full-text search integration
- [ ] Activity logging
- [ ] Increased depth limit (configurable)
- [ ] Folder templates
- [ ] Batch operations (copy, paste)

## Related Modules

- **Shares Module** (Part 2): File sharing, public links, class shares
- **Trash Module** (Part 3): Soft-delete, restore, purge
- **Users Module**: User profiles and preferences
- **S3 Service**: Structured cloud storage
- **Quota Middleware**: Storage limit enforcement

## Changelog

### Version 1.0.0 (Phase 0 Refactoring - Part 1)
- ✅ Created Files domain for personal file operations
- ✅ Extracted business logic to service layer
- ✅ Created path computation utilities
- ✅ Implemented hierarchical folder structure
- ✅ Added depth limit enforcement (2 levels)
- ✅ Created Joi validation schemas
- ✅ Implemented authorization policies
- ✅ Integrated with new S3 service structure
- ✅ Added comprehensive documentation

---

**Status**: Part 1 Complete ✅  
**Next**: Part 2 (Shares Module) and Part 3 (Trash Module)

_Last Updated: October 31, 2025_
