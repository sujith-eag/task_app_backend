/**
 * OAuth Module Index
 * 
 * Eagle Campus OAuth 2.1/OIDC Identity Provider
 * 
 * This module implements:
 * - OAuth 2.1 Authorization Code Flow with PKCE
 * - OpenID Connect 1.0 Core
 * - Refresh Token Rotation
 * - Admin Approval Workflow for Client Registration
 * 
 * @module api/oauth
 * @see /docs/oidc-idp-transformation/08-FINALIZED-IMPLEMENTATION-PLAN.md
 */

// Routes
export { default as routes } from './routes.js';

// Controllers
export * from './controllers/index.js';

// Services
export * from './services/index.js';

// Validators
export * from './validators/index.js';
