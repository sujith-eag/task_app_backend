import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true,
    },
    classSession: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClassSession',
        required: true,
    },
    
    // --- FEEDBACK CONTENT, Needs to Expand on this---
    rating: { // scale of 1 to 10
        type: Number,
        min: 1,
        max: 10,
        required: true,
    },
    comment: {
        type: String,
        trim: true,
    },

}, { timestamps: true });

feedbackSchema.index({ teacher: 1, subject: 1 });

const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;