/**
 * Conversations Service
 * Business logic for conversation management
 */

import Conversation from '../../../models/conversationModel.js';

/**
 * Find or create a conversation between two users
 */
export const findOrCreateConversation = async (senderId, recipientId) => {
    if (!recipientId) {
        const error = new Error('Recipient ID is required');
        error.statusCode = 400;
        throw error;
    }

    // Find existing conversation with both participants
    let conversation = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] },
    }).populate('participants', 'name avatar');

    // Create new conversation if none exists
    if (!conversation) {
        const newConversation = await Conversation.create({
            participants: [senderId, recipientId]
        });
        conversation = await newConversation.populate('participants', 'name avatar');
    }

    return conversation;
};

/**
 * Get all conversations for a user
 */
export const getUserConversations = async (userId) => {
    const conversations = await Conversation.find({
        participants: userId
    })
        .populate('participants', 'name avatar')
        .populate('lastMessage')
        .sort({ updatedAt: -1 }); // Most recent first

    return conversations;
};

/**
 * Get a specific conversation by ID
 */
export const getConversationById = async (conversationId, userId) => {
    const conversation = await Conversation.findById(conversationId)
        .populate('participants', 'name avatar');

    if (!conversation) {
        const error = new Error('Conversation not found');
        error.statusCode = 404;
        throw error;
    }

    // Verify user is a participant
    const isParticipant = conversation.participants.some(
        p => p._id.toString() === userId
    );

    if (!isParticipant) {
        const error = new Error('User is not a participant in this conversation');
        error.statusCode = 403;
        throw error;
    }

    return conversation;
};

/**
 * Update conversation's last message
 */
export const updateLastMessage = async (conversationId, messageId) => {
    const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        { lastMessage: messageId },
        { new: true }
    );

    return conversation;
};

/**
 * Verify user is participant in conversation
 */
export const verifyParticipant = async (conversationId, userId) => {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
        const error = new Error('Conversation not found');
        error.statusCode = 404;
        throw error;
    }

    const isParticipant = conversation.participants.some(
        p => p.toString() === userId
    );

    if (!isParticipant) {
        const error = new Error('User is not a participant in this conversation');
        error.statusCode = 403;
        throw error;
    }

    return conversation;
};

/**
 * Delete a conversation (if needed in future)
 */
export const deleteConversation = async (conversationId, userId) => {
    const conversation = await verifyParticipant(conversationId, userId);
    await conversation.deleteOne();
    return { id: conversationId };
};
