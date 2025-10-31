/**
 * Chat Routes
 * RESTful API routes for chat functionality
 */

import express from 'express';
import * as conversationsController from '../controllers/conversations.controller.js';
import * as messagesController from '../controllers/messages.controller.js';
import * as validators from '../validators/chat.validator.js';
import { protect } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../middleware/validation.middleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// ========================================
// CONVERSATION ROUTES
// ========================================

/**
 * @route   GET /api/chat/conversations
 * @desc    Get all conversations for logged-in user
 * @access  Private
 */
router.get(
    '/conversations',
    conversationsController.getConversations
);

/**
 * @route   POST /api/chat/conversations
 * @desc    Find or create conversation with another user
 * @access  Private
 */
router.post(
    '/conversations',
    validators.validateCreateConversation,
    validate,
    conversationsController.createOrGetConversation
);

/**
 * @route   GET /api/chat/conversations/:id
 * @desc    Get a specific conversation by ID
 * @access  Private
 */
router.get(
    '/conversations/:id',
    validators.validateConversationId,
    validate,
    conversationsController.getConversation
);

/**
 * @route   DELETE /api/chat/conversations/:id
 * @desc    Delete a conversation
 * @access  Private
 */
router.delete(
    '/conversations/:id',
    validators.validateConversationId,
    validate,
    conversationsController.deleteConversation
);

// ========================================
// MESSAGE ROUTES
// ========================================

/**
 * @route   GET /api/chat/messages/unread/total
 * @desc    Get total unread message count across all conversations
 * @access  Private
 */
router.get(
    '/messages/unread/total',
    messagesController.getTotalUnreadCount
);

/**
 * @route   GET /api/chat/conversations/:id/messages
 * @desc    Get all messages for a conversation (with pagination)
 * @access  Private
 */
router.get(
    '/conversations/:id/messages',
    validators.validateMessagePagination,
    validate,
    messagesController.getMessages
);

/**
 * @route   POST /api/chat/conversations/:id/messages
 * @desc    Create a new message (typically handled via Socket.IO)
 * @access  Private
 */
router.post(
    '/conversations/:id/messages',
    validators.validateCreateMessage,
    validate,
    messagesController.createMessage
);

/**
 * @route   GET /api/chat/conversations/:id/messages/search
 * @desc    Search messages in a conversation
 * @access  Private
 */
router.get(
    '/conversations/:id/messages/search',
    validators.validateMessageSearch,
    validate,
    messagesController.searchMessages
);

/**
 * @route   GET /api/chat/conversations/:id/messages/unread
 * @desc    Get unread message count for a conversation
 * @access  Private
 */
router.get(
    '/conversations/:id/messages/unread',
    validators.validateConversationId,
    validate,
    messagesController.getUnreadCount
);

/**
 * @route   PUT /api/chat/conversations/:id/messages/read
 * @desc    Mark all messages in a conversation as read
 * @access  Private
 */
router.put(
    '/conversations/:id/messages/read',
    validators.validateConversationId,
    validate,
    messagesController.markAsRead
);

/**
 * @route   DELETE /api/chat/messages/:id
 * @desc    Delete a specific message
 * @access  Private
 */
router.delete(
    '/messages/:id',
    validators.validateMessageId,
    validate,
    messagesController.deleteMessage
);

export default router;
