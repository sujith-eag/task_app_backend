/**
 * AI Validators
 * Input validation middleware for AI-related requests
 */

import { body, query } from 'express-validator';

const MAX_PROMPT_LENGTH = 1000;
const MAX_SESSION_ID_LENGTH = 100;

/**
 * Validate AI plan preview request
 */
export const validatePlanPreview = [
    body('prompt')
        .notEmpty()
        .withMessage('Prompt is required')
        .isString()
        .withMessage('Prompt must be a string')
        .isLength({ min: 10, max: MAX_PROMPT_LENGTH })
        .withMessage(`Prompt must be between 10 and ${MAX_PROMPT_LENGTH} characters`),
    
    body('sessionId')
        .notEmpty()
        .withMessage('Session ID is required')
        .isString()
        .withMessage('Session ID must be a string')
        .isLength({ max: MAX_SESSION_ID_LENGTH })
        .withMessage(`Session ID cannot exceed ${MAX_SESSION_ID_LENGTH} characters`),
    
    body('editedPlan')
        .optional()
        .isObject()
        .withMessage('Edited plan must be an object'),
    
    body('history')
        .optional()
        .isArray()
        .withMessage('History must be an array')
];

/**
 * Validate task generation request
 */
export const validateTaskGeneration = [
    body('prompt')
        .notEmpty()
        .withMessage('Prompt is required')
        .isString()
        .withMessage('Prompt must be a string')
        .isLength({ min: 10, max: MAX_PROMPT_LENGTH })
        .withMessage(`Prompt must be between 10 and ${MAX_PROMPT_LENGTH} characters`)
];

/**
 * Validate prompt history query
 */
export const validatePromptHistory = [
    query('sessionId')
        .optional()
        .isString()
        .withMessage('Session ID must be a string')
        .isLength({ max: MAX_SESSION_ID_LENGTH })
        .withMessage(`Session ID cannot exceed ${MAX_SESSION_ID_LENGTH} characters`),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
];

/**
 * Validate clear prompts request
 */
export const validateClearPrompts = [
    query('daysOld')
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage('Days old must be between 1 and 365')
];
