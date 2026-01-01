/**
 * User Consent Model
 * 
 * Tracks user consent for OAuth client applications.
 * Stores which scopes a user has granted to each client.
 * 
 * Features:
 * - Per-user, per-client consent tracking
 * - Scope management (grant/revoke individual scopes)
 * - Consent history for audit
 * - First-party app optimization (skip consent screen)
 * 
 * @module models/userConsentModel
 * @see /docs/oidc-idp-transformation/08-FINALIZED-IMPLEMENTATION-PLAN.md
 */

import mongoose from 'mongoose';

// ============================================================================
// Sub-Schemas
// ============================================================================

/**
 * Schema for tracking individual consent changes
 */
const consentHistorySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['granted', 'revoked', 'updated'],
    required: true
  },
  scopes: {
    type: [String],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  ip_address: {
    type: String
  },
  user_agent: {
    type: String
  }
}, { _id: false });

// ============================================================================
// Schema Definition
// ============================================================================

const userConsentSchema = new mongoose.Schema({
  // ─────────────────────────────────────────────────────────────────────────
  // Identification
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * User who granted consent
   */
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  /**
   * Client that received consent
   */
  client_id: {
    type: String,
    required: true,
    index: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Consent State
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Currently granted scopes
   */
  granted_scopes: {
    type: [String],
    default: []
  },
  
  /**
   * Whether consent is currently active
   * User can revoke all consent but keep the record
   */
  is_active: {
    type: Boolean,
    default: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * When consent was first granted
   */
  first_granted_at: {
    type: Date,
    default: Date.now
  },
  
  /**
   * When consent was last updated
   */
  last_updated_at: {
    type: Date,
    default: Date.now
  },
  
  /**
   * When consent was revoked (if is_active is false)
   */
  revoked_at: {
    type: Date
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Audit Trail
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * History of consent changes
   */
  history: {
    type: [consentHistorySchema],
    default: []
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Context
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * IP address when consent was first granted
   */
  initial_ip: {
    type: String
  },
  
  /**
   * User agent when consent was first granted
   */
  initial_user_agent: {
    type: String
  }

}, {
  timestamps: true // Add createdAt and updatedAt
});

// ============================================================================
// Indexes
// ============================================================================

// Unique constraint: one consent record per user-client pair
userConsentSchema.index(
  { user_id: 1, client_id: 1 },
  { unique: true }
);

// Index for finding active consents
userConsentSchema.index({ user_id: 1, is_active: 1 });

// Index for finding all users who consented to a client
userConsentSchema.index({ client_id: 1, is_active: 1 });

// ============================================================================
// Instance Methods
// ============================================================================

/**
 * Check if a specific scope is granted
 * @param {string} scope - Scope to check
 * @returns {boolean}
 */
userConsentSchema.methods.hasScope = function(scope) {
  return this.is_active && this.granted_scopes.includes(scope);
};

/**
 * Check if all requested scopes are granted
 * @param {string[]} scopes - Scopes to check
 * @returns {boolean}
 */
userConsentSchema.methods.hasAllScopes = function(scopes) {
  if (!this.is_active) return false;
  return scopes.every(scope => this.granted_scopes.includes(scope));
};

/**
 * Get missing scopes (not yet granted)
 * @param {string[]} requestedScopes - Requested scopes
 * @returns {string[]} Scopes not yet granted
 */
userConsentSchema.methods.getMissingScopes = function(requestedScopes) {
  if (!this.is_active) return requestedScopes;
  return requestedScopes.filter(scope => !this.granted_scopes.includes(scope));
};

/**
 * Grant additional scopes
 * @param {string[]} scopes - Scopes to grant
 * @param {Object} context - Request context
 * @returns {Promise<UserConsent>}
 */
userConsentSchema.methods.grantScopes = function(scopes, { ipAddress, userAgent } = {}) {
  const newScopes = scopes.filter(s => !this.granted_scopes.includes(s));
  
  if (newScopes.length > 0) {
    this.granted_scopes.push(...newScopes);
    this.is_active = true;
    this.last_updated_at = new Date();
    this.revoked_at = undefined;
    
    this.history.push({
      action: 'granted',
      scopes: newScopes,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }
  
  return this.save();
};

/**
 * Revoke specific scopes
 * @param {string[]} scopes - Scopes to revoke
 * @param {Object} context - Request context
 * @returns {Promise<UserConsent>}
 */
userConsentSchema.methods.revokeScopes = function(scopes, { ipAddress, userAgent } = {}) {
  const revokedScopes = scopes.filter(s => this.granted_scopes.includes(s));
  
  if (revokedScopes.length > 0) {
    this.granted_scopes = this.granted_scopes.filter(s => !scopes.includes(s));
    this.last_updated_at = new Date();
    
    this.history.push({
      action: 'revoked',
      scopes: revokedScopes,
      ip_address: ipAddress,
      user_agent: userAgent
    });
    
    // If no scopes left, mark as inactive
    if (this.granted_scopes.length === 0) {
      this.is_active = false;
      this.revoked_at = new Date();
    }
  }
  
  return this.save();
};

/**
 * Revoke all consent
 * @param {Object} context - Request context
 * @returns {Promise<UserConsent>}
 */
userConsentSchema.methods.revokeAll = function({ ipAddress, userAgent } = {}) {
  const revokedScopes = [...this.granted_scopes];
  
  if (revokedScopes.length > 0 || this.is_active) {
    this.history.push({
      action: 'revoked',
      scopes: revokedScopes,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }
  
  this.granted_scopes = [];
  this.is_active = false;
  this.revoked_at = new Date();
  this.last_updated_at = new Date();
  
  return this.save();
};

// ============================================================================
// Static Methods
// ============================================================================

/**
 * Find consent for a user-client pair
 * @param {string} userId - User ID
 * @param {string} clientId - Client ID
 * @returns {Promise<UserConsent|null>}
 */
userConsentSchema.statics.findConsent = function(userId, clientId) {
  return this.findOne({ user_id: userId, client_id: clientId });
};

/**
 * Find active consent for a user-client pair
 * @param {string} userId - User ID
 * @param {string} clientId - Client ID
 * @returns {Promise<UserConsent|null>}
 */
userConsentSchema.statics.findActiveConsent = function(userId, clientId) {
  return this.findOne({ 
    user_id: userId, 
    client_id: clientId,
    is_active: true
  });
};

/**
 * Grant or update consent
 * @param {Object} params - Consent parameters
 * @returns {Promise<UserConsent>}
 */
userConsentSchema.statics.grantConsent = async function({
  userId,
  clientId,
  scopes,
  ipAddress,
  userAgent
}) {
  let consent = await this.findOne({ user_id: userId, client_id: clientId });
  
  if (consent) {
    // Update existing consent
    return consent.grantScopes(scopes, { ipAddress, userAgent });
  } else {
    // Create new consent
    return this.create({
      user_id: userId,
      client_id: clientId,
      granted_scopes: scopes,
      is_active: true,
      initial_ip: ipAddress,
      initial_user_agent: userAgent,
      history: [{
        action: 'granted',
        scopes,
        ip_address: ipAddress,
        user_agent: userAgent
      }]
    });
  }
};

/**
 * Check if user has consented to all scopes
 * @param {string} userId - User ID
 * @param {string} clientId - Client ID
 * @param {string[]} scopes - Required scopes
 * @returns {Promise<boolean>}
 */
userConsentSchema.statics.hasConsent = async function(userId, clientId, scopes) {
  const consent = await this.findActiveConsent(userId, clientId);
  return consent ? consent.hasAllScopes(scopes) : false;
};

/**
 * Get all active consents for a user
 * @param {string} userId - User ID
 * @returns {Promise<UserConsent[]>}
 */
userConsentSchema.statics.findUserConsents = function(userId) {
  return this.find({ user_id: userId, is_active: true });
};

/**
 * Revoke all consents for a client (admin action)
 * @param {string} clientId - Client ID
 * @returns {Promise<{modifiedCount: number}>}
 */
userConsentSchema.statics.revokeAllForClient = async function(clientId) {
  return this.updateMany(
    { client_id: clientId, is_active: true },
    {
      is_active: false,
      revoked_at: new Date(),
      last_updated_at: new Date(),
      $push: {
        history: {
          action: 'revoked',
          scopes: [],
          timestamp: new Date()
        }
      }
    }
  );
};

/**
 * Count users who have consented to a client
 * @param {string} clientId - Client ID
 * @returns {Promise<number>}
 */
userConsentSchema.statics.countActiveConsents = function(clientId) {
  return this.countDocuments({ client_id: clientId, is_active: true });
};

// ============================================================================
// Export
// ============================================================================

const UserConsent = mongoose.model('UserConsent', userConsentSchema);
export default UserConsent;
