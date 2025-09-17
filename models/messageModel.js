import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    conversation: { // The conversation this message belongs to
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
        index: true
    },
    sender: { // The user who sent the message
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: { // The text content of the message
        type: String,
        required: true,
        trim: true
    }
}, { timestamps: true });

const Message = mongoose.model("Message", messageSchema);
export default Message;