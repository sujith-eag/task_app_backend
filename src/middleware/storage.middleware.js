/*
 * Legacy shim for storage/quota middleware.
 * Re-exports the centralized quota middleware from src/api/_common/middleware/quota.middleware.js
 */

import * as quota from '../api/_common/middleware/quota.middleware.js';

console.warn('[DEPRECATION] src/middleware/storage.middleware.js is deprecated. Please import from src/api/_common/middleware/quota.middleware.js instead.');

export const QUOTAS = quota.QUOTAS;
export const checkStorageQuota = quota.checkStorageQuota;
