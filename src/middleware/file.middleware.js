/*
 * Legacy shim for file upload middleware.
 * Re-exports the multer middlewares from src/api/_common/middleware/file.middleware.js
 */

import * as fileCommon from '../api/_common/middleware/file.middleware.js';

console.warn('[DEPRECATION] src/middleware/file.middleware.js is deprecated. Please import from src/api/_common/middleware/file.middleware.js instead.');

export const uploadFiles = fileCommon.uploadFiles;
export const uploadAvatar = fileCommon.uploadAvatar;
