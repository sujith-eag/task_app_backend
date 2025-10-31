import multer from 'multer';

// Use memory storage to hold the file temporarily before it's processed
const storage = multer.memoryStorage();

/**
 * File filter for general file uploads
 * Allows a variety of common file types including:
 * - Images (JPEG, PNG, GIF, WebP, SVG)
 * - Documents (PDF, Word, PowerPoint, Excel)
 * - Archives (ZIP, RAR, 7z)
 * - Code files (Python, JavaScript, TypeScript, Java, C/C++, etc.)
 * - Text files (Markdown, CSV, JSON, HTML, CSS, etc.)
 */
const generalFileFilter = (req, file, cb) => {
    const ALLOWED_MIMETYPES = [
        // Images
        'image/jpeg', 'image/png', 'image/gif',
        'image/webp', 'image/svg+xml',
        // Documents
        'application/pdf',
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // Archives
        'application/zip', 'application/x-rar-compressed',
        'application/vnd.rar', 'application/x-7z-compressed',
        // Programming & notebooks
        'text/x-python', // .py
        'application/x-ipynb+json', // .ipynb
        'application/typescript', // .ts
        'text/x-java-source', // .java
        'text/x-csrc', 'text/x-c++src', // .c, .cpp
        'text/markdown', // .md
        'application/x-sh', // .sh
        // Text files
        'text/plain', 'text/csv', 'text/javascript', 'text/css', 'text/html', 'application/json',
        // Fallback
        'application/octet-stream' // fallback for unrecognized file types
    ];

    if (ALLOWED_MIMETYPES.includes(file.mimetype) || file.mimetype.startsWith('text/')) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error('Invalid file type.'), false); // Reject the file
    }
};

/**
 * File filter for avatar image uploads
 * Only allows image files
 */
const avatarFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error('Invalid file type. Only images are allowed.'), false); // Reject the file
    }
};

/**
 * Configure multer for general file uploads
 * Supports up to 8 files with a maximum size of 20MB per file
 */
const generalUploader = multer({
    storage,
    fileFilter: generalFileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB limit
    },
});

/**
 * Configure multer for avatar uploads
 * Single file with a maximum size of 5MB
 */
const avatarUploader = multer({
    storage,
    fileFilter: avatarFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB limit
    },
});

// --- Named Exports ---
// Middleware to handle up to 8 files from a field named 'files'
export const uploadFiles = generalUploader.array('files', 8);

// Middleware to handle a single file from a field named 'avatar'
export const uploadAvatar = avatarUploader.single('avatar');
