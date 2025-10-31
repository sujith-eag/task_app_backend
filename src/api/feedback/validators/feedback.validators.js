import { body, param, query } from 'express-validator';

/**
 * Validation rules for Feedback Domain (Phase 0)
 */

// Submit feedback validation
export const submitFeedbackValidation = [
  body('sessionId')
    .notEmpty().withMessage('Session ID is required')
    .isMongoId().withMessage('Invalid session ID'),
  body('rating')
    .notEmpty().withMessage('Rating is required')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .isString().withMessage('Comment must be a string')
    .trim()
    .isLength({ max: 1000 }).withMessage('Comment must not exceed 1000 characters')
];

// Upsert reflection validation
export const upsertReflectionValidation = [
  param('sessionId')
    .notEmpty().withMessage('Session ID is required')
    .isMongoId().withMessage('Invalid session ID'),
  body('whatWentWell')
    .notEmpty().withMessage('What went well is required')
    .isString().withMessage('What went well must be a string')
    .trim()
    .isLength({ min: 10, max: 1000 }).withMessage('What went well must be between 10 and 1000 characters'),
  body('whatCouldImprove')
    .notEmpty().withMessage('What could improve is required')
    .isString().withMessage('What could improve must be a string')
    .trim()
    .isLength({ min: 10, max: 1000 }).withMessage('What could improve must be between 10 and 1000 characters'),
  body('studentEngagement')
    .notEmpty().withMessage('Student engagement rating is required')
    .isInt({ min: 1, max: 5 }).withMessage('Student engagement must be between 1 and 5'),
  body('topicsToRevisit')
    .optional()
    .isArray().withMessage('Topics to revisit must be an array'),
  body('topicsToRevisit.*')
    .isString().withMessage('Each topic must be a string')
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage('Each topic must be between 2 and 200 characters'),
  body('additionalNotes')
    .optional()
    .isString().withMessage('Additional notes must be a string')
    .trim()
    .isLength({ max: 1000 }).withMessage('Additional notes must not exceed 1000 characters')
];

// Session ID parameter validation
export const sessionIdValidation = [
  param('sessionId')
    .notEmpty().withMessage('Session ID is required')
    .isMongoId().withMessage('Invalid session ID')
];

// Feedback stats query validation
export const feedbackStatsValidation = [
  query('subjectId')
    .optional()
    .isMongoId().withMessage('Invalid subject ID'),
  query('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date format')
];

// Reflection history query validation
export const reflectionHistoryValidation = [
  query('subjectId')
    .optional()
    .isMongoId().withMessage('Invalid subject ID'),
  query('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date format'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
];

// Pending reflections query validation
export const pendingReflectionsValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
];
