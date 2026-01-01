/**
 * OAuth Token Service
 * 
 * Handles creation and validation of OAuth tokens:
 * - Access tokens (JWT with RS256)
 * - ID tokens (OIDC)
 * - Refresh tokens (opaque, stored in DB)
 * 
 * Token Lifetimes:
 * - Access token: 15 minutes
 * - ID token: 15 minutes
 * - Refresh token: 30 days
 * 
 * @module services/oauth/tokenService
 * @see /docs/oidc-idp-transformation/08-FINALIZED-IMPLEMENTATION-PLAN.md
 */

import {
  signJWT,
  verifyJWT,
  generateRandomToken,
  getKeyId
} from '../../../utils/oauthCrypto.js';
import RefreshToken from '../../../models/refreshTokenModel.js';
import config from '../../../config/index.js';
import crypto from 'crypto';

// ============================================================================
// Constants
// ============================================================================

/**
 * Token lifetimes in seconds
 */
const TOKEN_LIFETIMES = {
  ACCESS_TOKEN: 15 * 60,       // 15 minutes
  ID_TOKEN: 15 * 60,           // 15 minutes
  REFRESH_TOKEN: 30 * 24 * 60 * 60  // 30 days
};

/**
 * Token types
 */
const TOKEN_TYPES = {
  ACCESS: 'access_token',
  ID: 'id_token',
  REFRESH: 'refresh_token'
};

// ============================================================================
// Issuer Configuration
// ============================================================================

/**
 * Get the issuer URL
 * @returns {string}
 */
function getIssuer() {
  return config.oauth?.issuer || process.env.OAUTH_ISSUER || 'https://eagle-campus.com';
}

// ============================================================================
// Access Token Generation
// ============================================================================

/**
 * Generate an access token (JWT)
 * 
 * @param {Object} params - Token parameters
 * @param {Object} params.user - User object
 * @param {string} params.clientId - OAuth client ID
 * @param {string} params.scope - Granted scopes (space-separated)
 * @returns {Object} { token, expiresAt, expiresIn }
 */
export function generateAccessToken({ user, clientId, scope }) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = TOKEN_LIFETIMES.ACCESS_TOKEN;
  const expiresAt = now + expiresIn;
  
  const payload = {
    // Standard claims
    iss: getIssuer(),
    sub: user._id.toString(),
    aud: clientId,
    exp: expiresAt,
    iat: now,
    
    // Token identification
    jti: generateRandomToken(16),
    
    // Authorization claims
    scope,
    client_id: clientId,
    
    // Token type indicator
    token_type: TOKEN_TYPES.ACCESS
  };
  
  const token = signJWT(payload);
  
  return {
    token,
    expiresAt: new Date(expiresAt * 1000),
    expiresIn
  };
}

/**
 * Verify an access token
 * 
 * @param {string} token - Access token JWT
 * @param {Object} options - Verification options
 * @param {string} options.requiredScope - Required scope (optional)
 * @returns {Object} Token payload
 * @throws {Error} If token is invalid
 */
export function verifyAccessToken(token, options = {}) {
  const payload = verifyJWT(token, {
    issuer: getIssuer(),
    verifyKid: true
  });
  
  // Verify token type
  if (payload.token_type !== TOKEN_TYPES.ACCESS) {
    throw new Error('Invalid token type');
  }
  
  // Verify required scope
  if (options.requiredScope) {
    const scopes = payload.scope.split(' ');
    if (!scopes.includes(options.requiredScope)) {
      throw new Error(`Missing required scope: ${options.requiredScope}`);
    }
  }
  
  return payload;
}

// ============================================================================
// ID Token Generation (OIDC)
// ============================================================================

/**
 * Generate an ID token (OIDC)
 * Contains user identity claims
 * 
 * @param {Object} params - Token parameters
 * @param {Object} params.user - User object
 * @param {string} params.clientId - OAuth client ID
 * @param {string} params.scope - Granted scopes
 * @param {string} params.nonce - Nonce from authorization request
 * @param {string} params.accessToken - Access token (for at_hash)
 * @returns {string} ID token JWT
 */
