/**
 * OAuth Authorization Controller
 * 
 * Handles the OAuth 2.0/OIDC Authorization Endpoint.
 * Implements Authorization Code Flow with PKCE.
 * 
 * Flow:
 * 1. Client redirects user to /oauth/authorize
 * 2. User authenticates (if not already)
 * 3. User consents to requested scopes (if needed)
 * 4. Server redirects back with authorization code
 * 
 * @module controllers/oauth/authorizationController
 * @see /docs/oidc-idp-transformation/09-DEVELOPER-STUDY-GUIDE.md
 */

import AuthorizationCode from '../../../models/authorizationCodeModel.js';
import { validateRedirectUri, validateScopes } from '../services/clientService.js';
import { checkConsentNeeded, getConsentUIData } from '../services/consentService.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * OAuth 2.0/2.1 error codes
 */
const OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  ACCESS_DENIED: 'access_denied',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  INVALID_SCOPE: 'invalid_scope',
  SERVER_ERROR: 'server_error',
  TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable'
};

// ============================================================================
// Request Validation
// ============================================================================

/**
 * Validate authorization request parameters
 * 
 * @param {Object} params - Request query parameters
 * @returns {Object} { isValid, error, errorDescription }
 */
function validateAuthorizationRequest(params) {
  const {
    response_type,
    client_id,
    redirect_uri,
    scope,
    code_challenge,
    code_challenge_method
  } = params;
  
  // response_type is required and must be 'code'
  if (!response_type) {
    return {
      isValid: false,
      error: OAUTH_ERRORS.INVALID_REQUEST,
      errorDescription: 'Missing required parameter: response_type'
    };
  }
  
  if (response_type !== 'code') {
    return {
      isValid: false,
      error: OAUTH_ERRORS.UNSUPPORTED_RESPONSE_TYPE,
      errorDescription: 'Only response_type=code is supported'
    };
  }
  
  // client_id is required
  if (!client_id) {
    return {
      isValid: false,
      error: OAUTH_ERRORS.INVALID_REQUEST,
      errorDescription: 'Missing required parameter: client_id'
    };
  }
  
  // redirect_uri is required
  if (!redirect_uri) {
    return {
      isValid: false,
      error: OAUTH_ERRORS.INVALID_REQUEST,
      errorDescription: 'Missing required parameter: redirect_uri'
    };
  }
  
  // PKCE is required (OAuth 2.1 mandate)
  if (!code_challenge) {
    return {
      isValid: false,
      error: OAUTH_ERRORS.INVALID_REQUEST,
      errorDescription: 'PKCE code_challenge is required'
    };
  }
  
  // Only S256 method is supported
  if (code_challenge_method && code_challenge_method !== 'S256') {
    return {
      isValid: false,
      error: OAUTH_ERRORS.INVALID_REQUEST,
      errorDescription: 'Only code_challenge_method=S256 is supported'
    };
  }
  
  // Scope must include 'openid' for OIDC
  if (!scope || !scope.includes('openid')) {
    return {
      isValid: false,
      error: OAUTH_ERRORS.INVALID_SCOPE,
      errorDescription: 'scope must include openid'
    };
  }
  
  return { isValid: true };
}

/**
 * Build error redirect URL
 * 
 * @param {string} redirectUri - Client redirect URI
 * @param {string} error - Error code
 * @param {string} errorDescription - Error description
 * @param {string} state - State parameter
 * @returns {string} Error redirect URL
 */
function buildErrorRedirect(redirectUri, error, errorDescription, state) {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', errorDescription);
  if (state) {
    url.searchParams.set('state', state);
  }
  return url.toString();
}

/**
 * Build success redirect URL with authorization code
 * 
 * @param {string} redirectUri - Client redirect URI
 * @param {string} code - Authorization code
 * @param {string} state - State parameter
 * @returns {string} Success redirect URL
 */
function buildSuccessRedirect(redirectUri, code, state) {
  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  if (state) {
    url.searchParams.set('state', state);
  }
  return url.toString();
}

// ============================================================================
// Authorization Endpoint
// ============================================================================

