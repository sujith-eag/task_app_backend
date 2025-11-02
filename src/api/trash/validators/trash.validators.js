import Joi from 'joi';

// ============================================================================
// Validation Schemas (trash)
// ============================================================================

/**
 * Schema for bulk operations (soft-delete, restore, purge)
 */
export const bulkOperationSchema = Joi.object({
  fileIds: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one file ID must be provided',
      'array.base': 'File IDs must be an array',
      'any.required': 'File IDs are required',
    }),
});

/**
 * Schema for cleanup operation
 */
export const cleanupSchema = Joi.object({
  retentionDays: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(30)
    .messages({
      'number.min': 'Retention days must be at least 1',
      'number.max': 'Retention days cannot exceed 365',
    }),
});

/**
 * Schema for fileId parameter validation
 */
export const fileIdParamSchema = Joi.object({
  fileId: Joi.string().required().messages({
    'string.empty': 'File ID is required',
    'any.required': 'File ID is required',
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

export default {
  bulkOperationSchema,
  cleanupSchema,
  fileIdParamSchema,
  validate,
};
