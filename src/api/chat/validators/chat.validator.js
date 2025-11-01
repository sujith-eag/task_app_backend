/**
 * Chat Validators (Joi)
 */
import Joi from 'joi';
import validate from '../../../middleware/validation.middleware.js';

const mongoId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ID format');

export const validateCreateConversation = [
    validate({ body: Joi.object({ recipientId: mongoId.required().messages({ 'any.required': 'Recipient ID is required' }) }) })
];

export const validateConversationId = [
    validate({ params: Joi.object({ id: mongoId.required().messages({ 'any.required': 'Conversation ID is required' }) }) })
];

export const validateCreateMessage = [
    validate({
        params: Joi.object({ id: mongoId.required() }),
        body: Joi.object({ content: Joi.string().trim().min(1).max(5000).required().messages({ 'any.required': 'Message content is required' }) })
    })
];

export const validateMessagePagination = [
    validate({
        params: Joi.object({ id: mongoId.required() }),
        query: Joi.object({
            page: Joi.number().integer().min(1).optional(),
            limit: Joi.number().integer().min(1).max(100).optional()
        })
    })
];

export const validateMessageId = [
    validate({ params: Joi.object({ id: mongoId.required() }) })
];

export const validateMessageSearch = [
    validate({
        params: Joi.object({ id: mongoId.required() }),
        query: Joi.object({ q: Joi.string().min(1).max(100).required().messages({ 'any.required': 'Search query is required' }) })
    })
];

export const validateSocketMessage = (data) => {
    const schema = Joi.object({
        recipientId: Joi.string().required(),
        content: Joi.string().trim().min(1).max(5000).required()
    });

    const { error } = schema.validate(data, { abortEarly: false });
    if (!error) return [];
    return error.details.map(d => d.message);
};
