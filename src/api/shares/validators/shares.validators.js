import Joi from 'joi';

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for creating public share
 */
export const createPublicShareSchema = Joi.object({
  duration: Joi.string()
    .valid('1-hour', '1-day', '7-days')
    .required()
    .messages({
      'any.only': 'Duration must be one of: 1-hour, 1-day, 7-days',
      'any.required': 'Duration is required',
    }),
});

/**
 * Schema for getting public download link
 */
export const publicDownloadSchema = Joi.object({
  code: Joi.string().required().trim().messages({
    'string.empty': 'Share code is required',
    'any.required': 'Share code is required',
  }),
});

/**
 * Schema for sharing with user
 */
export const shareWithUserSchema = Joi.object({
  userIdToShareWith: Joi.string().required().messages({
    'string.empty': 'User ID is required',
    'any.required': 'User ID to share with is required',
  }),
  expiresAt: Joi.date().iso().optional().allow(null).messages({
    'date.format': 'Expiration date must be in ISO format',
  }),
});

/**
 * Schema for removing user access
 */
export const removeUserAccessSchema = Joi.object({
  userIdToRemove: Joi.string().optional().allow(null).messages({
    'string.empty': 'User ID must be a valid string or null',
  }),
});

/**
 * Schema for bulk remove
 */
export const bulkRemoveSchema = Joi.object({
  fileIds: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one file ID must be provided',
      'any.required': 'File IDs array is required',
    }),
});

/**
 * Schema for class share
 */
export const shareWithClassSchema = Joi.object({
  batch: Joi.number().integer().min(2000).max(2100).required().messages({
    'number.base': 'Batch must be a number',
    'number.min': 'Batch must be between 2000 and 2100',
    'number.max': 'Batch must be between 2000 and 2100',
    'any.required': 'Batch is required',
  }),
  semester: Joi.number().integer().min(1).max(8).required().messages({
    'number.base': 'Semester must be a number',
    'number.min': 'Semester must be between 1 and 8',
    'number.max': 'Semester must be between 1 and 8',
    'any.required': 'Semester is required',
  }),
  section: Joi.string().trim().uppercase().required().messages({
    'string.empty': 'Section is required',
    'any.required': 'Section is required',
  }),
  subjectId: Joi.string().required().messages({
    'string.empty': 'Subject ID is required',
    'any.required': 'Subject ID is required',
  }),
});

// ============================================================================
// Validation Middleware Helper
// ============================================================================

/**
 * Creates validation middleware for a given schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} source - Source to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(', ');
      return res.status(400).json({ message: errorMessage });
    }

    // Replace req[source] with validated and sanitized value
    req[source] = value;
    next();
  };
};
