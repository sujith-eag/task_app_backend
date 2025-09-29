import mongoose from "mongoose";

const promptSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true,
        index: true 
    },
    promptText: { 
        type: String, 
        required: true 
    },
    // A simple way to group prompts from a single interactive session
    sessionId: { 
        type: String, 
        required: true 
    },
    isInitialPrompt: {
        type: Boolean,
        default: false,
    }
}, { timestamps: true });

const Prompt = mongoose.model("Prompt", promptSchema);
export default Prompt;