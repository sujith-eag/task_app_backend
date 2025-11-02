import Joi from 'joi';

/**
 * Joi Schema for profile updates
 * Validates user profile fields (name, bio, preferences)
 */
export const updateProfileSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).optional()
        .messages({
            'string.min': 'Name must be at least 2 characters long',
            'string.max': 'Name must not exceed 50 characters'
        }),
    bio: Joi.string().trim().max(250).allow('').optional()
        .messages({
            'string.max': 'Bio must not exceed 250 characters'
        }),
    preferences: Joi.object({
        theme: Joi.string().valid('light', 'dark').optional(),
        isDiscoverable: Joi.boolean().optional(),
        // Accept both the misspelled key and the correct spelling for compatibility
        canRecieveMessages: Joi.boolean().optional(),
        canReceiveMessages: Joi.boolean().optional(),
        canRecieveFiles: Joi.boolean().optional(),
    }).optional(),
});

/**
 * Joi Schema for password change
 * Validates current password, new password, and confirmation
 */
export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required()
        .messages({
            'string.empty': 'Current password is required'
        }),
    newPassword: Joi.string()
        .pattern(new RegExp(
            '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'
        ))
        .required()
        .messages({
            'string.pattern.base': 'Password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, a number, and a special character.',
            'string.empty': 'New password is required'
        }),
    confirmPassword: Joi.string()
        .required()
        .valid(Joi.ref('newPassword'))
        .messages({
            'any.only': 'Passwords do not match.',
            'string.empty': 'Password confirmation is required'
        }),
});

/**
 * Joi Schema for student application
 * Validates USN, section, batch, and semester
 */
export const studentApplicationSchema = Joi.object({
    usn: Joi.string().trim().required()
        .messages({
            'string.empty': 'University Seat Number (USN) is required.'
        }),
    section: Joi.string().trim().valid('A', 'B', 'C').required()
        .messages({
            'string.empty': 'Section is required',
            'any.only': 'Section must be A, B, or C'
        }),
    batch: Joi.number().integer().min(2000).max(2100).required()
        .messages({
            'number.base': 'Batch must be a valid year',
            'number.min': 'Batch year must be 2000 or later',
            'number.max': 'Batch year must be 2100 or earlier'
        }),
    semester: Joi.number().integer().min(1).max(8).required()
        .messages({
            'number.base': 'Semester must be a number',
            'number.min': 'Semester must be between 1 and 8',
            'number.max': 'Semester must be between 1 and 8'
        }),
});

/**
 * Middleware to validate request body against a schema
 * 
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
export const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // Return all errors, not just the first
            stripUnknown: true, // Remove unknown fields
        });

        if (error) {
            const errorMessage = error.details.map(detail => detail.message).join(', ');
            res.status(400);
            return next(new Error(errorMessage));
        }

        // Replace req.body with validated and sanitized data
        req.body = value;
        next();
    };
};
