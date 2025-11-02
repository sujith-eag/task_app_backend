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
    
    // --- NEW: Context & Description ---
    description: { // For adding context to Subject Material folders
        type: String,
        trim: true,
        maxlength: 500
    },
    context: {
        type: String,
        enum: ['personal', 'academic_material', 'assignment'], // 'assignment' covers both master and draft folders
        default: 'personal',
        required: true,
        index: true // CRITICAL for performance
    },
    // --- NEW: Recycle Bin Fields ---
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: { // For the 15-day purge cron job
        type: Date,
        default: null
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
    /**
     * Last time this share was accessed
     */
    lastAccessedAt: {
      type: Date,
    },
	sharedWithClass: { // For sharing with an entire class dynamically
	// This is not an unbounded array. It's a small, fixed-size object 
		subject: { 
			type: mongoose.Schema.Types.ObjectId, ref: 'Subject' 
		},
		batch: { type: Number },
		semester: { type: Number },
		section: { type: String }
	}
}, { timestamps: true });

// --- NEW: Index for Unique Naming ---
// Enforces that for any document where isDeleted: false,
// the combination of parentId and fileName must be unique.
fileSchema.index(
    { parentId: 1, fileName: 1, isDeleted: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { isDeleted: false } 
    }
);

// --- NEW: Index for Search ---
// Creates a text index on fileName to power the search endpoint
fileSchema.index({ fileName: 'text' });


const File = mongoose.model("File", fileSchema);
export default File;