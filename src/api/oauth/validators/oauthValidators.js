/**
 * OAuth Request Validators
 * 
 * Input validation for OAuth endpoints using express-validator.
 * Ensures all requests meet OAuth 2.1/OIDC specifications.
 * 
 * @module validators/oauth
 */

import { body, query, validationResult } from 'express-validator';

// ============================================================================
// Validation Middleware
// ============================================================================

/**
 * Middleware to handle validation errors
 */
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    const firstError = errors.array()[0];
    return res.status(400).json({
      error: 'invalid_request',
      error_description: `${firstError.param}: ${firstError.msg}`
    });
  }
  
  next();
}

// ============================================================================
// Authorization Request Validators
// ============================================================================

/**
 * Validate authorization request query parameters
 */
export const validateAuthorizeRequest = [
  query('response_type')
    .exists().withMessage('response_type is required')
    .equals('code').withMessage('Only response_type=code is supported'),
  
  query('client_id')
    .exists().withMessage('client_id is required')
    .isString().withMessage('client_id must be a string')
    .isLength({ min: 1, max: 100 }).withMessage('Invalid client_id length'),
  
  query('redirect_uri')
    .exists().withMessage('redirect_uri is required')
    .isURL({
      require_protocol: true,
      protocols: ['http', 'https'],
      require_valid_protocol: true
    }).withMessage('redirect_uri must be a valid URL'),
  
  query('scope')
    .exists().withMessage('scope is required')
    .isString().withMessage('scope must be a string')
    .custom(value => value.includes('openid')).withMessage('scope must include openid'),
  
  query('code_challenge')
    .exists().withMessage('code_challenge is required (PKCE mandatory)')
    .isString().withMessage('code_challenge must be a string')
    .isLength({ min: 43, max: 128 }).withMessage('Invalid code_challenge length'),
  
  query('code_challenge_method')
    .optional()
    .equals('S256').withMessage('Only code_challenge_method=S256 is supported'),
  
  query('state')
    .optional()
    .isString().withMessage('state must be a string')
    .isLength({ max: 500 }).withMessage('state too long'),
  
  query('nonce')
    .optional()
    .isString().withMessage('nonce must be a string')
    .isLength({ max: 200 }).withMessage('nonce too long'),
  
  query('prompt')
    .optional()
    .isIn(['none', 'login', 'consent']).withMessage('Invalid prompt value'),
  
  handleValidationErrors
];

// ============================================================================
// Token Request Validators
// ============================================================================

/**
 * Validate token request body (authorization_code grant)
 */
export const validateTokenRequest = [
  body('grant_type')
    .exists().withMessage('grant_type is required')
    .isIn(['authorization_code', 'refresh_token']).withMessage('Unsupported grant_type'),
  
  handleValidationErrors
];

/**
 * Validate authorization_code grant parameters
 */
export const validateAuthCodeGrant = [
  body('grant_type')
    .equals('authorization_code'),
  
  body('code')
    .exists().withMessage('code is required')
    .isString().withMessage('code must be a string')
    .isLength({ min: 32, max: 128 }).withMessage('Invalid code format'),
  
  body('redirect_uri')
    .exists().withMessage('redirect_uri is required')
    .isURL({
      require_protocol: true,
      protocols: ['http', 'https'],
      require_valid_protocol: true
    }).withMessage('redirect_uri must be a valid URL'),
  
  body('code_verifier')
    .exists().withMessage('code_verifier is required (PKCE mandatory)')
    .isString().withMessage('code_verifier must be a string')
    .isLength({ min: 43, max: 128 }).withMessage('Invalid code_verifier length'),
  
  handleValidationErrors
];

/**
 * Validate refresh_token grant parameters
 */
export const validateRefreshTokenGrant = [
  body('grant_type')
    .equals('refresh_token'),
  
  body('refresh_token')
    .exists().withMessage('refresh_token is required')
    .isString().withMessage('refresh_token must be a string')
    .isLength({ min: 32, max: 128 }).withMessage('Invalid refresh_token format'),
  
  body('scope')
    .optional()
    .isString().withMessage('scope must be a string'),
  
  handleValidationErrors
];

// ============================================================================
// Token Revocation Validators
// ============================================================================

/**
 * Validate token revocation request
 */
export const validateRevokeRequest = [
  body('token')
    .exists().withMessage('token is required')
    .isString().withMessage('token must be a string'),
  
  body('token_type_hint')
    .optional()
    .isIn(['access_token', 'refresh_token']).withMessage('Invalid token_type_hint'),
  
  handleValidationErrors
];

// ============================================================================
// Token Introspection Validators
// ============================================================================

/**
 * Validate token introspection request
 */
export const validateIntrospectRequest = [
  body('token')
    .exists().withMessage('token is required')
    .isString().withMessage('token must be a string'),
  
  body('token_type_hint')
    .optional()
    .isIn(['access_token', 'refresh_token']).withMessage('Invalid token_type_hint'),
  
  handleValidationErrors
];

// ============================================================================
// Client Registration Validators
// ============================================================================

/**
 * Validate client registration request
 */
export const validateClientRegistration = [
  body('name')
    .exists().withMessage('name is required')
    .isString().withMessage('name must be a string')
    .isLength({ min: 3, max: 100 }).withMessage('name must be 3-100 characters'),
  
  body('description')
    .exists().withMessage('description is required')
    .isString().withMessage('description must be a string')
    .isLength({ min: 10, max: 500 }).withMessage('description must be 10-500 characters'),
  
  body('redirect_uris')
    .exists().withMessage('redirect_uris is required')
    .isArray({ min: 1, max: 10 }).withMessage('redirect_uris must be an array of 1-10 URIs'),
  
  body('redirect_uris.*')
    .isURL({
      require_protocol: true,
      protocols: ['http', 'https'],
      require_valid_protocol: true
    }).withMessage('Each redirect_uri must be a valid URL'),
  
  body('scopes')
    .optional()
    .isArray().withMessage('scopes must be an array')
    .custom(value => value.every(s => typeof s === 'string')).withMessage('Each scope must be a string'),
  
  body('application_type')
    .optional()
    .isIn(['web', 'native']).withMessage('application_type must be web or native'),
  
  body('logo_uri')
    .optional()
    .isURL().withMessage('logo_uri must be a valid URL'),
  
  handleValidationErrors
];

// ============================================================================
// Consent Validators
// ============================================================================

/**
 * Validate consent approval
 */
export const validateConsentApproval = [
  body('approved')
    .exists().withMessage('approved is required')
    .isBoolean().withMessage('approved must be a boolean'),
  
  body('scopes')
    .optional()
    .isArray().withMessage('scopes must be an array'),
  
  handleValidationErrors
];

// ============================================================================
// Export
// ============================================================================

export default {
  handleValidationErrors,
  validateAuthorizeRequest,
  validateTokenRequest,
  validateAuthCodeGrant,
  validateRefreshTokenGrant,
  validateRevokeRequest,
  validateIntrospectRequest,
  validateClientRegistration,
  validateConsentApproval
};
