/**
 * OAuth Client Model
 * 
 * Represents registered OAuth 2.1 clients (student projects) that can
 * authenticate users via Eagle Campus Identity Provider.
 * 
 * @module models/oauthClientModel
 * @see /docs/oidc-idp-transformation/08-FINALIZED-IMPLEMENTATION-PLAN.md
 */

import mongoose from 'mongoose';

// ============================================================================
// Constants
// ============================================================================

/**
 * Client status workflow:
 * pending → approved (by admin)
 * pending → rejected (by admin)
 * approved → suspended (by admin)
 * suspended → approved (reactivated)
 */
export const ClientStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended'
};

/**
 * Supported OAuth scopes
 * MVP: Only identity scopes (openid, profile, email)
 * Future: Resource scopes (files:read, tasks:write, etc.)
 */
export const SupportedScopes = [
  'openid',      // Required for OIDC (returns sub claim)
  'profile',     // name, picture
  'email',       // email, email_verified
  // Future scopes (post-MVP):
  // 'roles',    // roles array
  // 'academic', // department, batch, semester, section
  // 'files:read',
  // 'tasks:read'
];

/**
 * Supported grant types
 * All clients use authorization_code + refresh_token
 */
export const SupportedGrantTypes = [
  'authorization_code',
  'refresh_token'
];

// ============================================================================
// Schema Definition
// ============================================================================

const oauthClientSchema = new mongoose.Schema({
  // ─────────────────────────────────────────────────────────────────────────
  // Client Identification
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Unique client identifier (public)
   * Format: client_{32 hex chars}
   * Example: client_a1b2c3d4e5f6...
   */
  client_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  /**
   * Client secret hash (for confidential clients only)
   * Hashed with bcrypt, never stored in plain text
   * Currently not used (all clients are public)
   */
  client_secret_hash: {
    type: String,
    select: false
  },
  
  /**
   * Human-readable client name
   * Shown to users during consent
   */
  client_name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
    maxlength: [100, 'Client name cannot exceed 100 characters']
  },
  
  /**
   * Client type: public (SPAs, mobile) or confidential (server-side)
   * MVP: All clients are public (PKCE enforced)
   */
  client_type: {
    type: String,
    enum: ['public', 'confidential'],
    default: 'public'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Registration & Approval Workflow
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Current status in approval workflow
   */
  status: {
    type: String,
    enum: Object.values(ClientStatus),
    default: ClientStatus.PENDING,
    index: true
  },
  
  /**
   * User who registered this client
   */
  requested_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  /**
   * Admin who approved/rejected this client
   */
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  /**
   * When the client was reviewed (approved/rejected)
   */
  reviewed_at: {
    type: Date
  },
  
  /**
   * Reason for rejection (if rejected)
   */
  rejection_reason: {
    type: String,
    maxlength: 500
  },

  // ─────────────────────────────────────────────────────────────────────────
  // OAuth Configuration
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Allowed redirect URIs (exact match required)
   * Must be HTTPS in production (except localhost)
   */
  redirect_uris: {
    type: [String],
    required: [true, 'At least one redirect URI is required'],
    validate: {
      validator: function(uris) {
        return uris && uris.length > 0;
      },
      message: 'At least one redirect URI is required'
    }
  },
  
  /**
   * Scopes requested during registration
   */
  requested_scopes: {
    type: [String],
    default: ['openid', 'profile', 'email']
  },
  
  /**
   * Scopes approved by admin (subset of requested)
   */
  allowed_scopes: {
    type: [String],
    default: []
  },
  
  /**
   * Allowed OAuth grant types
   */
  allowed_grant_types: {
    type: [String],
    enum: SupportedGrantTypes,
    default: ['authorization_code', 'refresh_token']
  },
  
  /**
   * Whether PKCE is required (always true for public clients)
   */
  require_pkce: {
    type: Boolean,
    default: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Token Configuration
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Access token lifetime in seconds (default: 15 min)
   */
  access_token_lifetime: {
    type: Number,
    default: 900,
    min: 60,
    max: 3600
  },
  
  /**
   * Refresh token lifetime in seconds (default: 30 days)
   */
  refresh_token_lifetime: {
    type: Number,
    default: 2592000,
    min: 86400,
    max: 7776000 // 90 days max
  },
  
  /**
   * Authorization code lifetime in seconds (default: 10 min)
   */
  authorization_code_lifetime: {
    type: Number,
    default: 600,
    min: 60,
    max: 600
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Rate Limiting
  // ─────────────────────────────────────────────────────────────────────────
  
  rate_limit: {
    /**
     * Max requests per minute to token endpoint
     */
    requests_per_minute: {
      type: Number,
      default: 60
    },
    /**
     * Max requests per day
     */
    requests_per_day: {
      type: Number,
      default: 10000
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Description of what the client does
   */
  description: {
    type: String,
    maxlength: 1000
  },
  
  /**
   * Client homepage URL
   */
  homepage_url: {
    type: String
  },
  
  /**
   * Client logo URI (displayed during consent)
   */
  logo_uri: {
    type: String
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Audit
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * When the client was last used (token issued)
   */
  last_used_at: {
    type: Date
  },
  
  /**
   * Total number of tokens issued
   */
  token_count: {
    type: Number,
    default: 0
  }

}, {
  timestamps: true // createdAt, updatedAt
});

// ============================================================================
// Indexes
// ============================================================================

// Compound index for listing by status
oauthClientSchema.index({ status: 1, createdAt: -1 });

// Index for finding clients by owner
oauthClientSchema.index({ requested_by: 1 });

// ============================================================================
// Instance Methods
// ============================================================================

/**
 * Check if a redirect URI is valid for this client
 * @param {string} uri - Redirect URI to validate
 * @returns {boolean}
 */
oauthClientSchema.methods.isValidRedirectUri = function(uri) {
  return this.redirect_uris.includes(uri);
};

/**
 * Verify client secret (for confidential clients)
 * @param {string} secret - Plain text secret to verify
 * @returns {Promise<boolean>}
 */
oauthClientSchema.methods.verifySecret = async function(secret) {
  if (!this.client_secret_hash) {
    // Public clients don't have secrets
    return false;
  }
  
  // Use bcrypt to compare - need to import at top of file
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(secret, this.client_secret_hash);
};

/**
 * Check if a scope is allowed for this client
 * @param {string} scope - Space-separated scope string
 * @returns {boolean}
 */
oauthClientSchema.methods.hasScope = function(scope) {
  const requestedScopes = scope.split(' ');
  return requestedScopes.every(s => this.allowed_scopes.includes(s));
};

/**
 * Check if client is active and can be used
 * @returns {boolean}
 */
oauthClientSchema.methods.isActive = function() {
  return this.status === ClientStatus.APPROVED;
};

// ============================================================================
// Static Methods
// ============================================================================

/**
 * Find an active client by client_id
 * @param {string} clientId - Client ID
 * @returns {Promise<OAuthClient|null>}
 */
oauthClientSchema.statics.findActiveClient = function(clientId) {
  return this.findOne({
    client_id: clientId,
    status: ClientStatus.APPROVED
  });
};

/**
 * Get pending clients for admin review
 * @returns {Promise<OAuthClient[]>}
 */
oauthClientSchema.statics.findPendingClients = function() {
  return this.find({ status: ClientStatus.PENDING })
    .populate('requested_by', 'name email')
    .sort({ createdAt: 1 });
};

// ============================================================================
// Export
// ============================================================================

const OAuthClient = mongoose.model('OAuthClient', oauthClientSchema);
export default OAuthClient;
