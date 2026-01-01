/**
 * OIDC Discovery Controller
 * 
 * Implements OpenID Connect Discovery 1.0 endpoints:
 * - /.well-known/openid-configuration
 * - /.well-known/jwks.json
 * 
 * These endpoints are public and allow clients to discover
 * the IdP's configuration and public keys.
 * 
 * @module controllers/oauth/discoveryController
 * @see https://openid.net/specs/openid-connect-discovery-1_0.html
 */

import { generateJWKS } from '../../../utils/oauthCrypto.js';
import config from '../../../config/index.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get the issuer URL
 * @returns {string}
 */
function getIssuer() {
  return config.oauth?.issuer || process.env.OAUTH_ISSUER || 'https://eagle-campus.com';
}

/**
 * Get the base API URL
 * @returns {string}
 */
function getBaseUrl() {
  return getIssuer() + '/api';
}

// ============================================================================
// Discovery Document
// ============================================================================

/**
 * OpenID Connect Discovery Document
 * GET /.well-known/openid-configuration
 * 
 * Returns the OpenID Provider configuration information.
 * This is the starting point for OIDC client configuration.
 */
export async function getOpenIDConfiguration(req, res) {
  const issuer = getIssuer();
  const baseUrl = getBaseUrl();
  
  const configuration = {
    // ─────────────────────────────────────────────────────────────────────
    // Required Fields
    // ─────────────────────────────────────────────────────────────────────
    
    /**
     * REQUIRED. URL using the https scheme with no query or fragment component
     * that the OP asserts as its Issuer Identifier.
     */
    issuer,
    
    /**
     * REQUIRED. URL of the OP's OAuth 2.0 Authorization Endpoint.
     */
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    
    /**
     * REQUIRED. URL of the OP's OAuth 2.0 Token Endpoint.
     */
    token_endpoint: `${baseUrl}/oauth/token`,
    
    /**
     * REQUIRED. URL of the OP's JSON Web Key Set document.
     */
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    
    /**
     * REQUIRED. JSON array containing a list of the OAuth 2.0 response_type
     * values that this OP supports.
     */
    response_types_supported: [
      'code'  // OAuth 2.1 requires only authorization code flow
    ],
    
    /**
     * REQUIRED. JSON array containing a list of the Subject Identifier types
     * that this OP supports.
     */
    subject_types_supported: ['public'],
    
    /**
     * REQUIRED. JSON array containing a list of the JWS signing algorithms
     * supported for the ID Token.
     */
    id_token_signing_alg_values_supported: ['RS256'],
    
    /**
     * REQUIRED. JSON array containing a list of the JWS signing algorithms
     * supported by the Token Endpoint for the private_key_jwt and client_secret_jwt
     * methods.
     */
    token_endpoint_auth_signing_alg_values_supported: ['RS256'],

    // ─────────────────────────────────────────────────────────────────────
    // Recommended Fields
    // ─────────────────────────────────────────────────────────────────────
    
    /**
     * RECOMMENDED. URL of the OP's UserInfo Endpoint.
     */
    userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
    
    /**
     * RECOMMENDED. JSON array containing a list of the OAuth 2.0 scope values
     * that this server supports.
     */
    scopes_supported: [
      'openid',
      'profile',
      'email',
      'offline_access'
    ],
    
    /**
     * RECOMMENDED. JSON array containing a list of the Claim Names of the
     * Claims that the OpenID Provider MAY be able to supply values for.
     */
    claims_supported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'auth_time',
      'nonce',
      'at_hash',
      'name',
      'preferred_username',
      'picture',
      'email',
      'email_verified'
    ],

    // ─────────────────────────────────────────────────────────────────────
    // Optional Fields
    // ─────────────────────────────────────────────────────────────────────
    
    /**
     * URL of the OP's OAuth 2.0 Token Revocation Endpoint.
     */
    revocation_endpoint: `${baseUrl}/oauth/revoke`,
    
    /**
     * URL of the OP's OAuth 2.0 Token Introspection Endpoint.
     */
    introspection_endpoint: `${baseUrl}/oauth/introspect`,
    
    /**
     * JSON array containing a list of the OAuth 2.0 Grant Type values
     * that this OP supports.
     */
    grant_types_supported: [
      'authorization_code',
      'refresh_token'
    ],
    
    /**
     * JSON array containing a list of the OAuth 2.0 response_mode values
     * that this OP supports.
     */
    response_modes_supported: ['query'],
    
    /**
     * JSON array containing a list of Client Authentication methods
     * supported by this Token Endpoint.
     */
    token_endpoint_auth_methods_supported: [
      'client_secret_post',
      'client_secret_basic'
    ],
    
    /**
     * JSON array containing a list of PKCE code challenge methods supported.
     * OAuth 2.1 requires PKCE.
     */
    code_challenge_methods_supported: ['S256'],
    
    /**
     * Boolean value specifying whether the OP requires PKCE.
     * We require it for security (OAuth 2.1 mandate).
     */
    require_pkce: true,
    
    /**
     * URL of a page containing human-readable information that developers
     * might want or need to know when using the OpenID Provider.
     */
    service_documentation: 'https://eagle-campus.com/docs/oauth',
    
    /**
     * Languages and scripts supported for the user interface.
     */
    ui_locales_supported: ['en'],
    
    /**
     * Boolean value specifying whether the OP supports use of the claims
     * parameter.
     */
    claims_parameter_supported: false,
    
    /**
     * Boolean value specifying whether the OP supports use of the request
     * parameter.
     */
    request_parameter_supported: false,
    
    /**
     * Boolean value specifying whether the OP supports use of the
     * request_uri parameter.
     */
    request_uri_parameter_supported: false
  };
  
  // Set cache headers (discovery doc can be cached)
  res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.set('Content-Type', 'application/json');
  
  return res.json(configuration);
}

// ============================================================================
// JWKS (JSON Web Key Set)
// ============================================================================

/**
 * JSON Web Key Set
 * GET /.well-known/jwks.json
 * 
 * Returns the public keys used to verify JWT signatures.
 * Clients use this to validate access tokens and ID tokens.
 */
export async function getJWKS(req, res) {
  try {
    const jwks = generateJWKS();
    
    // Set cache headers (JWKS can be cached, but shorter than discovery)
    res.set('Cache-Control', 'public, max-age=900'); // 15 minutes
    res.set('Content-Type', 'application/json');
    
    return res.json(jwks);
  } catch (error) {
    console.error('Failed to generate JWKS:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to retrieve public keys'
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  getOpenIDConfiguration,
  getJWKS
};
