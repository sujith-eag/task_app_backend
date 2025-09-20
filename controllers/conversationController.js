import asyncHandler from 'express-async-handler';
import Conversation from '../models/conversationModel.js';

// @desc    Find or create a conversation with another user
// @route   POST /api/conversations
// @access  Private
export const createOrGetConversation = asyncHandler(async (req, res) => {
    const { recipientId } = req.body;
    const senderId = req.user.id;

    if (!recipientId) {
        res.status(400);
        throw new Error('Recipient ID is required.');
    }

    // Use $all to find a conversation with both participants, regardless of order
    let conversation = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] },
    }).populate('participants', 'name avatar');

    // If no conversation exists, create a new one
    if (!conversation) {
        let newConversation = await Conversation.create({ participants: [senderId, recipientId] });
        conversation = await newConversation.populate('participants', 'name avatar');
    }

    res.status(200).json(conversation);
});

// @desc    Get all conversations for the logged-in user
// @route   GET /api/conversations
// @access  Private
export const getConversations = asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({ participants: req.user.id })
        .populate('participants', 'name avatar') // Populate participant details
        .sort({ updatedAt: -1 }); // Show most recent conversations first

    res.status(200).json(conversations);
});