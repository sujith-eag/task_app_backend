/*
 * Legacy shim for role middleware.
 * This file now re-exports the centralized RBAC middleware located at
 * ../api/_common/middleware/rbac.middleware.js
 *
 * Reason: keep backward compatibility for any remaining imports that
 * reference `src/middleware/role.middleware.js` while consolidating
 * the real implementations in the _common folder.
 */

import * as rbac from '../api/_common/middleware/rbac.middleware.js';

console.warn('[DEPRECATION] src/middleware/role.middleware.js is deprecated. Please import from src/api/_common/middleware/rbac.middleware.js instead.');

export const isStudent = rbac.isStudent;
export const isTeacher = rbac.isTeacher;
export const isAdmin = rbac.isAdmin;
export const isHOD = rbac.isHOD;
export const isAdminOrHOD = rbac.isAdminOrHOD;

// Backwards-compatible alias some code may expect
export const hasRole = rbac.hasRole || rbac.authorize;
