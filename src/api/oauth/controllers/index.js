/**
 * OAuth Controllers Index
 * 
 * Central export for all OAuth controllers.
 * 
 * @module controllers/oauth
 */

export { default as discoveryController } from './discoveryController.js';
export { default as authorizationController } from './authorizationController.js';
export { default as tokenController } from './tokenController.js';
export { default as userinfoController } from './userinfoController.js';
export { default as clientController } from './clientController.js';

// Re-export commonly used handlers
export { getOpenIDConfiguration, getJWKS } from './discoveryController.js';
export { authorize, approveConsent, denyConsent, validateRequest as validateAuthorizeRequest } from './authorizationController.js';
export { token, revoke, introspect } from './tokenController.js';
export { userinfo } from './userinfoController.js';
export {
  register as registerClient,
  listOwn as listOwnClients,
  getOne as getClientById,
  update as updateClientById,
  remove as deleteClientById,
  rotateSecret,
  listPending as listPendingClients,
  approve as approveClientById,
  reject as rejectClientById,
  suspend as suspendClientById,
  reactivate as reactivateClientById,
  getPublicInfo as getClientPublicInfo,
  getStats as getOAuthStats,
  listAuthorizations as listUserAuthorizations,
  revokeAuthorization as revokeUserAuthorization
} from './clientController.js';
