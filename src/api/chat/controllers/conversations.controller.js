/**
 * Conversations Controller
 * HTTP request handlers for conversation management
 */

import asyncHandler from 'express-async-handler';
import * as conversationsService from '../services/conversations.service.js';

/**
 * @desc    Find or create a conversation with another user
 * @route   POST /api/chat/conversations
 * @access  Private
 */
export const createOrGetConversation = asyncHandler(async (req, res) => {
    const { recipientId } = req.body;
    const senderId = req.user.id;

    const conversation = await conversationsService.findOrCreateConversation(
        senderId,
        recipientId
    );

    res.status(200).json(conversation);
});

/**
 * @desc    Get all conversations for the logged-in user
 * @route   GET /api/chat/conversations
 * @access  Private
 */
export const getConversations = asyncHandler(async (req, res) => {
    const conversations = await conversationsService.getUserConversations(req.user.id);
    res.status(200).json(conversations);
});

/**
 * @desc    Get a specific conversation by ID
 * @route   GET /api/chat/conversations/:id
 * @access  Private
 */
export const getConversation = asyncHandler(async (req, res) => {
    const conversation = await conversationsService.getConversationById(
        req.params.id,
        req.user.id
    );
    res.status(200).json(conversation);
});

/**
 * @desc    Delete a conversation
 * @route   DELETE /api/chat/conversations/:id
 * @access  Private
 */
export const deleteConversation = asyncHandler(async (req, res) => {
    const result = await conversationsService.deleteConversation(
        req.params.id,
        req.user.id
    );
    res.status(200).json(result);
});