export function generateIdToken({ user, clientId, scope, nonce, accessToken }) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TOKEN_LIFETIMES.ID_TOKEN;
  const scopes = scope.split(' ');
  
  // Standard OIDC claims
  const payload = {
    iss: getIssuer(),
    sub: user._id.toString(),
    aud: clientId,
    exp: expiresAt,
    iat: now,
    auth_time: now // Time of authentication
  };
  
  // Include nonce if provided (replay attack prevention)
  if (nonce) {
    payload.nonce = nonce;
  }
  
  // Include at_hash if access token provided
  if (accessToken) {
    payload.at_hash = generateAtHash(accessToken);
  }
  
  // Add profile claims if 'profile' scope granted
  if (scopes.includes('profile')) {
    payload.name = user.name;
    payload.preferred_username = user.username || user.email?.split('@')[0];
    if (user.profilePic) {
      payload.picture = user.profilePic;
    }
  }
  
  // Add email claims if 'email' scope granted
  if (scopes.includes('email')) {
    payload.email = user.email;
    payload.email_verified = user.emailVerified || false;
  }
  
  return signJWT(payload);
}

/**
 * Generate at_hash (access token hash) for ID token
 * @param {string} accessToken - Access token
 * @returns {string} at_hash claim
 */
function generateAtHash(accessToken) {
  // Hash the access token with SHA-256
  const hash = crypto
    .createHash('sha256')
    .update(accessToken)
    .digest();
  
  // Take the first half
  const halfHash = hash.slice(0, hash.length / 2);
  
  // Base64URL encode
  return halfHash
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ============================================================================
// Refresh Token Management
// ============================================================================

/**
 * Generate a refresh token
 * Creates an opaque token stored in database
 * 
 * @param {Object} params - Token parameters
 * @param {Object} params.user - User object
 * @param {string} params.clientId - OAuth client ID
 * @param {string} params.scope - Granted scopes
 * @param {string} params.familyId - Token family ID (for rotation chain)
 * @param {string} params.previousTokenId - Previous token in chain
 * @param {number} params.rotationCount - Rotation count
 * @param {Object} params.context - Request context (IP, user agent, device)
 * @returns {Promise<Object>} { token, refreshToken, expiresAt }
 */
export async function generateRefreshToken({
  user,
  clientId,
  scope,
  familyId,
  previousTokenId,
  rotationCount = 0,
  context = {}
}) {
  const tokenId = generateRandomToken(32);
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIMES.REFRESH_TOKEN * 1000);
  
  // If no family ID, this is the first token in a new family
  const tokenFamilyId = familyId || generateRandomToken(16);
  
  const refreshToken = await RefreshToken.create({
    token_id: tokenId,
    user_id: user._id,
    client_id: clientId,
    family_id: tokenFamilyId,
    rotation_count: rotationCount,
    previous_token_id: previousTokenId,
    scope,
    device_id: context.deviceId,
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
    expires_at: expiresAt
  });
  
  return {
    token: tokenId,
    refreshToken,
    expiresAt,
    expiresIn: TOKEN_LIFETIMES.REFRESH_TOKEN
  };
}

/**
 * Validate and rotate a refresh token
 * Implements secure rotation with reuse detection
 * 
 * @param {string} tokenId - Refresh token value
 * @param {string} clientId - Expected client ID
 * @returns {Promise<Object>} { refreshToken, isValid, error }
 */
export async function validateRefreshToken(tokenId, clientId) {
  const refreshToken = await RefreshToken.findOne({ token_id: tokenId });
  
  if (!refreshToken) {
    return { isValid: false, error: 'Token not found' };
  }
  
  // Check if token belongs to the right client
  if (refreshToken.client_id !== clientId) {
    return { isValid: false, error: 'Token-client mismatch' };
  }
  
  // Check if token was already rotated (REUSE DETECTION!)
  if (refreshToken.rotated_at) {
    // SECURITY: Token reuse detected!
    // Revoke entire family to protect against token theft
    await RefreshToken.revokeFamilyTokens(
      refreshToken.family_id,
      'token_reuse'
    );
    
    return {
      isValid: false,
      error: 'Token reuse detected',
      securityEvent: 'refresh_token_reuse',
      familyId: refreshToken.family_id
    };
  }
  
  // Check if token is revoked
  if (refreshToken.is_revoked) {
    return { isValid: false, error: 'Token revoked' };
  }
  
  // Check if token is expired
  if (refreshToken.expires_at < new Date()) {
    return { isValid: false, error: 'Token expired' };
  }
  
  return { isValid: true, refreshToken };
}

