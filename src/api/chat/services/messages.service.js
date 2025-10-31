/**
 * Messages Service
 * Business logic for message management
 */

import Message from '../../../models/messageModel.js';
import * as conversationsService from './conversations.service.js';

/**
 * Create a new message
 */
export const createMessage = async (conversationId, senderId, content) => {
    if (!content || !content.trim()) {
        const error = new Error('Message content is required');
        error.statusCode = 400;
        throw error;
    }

    // Verify sender is participant
    await conversationsService.verifyParticipant(conversationId, senderId);

    // Create message
    let message = await Message.create({
        conversation: conversationId,
        sender: senderId,
        content: content.trim(),
    });

    // Populate sender details
    message = await message.populate('sender', 'name avatar');

    // Update conversation's last message
    await conversationsService.updateLastMessage(conversationId, message._id);

    return message;
};

/**
 * Get messages for a conversation with pagination
 */
export const getConversationMessages = async (conversationId, userId, pagination = {}) => {
    // Verify user is participant
    await conversationsService.verifyParticipant(conversationId, userId);

    const page = parseInt(pagination.page) || 1;
    const limit = parseInt(pagination.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ conversation: conversationId })
        .populate('sender', 'name avatar')
        .sort({ createdAt: -1 }) // Latest first
        .skip(skip)
        .limit(limit);

    // Reverse to show oldest to newest in the UI
    return messages.reverse();
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (conversationId, readerId) => {
    // Update all unread messages not sent by the reader
    const result = await Message.updateMany(
        {
            conversation: conversationId,
            sender: { $ne: readerId },
            status: { $ne: 'read' }
        },
        { $set: { status: 'read' } }
    );

    return {
        modifiedCount: result.modifiedCount,
        conversationId
    };
};

/**
 * Get unread message count for a conversation
 */
export const getUnreadCount = async (conversationId, userId) => {
    const count = await Message.countDocuments({
        conversation: conversationId,
        sender: { $ne: userId },
        status: { $ne: 'read' }
    });

    return count;
};

/**
 * Get total unread messages across all user's conversations
 */
export const getTotalUnreadCount = async (userId) => {
    // Get all user's conversations
    const conversations = await conversationsService.getUserConversations(userId);
    const conversationIds = conversations.map(c => c._id);

    // Count unread messages in those conversations
    const count = await Message.countDocuments({
        conversation: { $in: conversationIds },
        sender: { $ne: userId },
        status: { $ne: 'read' }
    });

    return count;
};

/**
 * Delete a message (soft delete or hard delete)
 */
export const deleteMessage = async (messageId, userId) => {
    const message = await Message.findById(messageId);

    if (!message) {
        const error = new Error('Message not found');
        error.statusCode = 404;
        throw error;
    }

    // Only sender can delete their message
    if (message.sender.toString() !== userId) {
        const error = new Error('You can only delete your own messages');
        error.statusCode = 403;
        throw error;
    }

    await message.deleteOne();
    return { id: messageId };
};

/**
 * Search messages in a conversation
 */
export const searchMessages = async (conversationId, userId, searchQuery) => {
    // Verify user is participant
    await conversationsService.verifyParticipant(conversationId, userId);

    const messages = await Message.find({
        conversation: conversationId,
        content: { $regex: searchQuery, $options: 'i' } // Case-insensitive search
    })
        .populate('sender', 'name avatar')
        .sort({ createdAt: -1 })
        .limit(50);

    return messages;
};