/**
 * Authorization Endpoint
 * GET /oauth/authorize
 * 
 * Initiates the authorization code flow.
 * Requires user to be authenticated (handled by middleware).
 */
export async function authorize(req, res) {
  const {
    response_type,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method = 'S256',
    nonce,
    prompt
  } = req.query;
  
  // Step 1: Validate request parameters
  const validation = validateAuthorizationRequest(req.query);
  if (!validation.isValid) {
    // Cannot redirect if we don't have valid redirect_uri or client_id
    if (!redirect_uri || !client_id) {
      return res.status(400).json({
        error: validation.error,
        error_description: validation.errorDescription
      });
    }
    
    // Redirect with error
    return res.redirect(
      buildErrorRedirect(redirect_uri, validation.error, validation.errorDescription, state)
    );
  }
  
  // Step 2: Validate client and redirect URI
  const clientValidation = await validateRedirectUri(client_id, redirect_uri);
  if (!clientValidation.isValid) {
    // If redirect URI is invalid, we MUST NOT redirect
    return res.status(400).json({
      error: OAUTH_ERRORS.INVALID_REQUEST,
      error_description: clientValidation.error
    });
  }
  
  const client = clientValidation.client;
  
  // Step 3: Validate scopes
  const requestedScopes = scope.split(' ');
  const scopeValidation = validateScopes(client, requestedScopes);
  if (!scopeValidation.isValid) {
    return res.redirect(
      buildErrorRedirect(
        redirect_uri,
        OAUTH_ERRORS.INVALID_SCOPE,
        `Unsupported scopes: ${scopeValidation.deniedScopes.join(', ')}`,
        state
      )
    );
  }
  
  // Step 4: Get authenticated user (assumed from auth middleware)
  const user = req.user;
  if (!user) {
    // Should not happen if auth middleware is properly configured
    // But handle it gracefully
    // In a real implementation, redirect to login with return URL
    return res.status(401).json({
      error: OAUTH_ERRORS.ACCESS_DENIED,
      error_description: 'User not authenticated'
    });
  }
  
  // Step 5: Check consent
  const consentCheck = await checkConsentNeeded(
    user._id,
    client_id,
    scopeValidation.grantedScopes,
    client.is_first_party
  );
  
  // Handle prompt=none (silent auth)
  if (prompt === 'none') {
    if (consentCheck.needsConsent) {
      return res.redirect(
        buildErrorRedirect(redirect_uri, 'consent_required', 'User consent required', state)
      );
    }
  }
  
  // Step 6: If consent needed, render consent page
  if (consentCheck.needsConsent) {
    // Store authorization request in session for consent callback
    req.session = req.session || {};
    req.session.pendingAuth = {
      client_id,
      redirect_uri,
      scope: scopeValidation.grantedScopes.join(' '),
      state,
      code_challenge,
      code_challenge_method,
      nonce,
      requested_at: Date.now()
    };
    
    // Return consent data (frontend will render consent UI)
    const consentData = getConsentUIData(client_id, scopeValidation.grantedScopes, client);
    
    return res.status(200).json({
      requires_consent: true,
      consent_data: consentData
    });
  }
  
  // Step 7: Generate authorization code
  try {
    const authCode = await AuthorizationCode.createCode({
      userId: user._id,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      scope: scopeValidation.grantedScopes.join(' '),
      state,
      nonce,
      requestIp: req.ip,
      requestUserAgent: req.get('User-Agent')
    });
    
    // Step 8: Redirect with code
    return res.redirect(buildSuccessRedirect(redirect_uri, authCode.code, state));
    
  } catch (error) {
    console.error('Failed to create authorization code:', error);
    return res.redirect(
      buildErrorRedirect(redirect_uri, OAUTH_ERRORS.SERVER_ERROR, 'Failed to generate authorization code', state)
    );
  }
}

/**
 * Consent Approval Endpoint
 * POST /oauth/authorize/consent
 * 
 * Called after user approves consent.
 * Generates authorization code and redirects.
 */
