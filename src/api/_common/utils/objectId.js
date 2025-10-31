import mongoose from 'mongoose';

/**
 * Check if a string is a valid MongoDB ObjectId
 * 
 * @param {string} id - String to validate
 * @returns {boolean} True if valid ObjectId, false otherwise
 */
export const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validate and convert string to ObjectId
 * Throws an error if the string is not a valid ObjectId
 * 
 * @param {string} id - String to convert
 * @param {string} fieldName - Name of the field (for error messages)
 * @returns {mongoose.Types.ObjectId} MongoDB ObjectId
 * @throws {Error} If id is not a valid ObjectId
 */
export const toObjectId = (id, fieldName = 'ID') => {
    if (!isValidObjectId(id)) {
        throw new Error(`Invalid ${fieldName} format`);
    }
    return new mongoose.Types.ObjectId(id);
};

/**
 * Validate multiple IDs
 * 
 * @param {string[]} ids - Array of ID strings to validate
 * @returns {boolean} True if all IDs are valid, false otherwise
 */
export const areValidObjectIds = (ids) => {
    return Array.isArray(ids) && ids.every(isValidObjectId);
};
