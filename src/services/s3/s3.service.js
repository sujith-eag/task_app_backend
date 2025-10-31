import { 
    S3Client, 
    PutObjectCommand, 
    DeleteObjectCommand,
    GetObjectCommand 
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildKey, buildAvatarKey } from './keybuilder.js';

// Load credentials and region from environment variables
const bucketName = process.env.AWS_S3_BUCKET_NAME;
const bucketRegion = process.env.AWS_S3_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

// Create S3 client instance
const s3Client = new S3Client({
    region: bucketRegion,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

/**
 * Upload a file to S3 with structured key
 * 
 * @param {Object} options - Upload options
 * @param {Object} options.file - File object from multer (req.file)
 * @param {string} options.context - File context (personal, academic_material, etc.)
 * @param {string} options.ownerId - User/owner ID
 * @returns {Promise<string>} The S3 key of the uploaded file
 */
export const uploadFile = async ({ file, context, ownerId }) => {
    // Generate structured key using keybuilder
    const fileKey = buildKey({
        context,
        ownerId,
        filename: file.originalname,
        mimetype: file.mimetype,
    });

    const uploadParams = {
        Bucket: bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);
    
    return fileKey;
};

/**
 * Upload avatar image to S3
 * Uses simplified key structure for avatars
 * 
 * @param {Object} file - File object from multer (req.file)
 * @param {string} userId - User ID
 * @returns {Promise<string>} The S3 key of the uploaded avatar
 */
export const uploadAvatar = async (file, userId) => {
    const fileKey = buildAvatarKey(userId, file.originalname, file.mimetype);

    const uploadParams = {
        Bucket: bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);
    
    return fileKey;
};

/**
 * Delete a file from S3
 * 
 * @param {string} fileKey - The key of the file to delete
 * @returns {Promise<void>}
 */
export const deleteFile = async (fileKey) => {
    const deleteParams = {
        Bucket: bucketName,
        Key: fileKey,
    };

    const command = new DeleteObjectCommand(deleteParams);
    await s3Client.send(command);
};

/**
 * Generate a pre-signed download URL
 * Forces browser to download file with original filename
 * 
 * @param {string} fileKey - The key of the file in S3
 * @param {string} fileName - Original filename for download
 * @param {number} expiresIn - URL expiration time in seconds (default: 60)
 * @returns {Promise<string>} Pre-signed download URL
 */
export const getDownloadUrl = async (fileKey, fileName, expiresIn = 60) => {
    const getParams = {
        Bucket: bucketName,
        Key: fileKey,
        ResponseContentDisposition: `attachment; filename="${fileName}"`,
    };

    const command = new GetObjectCommand(getParams);
    const url = await awsGetSignedUrl(s3Client, command, { expiresIn });
    
    return url;
};

/**
 * Generate a pre-signed preview URL
 * Allows inline viewing in browser (doesn't force download)
 * 
 * @param {string} fileKey - The key of the file in S3
 * @param {number} expiresIn - URL expiration time in seconds (default: 60)
 * @returns {Promise<string>} Pre-signed preview URL
 */
export const getPreviewUrl = async (fileKey, expiresIn = 60) => {
    const getParams = {
        Bucket: bucketName,
        Key: fileKey,
        // No ResponseContentDisposition for preview - allows inline viewing
    };

    const command = new GetObjectCommand(getParams);
    const url = await awsGetSignedUrl(s3Client, command, { expiresIn });
    
    return url;
};

/**
 * Retrieve a readable stream for a file from S3
 * Useful for streaming large files or creating archives
 * 
 * @param {string} fileKey - The key of the file in S3
 * @returns {Promise<ReadableStream>} File's readable stream
 */
export const getFileStream = async (fileKey) => {
    const getParams = {
        Bucket: bucketName,
        Key: fileKey,
    };
    
    const command = new GetObjectCommand(getParams);
    const response = await s3Client.send(command);
    return response.Body;
};

/**
 * Delete multiple files from S3
 * Useful for batch operations
 * 
 * @param {string[]} fileKeys - Array of S3 keys to delete
 * @returns {Promise<void>}
 */
export const deleteMultipleFiles = async (fileKeys) => {
    const deletePromises = fileKeys.map(key => deleteFile(key));
    await Promise.all(deletePromises);
};

// Export S3 client for advanced operations
export { s3Client };

export default {
    uploadFile,
    uploadAvatar,
    deleteFile,
    deleteMultipleFiles,
    getDownloadUrl,
    getPreviewUrl,
    getFileStream,
    s3Client,
};
