/*
 * Legacy shim for the global error handler.
 * Re-exports the centralized error handler from src/api/_common/middleware/error.middleware.js
 */

import errorHandler from '../api/_common/middleware/error.middleware.js';

console.warn('[DEPRECATION] src/middleware/error.middleware.js is deprecated. Please import from src/api/_common/middleware/error.middleware.js instead.');

export default errorHandler;