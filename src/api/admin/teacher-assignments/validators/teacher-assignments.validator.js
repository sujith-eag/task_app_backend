import Joi from 'joi';

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for adding/updating a teacher's subject assignment
 */
export const teacherAssignmentSchema = Joi.object({
  subject: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({
      'string.hex': 'Subject ID must be a valid hex string',
      'string.length': 'Subject ID must be 24 characters',
      'any.required': 'Subject ID is required',
    }),
  sections: Joi.array()
    .items(Joi.string())
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one section must be provided',
      'array.base': 'Sections must be an array',
      'any.required': 'Sections are required',
    }),
  batch: Joi.number()
    .integer()
    .required()
    .messages({
      'number.base': 'Batch must be a number',
      'any.required': 'Batch is required',
    }),
  semester: Joi.number()
    .integer()
    .min(1)
    .max(4)
    .required()
    .messages({
      'number.min': 'Semester must be between 1 and 4',
      'number.max': 'Semester must be between 1 and 4',
      'any.required': 'Semester is required',
    }),
});

/**
 * Schema for teacherId parameter validation
 */
export const teacherIdParamSchema = Joi.object({
  teacherId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid teacher ID format',
      'any.required': 'Teacher ID is required',
    }),
});

/**
 * Schema for assignmentId parameter validation
 */
export const assignmentIdParamSchema = Joi.object({
  teacherId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid teacher ID format',
      'any.required': 'Teacher ID is required',
    }),
  assignmentId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid assignment ID format',
      'any.required': 'Assignment ID is required',
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
