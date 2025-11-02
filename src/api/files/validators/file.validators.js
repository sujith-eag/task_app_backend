import Joi from 'joi';

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for file upload
 */
export const uploadFilesSchema = Joi.object({
  parentId: Joi.string().allow(null, 'null').optional(),
});

/**
 * Schema for folder creation
 */
export const createFolderSchema = Joi.object({
  folderName: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Folder name is required',
    'string.min': 'Folder name must be at least 1 character',
    'string.max': 'Folder name must not exceed 100 characters',
  }),
  parentId: Joi.string().allow(null, 'null').optional(),
});

/**
 * Schema for moving items
 */
export const moveItemSchema = Joi.object({
  newParentId: Joi.string().allow(null, 'null').required().messages({
    'any.required': 'New parent ID is required',
  }),
});

/**
 * Schema for renaming folder
 */
export const renameFolderSchema = Joi.object({
  newName: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'New folder name is required',
    'string.min': 'Folder name must be at least 1 character',
    'string.max': 'Folder name must not exceed 100 characters',
  }),
});

/**
 * Schema for bulk file operations
 */
export const bulkFileIdsSchema = Joi.object({
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
 * Schema for listing files (query params)
 */
export const listFilesSchema = Joi.object({
  parentId: Joi.string().allow(null, 'null', '').optional(),
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
    try {
      if (source === 'query') {
        // Some Express versions expose a getter-only req.query which cannot be
        // reassigned. Attempt to copy properties into the existing object; if
        // that isn't possible, attach a fallback property prefixed with
        // `validated_` so callers can still access the sanitized query.
        if (req.query && typeof req.query === 'object') {
          try {
            // Clear existing keys then copy validated values in
            Object.keys(req.query).forEach((k) => { delete req.query[k]; });
            Object.assign(req.query, value);
          } catch (innerErr) {
            // Fallback: attach validated query under a different key
            req.validated_query = value;
          }
        } else {
          try { req.query = value; } catch (e) { req.validated_query = value; }
        }
      } else {
        req[source] = value;
      }
    } catch (err) {
      // As a last resort, attach the validated payload under a fallback key
      req[`validated_${source}`] = value;
    }
    next();
  };
};
