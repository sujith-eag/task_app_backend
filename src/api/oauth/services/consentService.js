/**
 * OAuth Consent Service
 * 
 * Manages user consent for OAuth applications.
 * Handles consent UI flow, scope management, and consent revocation.
 * 
 * @module services/oauth/consentService
 * @see /docs/oidc-idp-transformation/08-FINALIZED-IMPLEMENTATION-PLAN.md
 */

import UserConsent from '../../../models/userConsentModel.js';
import OAuthClient from '../../../models/oauthClientModel.js';

// ============================================================================
// Scope Descriptions
// ============================================================================

/**
 * Human-readable descriptions for OAuth scopes
 * Used in consent UI
 */
const SCOPE_DESCRIPTIONS = {
  openid: {
    name: 'OpenID Connect',
    description: 'Verify your identity',
    icon: 'key'
  },
  profile: {
    name: 'Profile Information',
    description: 'Access your name, username, and profile picture',
    icon: 'user'
  },
  email: {
    name: 'Email Address',
    description: 'Access your email address and verification status',
    icon: 'mail'
  },
  offline_access: {
    name: 'Offline Access',
    description: 'Access your data when you\'re not using the app',
    icon: 'refresh'
  }
};

// ============================================================================
// Consent Checking
// ============================================================================

/**
 * Check if user consent is needed for the requested scopes
 * 
 * @param {string} userId - User ID
 * @param {string} clientId - Client ID
 * @param {string[]} requestedScopes - Requested scopes
 * @param {boolean} isFirstParty - Whether client is first-party
 * @returns {Promise<Object>} { needsConsent, missingScopes, existingConsent }
 */
export async function checkConsentNeeded(userId, clientId, requestedScopes, isFirstParty = false) {
  // First-party apps skip consent
  if (isFirstParty) {
    return {
      needsConsent: false,
      missingScopes: [],
      existingConsent: null
    };
  }
  
  // Check existing consent
  const existingConsent = await UserConsent.findActiveConsent(userId, clientId);
  
  if (!existingConsent) {
    return {
      needsConsent: true,
      missingScopes: requestedScopes,
      existingConsent: null
    };
  }
  
  // Check for missing scopes
  const missingScopes = existingConsent.getMissingScopes(requestedScopes);
  
  return {
    needsConsent: missingScopes.length > 0,
    missingScopes,
    existingConsent
  };
}

/**
 * Get consent data for UI rendering
 * 
 * @param {string} clientId - Client ID
 * @param {string[]} requestedScopes - Requested scopes
 * @param {Object} client - Client document
 * @returns {Object} Consent UI data
 */
export function getConsentUIData(clientId, requestedScopes, client) {
  // Build scope information for UI
  const scopeInfo = requestedScopes.map(scope => ({
    scope,
    ...SCOPE_DESCRIPTIONS[scope] || {
      name: scope,
      description: `Access ${scope} data`,
      icon: 'circle'
    }
  }));
  
  return {
    client: {
      id: clientId,
      name: client.name,
      description: client.description,
      logo_uri: client.logo_uri,
      is_first_party: client.is_first_party
    },
    scopes: scopeInfo,
    requestedScopes
  };
}

// ============================================================================
// Consent Management
// ============================================================================

/**
 * Grant consent for requested scopes
 * 
 * @param {Object} params - Consent parameters
 * @param {string} params.userId - User ID
 * @param {string} params.clientId - Client ID
 * @param {string[]} params.scopes - Scopes to grant
 * @param {string} params.ipAddress - Request IP
 * @param {string} params.userAgent - Request user agent
 * @returns {Promise<Object>} { success, consent }
 */
export async function grantConsent({
  userId,
  clientId,
  scopes,
  ipAddress,
  userAgent
}) {
  const consent = await UserConsent.grantConsent({
    userId,
    clientId,
    scopes,
    ipAddress,
    userAgent
  });
  
  return { success: true, consent };
}

/**
 * Revoke consent for a specific client
 * 
 * @param {string} userId - User ID
 * @param {string} clientId - Client ID
 * @param {string} ipAddress - Request IP
 * @param {string} userAgent - Request user agent
 * @returns {Promise<Object>} { success, error }
 */
export async function revokeConsent(userId, clientId, ipAddress, userAgent) {
  const consent = await UserConsent.findConsent(userId, clientId);
  
  if (!consent) {
    return { success: false, error: 'No consent found' };
  }
  
  await consent.revokeAll({ ipAddress, userAgent });
  
  return { success: true };
}

