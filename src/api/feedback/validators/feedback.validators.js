import Joi from 'joi';
import validate from '../../../middleware/validation.middleware.js';

const mongoId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ID format');

// Submit feedback validation
export const submitFeedbackValidation = [
  validate({ body: Joi.object({ sessionId: mongoId.required(), rating: Joi.number().integer().min(1).max(5).required(), comment: Joi.string().trim().max(1000).optional() }) })
];

// Upsert reflection validation
export const upsertReflectionValidation = [
  validate({ params: Joi.object({ sessionId: mongoId.required() }), body: Joi.object({
    whatWentWell: Joi.string().trim().min(10).max(1000).required(),
    whatCouldImprove: Joi.string().trim().min(10).max(1000).required(),
    studentEngagement: Joi.number().integer().min(1).max(5).required(),
    topicsToRevisit: Joi.array().items(Joi.string().trim().min(2).max(200)).optional(),
    additionalNotes: Joi.string().trim().max(1000).optional()
  }) })
];

// Session ID parameter validation
export const sessionIdValidation = [
  validate({ params: Joi.object({ sessionId: mongoId.required() }) })
];

// Feedback stats query validation
export const feedbackStatsValidation = [
  validate({ query: Joi.object({ subjectId: mongoId.optional(), startDate: Joi.date().iso().optional(), endDate: Joi.date().iso().optional() }) })
];

// Reflection history query validation
export const reflectionHistoryValidation = [
  validate({ query: Joi.object({ subjectId: mongoId.optional(), startDate: Joi.date().iso().optional(), endDate: Joi.date().iso().optional(), limit: Joi.number().integer().min(1).max(200).optional() }) })
];

// Pending reflections query validation
export const pendingReflectionsValidation = [
  validate({ query: Joi.object({ limit: Joi.number().integer().min(1).max(50).optional() }) })
];
