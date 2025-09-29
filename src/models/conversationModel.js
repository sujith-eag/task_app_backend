import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    participants: [{ // The two users involved in the conversation
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    lastMessage: { // A reference to the most recent message for UI previews
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }
}, { timestamps: true });

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;