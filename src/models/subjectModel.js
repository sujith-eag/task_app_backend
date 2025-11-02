import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    subjectCode: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    semester: {
        type: Number,
        required: true,
        min: 1,
        max: 4,
    },
    department: {
        type: String,
        required: true,
    },
    // --- NEW ---
    isElective: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Subject = mongoose.model("Subject", subjectSchema);
export default Subject;