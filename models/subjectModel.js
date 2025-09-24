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
    teachers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
}, { timestamps: true });

const Subject = mongoose.model("Subject", subjectSchema);
export default Subject;