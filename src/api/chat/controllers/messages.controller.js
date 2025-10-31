/**
 * Messages Controller
 * HTTP request handlers for message management
 */

import asyncHandler from 'express-async-handler';
import * as messagesService from '../services/messages.service.js';

/**
 * @desc    Get all messages for a specific conversation
 * @route   GET /api/chat/conversations/:id/messages
 * @access  Private
 */
export const getMessages = asyncHandler(async (req, res) => {
    const { page, limit } = req.query;

    const messages = await messagesService.getConversationMessages(
        req.params.id,
        req.user.id,
        { page, limit }
    );

    res.status(200).json(messages);
});

/**
 * @desc    Create a new message (HTTP endpoint, not typically used with Socket.IO)
 * @route   POST /api/chat/conversations/:id/messages
 * @access  Private
 */
export const createMessage = asyncHandler(async (req, res) => {
    const { content } = req.body;

    const message = await messagesService.createMessage(
        req.params.id,
        req.user.id,
        content
    );

    res.status(201).json(message);
});

/**
 * @desc    Mark messages as read
 * @route   PUT /api/chat/conversations/:id/messages/read
 * @access  Private
 */
export const markAsRead = asyncHandler(async (req, res) => {
    const result = await messagesService.markMessagesAsRead(
        req.params.id,
        req.user.id
    );

    res.status(200).json(result);
});

/**
 * @desc    Get unread message count for a conversation
 * @route   GET /api/chat/conversations/:id/messages/unread
 * @access  Private
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
    const count = await messagesService.getUnreadCount(
        req.params.id,
        req.user.id
    );

    res.status(200).json({ count });
});

/**
 * @desc    Get total unread messages across all conversations
 * @route   GET /api/chat/messages/unread/total
 * @access  Private
 */
export const getTotalUnreadCount = asyncHandler(async (req, res) => {
    const count = await messagesService.getTotalUnreadCount(req.user.id);
    res.status(200).json({ count });
});

/**
 * @desc    Delete a message
 * @route   DELETE /api/chat/messages/:id
 * @access  Private
 */
export const deleteMessage = asyncHandler(async (req, res) => {
    const result = await messagesService.deleteMessage(
        req.params.id,
        req.user.id
    );
    res.status(200).json(result);
});

/**
 * @desc    Search messages in a conversation
 * @route   GET /api/chat/conversations/:id/messages/search
 * @access  Private
 */
export const searchMessages = asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q) {
        res.status(400);
        throw new Error('Search query is required');
    }

    const messages = await messagesService.searchMessages(
        req.params.id,
        req.user.id,
        q
    );

    res.status(200).json(messages);
});
