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

    // Safely apply the validated value back to the request.
    // Some server frameworks expose `req.query` as a getter-only property on the
    // IncomingMessage prototype. Replacing that property will throw
    // "Cannot set property query ... which has only a getter". To be robust
    // across environments, merge validated values into the existing object
    // when possible, and otherwise attach them to `req.validated`.
    try {
      if (source === 'query' && req.query && typeof req.query === 'object') {
        // Remove any keys not present in the validated value, then assign
        // validated keys. This keeps downstream code that reads `req.query` working.
        Object.keys(req.query).forEach((k) => {
          if (!(k in value)) delete req.query[k];
        });
        Object.assign(req.query, value);
      } else {
        // body and params are usually safe to replace
        req[source] = value;
      }
    } catch (e) {
      // Fallback: attach validated data to req.validated so controllers can read it
      req.validated = req.validated || {};
      req.validated[source] = value;
    }
    next();
  };
};
