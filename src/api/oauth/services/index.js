/**
 * OAuth Services Index
 * 
 * Central export for all OAuth-related services.
 * 
 * @module services/oauth
 */

export { default as tokenService } from './tokenService.js';
export { default as clientService } from './clientService.js';
export { default as consentService } from './consentService.js';

// Re-export commonly used functions for convenience
export {
  generateAccessToken,
  verifyAccessToken,
  generateIdToken,
  generateRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  buildTokenResponse,
  buildRefreshTokenResponse
} from './tokenService.js';

export {
  registerClient,
  validateClient,
  validateRedirectUri,
  validateScopes,
  approveClient,
  rejectClient,
  suspendClient,
  reactivateClient
} from './clientService.js';

export {
  checkConsentNeeded,
  getConsentUIData,
  grantConsent,
  revokeConsent,
  listUserConsents
} from './consentService.js';
