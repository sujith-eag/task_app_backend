import Joi from 'joi';

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for creating a new subject
 */
export const createSubjectSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Subject name is required',
    'any.required': 'Subject name is required',
  }),
  subjectCode: Joi.string().trim().required().messages({
    'string.empty': 'Subject code is required',
    'any.required': 'Subject code is required',
  }),
  semester: Joi.number().integer().min(1).max(4).required().messages({
    'number.min': 'Semester must be between 1 and 4',
    'number.max': 'Semester must be between 1 and 4',
    'any.required': 'Semester is required',
  }),
  department: Joi.string().trim().required().messages({
    'string.empty': 'Department is required',
    'any.required': 'Department is required',
  }),
});

/**
 * Schema for updating a subject
 */
export const updateSubjectSchema = Joi.object({
  name: Joi.string().trim().optional(),
  subjectCode: Joi.string().trim().optional(),
  semester: Joi.number().integer().min(1).max(4).optional(),
  department: Joi.string().trim().optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided to update',
  });

/**
 * Schema for semester query parameter
 */
export const semesterQuerySchema = Joi.object({
  semester: Joi.number().integer().min(1).max(4).optional().messages({
    'number.min': 'Semester must be between 1 and 4',
    'number.max': 'Semester must be between 1 and 4',
  }),
});

/**
 * Schema for subject ID parameter validation
 */
export const subjectIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid subject ID format',
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
