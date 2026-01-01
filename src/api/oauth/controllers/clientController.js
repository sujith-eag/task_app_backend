/**
 * OAuth Client Controller
 * 
 * Handles OAuth client registration and management.
 * 
 * User Endpoints:
 * - Register new client (requires auth)
 * - List own clients
 * - Update own client
 * - Delete own client
 * - Rotate client secret
 * 
 * Admin Endpoints:
 * - List pending clients
 * - Approve client
 * - Reject client
 * - Suspend client
 * - List all clients
 * 
 * @module controllers/oauth/clientController
 */

import {
  registerClient,
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
} from '../services/clientService.js';
import { revokeAllClientConsents, listUserConsents, revokeConsent } from '../services/consentService.js';
import RefreshToken from '../../../models/refreshTokenModel.js';

// ============================================================================
// User Client Management
// ============================================================================

/**
 * Register a new OAuth client
 * POST /oauth/clients
 * 
 * Requires authentication. Client starts in PENDING status.
 */
export async function register(req, res) {
  const {
    name,
    description,
    redirect_uris,
    scopes,
    application_type,
    logo_uri,
    metadata
  } = req.body;
  
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'Authentication required'
    });
  }
  
  try {
    const result = await registerClient({
      name,
      description,
      redirectUris: redirect_uris,
      scopes,
      applicationType: application_type,
      isFirstParty: false, // User registrations are never first-party
      ownerId: user._id,
      ownerEmail: user.email,
      metadata: {
        ...metadata,
        logo_uri
      }
    });
    
    // Return client info with secret (only time secret is shown)
    return res.status(201).json({
      message: 'Client registered successfully. Awaiting admin approval.',
      client_id: result.clientId,
      client_secret: result.clientSecret,
      status: result.client.status,
      name: result.client.client_name,
      redirect_uris: result.client.redirect_uris,
      scopes: result.client.scopes,
      created_at: result.client.created_at,
      
      // Security reminder
      _warning: 'Store the client_secret securely. It will not be shown again.'
    });
    
  } catch (error) {
    console.error('Client registration error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'conflict',
        error_description: 'A client with this name already exists'
      });
    }
    
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to register client'
    });
  }
}

/**
 * List user's own clients
 * GET /oauth/clients
 */
export async function listOwn(req, res) {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'Authentication required'
    });
  }
  
  try {
    const clients = await listOwnerClients(user._id);
    
    return res.json({
      clients: clients.map(client => ({
        client_id: client.client_id,
        name: client.name,
        description: client.description,
        status: client.status,
        redirect_uris: client.redirect_uris,
        scopes: client.scopes,
        created_at: client.created_at,
        approved_at: client.approved_at
      }))
    });
    
  } catch (error) {
    console.error('List clients error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to list clients'
    });
  }
}

/**
 * Get client details
 * GET /oauth/clients/:clientId
 */
export async function getOne(req, res) {
  const { clientId } = req.params;
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'Authentication required'
    });
  }
  
  try {
    const client = await getClientForOwner(clientId, user._id);
    
    if (!client) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Client not found'
      });
    }
    
    return res.json({ client });
    
  } catch (error) {
    console.error('Get client error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to get client'
    });
  }
}

/**
 * Update client
 * PATCH /oauth/clients/:clientId
 */
export async function update(req, res) {
  const { clientId } = req.params;
  const user = req.user;
  const updates = req.body;
  
  if (!user) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'Authentication required'
    });
  }
  
  try {
    const result = await updateClient(clientId, user._id, updates);
    
    if (!result.success) {
      return res.status(404).json({
        error: 'not_found',
        error_description: result.error
      });
    }
    
    return res.json({
      message: 'Client updated successfully',
      client: {
        client_id: result.client.client_id,
        name: result.client.name,
        description: result.client.description,
        redirect_uris: result.client.redirect_uris
      }
    });
    
  } catch (error) {
    console.error('Update client error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to update client'
    });
  }
}

/**
 * Rotate client secret
 * POST /oauth/clients/:clientId/rotate-secret
 */
export async function rotateSecret(req, res) {
  const { clientId } = req.params;
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'Authentication required'
    });
  }
  
  try {
    const result = await rotateClientSecret(clientId, user._id.toString());
    
    if (!result.success) {
      return res.status(result.error.includes('not found') ? 404 : 403).json({
        error: 'error',
        error_description: result.error
      });
    }
    
    return res.json({
      message: 'Client secret rotated successfully',
      client_secret: result.newSecret,
      _warning: 'Store the new client_secret securely. It will not be shown again.'
    });
    
  } catch (error) {
    console.error('Rotate secret error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to rotate client secret'
    });
  }
}

/**
 * Delete client
 * DELETE /oauth/clients/:clientId
 */
export async function remove(req, res) {
  const { clientId } = req.params;
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'Authentication required'
    });
  }
  
  try {
    // Check if user is admin
    const isAdmin = user.roles?.includes('admin');
    
    const result = await deleteClient(clientId, user._id.toString(), isAdmin);
    
    if (!result.success) {
      return res.status(404).json({
        error: 'not_found',
        error_description: result.error
      });
    }
    
    // Revoke all tokens and consents for this client
    await Promise.all([
      RefreshToken.revokeAllClientTokens(clientId, 'client_deleted'),
      revokeAllClientConsents(clientId)
    ]);
    
    return res.json({
      message: 'Client deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete client error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to delete client'
    });
  }
}

