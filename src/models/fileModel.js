import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
    
    // --- Core Fields ---    
    user: { // The user who owns/uploaded the file
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
        index: true
    },
    fileName: { // The original name of the file
        type: String,
        required: true,
        trim: true
    },
    s3Key: { // The unique key for the file in the S3 bucket
        type: String,
        required: true,
        unique: true
    },
    size: { // File size in bytes
        type: Number, 
        required: true
    },
    fileType: { // The MIME type of the file, e.g., 'image/jpeg'
        type: String,
        required: true
    },
    // --- Folder Structure ---
    isFolder: { type: Boolean, default: false },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File', // Self-referencing relationship
        default: null, // null = in root directory
        index: true
    },
    // --- Path Enumeration for Efficient Hierarchy Queries ---
    path: {
        type: String,
        index: true // CRITICAL for performance
    },
    // --- Analytics & Metadata ---
    downloadCount: { type: Number, default: 0 },
    tags: [{ type: String, trim: true }],
    // --- Status & Sharing ---
    status: {
        type: String,
        enum: ['available', 'processing', 'archived', 'error'],
        default: 'available'
    },
    sharedWith: [{ // Array of users this file is shared with
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		expiresAt: { type: Date, default: null } // null means no expiration
    }],
    publicShare: {
        code: {
            type: String,
            unique: true,
            sparse: true, // Allows multiple documents to have a null 'code'
            index: true   // For fast lookups
        },
        isActive: { type: Boolean, default: false },
        expiresAt: { type: Date }
    },
    sharedWithClass: { // For sharing with an entire class dynamically
        subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
        batch: { type: Number },
        semester: { type: Number },
        section: { type: String }
    },
    // --- Soft Delete Support ---
    isDeleted: {
        type: Boolean,
        default: false,
        index: true // For efficient queries of active/deleted files
    },
    deletedAt: {
        type: Date,
        default: null
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

const File = mongoose.model("File", fileSchema);
export default File;