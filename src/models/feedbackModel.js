import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true,
        index: true,
    },
    classSession: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClassSession',
        required: true,
    },
    batch: { type: Number, required: true },
    semester: { type: Number, required: true },
    
    // --- Quantitative Feedback Metrics (Scale of 1-5) ---
    ratings: {
        clarity: { type: Number, min: 1, max: 5, required: true },
        engagement: { type: Number, min: 1, max: 5, required: true },
        pace: { type: Number, min: 1, max: 5, required: true },
        knowledge: { type: Number, min: 1, max: 5, required: true },
    },

    // --- Qualitative Feedback (Text) ---
    positiveFeedback: { type: String, trim: true, maxlength: 500 },
    improvementSuggestions: { type: String, trim: true, maxlength: 500 },

}, { timestamps: true });

const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;