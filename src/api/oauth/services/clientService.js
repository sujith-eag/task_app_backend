/**
 * OAuth Client Service
 * 
 * Manages OAuth client registration, validation, and lifecycle.
 * Supports admin approval workflow for student project clients.
 * 
 * @module services/oauth/clientService
 * @see /docs/oidc-idp-transformation/08-FINALIZED-IMPLEMENTATION-PLAN.md
 */

import OAuthClient from '../../../models/oauthClientModel.js';
import {
  generateClientId,
  generateClientSecret
} from '../../../utils/oauthCrypto.js';

// ============================================================================
// Client Registration
// ============================================================================

/**
 * Register a new OAuth client application
 * Client starts in PENDING status, requires admin approval
 * 
 * @param {Object} params - Client registration parameters
 * @param {string} params.name - Application name
 * @param {string} params.description - Application description
 * @param {string[]} params.redirectUris - Allowed redirect URIs
 * @param {string[]} params.scopes - Requested scopes
 * @param {string} params.applicationType - 'web' or 'native'
 * @param {boolean} params.isFirstParty - Whether this is a first-party app
 * @param {string} params.ownerId - User ID of the owner
 * @param {string} params.ownerEmail - Email of the owner
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<Object>} { client, clientId, clientSecret }
 */
export async function registerClient({
  name,
  description,
  redirectUris,
  scopes = ['openid', 'profile', 'email'],
  applicationType = 'web',
  isFirstParty = false,
  ownerId,
  ownerEmail,
  metadata = {}
}) {
  // Generate credentials
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();
  
  // Create client
  const client = await OAuthClient.create({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: name,
    description,
    redirect_uris: redirectUris,
    scopes,
    application_type: applicationType,
    is_first_party: isFirstParty,
    requested_by: ownerId,
    owner: {
      user_id: ownerId,
      email: ownerEmail
    },
    metadata,
    // First-party apps are auto-approved
    status: isFirstParty ? 'approved' : 'pending',
    approved_at: isFirstParty ? new Date() : undefined
  });
  
  return {
    client,
    clientId,
    // Only return secret once at registration
    clientSecret
  };
}

/**
 * Validate client credentials
 * 
 * @param {string} clientId - Client ID
 * @param {string} clientSecret - Client secret (optional for public clients)
 * @returns {Promise<Object>} { isValid, client, error }
 */
export async function validateClient(clientId, clientSecret = null) {
  const client = await OAuthClient.findActiveClient(clientId);
  
  if (!client) {
    return { isValid: false, error: 'Client not found or inactive' };
  }
  
  // Verify secret if provided (confidential clients)
  if (clientSecret !== null) {
    const isSecretValid = await client.verifySecret(clientSecret);
    if (!isSecretValid) {
      // Track failed attempt
      await OAuthClient.updateOne(
        { client_id: clientId },
        { $inc: { 'rate_limit.failed_auth_attempts': 1 } }
      );
      return { isValid: false, error: 'Invalid client secret' };
    }
  }
  
  return { isValid: true, client };
}

/**
 * Validate redirect URI for a client
 * 
 * @param {string} clientId - Client ID
 * @param {string} redirectUri - Redirect URI to validate
 * @returns {Promise<Object>} { isValid, client, error }
 */
export async function validateRedirectUri(clientId, redirectUri) {
  const client = await OAuthClient.findActiveClient(clientId);
  
  if (!client) {
    return { isValid: false, error: 'Client not found or inactive' };
  }
  
  if (!client.isValidRedirectUri(redirectUri)) {
    return { isValid: false, error: 'Invalid redirect URI', client };
  }
  
  return { isValid: true, client };
}

/**
 * Validate requested scopes for a client
 * 
 * @param {Object} client - Client document
 * @param {string[]} requestedScopes - Requested scopes
 * @returns {Object} { isValid, grantedScopes, deniedScopes }
 */
