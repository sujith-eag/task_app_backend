/**
 * OAuth/OIDC Configuration
 * 
 * Centralized configuration for the OAuth Identity Provider.
 * Settings can be overridden via environment variables.
 * 
 * @module config/oauth
 */

// ============================================================================
// Environment Variables
// ============================================================================

const env = process.env;

// ============================================================================
// OAuth Configuration
// ============================================================================

const oauthConfig = {
  // ─────────────────────────────────────────────────────────────────────────
  // Issuer Configuration
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * OAuth/OIDC Issuer URL
   * This is the base URL of the identity provider.
   * Used in token claims (iss) and discovery document.
   */
  issuer: env.OAUTH_ISSUER || 'https://eagle-campus.com',
  
  // ─────────────────────────────────────────────────────────────────────────
  // Token Lifetimes
  // ─────────────────────────────────────────────────────────────────────────
  
  tokens: {
    /**
     * Access token lifetime in seconds
     * Default: 15 minutes (900 seconds)
     */
    accessTokenLifetime: parseInt(env.OAUTH_ACCESS_TOKEN_LIFETIME, 10) || 15 * 60,
    
    /**
     * ID token lifetime in seconds
     * Default: 15 minutes (900 seconds)
     */
    idTokenLifetime: parseInt(env.OAUTH_ID_TOKEN_LIFETIME, 10) || 15 * 60,
    
    /**
     * Refresh token lifetime in seconds
     * Default: 30 days
     */
    refreshTokenLifetime: parseInt(env.OAUTH_REFRESH_TOKEN_LIFETIME, 10) || 30 * 24 * 60 * 60,
    
    /**
     * Authorization code lifetime in seconds
     * Default: 10 minutes
     */
    authCodeLifetime: parseInt(env.OAUTH_AUTH_CODE_LIFETIME, 10) || 10 * 60
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Supported Features
  // ─────────────────────────────────────────────────────────────────────────
  
  features: {
    /**
     * Supported scopes
     */
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    
    /**
     * Supported response types
     * OAuth 2.1 only allows 'code'
     */
    responseTypes: ['code'],
    
    /**
     * Supported grant types
     */
    grantTypes: ['authorization_code', 'refresh_token'],
    
    /**
     * Supported PKCE methods
     * OAuth 2.1 requires S256
     */
    pkceMethods: ['S256'],
    
    /**
     * Supported token endpoint auth methods
     */
    tokenEndpointAuthMethods: ['client_secret_basic', 'client_secret_post'],
    
    /**
     * Signing algorithm for JWTs
     */
    signingAlgorithm: 'RS256'
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Security Settings
  // ─────────────────────────────────────────────────────────────────────────
  
  security: {
    /**
     * Require PKCE for all authorization requests
     * OAuth 2.1 mandates this
     */
    requirePKCE: true,
    
    /**
     * Require consent for third-party apps
     * First-party apps skip consent
     */
    requireConsent: true,
    
    /**
     * Enable refresh token rotation
     * New token issued on each use
     */
    rotateRefreshTokens: true,
    
    /**
     * Revoke entire token family on reuse detection
     */
    revokeOnReuse: true,
    
    /**
     * Maximum active refresh tokens per user-client pair
     */
    maxActiveTokensPerClient: 5,
    
    /**
     * Allowed redirect URI schemes
     * 'http' only allowed for localhost in development
     */
    allowedRedirectSchemes: env.NODE_ENV === 'production' 
      ? ['https']
      : ['https', 'http'],
    
    /**
     * Allowed localhost redirect in development
     */
    allowLocalhostRedirect: env.NODE_ENV !== 'production'
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Rate Limiting
  // ─────────────────────────────────────────────────────────────────────────
  
  rateLimits: {
    /**
     * Token endpoint rate limit (per client)
     */
    tokenEndpoint: {
      windowMs: 60 * 1000, // 1 minute
      max: 60
    },
    
    /**
     * Authorization endpoint rate limit (per IP)
     */
    authorizeEndpoint: {
      windowMs: 60 * 1000,
      max: 30
    },
    
    /**
     * Client registration rate limit (per user)
     */
    clientRegistration: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10
    }
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // CORS Settings
  // ─────────────────────────────────────────────────────────────────────────
  
  cors: {
    /**
     * Allowed origins for OAuth endpoints
     * Set to ['*'] to allow all (not recommended for production)
     */
    allowedOrigins: env.OAUTH_ALLOWED_ORIGINS?.split(',') || ['*'],
    
    /**
     * Allow credentials in CORS requests
     */
    allowCredentials: true
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Key Configuration
  // ─────────────────────────────────────────────────────────────────────────
  
  keys: {
    /**
     * Path to RSA private key file
     */
    privateKeyPath: env.OAUTH_PRIVATE_KEY_PATH || './keys/private.pem',
    
    /**
     * Path to RSA public key file
     */
    publicKeyPath: env.OAUTH_PUBLIC_KEY_PATH || './keys/public.pem',
    
    /**
     * RSA private key (inline, for container deployments)
     * Takes precedence over file path
     */
    privateKey: env.OAUTH_PRIVATE_KEY,
    
    /**
     * RSA public key (inline, for container deployments)
     */
    publicKey: env.OAUTH_PUBLIC_KEY
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Client Defaults
  // ─────────────────────────────────────────────────────────────────────────
  
  clientDefaults: {
    /**
     * Default scopes for new clients
     */
    scopes: ['openid', 'profile', 'email'],
    
    /**
     * Default token lifetime for clients (in seconds)
     */
    accessTokenLifetime: 15 * 60,
    
    /**
     * Default refresh token lifetime for clients (in seconds)
     */
    refreshTokenLifetime: 30 * 24 * 60 * 60,
    
    /**
     * Auto-approve first-party clients
     */
    autoApproveFirstParty: true
  }
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate OAuth configuration on startup
 * @throws {Error} If configuration is invalid
 */
export function validateOAuthConfig() {
  const errors = [];
  
  if (!oauthConfig.issuer) {
    errors.push('OAUTH_ISSUER is required');
  }
  
  if (oauthConfig.tokens.accessTokenLifetime < 60) {
    errors.push('Access token lifetime must be at least 60 seconds');
  }
  
  if (oauthConfig.tokens.refreshTokenLifetime < oauthConfig.tokens.accessTokenLifetime) {
    errors.push('Refresh token lifetime must be greater than access token lifetime');
  }
  
  if (errors.length > 0) {
    throw new Error(`OAuth configuration errors:\n${errors.join('\n')}`);
  }
  
  return true;
}

// ============================================================================
// Export
// ============================================================================

export default oauthConfig;
export { oauthConfig };
