/**
 * Refresh Token Model
 * 
 * Stores OAuth refresh tokens with rotation tracking for security.
 * Implements token family concept for reuse detection.
 * 
 * Key Security Features:
 * - Token rotation: New token issued on each use
 * - Family tracking: All rotated tokens share a family_id
 * - Reuse detection: If rotated token is reused, entire family is revoked
 * 
 * @module models/refreshTokenModel
 * @see /docs/oidc-idp-transformation/09-DEVELOPER-STUDY-GUIDE.md#7-refresh-token-rotation
 */

import mongoose from 'mongoose';

// ============================================================================
// Schema Definition
// ============================================================================

const refreshTokenSchema = new mongoose.Schema({
  // ─────────────────────────────────────────────────────────────────────────
  // Token Identification
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Unique opaque token value (64 hex characters)
   * This is what the client stores and sends to refresh
   */
  token_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  /**
   * User who owns this refresh token
   */
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  /**
   * OAuth client that issued this token
   */
  client_id: {
    type: String,
    required: true,
    index: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Token Rotation Tracking
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Token family identifier
   * All tokens in a rotation chain share the same family_id
   * Used to detect token reuse and revoke entire family
   */
  family_id: {
    type: String,
    required: true,
    index: true
  },
  
  /**
   * Number of times this token family has been rotated
   * Starts at 0, increments with each rotation
   */
  rotation_count: {
    type: Number,
    default: 0
  },
  
  /**
   * When this token was rotated (replaced by a new token)
   * If set, this token should not be used again
   * Reuse of a rotated token triggers family revocation
   */
  rotated_at: {
    type: Date
  },
  
  /**
   * Previous token in the rotation chain
   * Used for audit trail
   */
  previous_token_id: {
    type: String
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Revocation Status
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Whether this token has been revoked
   */
  is_revoked: {
    type: Boolean,
    default: false,
    index: true
  },
  
  /**
   * When the token was revoked
   */
  revoked_at: {
    type: Date
  },
  
  /**
   * Reason for revocation
   */
  revocation_reason: {
    type: String,
    enum: [
      'user_logout',        // User explicitly logged out
      'user_revoked',       // User revoked app access
      'admin_revoked',      // Admin revoked client or user
      'password_changed',   // User changed password
      'token_reuse',        // Security: reuse detected
      'client_deleted',     // Client was deleted
      'expired'             // Natural expiration
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Granted scopes for this token
   */
  scope: {
    type: String,
    required: true
  },
  
  /**
   * Device identifier (for device-aware tokens)
   */
  device_id: {
    type: String,
    index: true
  },
  
  /**
   * IP address at token issuance
   */
  ip_address: {
    type: String
  },
  
  /**
   * User agent at token issuance
   */
  user_agent: {
    type: String
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * When the token was issued
   */
  issued_at: {
    type: Date,
    default: Date.now
  },
  
  /**
   * When the token expires
   * MongoDB TTL index will auto-delete expired tokens
   */
  expires_at: {
    type: Date,
    required: true
  },
  
  /**
   * When the token was last used to get an access token
   */
  last_used_at: {
    type: Date
  }

}, {
  timestamps: false // Using custom issued_at instead
});

// ============================================================================
// Indexes
// ============================================================================

// TTL index: Auto-delete expired tokens after 7 days (grace period)
// This gives time for audit even after expiration
refreshTokenSchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }
);

// Compound index for token validation
refreshTokenSchema.index({ token_id: 1, is_revoked: 1 });

// Compound index for finding user's tokens per client
refreshTokenSchema.index({ user_id: 1, client_id: 1 });

// Index for family-based operations (revoke entire family)
refreshTokenSchema.index({ family_id: 1, is_revoked: 1 });

// ============================================================================
// Instance Methods
// ============================================================================

/**
 * Check if token is valid for use
 * @returns {boolean}
 */
refreshTokenSchema.methods.isValid = function() {
  return !this.is_revoked && 
         !this.rotated_at && 
         this.expires_at > new Date();
};

/**
 * Check if token has been rotated (and thus should not be reused)
 * @returns {boolean}
 */
refreshTokenSchema.methods.wasRotated = function() {
  return !!this.rotated_at;
};

/**
 * Mark token as rotated
 * @returns {Promise<RefreshToken>}
 */
refreshTokenSchema.methods.markRotated = function() {
  this.rotated_at = new Date();
  return this.save();
};

/**
 * Revoke this token
 * @param {string} reason - Revocation reason
 * @returns {Promise<RefreshToken>}
 */
refreshTokenSchema.methods.revoke = function(reason) {
  this.is_revoked = true;
  this.revoked_at = new Date();
  this.revocation_reason = reason;
  return this.save();
};

// ============================================================================
// Static Methods
// ============================================================================

/**
 * Find a valid (non-revoked, non-rotated, non-expired) token
 * @param {string} tokenId - Token ID
 * @returns {Promise<RefreshToken|null>}
 */
refreshTokenSchema.statics.findValidToken = function(tokenId) {
  return this.findOne({
    token_id: tokenId,
    is_revoked: false,
    expires_at: { $gt: new Date() }
  });
};

/**
 * Revoke all tokens in a family (security measure)
 * @param {string} familyId - Token family ID
 * @param {string} reason - Revocation reason
 * @returns {Promise<{modifiedCount: number}>}
 */
refreshTokenSchema.statics.revokeFamilyTokens = async function(familyId, reason = 'token_reuse') {
  return this.updateMany(
    { family_id: familyId },
    {
      is_revoked: true,
      revoked_at: new Date(),
      revocation_reason: reason
    }
  );
};

/**
 * Revoke all tokens for a user-client pair
 * @param {string} userId - User ID
 * @param {string} clientId - Client ID
 * @param {string} reason - Revocation reason
 * @returns {Promise<{modifiedCount: number}>}
 */
refreshTokenSchema.statics.revokeUserClientTokens = async function(userId, clientId, reason = 'user_revoked') {
  return this.updateMany(
    { user_id: userId, client_id: clientId, is_revoked: false },
    {
      is_revoked: true,
      revoked_at: new Date(),
      revocation_reason: reason
    }
  );
};

/**
 * Revoke all tokens for a user (e.g., password change)
 * @param {string} userId - User ID
 * @param {string} reason - Revocation reason
 * @returns {Promise<{modifiedCount: number}>}
 */
refreshTokenSchema.statics.revokeAllUserTokens = async function(userId, reason = 'password_changed') {
  return this.updateMany(
    { user_id: userId, is_revoked: false },
    {
      is_revoked: true,
      revoked_at: new Date(),
      revocation_reason: reason
    }
  );
};

/**
 * Revoke all tokens for a client (e.g., client deleted)
 * @param {string} clientId - Client ID
 * @param {string} reason - Revocation reason
 * @returns {Promise<{modifiedCount: number}>}
 */
refreshTokenSchema.statics.revokeAllClientTokens = async function(clientId, reason = 'client_deleted') {
  return this.updateMany(
    { client_id: clientId, is_revoked: false },
    {
      is_revoked: true,
      revoked_at: new Date(),
      revocation_reason: reason
    }
  );
};

/**
 * Count active tokens for a user-client pair
 * @param {string} userId - User ID
 * @param {string} clientId - Client ID
 * @returns {Promise<number>}
 */
refreshTokenSchema.statics.countActiveTokens = function(userId, clientId) {
  return this.countDocuments({
    user_id: userId,
    client_id: clientId,
    is_revoked: false,
    rotated_at: null,
    expires_at: { $gt: new Date() }
  });
};

// ============================================================================
// Export
// ============================================================================

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
