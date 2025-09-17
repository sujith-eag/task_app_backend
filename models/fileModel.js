import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
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
    fileType: { // The MIME type of the file, e.g., 'image/jpeg'
        type: String,
        required: true
    },
    sharedWith: [{ // Array of users this file is shared with
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true });

const File = mongoose.model("File", fileSchema);
export default File;