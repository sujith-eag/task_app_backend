/*
 * Legacy shim for validation middleware.
 * Re-exports the centralized implementation from src/api/_common/middleware/validation.middleware.js
 */

import validateDefault from '../api/_common/middleware/validation.middleware.js';

console.warn('[DEPRECATION] src/middleware/validation.middleware.js is deprecated. Please import from src/api/_common/middleware/validation.middleware.js instead.');

export default validateDefault;
export const validate = validateDefault;
