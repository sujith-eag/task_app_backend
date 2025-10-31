import { body, param, query } from 'express-validator';

/**
 * Validation rules for Attendance Domain (Phase 0)
 */

// Session creation validation
export const createSessionValidation = [
  body('subject')
    .notEmpty().withMessage('Subject is required')
    .isMongoId().withMessage('Invalid subject ID'),
  body('batch')
    .notEmpty().withMessage('Batch is required')
    .isInt({ min: 2000, max: 2100 }).withMessage('Invalid batch year'),
  body('semester')
    .notEmpty().withMessage('Semester is required')
    .isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8'),
  body('section')
    .notEmpty().withMessage('Section is required')
    .isIn(['A', 'B', 'C']).withMessage('Section must be A, B, or C'),
  body('topic')
    .notEmpty().withMessage('Topic is required')
    .isString().withMessage('Topic must be a string')
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage('Topic must be between 3 and 200 characters'),
  body('sessionType')
    .notEmpty().withMessage('Session type is required')
    .isIn(['lecture', 'lab', 'tutorial', 'seminar']).withMessage('Invalid session type')
];

// Mark attendance validation
export const markAttendanceValidation = [
  body('attendanceCode')
    .notEmpty().withMessage('Attendance code is required')
    .isString().withMessage('Attendance code must be a string')
    .matches(/^\d{8}$/).withMessage('Attendance code must be 8 digits')
];

// Update attendance record validation
export const updateAttendanceValidation = [
  param('recordId')
    .notEmpty().withMessage('Record ID is required')
    .isMongoId().withMessage('Invalid record ID'),
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['present', 'absent', 'late']).withMessage('Status must be present, absent, or late')
];

// Bulk update validation
export const bulkUpdateValidation = [
  body('updates')
    .isArray({ min: 1 }).withMessage('Updates must be a non-empty array'),
  body('updates.*.recordId')
    .notEmpty().withMessage('Record ID is required')
    .isMongoId().withMessage('Invalid record ID'),
  body('updates.*.status')
    .notEmpty().withMessage('Status is required')
    .isIn(['present', 'absent', 'late']).withMessage('Status must be present, absent, or late')
];

// Session ID parameter validation
export const sessionIdValidation = [
  param('sessionId')
    .notEmpty().withMessage('Session ID is required')
    .isMongoId().withMessage('Invalid session ID')
];

// Subject ID parameter validation
export const subjectIdValidation = [
  param('subjectId')
    .notEmpty().withMessage('Subject ID is required')
    .isMongoId().withMessage('Invalid subject ID')
];

// Class stats query validation
export const classStatsValidation = [
  query('batch')
    .notEmpty().withMessage('Batch is required')
    .isInt({ min: 2000, max: 2100 }).withMessage('Invalid batch year'),
  query('semester')
    .notEmpty().withMessage('Semester is required')
    .isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8'),
  query('section')
    .notEmpty().withMessage('Section is required')
    .isIn(['A', 'B', 'C']).withMessage('Section must be A, B, or C'),
  query('subjectId')
    .notEmpty().withMessage('Subject ID is required')
    .isMongoId().withMessage('Invalid subject ID')
];

// Low attendance query validation
export const lowAttendanceValidation = [
  query('threshold')
    .notEmpty().withMessage('Threshold is required')
    .isFloat({ min: 0, max: 100 }).withMessage('Threshold must be between 0 and 100'),
  query('batch')
    .notEmpty().withMessage('Batch is required')
    .isInt({ min: 2000, max: 2100 }).withMessage('Invalid batch year'),
  query('semester')
    .notEmpty().withMessage('Semester is required')
    .isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8'),
  query('section')
    .notEmpty().withMessage('Section is required')
    .isIn(['A', 'B', 'C']).withMessage('Section must be A, B, or C'),
  query('subjectId')
    .optional()
    .isMongoId().withMessage('Invalid subject ID')
];

// Export data query validation
export const exportDataValidation = [
  query('batch')
    .notEmpty().withMessage('Batch is required')
    .isInt({ min: 2000, max: 2100 }).withMessage('Invalid batch year'),
  query('semester')
    .notEmpty().withMessage('Semester is required')
    .isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8'),
  query('section')
    .notEmpty().withMessage('Section is required')
    .isIn(['A', 'B', 'C']).withMessage('Section must be A, B, or C'),
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

// Trend query validation
export const trendValidation = [
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

// History query validation
export const historyValidation = [
  query('subjectId')
    .optional()
    .isMongoId().withMessage('Invalid subject ID'),
  query('batch')
    .optional()
    .isInt({ min: 2000, max: 2100 }).withMessage('Invalid batch year'),
  query('semester')
    .optional()
    .isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8'),
  query('section')
    .optional()
    .isIn(['A', 'B', 'C']).withMessage('Section must be A, B, or C'),
  query('status')
    .optional()
    .isIn(['active', 'completed']).withMessage('Status must be active or completed'),
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
