/**
 * Chat Validators
 * Input validation middleware for chat-related requests
 */

import { body, param, query } from 'express-validator';

/**
 * Validate conversation creation
 */
export const validateCreateConversation = [
    body('recipientId')
        .notEmpty()
        .withMessage('Recipient ID is required')
        .isMongoId()
        .withMessage('Invalid recipient ID format')
];

/**
 * Validate conversation ID parameter
 */
export const validateConversationId = [
    param('id')
        .isMongoId()
        .withMessage('Invalid conversation ID')
];

/**
 * Validate message creation
 */
export const validateCreateMessage = [
    param('id')
        .isMongoId()
        .withMessage('Invalid conversation ID'),
    
    body('content')
        .notEmpty()
        .withMessage('Message content is required')
        .trim()
        .isLength({ min: 1, max: 5000 })
        .withMessage('Message must be between 1 and 5000 characters')
];

/**
 * Validate message pagination
 */
export const validateMessagePagination = [
    param('id')
        .isMongoId()
        .withMessage('Invalid conversation ID'),
    
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
];

/**
 * Validate message ID parameter
 */
export const validateMessageId = [
    param('id')
        .isMongoId()
        .withMessage('Invalid message ID')
];

/**
 * Validate message search
 */
export const validateMessageSearch = [
    param('id')
        .isMongoId()
        .withMessage('Invalid conversation ID'),
    
    query('q')
        .notEmpty()
        .withMessage('Search query is required')
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters')
];

/**
 * Validate Socket.IO message data
 */
export const validateSocketMessage = (data) => {
    const errors = [];

    if (!data) {
        errors.push('Message data is required');
        return errors;
    }

    if (!data.recipientId || typeof data.recipientId !== 'string') {
        errors.push('Valid recipient ID is required');
    }

    if (!data.content || typeof data.content !== 'string') {
        errors.push('Message content is required');
    } else if (data.content.trim().length === 0) {
        errors.push('Message content cannot be empty');
    } else if (data.content.length > 5000) {
        errors.push('Message content cannot exceed 5000 characters');
    }

    return errors;
};