export async function approveConsent(req, res) {
  const { approved, scopes } = req.body;
  
  // Get pending authorization from session
  const pendingAuth = req.session?.pendingAuth;
  if (!pendingAuth) {
    return res.status(400).json({
      error: OAUTH_ERRORS.INVALID_REQUEST,
      error_description: 'No pending authorization request'
    });
  }
  
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    nonce
  } = pendingAuth;
  
  // Clear pending auth
  delete req.session.pendingAuth;
  
  // If user denied consent
  if (!approved) {
    return res.redirect(
      buildErrorRedirect(redirect_uri, OAUTH_ERRORS.ACCESS_DENIED, 'User denied consent', state)
    );
  }
  
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      error: OAUTH_ERRORS.ACCESS_DENIED,
      error_description: 'User not authenticated'
    });
  }
  
  // Record consent
  const { grantConsent } = await import('../services/consentService.js');
  await grantConsent({
    userId: user._id,
    clientId: client_id,
    scopes: scopes || pendingAuth.scope.split(' '),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Generate authorization code
  try {
    const authCode = await AuthorizationCode.createCode({
      userId: user._id,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      scope: scopes ? scopes.join(' ') : pendingAuth.scope,
      state,
      nonce,
      requestIp: req.ip,
      requestUserAgent: req.get('User-Agent')
    });
    
    return res.redirect(buildSuccessRedirect(redirect_uri, authCode.code, state));
    
  } catch (error) {
    console.error('Failed to create authorization code:', error);
    return res.redirect(
      buildErrorRedirect(redirect_uri, OAUTH_ERRORS.SERVER_ERROR, 'Failed to generate authorization code', state)
    );
  }
}

/**
 * Consent Denial Endpoint
 * POST /oauth/authorize/deny
 * 
 * Called when user denies consent.
 * Redirects with access_denied error.
 */
export async function denyConsent(req, res) {
  const pendingAuth = req.session?.pendingAuth;
  
  if (!pendingAuth) {
    return res.status(400).json({
      error: OAUTH_ERRORS.INVALID_REQUEST,
      error_description: 'No pending authorization request'
    });
  }
  
  const { redirect_uri, state } = pendingAuth;
  
  // Clear pending auth
  delete req.session.pendingAuth;
  
  return res.redirect(
    buildErrorRedirect(redirect_uri, OAUTH_ERRORS.ACCESS_DENIED, 'User denied consent', state)
  );
}

// ============================================================================
// SPA Validation Endpoint
// ============================================================================

/**
 * Validate Authorization Request (SPA)
 * GET /oauth/authorize/validate
 * 
 * Validates OAuth parameters and returns client info for SPA consent page.
 * Used when frontend handles consent UI instead of server-rendered page.
 */
export async function validateRequest(req, res) {
  const {
    response_type,
    client_id,
    redirect_uri,
    scope,
    code_challenge,
    code_challenge_method
  } = req.query;
  
  // Validate basic parameters
  const validation = validateAuthorizationRequest(req.query);
  if (!validation.isValid) {
    return res.status(400).json({
      error: validation.error,
      error_description: validation.errorDescription
    });
  }
  
  // Validate client and redirect URI
  const clientValidation = await validateRedirectUri(client_id, redirect_uri);
  if (!clientValidation.isValid) {
    return res.status(400).json({
      error: OAUTH_ERRORS.INVALID_REQUEST,
      error_description: clientValidation.error
    });
  }
  
  const client = clientValidation.client;
  
  // Validate scopes
  const requestedScopes = scope.split(' ');
  const scopeValidation = validateScopes(client, requestedScopes);
  if (!scopeValidation.isValid) {
    return res.status(400).json({
      error: OAUTH_ERRORS.INVALID_SCOPE,
      error_description: `Unsupported scopes: ${scopeValidation.deniedScopes.join(', ')}`
    });
  }
  
  // Return client info and validated scopes for consent UI
  return res.json({
    client: {
      client_id: client.client_id,
      client_name: client.client_name,
      client_uri: client.client_uri,
      logo_uri: client.logo_uri,
      policy_uri: client.policy_uri,
      tos_uri: client.tos_uri,
      is_first_party: client.is_first_party || false
    },
    scopes: scopeValidation.grantedScopes
  });
}

// ============================================================================
// Export
// ============================================================================

export default {
  authorize,
  approveConsent,
  denyConsent,
  validateRequest
};