export function validateScopes(client, requestedScopes) {
  const grantedScopes = [];
  const deniedScopes = [];
  
  for (const scope of requestedScopes) {
    if (client.hasScope(scope)) {
      grantedScopes.push(scope);
    } else {
      deniedScopes.push(scope);
    }
  }
  
  return {
    isValid: deniedScopes.length === 0,
    grantedScopes,
    deniedScopes
  };
}

// ============================================================================
// Client Lifecycle Management
// ============================================================================

/**
 * Approve a pending client (admin action)
 * 
 * @param {string} clientId - Client ID
 * @param {string} adminId - Admin user ID
 * @param {string} notes - Approval notes
 * @returns {Promise<Object>} { success, client, error }
 */
export async function approveClient(clientId, adminId, notes = '') {
  const client = await OAuthClient.findOne({ client_id: clientId });
  
  if (!client) {
    return { success: false, error: 'Client not found' };
  }
  
  if (client.status !== 'pending') {
    return { success: false, error: `Cannot approve client with status: ${client.status}` };
  }
  
  client.status = 'approved';
  client.approved_at = new Date();
  client.approved_by = adminId;
  client.review_notes = notes;
  
  await client.save();
  
  return { success: true, client };
}

/**
 * Reject a pending client (admin action)
 * 
 * @param {string} clientId - Client ID
 * @param {string} adminId - Admin user ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} { success, client, error }
 */
export async function rejectClient(clientId, adminId, reason = '') {
  const client = await OAuthClient.findOne({ client_id: clientId });
  
  if (!client) {
    return { success: false, error: 'Client not found' };
  }
  
  if (client.status !== 'pending') {
    return { success: false, error: `Cannot reject client with status: ${client.status}` };
  }
  
  client.status = 'rejected';
  client.approved_by = adminId;
  client.review_notes = reason;
  
  await client.save();
  
  return { success: true, client };
}

/**
 * Suspend an approved client (admin action)
 * 
 * @param {string} clientId - Client ID
 * @param {string} adminId - Admin user ID
 * @param {string} reason - Suspension reason
 * @returns {Promise<Object>} { success, client, error }
 */
export async function suspendClient(clientId, adminId, reason = '') {
  const client = await OAuthClient.findOne({ client_id: clientId });
  
  if (!client) {
    return { success: false, error: 'Client not found' };
  }
  
  if (client.status !== 'approved') {
    return { success: false, error: `Cannot suspend client with status: ${client.status}` };
  }
  
  client.status = 'suspended';
  client.review_notes = reason;
  
  await client.save();
  
  return { success: true, client };
}

/**
 * Reactivate a suspended client (admin action)
 * 
 * @param {string} clientId - Client ID
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} { success, client, error }
 */
export async function reactivateClient(clientId, adminId) {
  const client = await OAuthClient.findOne({ client_id: clientId });
  
  if (!client) {
    return { success: false, error: 'Client not found' };
  }
  
  if (client.status !== 'suspended') {
    return { success: false, error: `Cannot reactivate client with status: ${client.status}` };
  }
  
  client.status = 'approved';
  await client.save();
  
  return { success: true, client };
}

/**
 * Rotate client secret
 * 
 * @param {string} clientId - Client ID
 * @param {string} requesterId - User requesting rotation
 * @returns {Promise<Object>} { success, newSecret, error }
 */
export async function rotateClientSecret(clientId, requesterId) {
  const client = await OAuthClient.findOne({ client_id: clientId });
  
  if (!client) {
    return { success: false, error: 'Client not found' };
  }
  
  // Verify requester is owner or admin
  if (client.owner.user_id?.toString() !== requesterId) {
    return { success: false, error: 'Not authorized to rotate secret' };
  }
  
  const newSecret = generateClientSecret();
  await client.setSecret(newSecret);
  
  return { success: true, newSecret };
}

// ============================================================================
// Client Queries
// ============================================================================

/**
 * Get client by ID (public info only)
 * 
 * @param {string} clientId - Client ID
 * @returns {Promise<Object|null>} Public client info
 */
