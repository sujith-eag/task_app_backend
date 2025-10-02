import mongoose from "mongoose";

const classSessionSchema = new mongoose.Schema({
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true,
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['Theory', 'Lab'],
        required: true,
    },
    batch: {
        type: Number,
        required: true
    },
    semester: {
	    type: Number,
	    required: true,
    },
	section: {
        type: String,
        enum: ['A', 'B'],
        required: true,
    },    
    startTime: {
        type: Date,
        default: Date.now,
    },
    attendanceCode: { // A random 8-digit generated number
        type: String,
    },
    attendanceWindowExpires: {
        type: Date,
    },

    attendanceRecords: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        status: {
            type: Boolean,
            default: false 
        },
        hasSubmittedFeedback: {
            type: Boolean,
            default: false
        },
        feedbackSubmittedAt: { type: Date }
    }],
}, { timestamps: true });

// Indexing for fetching classes by subject or teacher
classSessionSchema.index({ subject: 1, createdAt: -1 });
classSessionSchema.index({ teacher: 1, createdAt: -1 });

const ClassSession = mongoose.model("ClassSession", classSessionSchema);
export default ClassSession;