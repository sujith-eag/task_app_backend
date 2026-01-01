/**
 * OAuth Routes
 * 
 * Defines all OAuth 2.1/OIDC endpoints.
 * 
 * Public Endpoints (no auth required):
 * - GET  /.well-known/openid-configuration
 * - GET  /.well-known/jwks.json
 * - POST /oauth/token
 * - POST /oauth/revoke
 * - POST /oauth/introspect
 * - GET  /oauth/clients/:clientId/info
 * 
 * Protected Endpoints (require user auth):
 * - GET  /oauth/authorize
 * - POST /oauth/authorize/consent
 * - POST /oauth/authorize/deny
 * - GET  /oauth/userinfo
 * - POST /oauth/userinfo
 * - POST /oauth/clients (register)
 * - GET  /oauth/clients (list own)
 * - GET  /oauth/clients/:clientId
 * - PATCH /oauth/clients/:clientId
 * - DELETE /oauth/clients/:clientId
 * - POST /oauth/clients/:clientId/rotate-secret
 * 
 * Admin Endpoints (require admin role):
 * - GET  /oauth/admin/clients/pending
 * - POST /oauth/admin/clients/:clientId/approve
 * - POST /oauth/admin/clients/:clientId/reject
 * - POST /oauth/admin/clients/:clientId/suspend
 * - POST /oauth/admin/clients/:clientId/reactivate
 * 
 * @module routes/oauth
 */

import { Router } from 'express';
import {
  getOpenIDConfiguration,
  getJWKS,
  authorize,
  approveConsent,
  denyConsent,
  validateAuthorizeRequest as validateAuthRequestController,
  token,
  revoke,
  introspect,
  userinfo,
  registerClient,
  listOwnClients,
  getClientById,
  updateClientById,
  deleteClientById,
  rotateSecret,
  listPendingClients,
  approveClientById,
  rejectClientById,
  suspendClientById,
  reactivateClientById,
  getClientPublicInfo,
  getOAuthStats,
  listUserAuthorizations,
  revokeUserAuthorization
} from './controllers/index.js';
import {
  validateAuthorizeRequest,
  validateTokenRequest,
  validateRevokeRequest,
  validateIntrospectRequest,
  validateConsentApproval,
  validateClientRegistration
} from './validators/index.js';
import { rateLimit } from './middleware/index.js';

// Import auth middleware (from existing auth system)
// This will be replaced with proper import once we verify the path
const requireAuth = (req, res, next) => {
  // Placeholder - will be replaced with actual auth middleware
  // The actual implementation should verify the user's session/JWT
  if (!req.user) {
    return res.status(401).json({
      error: 'login_required',
      error_description: 'User authentication required'
    });
  }
  next();
};

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

// ============================================================================
// Discovery Endpoints (Public)
// ============================================================================

/**
 * OpenID Connect Discovery
 * Returns provider configuration
 */
router.get('/.well-known/openid-configuration', getOpenIDConfiguration);

/**
 * JSON Web Key Set
 * Returns public keys for token verification
 */
router.get('/.well-known/jwks.json', getJWKS);

// ============================================================================
// Authorization Endpoints (Protected)
// ============================================================================

/**
 * Authorization Endpoint
 * Initiates authorization code flow
 * 
 * Query Parameters:
 * - response_type: Must be 'code'
 * - client_id: OAuth client ID
 * - redirect_uri: Client redirect URI
 * - scope: Requested scopes (must include 'openid')
 * - state: CSRF protection state
 * - code_challenge: PKCE code challenge
 * - code_challenge_method: Must be 'S256'
 * - nonce: (Optional) OIDC nonce
 * - prompt: (Optional) 'none', 'login', or 'consent'
 */
router.get(
  '/oauth/authorize',
  requireAuth,
  validateAuthorizeRequest,
  authorize
);

/**
 * Validate Authorization Request (SPA)
 * Returns client info for frontend consent page
 */
router.get(
  '/oauth/authorize/validate',
  requireAuth,
  validateAuthRequestController
);

/**
 * Consent Approval
 * Called when user approves consent
 */
router.post(
  '/oauth/authorize/consent',
  requireAuth,
  validateConsentApproval,
  approveConsent
);

/**
 * Consent Denial
 * Called when user denies consent
 */
router.post(
  '/oauth/authorize/deny',
  requireAuth,
  denyConsent
);

// ============================================================================
// Token Endpoints (Public with Client Auth)
// ============================================================================

