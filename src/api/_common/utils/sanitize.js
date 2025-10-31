/**
 * Sanitization utilities for user input
 */

/**
 * Remove potentially dangerous HTML tags and scripts from strings
 * Basic XSS prevention
 * 
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeHtml = (str) => {
    if (typeof str !== 'string') return str;
    
    return str
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

/**
 * Trim whitespace and convert to lowercase
 * Useful for email addresses and usernames
 * 
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
export const normalizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.trim().toLowerCase();
};

/**
 * Sanitize filename by removing dangerous characters
 * 
 * @param {string} filename - Original filename
 * @returns {string} Safe filename
 */
export const sanitizeFilename = (filename) => {
    if (typeof filename !== 'string') return 'file';
    
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe chars with underscore
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .slice(0, 255); // Limit length
};

/**
 * Deep sanitize an object recursively
 * Sanitizes all string values in an object
 * 
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
export const deepSanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
        return typeof obj === 'string' ? sanitizeHtml(obj) : obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(deepSanitize);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = deepSanitize(value);
    }
    return sanitized;
};
