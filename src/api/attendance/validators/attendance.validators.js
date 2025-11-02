import Joi from 'joi';
import validate from '../../_common/middleware/validation.middleware.js';

const mongoId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ID format');

// Session creation validation
export const createSessionValidation = [
  validate({ body: Joi.object({
    subject: mongoId.required(),
    batch: Joi.number().integer().min(2000).max(2100).required(),
    semester: Joi.number().integer().min(1).max(8).required(),
    section: Joi.string().valid('A', 'B', 'C').required(),
    topic: Joi.string().trim().min(3).max(200).required(),
    sessionType: Joi.string().valid('lecture', 'lab', 'tutorial', 'seminar').required()
  }) })
];

// Mark attendance validation
export const markAttendanceValidation = [
  validate({ body: Joi.object({ attendanceCode: Joi.string().pattern(/^\d{8}$/).required() }) })
];

// Update attendance record validation
export const updateAttendanceValidation = [
  validate({ params: Joi.object({ recordId: mongoId.required() }), body: Joi.object({ status: Joi.string().valid('present', 'absent', 'late').required() }) })
];

// Bulk update validation
export const bulkUpdateValidation = [
  validate({ body: Joi.object({ updates: Joi.array().items(Joi.object({ recordId: mongoId.required(), status: Joi.string().valid('present', 'absent', 'late').required() })).min(1).required() }) })
];

// Session ID parameter validation
export const sessionIdValidation = [
  validate({ params: Joi.object({ sessionId: mongoId.required() }) })
];

// Subject ID parameter validation
export const subjectIdValidation = [
  validate({ params: Joi.object({ subjectId: mongoId.required() }) })
];

// Class stats query validation
export const classStatsValidation = [
  validate({ query: Joi.object({ batch: Joi.number().integer().min(2000).max(2100).required(), semester: Joi.number().integer().min(1).max(8).required(), section: Joi.string().valid('A', 'B', 'C').required(), subjectId: mongoId.required() }) })
];

// Low attendance query validation
export const lowAttendanceValidation = [
  validate({ query: Joi.object({ threshold: Joi.number().min(0).max(100).required(), batch: Joi.number().integer().min(2000).max(2100).required(), semester: Joi.number().integer().min(1).max(8).required(), section: Joi.string().valid('A', 'B', 'C').required(), subjectId: mongoId.optional() }) })
];

// Export data query validation
export const exportDataValidation = [
  validate({ query: Joi.object({ batch: Joi.number().integer().min(2000).max(2100).required(), semester: Joi.number().integer().min(1).max(8).required(), section: Joi.string().valid('A', 'B', 'C').required(), subjectId: mongoId.optional(), startDate: Joi.date().iso().optional(), endDate: Joi.date().iso().optional() }) })
];

// Trend query validation
export const trendValidation = [
  validate({ query: Joi.object({ subjectId: mongoId.optional(), startDate: Joi.date().iso().optional(), endDate: Joi.date().iso().optional() }) })
];

// History query validation
export const historyValidation = [
  validate({ query: Joi.object({ subjectId: mongoId.optional(), batch: Joi.number().integer().min(2000).max(2100).optional(), semester: Joi.number().integer().min(1).max(8).optional(), section: Joi.string().valid('A', 'B', 'C').optional(), status: Joi.string().valid('active', 'completed').optional(), startDate: Joi.date().iso().optional(), endDate: Joi.date().iso().optional(), limit: Joi.number().integer().min(1).max(200).optional() }) })
];
