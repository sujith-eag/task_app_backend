/**
 * AI Validators (Joi)
 */
import Joi from 'joi';
import validate from '../../../middleware/validation.middleware.js';

const MAX_PROMPT_LENGTH = 1000;
const MAX_SESSION_ID_LENGTH = 100;

export const validatePlanPreview = [
    validate({ body: Joi.object({
        prompt: Joi.string().min(10).max(MAX_PROMPT_LENGTH).required().messages({ 'any.required': 'Prompt is required' }),
        sessionId: Joi.string().max(MAX_SESSION_ID_LENGTH).required().messages({ 'any.required': 'Session ID is required' }),
        editedPlan: Joi.object().optional(),
        history: Joi.array().optional()
    }) })
];

export const validateTaskGeneration = [
    validate({ body: Joi.object({ prompt: Joi.string().min(10).max(MAX_PROMPT_LENGTH).required().messages({ 'any.required': 'Prompt is required' }) }) })
];

export const validatePromptHistory = [
    validate({ query: Joi.object({ sessionId: Joi.string().max(MAX_SESSION_ID_LENGTH).optional(), limit: Joi.number().integer().min(1).max(100).optional() }) })
];

export const validateClearPrompts = [
    validate({ query: Joi.object({ daysOld: Joi.number().integer().min(1).max(365).optional() }) })
];
