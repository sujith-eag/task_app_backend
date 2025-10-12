import multer from 'multer';

// Use memory storage to hold the file temporarily before it's processed
const storage = multer.memoryStorage();

// --- Multer Middleware: General File Uploads ---
// Filters incoming files to allow a variety of common types.
const generalFileFilter = (req, file, cb) => {
    const ALLOWED_MIMETYPES = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip', 'application/x-rar-compressed',
        'text/plain', 'text/csv', 'text/javascript', 'text/css', 'text/html', 'application/json',
        'application/octet-stream' // fallback for unrecognized file types
    ];

    if (ALLOWED_MIMETYPES.includes(file.mimetype) || file.mimetype.startsWith('text/')) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error('Invalid file type.'), false); // Reject the file
    }
};

// Configure multer for general file uploads
const generalUploader = multer({
    storage,
    fileFilter: generalFileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB limit
    },
});

// --- Multer Middleware: Avatar Image Upload ---
// Filters files to ensure only images are accepted.
const avatarFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error('Invalid file type. Only images are allowed.'), false); // Reject the file
    }
};


// Configure multer for avatar uploads
const avatarUploader = multer({
    storage,
    fileFilter: avatarFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB limit
    },
});


// --- Named Exports ---
// Middleware to handle up to 4 files from a field named 'files'
export const uploadFiles = generalUploader.array('files', 4);

// Middleware to handle a single file from a field named 'avatar'
export const uploadAvatar = avatarUploader.single('avatar');