/**
 * Revoke specific scopes
 * 
 * @param {string} userId - User ID
 * @param {string} clientId - Client ID
 * @param {string[]} scopes - Scopes to revoke
 * @param {string} ipAddress - Request IP
 * @param {string} userAgent - Request user agent
 * @returns {Promise<Object>} { success, consent, error }
 */
export async function revokeScopes(userId, clientId, scopes, ipAddress, userAgent) {
  const consent = await UserConsent.findConsent(userId, clientId);
  
  if (!consent) {
    return { success: false, error: 'No consent found' };
  }
  
  await consent.revokeScopes(scopes, { ipAddress, userAgent });
  
  return { success: true, consent };
}

// ============================================================================
// User Consent Management (Account Settings)
// ============================================================================

/**
 * List all consents for a user
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of consents with client info
 */
export async function listUserConsents(userId) {
  const consents = await UserConsent.findUserConsents(userId);
  
  // Get client details for each consent
  const clientIds = consents.map(c => c.client_id);
  const clients = await OAuthClient.find({ client_id: { $in: clientIds } })
    .select('client_id client_name logo_uri client_uri')
    .lean();
  
  // Create a map for quick lookup
  const clientMap = clients.reduce((acc, client) => {
    acc[client.client_id] = client;
    return acc;
  }, {});
  
  return consents.map(consent => {
    const client = clientMap[consent.client_id] || {};
    return {
      client_id: consent.client_id,
      client_name: client.client_name || 'Unknown Application',
      logo_uri: client.logo_uri,
      client_uri: client.client_uri,
      granted_scopes: consent.granted_scopes,
      first_granted_at: consent.first_granted_at,
      last_updated_at: consent.last_updated_at
    };
  });
}

/**
 * Get detailed consent for a specific client
 * 
 * @param {string} userId - User ID
 * @param {string} clientId - Client ID
 * @returns {Promise<Object|null>} Consent details
 */
export async function getConsentDetails(userId, clientId) {
  const consent = await UserConsent.findConsent(userId, clientId);
  
  if (!consent) {
    return null;
  }
  
  return {
    clientId: consent.client_id,
    grantedScopes: consent.granted_scopes,
    scopeDescriptions: consent.granted_scopes.map(scope => ({
      scope,
      ...SCOPE_DESCRIPTIONS[scope] || { name: scope, description: scope }
    })),
    isActive: consent.is_active,
    firstGrantedAt: consent.first_granted_at,
    lastUpdatedAt: consent.last_updated_at,
    history: consent.history.slice(-10) // Last 10 changes
  };
}

/**
 * Revoke all consents for a user (account deletion)
 * 
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of consents revoked
 */
export async function revokeAllUserConsents(userId) {
  const consents = await UserConsent.find({ user_id: userId, is_active: true });
  
  let revokedCount = 0;
  for (const consent of consents) {
    await consent.revokeAll({});
    revokedCount++;
  }
  
  return revokedCount;
}

// ============================================================================
// Admin Functions
// ============================================================================

/**
 * Get consent statistics for a client (admin view)
 * 
 * @param {string} clientId - Client ID
 * @returns {Promise<Object>} Consent statistics
 */
export async function getClientConsentStats(clientId) {
  const activeCount = await UserConsent.countActiveConsents(clientId);
  
  // Get scope distribution
  const consents = await UserConsent.find({
    client_id: clientId,
    is_active: true
  }).select('granted_scopes');
  
  const scopeCounts = {};
  for (const consent of consents) {
    for (const scope of consent.granted_scopes) {
      scopeCounts[scope] = (scopeCounts[scope] || 0) + 1;
    }
  }
  
  return {
    totalActiveConsents: activeCount,
    scopeDistribution: scopeCounts
  };
}

/**
 * Revoke all consents for a client (admin action, e.g., client deletion)
 * 
 * @param {string} clientId - Client ID
 * @returns {Promise<Object>} { modifiedCount }
 */
export async function revokeAllClientConsents(clientId) {
  return UserConsent.revokeAllForClient(clientId);
}

// ============================================================================
// Export
// ============================================================================

export default {
  SCOPE_DESCRIPTIONS,
  checkConsentNeeded,
  getConsentUIData,
  grantConsent,
  revokeConsent,
  revokeScopes,
  listUserConsents,
  getConsentDetails,
  revokeAllUserConsents,
  getClientConsentStats,
  revokeAllClientConsents
};
