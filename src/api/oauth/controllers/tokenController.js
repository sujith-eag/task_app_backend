/**
 * OAuth Token Controller
 * 
 * Handles the OAuth 2.0 Token Endpoint.
 * Supports:
 * - authorization_code grant (with PKCE)
 * - refresh_token grant (with rotation)
 * 
 * @module controllers/oauth/tokenController
 * @see /docs/oidc-idp-transformation/09-DEVELOPER-STUDY-GUIDE.md
 */

import AuthorizationCode from '../../../models/authorizationCodeModel.js';
import User from '../../../models/userModel.js';
import { validateClient } from '../services/clientService.js';
import {
  buildTokenResponse,
  buildRefreshTokenResponse,
  validateRefreshToken
} from '../services/tokenService.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * OAuth 2.0 error codes for token endpoint
 */
const TOKEN_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  INVALID_SCOPE: 'invalid_scope',
  SERVER_ERROR: 'server_error'
};

/**
 * Supported grant types
 */
const SUPPORTED_GRANTS = ['authorization_code', 'refresh_token'];

// ============================================================================
// Client Authentication
// ============================================================================

/**
 * Extract client credentials from request
 * Supports client_secret_basic and client_secret_post
 * 
 * @param {Request} req - Express request
 * @returns {Object} { clientId, clientSecret }
 */
function extractClientCredentials(req) {
  // Try Authorization header (client_secret_basic)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [clientId, clientSecret] = credentials.split(':');
    return {
      clientId: decodeURIComponent(clientId),
      clientSecret: decodeURIComponent(clientSecret)
    };
  }
  
  // Try request body (client_secret_post)
  return {
    clientId: req.body.client_id,
    clientSecret: req.body.client_secret
  };
}

// ============================================================================
// Token Endpoint
// ============================================================================

/**
 * Token Endpoint
 * POST /oauth/token
 * 
 * Exchanges authorization code for tokens or refreshes tokens.
 */
export async function token(req, res) {
  const { grant_type } = req.body;
  
  // Validate grant type
  if (!grant_type) {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_REQUEST,
      error_description: 'Missing required parameter: grant_type'
    });
  }
  
  if (!SUPPORTED_GRANTS.includes(grant_type)) {
    return res.status(400).json({
      error: TOKEN_ERRORS.UNSUPPORTED_GRANT_TYPE,
      error_description: `Unsupported grant_type. Supported: ${SUPPORTED_GRANTS.join(', ')}`
    });
  }
  
  // Extract and validate client credentials
  const { clientId, clientSecret } = extractClientCredentials(req);
  
  if (!clientId) {
    return res.status(401).json({
      error: TOKEN_ERRORS.INVALID_CLIENT,
      error_description: 'Client authentication required'
    });
  }
  
  const clientValidation = await validateClient(clientId, clientSecret);
  if (!clientValidation.isValid) {
    return res.status(401).json({
      error: TOKEN_ERRORS.INVALID_CLIENT,
      error_description: clientValidation.error
    });
  }
  
  // Route to appropriate grant handler
  try {
    switch (grant_type) {
      case 'authorization_code':
        return await handleAuthorizationCodeGrant(req, res, clientId);
      case 'refresh_token':
        return await handleRefreshTokenGrant(req, res, clientId);
      default:
        return res.status(400).json({
          error: TOKEN_ERRORS.UNSUPPORTED_GRANT_TYPE,
          error_description: 'Grant type not implemented'
        });
    }
  } catch (error) {
    console.error('Token endpoint error:', error);
    return res.status(500).json({
      error: TOKEN_ERRORS.SERVER_ERROR,
      error_description: 'An unexpected error occurred'
    });
  }
}

// ============================================================================
// Authorization Code Grant
// ============================================================================

/**
 * Handle authorization_code grant type
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {string} clientId - Validated client ID
 */
async function handleAuthorizationCodeGrant(req, res, clientId) {
  const { code, redirect_uri, code_verifier } = req.body;
  
  // Validate required parameters
  if (!code) {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_REQUEST,
      error_description: 'Missing required parameter: code'
    });
  }
  
  if (!redirect_uri) {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_REQUEST,
      error_description: 'Missing required parameter: redirect_uri'
    });
  }
  
  if (!code_verifier) {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_REQUEST,
      error_description: 'Missing required parameter: code_verifier (PKCE required)'
    });
  }
  
  // Find and validate authorization code
  const authCode = await AuthorizationCode.findValidCode(code, clientId, redirect_uri);
  
  if (!authCode) {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_GRANT,
      error_description: 'Invalid, expired, or already used authorization code'
    });
  }
  
  // Verify PKCE
  if (!authCode.verifyPKCE(code_verifier)) {
    // Mark code as used to prevent retry attacks
    await authCode.markUsed(req.ip);
    
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_GRANT,
      error_description: 'PKCE verification failed'
    });
  }
  
  // Mark code as used BEFORE generating tokens
  await authCode.markUsed(req.ip);
  
  // Get user
  const user = await User.findById(authCode.user_id);
  if (!user) {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_GRANT,
      error_description: 'User not found'
    });
  }
  
  // Check if user account is active
  if (user.accountStatus && user.accountStatus !== 'active') {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_GRANT,
      error_description: 'User account is not active'
    });
  }
  
  // Build token response
  const tokenResponse = await buildTokenResponse({
    user,
    clientId,
    scope: authCode.scope,
    nonce: authCode.nonce,
    context: {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });
  
  // Set cache control headers (tokens should not be cached)
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  
  return res.json(tokenResponse);
}

