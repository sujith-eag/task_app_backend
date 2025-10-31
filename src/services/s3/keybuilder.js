import crypto from 'crypto';

/**
 * S3 Key Builder
 * Generates structured, hierarchical keys for S3 objects
 * Format: {env}/{context}/{ownerId}/{yyyy}/{mm}/{uuid}.{ext}
 * 
 * This structure provides:
 * - Environment isolation (dev/staging/production)
 * - Context separation (personal/academic_material/assignment_submission)
 * - User/owner grouping for easier management
 * - Time-based organization for archival and lifecycle policies
 * - UUID for uniqueness and collision prevention
 */

const ENV = process.env.NODE_ENV || 'development';

/**
 * Generate a random UUID for file uniqueness
 * 
 * @param {number} bytes - Number of random bytes (default 16)
 * @returns {string} Hex string UUID
 */
const generateUUID = (bytes = 16) => {
    return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Extract file extension from filename or mimetype
 * 
 * @param {string} filename - Original filename
 * @param {string} mimetype - File MIME type
 * @returns {string} File extension (without dot)
 */
const getExtension = (filename, mimetype) => {
    // Try to get extension from filename first
    if (filename && filename.includes('.')) {
        const parts = filename.split('.');
        return parts[parts.length - 1].toLowerCase();
    }

    // Fallback to mimetype mapping
    const mimetypeMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/zip': 'zip',
        'text/plain': 'txt',
        'text/csv': 'csv',
        'application/json': 'json',
    };

    return mimetypeMap[mimetype] || 'bin';
};

/**
 * Build a structured S3 key
 * 
 * @param {Object} options - Key building options
 * @param {string} options.context - File context (personal, academic_material, assignment_submission)
 * @param {string} options.ownerId - User/owner ID
 * @param {string} options.filename - Original filename
 * @param {string} options.mimetype - File MIME type
 * @returns {string} Structured S3 key
 * 
 * @example
 * buildKey({
 *   context: 'personal',
 *   ownerId: '507f1f77bcf86cd799439011',
 *   filename: 'report.pdf',
 *   mimetype: 'application/pdf'
 * })
 * // Returns: "production/personal/507f1f77bcf86cd799439011/2025/10/a3f8b9c2d1e4f5g6h7i8j9k0.pdf"
 */
export const buildKey = ({ context, ownerId, filename, mimetype }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const uuid = generateUUID();
    const ext = getExtension(filename, mimetype);

    return `${ENV}/${context}/${ownerId}/${year}/${month}/${uuid}.${ext}`;
};

/**
 * Build a key for avatar uploads
 * Simplified structure for user avatars: {env}/avatars/{userId}.{ext}
 * 
 * @param {string} userId - User ID
 * @param {string} filename - Original filename
 * @param {string} mimetype - File MIME type
 * @returns {string} Avatar S3 key
 */
export const buildAvatarKey = (userId, filename, mimetype) => {
    const ext = getExtension(filename, mimetype);
    return `${ENV}/avatars/${userId}.${ext}`;
};

/**
 * Parse an S3 key to extract metadata
 * 
 * @param {string} key - S3 key to parse
 * @returns {Object} Parsed metadata
 */
export const parseKey = (key) => {
    const parts = key.split('/');
    
    if (parts.length < 6) {
        return {
            env: parts[0],
            context: parts[1],
            valid: false,
        };
    }

    return {
        env: parts[0],
        context: parts[1],
        ownerId: parts[2],
        year: parts[3],
        month: parts[4],
        filename: parts[5],
        valid: true,
    };
};

/**
 * Generate a key for a folder marker
 * S3 folders are represented by keys ending with '/'
 * 
 * @param {Object} options - Folder key options
 * @param {string} options.context - File context
 * @param {string} options.ownerId - User/owner ID
 * @param {string} options.folderPath - Folder path
 * @returns {string} Folder marker key
 */
export const buildFolderKey = ({ context, ownerId, folderPath }) => {
    const sanitizedPath = folderPath.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
    return `${ENV}/${context}/${ownerId}/folders/${sanitizedPath}/`;
};

export default {
    buildKey,
    buildAvatarKey,
    parseKey,
    buildFolderKey,
};
