/**
 * Authorization Code Model
 * 
 * Stores temporary authorization codes used in OAuth 2.1 Authorization Code flow.
 * Codes are single-use and short-lived (10 minutes).
 * 
 * Security Features:
 * - PKCE (Proof Key for Code Exchange) support with S256 method
 * - Single-use enforcement
 * - Short TTL (10 minutes)
 * - Binding to client and redirect URI
 * 
 * @module models/authorizationCodeModel
 * @see /docs/oidc-idp-transformation/09-DEVELOPER-STUDY-GUIDE.md#4-pkce
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

// ============================================================================
// Constants
// ============================================================================

/**
 * Authorization code lifetime in seconds
 */
const CODE_LIFETIME_SECONDS = 10 * 60; // 10 minutes

/**
 * PKCE challenge methods supported
 * Note: OAuth 2.1 requires S256, plain is not allowed
 */
const PKCE_METHODS = ['S256'];

// ============================================================================
// Schema Definition
// ============================================================================

const authorizationCodeSchema = new mongoose.Schema({
  // ─────────────────────────────────────────────────────────────────────────
  // Code Identification
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * The authorization code value
   * Opaque, cryptographically random string (64 hex chars)
   */
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Binding Information
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * User who authorized the request
   */
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  /**
   * Client that requested authorization
   */
  client_id: {
    type: String,
    required: true,
    index: true
  },
  
  /**
   * Redirect URI used in the authorization request
   * Must match exactly when exchanging code for tokens
   */
  redirect_uri: {
    type: String,
    required: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PKCE (Proof Key for Code Exchange)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * PKCE code challenge
   * Base64URL-encoded SHA256 hash of the code_verifier
   */
  code_challenge: {
    type: String,
    required: true
  },
  
  /**
   * PKCE code challenge method
   * Only S256 is supported (OAuth 2.1 requirement)
   */
  code_challenge_method: {
    type: String,
    enum: PKCE_METHODS,
    required: true,
    default: 'S256'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Authorization Details
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Scopes approved by the user
   * Space-separated string (OAuth spec format)
   */
  scope: {
    type: String,
    required: true
  },
  
  /**
   * State parameter from authorization request
   * Passed back to client for CSRF protection
   */
  state: {
    type: String
  },
  
  /**
   * Nonce value for OIDC (OpenID Connect)
   * Included in ID token for replay attack prevention
   */
  nonce: {
    type: String
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Usage Tracking
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Whether this code has been used
   * Codes are single-use
   */
  is_used: {
    type: Boolean,
    default: false
  },
  
  /**
   * When the code was used
   */
  used_at: {
    type: Date
  },
  
  /**
   * IP address of code usage (for audit)
   */
  used_from_ip: {
    type: String
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * When the code was issued
   */
  issued_at: {
    type: Date,
    default: Date.now
  },
  
  /**
   * When the code expires
   * MongoDB TTL index will auto-delete
   */
  expires_at: {
    type: Date,
    required: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Request Context (for audit/security)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * IP address of authorization request
   */
  request_ip: {
    type: String
  },
  
  /**
   * User agent of authorization request
   */
  request_user_agent: {
    type: String
  }

}, {
  timestamps: false // Using custom issued_at instead
});

// ============================================================================
// Indexes
// ============================================================================

// TTL index: Auto-delete expired codes immediately
// Short lifetime = fast cleanup
authorizationCodeSchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 0 }
);

// Compound index for code validation
authorizationCodeSchema.index({ code: 1, is_used: 1 });

// ============================================================================
// Instance Methods
// ============================================================================

/**
 * Check if code is valid for exchange
 * @returns {boolean}
 */
authorizationCodeSchema.methods.isValid = function() {
  return !this.is_used && this.expires_at > new Date();
};

/**
 * Verify PKCE code verifier
 * @param {string} codeVerifier - The code_verifier from token request
 * @returns {boolean}
 */
authorizationCodeSchema.methods.verifyPKCE = function(codeVerifier) {
  if (!codeVerifier) return false;
  
  // S256: BASE64URL(SHA256(code_verifier)) === code_challenge
  const hash = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest();
  
  // Convert to base64url
  const computed = hash
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(this.code_challenge)
  );
};

/**
 * Mark code as used
 * @param {string} ipAddress - IP address of token request
 * @returns {Promise<AuthorizationCode>}
 */
authorizationCodeSchema.methods.markUsed = function(ipAddress) {
  this.is_used = true;
  this.used_at = new Date();
  this.used_from_ip = ipAddress;
  return this.save();
};

// ============================================================================
// Static Methods
// ============================================================================

/**
 * Generate a new authorization code
 * @returns {string} 64-character hex string
 */
authorizationCodeSchema.statics.generateCode = function() {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create a new authorization code document
 * @param {Object} params - Code parameters
 * @returns {Promise<AuthorizationCode>}
 */
authorizationCodeSchema.statics.createCode = async function({
  userId,
  clientId,
  redirectUri,
  codeChallenge,
  codeChallengeMethod = 'S256',
  scope,
  state,
  nonce,
  requestIp,
  requestUserAgent
}) {
  const code = this.generateCode();
  const expiresAt = new Date(Date.now() + CODE_LIFETIME_SECONDS * 1000);
  
  return this.create({
    code,
    user_id: userId,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    scope,
    state,
    nonce,
    expires_at: expiresAt,
    request_ip: requestIp,
    request_user_agent: requestUserAgent
  });
};

/**
 * Find and validate an authorization code
 * Does NOT mark as used - caller should do that after successful exchange
 * @param {string} code - Authorization code
 * @param {string} clientId - Expected client ID
 * @param {string} redirectUri - Expected redirect URI
 * @returns {Promise<AuthorizationCode|null>}
 */
authorizationCodeSchema.statics.findValidCode = function(code, clientId, redirectUri) {
  return this.findOne({
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    is_used: false,
    expires_at: { $gt: new Date() }
  });
};

/**
 * Clean up expired and used codes
 * Usually handled by TTL index, but can be called manually
 * @returns {Promise<{deletedCount: number}>}
 */
authorizationCodeSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    $or: [
      { expires_at: { $lt: new Date() } },
      { is_used: true, used_at: { $lt: new Date(Date.now() - 60000) } } // Used codes older than 1 minute
    ]
  });
};

// ============================================================================
// Export
// ============================================================================

const AuthorizationCode = mongoose.model('AuthorizationCode', authorizationCodeSchema);
export default AuthorizationCode;