// ============================================================================
// Refresh Token Grant
// ============================================================================

/**
 * Handle refresh_token grant type
 * Implements secure token rotation with reuse detection
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {string} clientId - Validated client ID
 */
async function handleRefreshTokenGrant(req, res, clientId) {
  const { refresh_token, scope } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_REQUEST,
      error_description: 'Missing required parameter: refresh_token'
    });
  }
  
  // Validate refresh token
  const validation = await validateRefreshToken(refresh_token, clientId);
  
  if (!validation.isValid) {
    // Check for security event (token reuse)
    if (validation.securityEvent === 'refresh_token_reuse') {
      // Log security event
      console.warn('SECURITY: Refresh token reuse detected', {
        familyId: validation.familyId,
        clientId,
        ip: req.ip
      });
    }
    
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_GRANT,
      error_description: validation.error
    });
  }
  
  const oldToken = validation.refreshToken;
  
  // Get user
  const user = await User.findById(oldToken.user_id);
  if (!user) {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_GRANT,
      error_description: 'User not found'
    });
  }
  
  // Check if user account is active
  if (user.accountStatus && user.accountStatus !== 'active') {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_GRANT,
      error_description: 'User account is not active'
    });
  }
  
  // Validate scope (cannot request more scopes than originally granted)
  if (scope) {
    const originalScopes = oldToken.scope.split(' ');
    const requestedScopes = scope.split(' ');
    const invalidScopes = requestedScopes.filter(s => !originalScopes.includes(s));
    
    if (invalidScopes.length > 0) {
      return res.status(400).json({
        error: TOKEN_ERRORS.INVALID_SCOPE,
        error_description: `Cannot request scopes not in original grant: ${invalidScopes.join(', ')}`
      });
    }
  }
  
  // Build token response with rotation
  const tokenResponse = await buildRefreshTokenResponse({
    oldToken,
    user,
    context: {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });
  
  // Update last used timestamp
  oldToken.last_used_at = new Date();
  await oldToken.save();
  
  // Set cache control headers
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  
  return res.json(tokenResponse);
}

// ============================================================================
// Token Revocation
// ============================================================================

/**
 * Token Revocation Endpoint
 * POST /oauth/revoke
 * 
 * Revokes a refresh token (access tokens cannot be revoked as they are JWTs).
 */
export async function revoke(req, res) {
  const { token, token_type_hint } = req.body;
  const { clientId } = extractClientCredentials(req);
  
  if (!token) {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_REQUEST,
      error_description: 'Missing required parameter: token'
    });
  }
  
  // Validate client
  const clientValidation = await validateClient(clientId, req.body.client_secret);
  if (!clientValidation.isValid) {
    return res.status(401).json({
      error: TOKEN_ERRORS.INVALID_CLIENT,
      error_description: clientValidation.error
    });
  }
  
  // Revoke token (only refresh tokens can be revoked)
  const { revokeRefreshToken } = await import('../services/tokenService.js');
  await revokeRefreshToken(token, 'user_revoked');
  
  // RFC 7009: Always return 200 OK, even if token was invalid
  return res.status(200).send();
}

// ============================================================================
// Token Introspection (Optional)
// ============================================================================

/**
 * Token Introspection Endpoint
 * POST /oauth/introspect
 * 
 * Returns information about a token.
 * Useful for resource servers to validate tokens.
 */
export async function introspect(req, res) {
  const { token, token_type_hint } = req.body;
  const { clientId, clientSecret } = extractClientCredentials(req);
  
  if (!token) {
    return res.status(400).json({
      error: TOKEN_ERRORS.INVALID_REQUEST,
      error_description: 'Missing required parameter: token'
    });
  }
  
  // Validate client
  const clientValidation = await validateClient(clientId, clientSecret);
  if (!clientValidation.isValid) {
    return res.status(401).json({
      error: TOKEN_ERRORS.INVALID_CLIENT,
      error_description: clientValidation.error
    });
  }
  
  // Try to introspect as access token first
  try {
    const { verifyAccessToken } = await import('../services/tokenService.js');
    const payload = verifyAccessToken(token);
    
    return res.json({
      active: true,
      scope: payload.scope,
      client_id: payload.client_id,
      sub: payload.sub,
      exp: payload.exp,
      iat: payload.iat,
      iss: payload.iss,
      token_type: 'Bearer'
    });
  } catch {
    // Token is invalid or expired
    return res.json({ active: false });
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  token,
  revoke,
  introspect
};
