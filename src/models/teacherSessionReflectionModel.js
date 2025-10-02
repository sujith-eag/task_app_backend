import mongoose from "mongoose";

const teacherSessionReflectionSchema = new mongoose.Schema({
    classSession: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'ClassSession', 
        required: true, 
        unique: true, 
        index: true
    },
    teacher: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true
    },
    selfAssessment: {
        effectiveness: { type: Number, min: 1, max: 5, required: true },
        studentEngagement: { type: Number, min: 1, max: 5, required: true },
        pace: { type: String, enum: ['Too Slow', 'Just Right', 'Too Fast'], required: true },
    },
    sessionHighlights: { type: String, trim: true, 
        required: true, maxlength: 500 },
    challengesFaced: { type: String, trim: true, maxlength: 500 },
    improvementsForNextSession: { type: String, trim: true, maxlength: 500 },
    
    status: {
        type: String,
        enum: ['Submitted', 'Reviewed', 'ActionTaken'],
        default: 'Submitted'
    }    
}, { timestamps: true });

const TeacherSessionReflection = mongoose.model("TeacherSessionReflection", teacherSessionReflectionSchema);
export default TeacherSessionReflection;