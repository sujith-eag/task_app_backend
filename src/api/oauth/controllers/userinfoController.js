/**
 * OAuth UserInfo Controller
 * 
 * Implements the OIDC UserInfo Endpoint.
 * Returns claims about the authenticated user.
 * 
 * @module controllers/oauth/userinfoController
 * @see https://openid.net/specs/openid-connect-core-1_0.html#UserInfo
 */

import User from '../../../models/userModel.js';
import { verifyAccessToken } from '../services/tokenService.js';

// ============================================================================
// UserInfo Endpoint
// ============================================================================

/**
 * UserInfo Endpoint
 * GET /oauth/userinfo
 * POST /oauth/userinfo
 * 
 * Returns claims about the authenticated user based on granted scopes.
 * Requires Bearer token authentication.
 */
export async function userinfo(req, res) {
  // Extract Bearer token
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Bearer token required'
    });
  }
  
  const accessToken = authHeader.slice(7);
  
  // Verify access token
  let tokenPayload;
  try {
    tokenPayload = verifyAccessToken(accessToken);
  } catch (error) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: error.message
    });
  }
  
  // Get user
  const user = await User.findById(tokenPayload.sub);
  
  if (!user) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'User not found'
    });
  }
  
  // Check if user account is active
  if (user.accountStatus && user.accountStatus !== 'active') {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'User account is not active'
    });
  }
  
  // Build response based on granted scopes
  const scopes = tokenPayload.scope.split(' ');
  const response = {
    sub: user._id.toString()
  };
  
  // Add profile claims if 'profile' scope granted
  if (scopes.includes('profile')) {
    response.name = user.name;
    response.preferred_username = user.username || user.email?.split('@')[0];
    
    if (user.profilePic) {
      response.picture = user.profilePic;
    }
    
    // Add additional profile fields if available
    if (user.updatedAt) {
      response.updated_at = Math.floor(user.updatedAt.getTime() / 1000);
    }
  }
  
  // Add email claims if 'email' scope granted
  if (scopes.includes('email')) {
    response.email = user.email;
    response.email_verified = user.emailVerified || false;
  }
  
  // Set cache control headers
  res.set('Cache-Control', 'no-store');
  
  return res.json(response);
}

// ============================================================================
// Export
// ============================================================================

export default {
  userinfo
};