export async function getClientPublicInfo(clientId) {
  const client = await OAuthClient.findActiveClient(clientId);
  
  if (!client) {
    return null;
  }
  
  return {
    client_id: client.client_id,
    name: client.name,
    description: client.description,
    logo_uri: client.logo_uri,
    scopes: client.scopes,
    is_first_party: client.is_first_party
  };
}

/**
 * Get client for owner (includes sensitive info)
 * 
 * @param {string} clientId - Client ID
 * @param {string} ownerId - Owner user ID
 * @returns {Promise<Object|null>} Client info (without secret)
 */
export async function getClientForOwner(clientId, ownerId) {
  const client = await OAuthClient.findOne({
    client_id: clientId,
    'owner.user_id': ownerId
  });
  
  if (!client) {
    return null;
  }
  
  // Return without secret
  const clientObj = client.toObject();
  delete clientObj.client_secret;
  
  return clientObj;
}

/**
 * List pending clients (admin view)
 * 
 * @returns {Promise<Array>} Pending clients
 */
export async function listPendingClients() {
  return OAuthClient.findPendingClients();
}

/**
 * List clients by owner
 * 
 * @param {string} ownerId - Owner user ID
 * @returns {Promise<Array>} Owner's clients
 */
export async function listOwnerClients(ownerId) {
  return OAuthClient.find({ 'owner.user_id': ownerId })
    .select('-client_secret')
    .sort({ created_at: -1 });
}

/**
 * Update client metadata
 * 
 * @param {string} clientId - Client ID
 * @param {string} ownerId - Owner user ID (for authorization)
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} { success, client, error }
 */
export async function updateClient(clientId, ownerId, updates) {
  const client = await OAuthClient.findOne({
    client_id: clientId,
    'owner.user_id': ownerId
  });
  
  if (!client) {
    return { success: false, error: 'Client not found or not authorized' };
  }
  
  // Only allow updating certain fields
  const allowedUpdates = [
    'name',
    'description',
    'redirect_uris',
    'logo_uri',
    'metadata'
  ];
  
  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      client[key] = updates[key];
    }
  }
  
  await client.save();
  
  return { success: true, client };
}

/**
 * Delete a client
 * 
 * @param {string} clientId - Client ID
 * @param {string} requesterId - Requester user ID
 * @param {boolean} isAdmin - Whether requester is admin
 * @returns {Promise<Object>} { success, error }
 */
export async function deleteClient(clientId, requesterId, isAdmin = false) {
  const query = { client_id: clientId };
  
  // Non-admins can only delete their own clients
  if (!isAdmin) {
    query['owner.user_id'] = requesterId;
  }
  
  const client = await OAuthClient.findOne(query);
  
  if (!client) {
    return { success: false, error: 'Client not found or not authorized' };
  }
  
  await client.deleteOne();
  
  return { success: true };
}

// ============================================================================
// Admin Statistics
// ============================================================================

/**
 * Get OAuth statistics for admin dashboard
 * 
 * @returns {Promise<Object>} OAuth statistics
 */
export async function getOAuthStats() {
  const [
    totalClients,
    pendingClients,
    activeClients,
    suspendedClients
  ] = await Promise.all([
    OAuthClient.countDocuments(),
    OAuthClient.countDocuments({ status: 'pending' }),
    OAuthClient.countDocuments({ status: 'active' }),
    OAuthClient.countDocuments({ status: 'suspended' })
  ]);
  
  return {
    totalClients,
    pendingClients,
    activeClients,
    suspendedClients,
    rejectedClients: totalClients - pendingClients - activeClients - suspendedClients,
    lastUpdated: new Date().toISOString()
  };
}

// ============================================================================
// Export
// ============================================================================

export default {
  registerClient,
  validateClient,
  validateRedirectUri,
  validateScopes,
  approveClient,
  rejectClient,
  suspendClient,
  reactivateClient,
  rotateClientSecret,
  getClientPublicInfo,
  getClientForOwner,
  listPendingClients,
  listOwnerClients,
  updateClient,
  deleteClient,
  getOAuthStats
};
