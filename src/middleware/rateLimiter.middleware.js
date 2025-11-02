/*
 * Legacy shim for rate limiter middleware.
 * Re-exports the centralized limiters from src/api/_common/middleware/rateLimit.middleware.js
 */

import * as rateLimitCommon from '../api/_common/middleware/rateLimit.middleware.js';

console.warn('[DEPRECATION] src/middleware/rateLimiter.middleware.js is deprecated. Please import from src/api/_common/middleware/rateLimit.middleware.js instead.');

export const authLimiter = rateLimitCommon.authLimiter;
export const generalApiLimiter = rateLimitCommon.generalApiLimiter;
export const downloadLimiter = rateLimitCommon.downloadLimiter;
export const publicApiLimiter = rateLimitCommon.publicApiLimiter;

