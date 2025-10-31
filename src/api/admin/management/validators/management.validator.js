import Joi from 'joi';

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for updating student details
 */
export const updateStudentDetailsSchema = Joi.object({
  usn: Joi.string().trim().optional(),
  batch: Joi.number().integer().min(2000).optional(),
  section: Joi.string().trim().valid('A', 'B', 'C').optional(),
  semester: Joi.number().integer().min(1).max(4).optional(),
})
  .min(1)
  .messages({
    'object.min':
      'At least one field (usn, batch, semester or section) must be provided to update.',
  });

/**
 * Schema for updating student enrollment
 */
export const updateEnrollmentSchema = Joi.object({
  subjectIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .required()
    .messages({
      'array.base': 'Subject IDs must be an array',
      'string.hex': 'Each subject ID must be a valid hex string',
      'string.length': 'Each subject ID must be 24 characters',
      'any.required': 'Subject IDs are required',
    }),
});

/**
 * Schema for faculty promotion
 */
export const facultyPromotionSchema = Joi.object({
  role: Joi.string().valid('teacher', 'hod').required().messages({
    'any.only': 'Role must be either "teacher" or "hod"',
    'any.required': 'Role is required',
  }),
  staffId: Joi.string().trim().required().messages({
    'string.empty': 'Staff ID is required',
    'any.required': 'Staff ID is required',
  }),
  department: Joi.string().trim().required().messages({
    'string.empty': 'Department is required',
    'any.required': 'Department is required',
  }),
});

/**
 * Schema for role query parameter
 */
export const roleQuerySchema = Joi.object({
  role: Joi.string()
    .valid('user', 'student', 'teacher', 'hod')
    .required()
    .messages({
      'any.only': 'Role must be one of: user, student, teacher, hod',
      'any.required': 'Role query parameter is required',
    }),
});

/**
 * Schema for userId parameter validation
 */
export const userIdParamSchema = Joi.object({
  userId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid user ID format',
      'any.required': 'User ID is required',
    }),
});

/**
 * Schema for studentId parameter validation
 */
export const studentIdParamSchema = Joi.object({
  studentId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid student ID format',
      'any.required': 'Student ID is required',
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
