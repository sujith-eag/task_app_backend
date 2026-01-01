/**
 * OAuth Middleware
 * 
 * Middleware for OAuth/OIDC endpoints.
 * 
 * @module middleware/oauth
 */

import { verifyAccessToken } from '../services/tokenService.js';
import User from '../../../models/userModel.js';

// ============================================================================
// Bearer Token Authentication
// ============================================================================

/**
 * Authenticate request using Bearer token
 * Extracts and validates OAuth access token from Authorization header
 * 
 * Use this middleware for resource servers / API endpoints that accept
 * OAuth access tokens instead of session cookies.
 * 
 * Sets:
 * - req.oauth = { token, payload }
 * - req.user = User document
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.requiredScope - Scope that must be present
 * @param {boolean} options.optional - If true, don't reject if no token
 */
export function requireBearerToken(options = {}) {
  return async function bearerTokenMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    
    // Check for Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (options.optional) {
        return next();
      }
      
      res.set('WWW-Authenticate', 'Bearer');
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Bearer token required'
      });
    }
    
    const token = authHeader.slice(7);
    
    try {
      // Verify the access token
      const payload = verifyAccessToken(token, {
        requiredScope: options.requiredScope
      });
      
      // Get user
      const user = await User.findById(payload.sub);
      
      if (!user) {
        res.set('WWW-Authenticate', 'Bearer');
        return res.status(401).json({
          error: 'invalid_token',
          error_description: 'User not found'
        });
      }
      
      // Check if user is active
      if (!user.isActive) {
        res.set('WWW-Authenticate', 'Bearer');
        return res.status(401).json({
          error: 'invalid_token',
          error_description: 'User account is inactive'
        });
      }
      
      // Attach OAuth info to request
      req.oauth = {
        token,
        payload,
        clientId: payload.client_id,
        scopes: payload.scope.split(' ')
      };
      
      // Attach user to request (standard pattern)
      req.user = user;
      
      next();
    } catch (error) {
      res.set('WWW-Authenticate', 'Bearer');
      return res.status(401).json({
        error: 'invalid_token',
        error_description: error.message
      });
    }
  };
}

/**
 * Require specific scope(s) for the request
 * Must be used after requireBearerToken
 * 
 * @param {string|string[]} scopes - Required scope(s)
 */
export function requireScope(scopes) {
  const requiredScopes = Array.isArray(scopes) ? scopes : [scopes];
  
  return function scopeMiddleware(req, res, next) {
    if (!req.oauth) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'No OAuth context'
      });
    }
    
    const missingScopes = requiredScopes.filter(
      scope => !req.oauth.scopes.includes(scope)
    );
    
    if (missingScopes.length > 0) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: `Missing required scopes: ${missingScopes.join(', ')}`,
        scope: requiredScopes.join(' ')
      });
    }
    
    next();
  };
}

// ============================================================================
// Client Authentication
// ============================================================================

/**
 * Authenticate OAuth client from request
 * Supports client_secret_basic and client_secret_post
 * 
 * Sets:
 * - req.oauthClient = Client document
 */
export async function authenticateClient(req, res, next) {
  const { validateClient } = await import('../services/clientService.js');
  
  let clientId, clientSecret;
  
  // Try Authorization header (client_secret_basic)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
    [clientId, clientSecret] = credentials.split(':');
    clientId = decodeURIComponent(clientId);
    clientSecret = decodeURIComponent(clientSecret);
  } else {
    // Try request body (client_secret_post)
    clientId = req.body.client_id;
    clientSecret = req.body.client_secret;
  }
  
  if (!clientId) {
    return res.status(401).json({
      error: 'invalid_client',
      error_description: 'Client authentication required'
    });
  }
  
  const validation = await validateClient(clientId, clientSecret);
  
  if (!validation.isValid) {
    return res.status(401).json({
      error: 'invalid_client',
      error_description: validation.error
    });
  }
  
  req.oauthClient = validation.client;
  next();
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Simple in-memory rate limiter for OAuth endpoints
 * In production, use Redis for distributed rate limiting
 */
const rateLimitStore = new Map();

/**
 * Rate limit middleware for OAuth endpoints
 * 
 * @param {Object} options - Configuration
 * @param {number} options.windowMs - Time window in ms
 * @param {number} options.max - Max requests per window
 * @param {string} options.keyGenerator - Key generator function or 'ip' | 'client'
 */
export function rateLimit(options = {}) {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 60,
    keyGenerator = 'ip'
  } = options;
  
  return function rateLimitMiddleware(req, res, next) {
    let key;
    
    if (typeof keyGenerator === 'function') {
      key = keyGenerator(req);
    } else if (keyGenerator === 'client') {
      key = `client:${req.oauthClient?.client_id || req.body.client_id || 'unknown'}`;
    } else {
      key = `ip:${req.ip}`;
    }
    
    const now = Date.now();
    const record = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };
    
    // Reset if window expired
    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + windowMs;
    }
    
    record.count++;
    rateLimitStore.set(key, record);
    
    // Set rate limit headers
    res.set('X-RateLimit-Limit', max);
    res.set('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.set('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));
    
    if (record.count > max) {
      return res.status(429).json({
        error: 'too_many_requests',
        error_description: 'Rate limit exceeded',
        retry_after: Math.ceil((record.resetAt - now) / 1000)
      });
    }
    
    next();
  };
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============================================================================
// CORS for OAuth
// ============================================================================

/**
 * CORS configuration for OAuth endpoints
 * Token endpoint may need special CORS handling
 */
export function oauthCors(req, res, next) {
  // Allow any origin for discovery endpoints
  if (req.path.includes('.well-known')) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Max-Age', '86400');
  }
  
  // For token endpoint, be more restrictive or use configured origins
  if (req.path.includes('/oauth/token')) {
    // In production, configure allowed origins
    const allowedOrigins = process.env.OAUTH_ALLOWED_ORIGINS?.split(',') || [];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  
  next();
}

// ============================================================================
// Export
// ============================================================================

export default {
  requireBearerToken,
  requireScope,
  authenticateClient,
  rateLimit,
  oauthCors
};
