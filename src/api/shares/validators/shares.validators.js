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
 * Schema for sharing with one or multiple classes
 * Accepts either a single class share or an array of class shares
 */
export const shareWithClassSchema = Joi.object({
  classShares: Joi.array()
    .items(
      Joi.object({
        batch: Joi.number().integer().min(2020).max(2035).required().messages({
          'number.base': 'Batch must be a number',
          'number.min': 'Batch must be between 2020 and 2035',
          'number.max': 'Batch must be between 2020 and 2035',
          'any.required': 'Batch is required',
        }),
        semester: Joi.number().integer().min(1).max(8).required().messages({
          'number.base': 'Semester must be a number',
          'number.min': 'Semester must be between 1 and 8',
          'number.max': 'Semester must be between 1 and 8',
          'any.required': 'Semester is required',
        }),
        section: Joi.string()
          .valid('A', 'B', 'C')
          .uppercase()
          .required()
          .messages({
            'any.only': 'Section must be A, B, or C',
            'any.required': 'Section is required',
          }),
        subjectId: Joi.string().hex().length(24).required().messages({
          'string.hex': 'Subject ID must be a valid MongoDB ObjectId',
          'string.length': 'Subject ID must be 24 characters',
          'any.required': 'Subject ID is required',
        }),
        expiresAt: Joi.date().iso().optional().allow(null).messages({
          'date.format': 'Expiration date must be in ISO format',
        }),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one class share must be provided',
      'any.required': 'Class shares array is required',
    }),
  description: Joi.string().trim().max(500).optional().allow(null, '').messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
});

/**
 * Schema for removing class shares
 */
export const removeClassShareSchema = Joi.object({
  classFilters: Joi.array()
    .items(
      Joi.object({
        batch: Joi.number().integer().required(),
        semester: Joi.number().integer().required(),
        section: Joi.string().valid('A', 'B', 'C').required(),
        subjectId: Joi.string().hex().length(24).required(),
      })
    )
    .optional()
    .default([])
    .messages({
      'array.base': 'Class filters must be an array',
    }),
});

/**
 * Schema for updating class share expiration
 */
export const updateClassShareExpirationSchema = Joi.object({
  expiresAt: Joi.date().iso().allow(null).required().messages({
    'date.format': 'Expiration date must be in ISO format',
    'any.required': 'Expiration date is required (use null for no expiration)',
  }),
});

/**
 * Schema for getting class materials (query params)
 */
export const getClassMaterialsSchema = Joi.object({
  subjectId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Subject ID must be a valid MongoDB ObjectId',
    'string.length': 'Subject ID must be 24 characters',
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

    // Only replace req.body (req.query and req.params are read-only in newer Express)
    // The validation already succeeded, so we just use the original values
    if (source === 'body') {
      req[source] = value;
    }
    // For query and params, validation passes but we don't reassign
    // The original req.query and req.params already have the correct values
    
    next();
  };
};
