import { 
    S3Client, 
    PutObjectCommand, 
    DeleteObjectCommand,
    GetObjectCommand 
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from 'crypto';

// Loading credentials and region from environment variables
const bucketName = process.env.AWS_S3_BUCKET_NAME;
const bucketRegion = process.env.AWS_S3_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

// Creating S3 client instance
const s3Client = new S3Client({
    region: bucketRegion,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});


/**
 * Uploads a file to S3.
 * @param {object} file - The file object from multer (req.file).
 * @returns {Promise<string>} - The unique key of the uploaded file in S3.
 */
export const uploadFile = async (file) => {
    // Generate a unique, random name for the file
    const randomFileName = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
    const fileKey = randomFileName();

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
 * Deletes a file from S3.
 * @param {string} fileKey - The key of the file to delete.
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
 * Generates a secure, temporary URL to download a file from S3.
 * @param {string} fileKey - The key of the file to generate a URL for.
 * @returns {Promise<string>} - The pre-signed URL.
 */
export const getSignedUrl = async (fileKey, fileName) => {
    const getParams = {
        Bucket: bucketName,
        Key: fileKey,
        ResponseContentDisposition: `attachment; filename="${fileName}"`
    }; // This tells S3 to send headers that force a download with the original filename

    const command = new GetObjectCommand(getParams);
    // The URL will be valid for 60 seconds
    const url = await awsGetSignedUrl(s3Client, command, { expiresIn: 60 });
    
    return url;
};
