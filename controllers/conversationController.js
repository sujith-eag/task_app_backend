import asyncHandler from 'express-async-handler';
import Conversation from '../models/conversationModel.js';



// @desc    Get all conversations for the logged-in user
// @route   GET /api/conversations
// @access  Private
export const getConversations = asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({ participants: req.user.id })
        .populate('participants', 'name avatar') // Populate participant details
        .sort({ updatedAt: -1 }); // Show most recent conversations first

    res.status(200).json(conversations);
});