// ============================================================================
// Admin Client Management
// ============================================================================

/**
 * List pending clients (admin)
 * GET /oauth/admin/clients/pending
 */
export async function listPending(req, res) {
  try {
    const clients = await listPendingClients();
    
    return res.json({
      clients: clients.map(client => ({
        client_id: client.client_id,
        name: client.name,
        description: client.description,
        owner: client.owner,
        redirect_uris: client.redirect_uris,
        scopes: client.scopes,
        created_at: client.created_at
      }))
    });
    
  } catch (error) {
    console.error('List pending clients error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to list pending clients'
    });
  }
}

/**
 * Approve client (admin)
 * POST /oauth/admin/clients/:clientId/approve
 */
export async function approve(req, res) {
  const { clientId } = req.params;
  const { notes } = req.body;
  const admin = req.user;
  
  try {
    const result = await approveClient(clientId, admin._id, notes);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'bad_request',
        error_description: result.error
      });
    }
    
    return res.json({
      message: 'Client approved successfully',
      client_id: result.client.client_id,
      status: result.client.status
    });
    
  } catch (error) {
    console.error('Approve client error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to approve client'
    });
  }
}

/**
 * Reject client (admin)
 * POST /oauth/admin/clients/:clientId/reject
 */
export async function reject(req, res) {
  const { clientId } = req.params;
  const { reason } = req.body;
  const admin = req.user;
  
  try {
    const result = await rejectClient(clientId, admin._id, reason);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'bad_request',
        error_description: result.error
      });
    }
    
    return res.json({
      message: 'Client rejected',
      client_id: result.client.client_id,
      status: result.client.status
    });
    
  } catch (error) {
    console.error('Reject client error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to reject client'
    });
  }
}

/**
 * Suspend client (admin)
 * POST /oauth/admin/clients/:clientId/suspend
 */
export async function suspend(req, res) {
  const { clientId } = req.params;
  const { reason } = req.body;
  const admin = req.user;
  
  try {
    const result = await suspendClient(clientId, admin._id, reason);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'bad_request',
        error_description: result.error
      });
    }
    
    // Revoke all tokens for suspended client
    await RefreshToken.revokeAllClientTokens(clientId, 'admin_revoked');
    
    return res.json({
      message: 'Client suspended',
      client_id: result.client.client_id,
      status: result.client.status
    });
    
  } catch (error) {
    console.error('Suspend client error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to suspend client'
    });
  }
}

/**
 * Reactivate client (admin)
 * POST /oauth/admin/clients/:clientId/reactivate
 */
export async function reactivate(req, res) {
  const { clientId } = req.params;
  const admin = req.user;
  
  try {
    const result = await reactivateClient(clientId, admin._id);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'bad_request',
        error_description: result.error
      });
    }
    
    return res.json({
      message: 'Client reactivated',
      client_id: result.client.client_id,
      status: result.client.status
    });
    
  } catch (error) {
    console.error('Reactivate client error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to reactivate client'
    });
  }
}

/**
 * Get client public info (public endpoint)
 * GET /oauth/clients/:clientId/info
 */
export async function getPublicInfo(req, res) {
  const { clientId } = req.params;
  
  try {
    const info = await getClientPublicInfo(clientId);
    
    if (!info) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Client not found'
      });
    }
    
    return res.json(info);
    
  } catch (error) {
    console.error('Get client info error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to get client info'
    });
  }
}

// ============================================================================
// Admin Statistics
// ============================================================================

/**
 * Get OAuth statistics (admin only)
 * GET /oauth/admin/clients/stats
 */
export async function getStats(req, res) {
  try {
    const stats = await getOAuthStats();
    return res.json(stats);
  } catch (error) {
    console.error('Get OAuth stats error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to get OAuth statistics'
    });
  }
}

// ============================================================================
// User Authorization Management
// ============================================================================

/**
 * List user's authorized applications
 * GET /oauth/user/authorizations
 */
export async function listAuthorizations(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const authorizations = await listUserConsents(userId);
    
    return res.json({
      authorizations,
      total: authorizations.length
    });
  } catch (error) {
    console.error('List authorizations error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to list authorizations'
    });
  }
}

/**
 * Revoke user authorization for a specific client
 * DELETE /oauth/user/authorizations/:clientId
 */
export async function revokeAuthorization(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { clientId } = req.params;
    
    // Get request metadata
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Revoke the consent
    const result = await revokeConsent(userId, clientId, ipAddress, userAgent);
    
    if (!result.success) {
      return res.status(404).json({
        error: 'not_found',
        error_description: result.error || 'Authorization not found'
      });
    }
    
    // Also revoke any active refresh tokens
    await RefreshToken.deleteMany({ 
      userId, 
      clientId 
    });
    
    return res.json({
      success: true,
      message: 'Authorization revoked successfully'
    });
  } catch (error) {
    console.error('Revoke authorization error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to revoke authorization'
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  register,
  listOwn,
  getOne,
  update,
  rotateSecret,
  remove,
  listPending,
  approve,
  reject,
  suspend,
  reactivate,
  getPublicInfo,
  getStats,
  listAuthorizations,
  revokeAuthorization
};
