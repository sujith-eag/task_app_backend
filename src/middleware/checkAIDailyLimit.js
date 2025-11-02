/*
 * Legacy shim for AI daily limit middleware.
 * Re-exports the centralized checkAIDailyLimit from src/api/_common/middleware/aiLimit.middleware.js
 */

import * as aiLimit from '../api/_common/middleware/aiLimit.middleware.js';

console.warn('[DEPRECATION] src/middleware/checkAIDailyLimit.js is deprecated. Please import from src/api/_common/middleware/aiLimit.middleware.js instead.');

export const checkAIDailyLimit = aiLimit.checkAIDailyLimit;
