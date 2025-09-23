import multer from 'multer';

// Storage strategy (in memory, as we're uploading directly to S3)
const storage = multer.memoryStorage();

// Whitelist of allowed MIME types for better security
const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/javascript',
    'text/css',             
    'text/html',      
    'application/json',
    'application/zip',
];


// Function to filter files by type
const fileFilter = (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('text/')) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error('Invalid file type.'), false); // Reject the file
    }
};

const limits = {
    fileSize: 10 * 1024 * 1024, // 10 MB in bytes
};

// Configure and export the multer instance
const upload = multer({
    storage,
    fileFilter,
    limits,
});

// .single('file') means we are expecting a single file with the field name 'file'

// Export a middleware that accepts up to 4 files from a field named 'files'
export default upload.array('files', 4);