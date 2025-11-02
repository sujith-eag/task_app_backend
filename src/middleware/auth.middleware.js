// DEPRECATION SHIM
// The auth middleware has been moved to `src/api/_common/middleware/auth.middleware.js`.
// This file remains as a compatibility shim that re-exports the centralized
// middleware and provides a clear warning at load time so developers update imports.

/* eslint-disable no-console */
console.warn('DEPRECATION: legacy `src/middleware/auth.middleware.js` has moved. Import from `src/api/_common/middleware/auth.middleware.js` instead.');

import * as commonAuth from '../api/_common/middleware/auth.middleware.js';

// Re-export the main middleware functions for backward compatibility
export const protect = commonAuth.protect;
export const socketAuthMiddleware = commonAuth.socketAuthMiddleware;

// Provide the older alias `authenticate` if callers reference it
export const authenticate = commonAuth.protect;