/**
 * Token Endpoint
 * Exchanges authorization code for tokens
 * 
 * Supported grant_types:
 * - authorization_code (with PKCE)
 * - refresh_token (with rotation)
 * 
 * Client authentication:
 * - client_secret_basic (Authorization header)
 * - client_secret_post (request body)
 */
router.post(
  '/oauth/token',
  validateTokenRequest,
  token
);

/**
 * Token Revocation Endpoint
 * Revokes refresh tokens
 * 
 * RFC 7009 compliant - always returns 200 OK
 */
router.post(
  '/oauth/revoke',
  validateRevokeRequest,
  revoke
);

/**
 * Token Introspection Endpoint
 * Returns token information
 * 
 * RFC 7662 compliant
 */
router.post(
  '/oauth/introspect',
  validateIntrospectRequest,
  introspect
);

// ============================================================================
// UserInfo Endpoint (Protected by Bearer Token)
// ============================================================================

/**
 * UserInfo Endpoint
 * Returns claims about the authenticated user
 * 
 * Authorization: Bearer <access_token>
 * 
 * Returns claims based on granted scopes:
 * - openid: sub
 * - profile: name, preferred_username, picture
 * - email: email, email_verified
 */
router.get('/oauth/userinfo', userinfo);
router.post('/oauth/userinfo', userinfo);

// ============================================================================
// User Authorization Management Endpoints (Protected)
// ============================================================================

/**
 * List user's authorized applications
 * GET /oauth/user/authorizations
 */
router.get(
  '/oauth/user/authorizations',
  requireAuth,
  listUserAuthorizations
);

/**
 * Revoke user's authorization for a specific client
 * DELETE /oauth/user/authorizations/:clientId
 */
router.delete(
  '/oauth/user/authorizations/:clientId',
  requireAuth,
  revokeUserAuthorization
);

// ============================================================================
// Client Management Endpoints (Protected)
// ============================================================================

/**
 * Register new OAuth client
 * Client starts in PENDING status, requires admin approval
 */
router.post(
  '/oauth/clients',
  requireAuth,
  rateLimit({ max: 10, windowMs: 60 * 60 * 1000 }), // 10 per hour
  validateClientRegistration,
  registerClient
);

/**
 * List user's own clients
 */
router.get(
  '/oauth/clients',
  requireAuth,
  listOwnClients
);

/**
 * Get client public info (public endpoint)
 */
router.get(
  '/oauth/clients/:clientId/info',
  getClientPublicInfo
);

/**
 * Get client details (owner only)
 */
router.get(
  '/oauth/clients/:clientId',
  requireAuth,
  getClientById
);

/**
 * Update client (owner only)
 */
router.patch(
  '/oauth/clients/:clientId',
  requireAuth,
  updateClientById
);

/**
 * Delete client (owner or admin)
 */
router.delete(
  '/oauth/clients/:clientId',
  requireAuth,
  deleteClientById
);

/**
 * Rotate client secret (owner only)
 */
router.post(
  '/oauth/clients/:clientId/rotate-secret',
  requireAuth,
  rotateSecret
);

// ============================================================================
// Admin Client Management Endpoints
// ============================================================================

/**
 * Admin auth middleware placeholder
 * Replace with actual admin auth middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'Authentication required'
    });
  }
  
  if (!req.user.roles?.includes('admin')) {
    return res.status(403).json({
      error: 'forbidden',
      error_description: 'Admin access required'
    });
  }
  
  next();
};

/**
 * Get OAuth statistics (admin)
 */
router.get(
  '/oauth/admin/clients/stats',
  requireAdmin,
  getOAuthStats
);

/**
 * List pending clients (admin)
 */
router.get(
  '/oauth/admin/clients/pending',
  requireAdmin,
  listPendingClients
);

/**
 * Approve client (admin)
 */
router.post(
  '/oauth/admin/clients/:clientId/approve',
  requireAdmin,
  approveClientById
);

/**
 * Reject client (admin)
 */
router.post(
  '/oauth/admin/clients/:clientId/reject',
  requireAdmin,
  rejectClientById
);

/**
 * Suspend client (admin)
 */
router.post(
  '/oauth/admin/clients/:clientId/suspend',
  requireAdmin,
  suspendClientById
);

/**
 * Reactivate client (admin)
 */
router.post(
  '/oauth/admin/clients/:clientId/reactivate',
  requireAdmin,
  reactivateClientById
);

// ============================================================================
// Export
// ============================================================================

export default router;
