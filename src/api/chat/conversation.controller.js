import asyncHandler from 'express-async-handler';
import Conversation from '../../models/conversationModel.js';
import Message from '../../models/messageModel.js';


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


// @desc    Get all messages for a specific conversation
// @route   GET /api/conversations/:id/messages
// @access  Private
export const getMessagesForConversation = asyncHandler(async (req, res) => {
    // First, check if the user is a participant in the conversation to secure the endpoint
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.participants.includes(req.user.id)) {
        res.status(404);
        throw new Error('Conversation not found or user is not a participant.');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Load 50 messages per page
    const skip = (page - 1) * limit;

    const messages = await Message.find({ conversation: req.params.id })
        .populate('sender', 'name avatar') // Populate sender details
        .sort({ createdAt: -1 }) // Sort descending to get the latest messages
        .skip(skip)
        .limit(limit);

    // Send the messages reversed so they appear correctly (oldest to newest) in the slice
    res.status(200).json(messages.reverse()); 
});