/**
 * Rotate a refresh token
 * Marks old token as rotated and creates new one
 * 
 * @param {Object} oldToken - Old refresh token document
 * @param {Object} user - User object
 * @param {Object} context - Request context
 * @returns {Promise<Object>} New refresh token info
 */
export async function rotateRefreshToken(oldToken, user, context = {}) {
  // Mark old token as rotated
  await oldToken.markRotated();
  
  // Create new token in same family
  return generateRefreshToken({
    user,
    clientId: oldToken.client_id,
    scope: oldToken.scope,
    familyId: oldToken.family_id,
    previousTokenId: oldToken.token_id,
    rotationCount: oldToken.rotation_count + 1,
    context
  });
}

/**
 * Revoke a refresh token and its family
 * 
 * @param {string} tokenId - Token to revoke
 * @param {string} reason - Revocation reason
 * @returns {Promise<boolean>} Success
 */
export async function revokeRefreshToken(tokenId, reason = 'user_revoked') {
  const token = await RefreshToken.findOne({ token_id: tokenId });
  if (!token) return false;
  
  // Revoke entire family for security
  await RefreshToken.revokeFamilyTokens(token.family_id, reason);
  return true;
}

// ============================================================================
// Token Response Builder
// ============================================================================

/**
 * Build complete token response for token endpoint
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.user - User object
 * @param {string} params.clientId - Client ID
 * @param {string} params.scope - Granted scopes
 * @param {string} params.nonce - OIDC nonce (optional)
 * @param {Object} params.context - Request context
 * @returns {Promise<Object>} Token response
 */
export async function buildTokenResponse({
  user,
  clientId,
  scope,
  nonce,
  context = {}
}) {
  const scopes = scope.split(' ');
  
  // Generate access token
  const accessTokenResult = generateAccessToken({ user, clientId, scope });
  
  // Build response
  const response = {
    access_token: accessTokenResult.token,
    token_type: 'Bearer',
    expires_in: accessTokenResult.expiresIn,
    scope
  };
  
  // Generate ID token if openid scope
  if (scopes.includes('openid')) {
    response.id_token = generateIdToken({
      user,
      clientId,
      scope,
      nonce,
      accessToken: accessTokenResult.token
    });
  }
  
  // Generate refresh token if offline_access scope
  if (scopes.includes('offline_access')) {
    const refreshTokenResult = await generateRefreshToken({
      user,
      clientId,
      scope,
      context
    });
    response.refresh_token = refreshTokenResult.token;
  }
  
  return response;
}

/**
 * Build token response for refresh token grant
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.oldToken - Old refresh token document
 * @param {Object} params.user - User object
 * @param {Object} params.context - Request context
 * @returns {Promise<Object>} Token response
 */
export async function buildRefreshTokenResponse({
  oldToken,
  user,
  context = {}
}) {
  const scope = oldToken.scope;
  const clientId = oldToken.client_id;
  const scopes = scope.split(' ');
  
  // Generate new access token
  const accessTokenResult = generateAccessToken({ user, clientId, scope });
  
  // Rotate refresh token
  const newRefreshToken = await rotateRefreshToken(oldToken, user, context);
  
  // Build response
  const response = {
    access_token: accessTokenResult.token,
    token_type: 'Bearer',
    expires_in: accessTokenResult.expiresIn,
    refresh_token: newRefreshToken.token,
    scope
  };
  
  // Include new ID token if openid scope
  if (scopes.includes('openid')) {
    response.id_token = generateIdToken({
      user,
      clientId,
      scope,
      accessToken: accessTokenResult.token
    });
  }
  
  return response;
}

// ============================================================================
// Export
// ============================================================================

export default {
  generateAccessToken,
  verifyAccessToken,
  generateIdToken,
  generateRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  buildTokenResponse,
  buildRefreshTokenResponse,
  TOKEN_LIFETIMES,
  TOKEN_TYPES
};
