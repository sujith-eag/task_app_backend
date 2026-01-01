/**
 * OAuth Test Setup Utilities
 * 
 * Helper functions for OAuth integration testing.
 * 
 * @module tests/oauth/setup
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import OAuthClient from '../../models/oauthClientModel.js';
import RefreshToken from '../../models/refreshTokenModel.js';
import AuthorizationCode from '../../models/authorizationCodeModel.js';
import UserConsent from '../../models/userConsentModel.js';
import User from '../../models/userModel.js';
import {
  generateClientId,
  generateClientSecret,
  generateCodeChallenge,
  generateCodeVerifier,
  signJWT,
  generateRandomToken,
} from '../../utils/oauthCrypto.js';

// ============================================================================
// Test RSA Keys
// ============================================================================

let testKeyPair = null;

/**
 * Generate test RSA keypair and set environment variables
 */
export const setupTestKeys = () => {
  if (testKeyPair) return testKeyPair;
  
  testKeyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  
  process.env.OAUTH_PRIVATE_KEY = testKeyPair.privateKey;
  process.env.OAUTH_PUBLIC_KEY = testKeyPair.publicKey;
  process.env.OAUTH_ISSUER = 'http://localhost:3000';
  
  return testKeyPair;
};

// ============================================================================
// OAuth Client Factories
// ============================================================================

/**
 * Create a test OAuth client
 * @param {Object} overrides - Field overrides
 * @returns {Promise<Object>} Created client with plain secret
 */
export const createTestOAuthClient = async (overrides = {}) => {
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();
  
  // Hash the secret for storage
  const secretHash = crypto
    .createHash('sha256')
    .update(clientSecret)
    .digest('hex');
  
  const defaultData = {
    client_id: clientId,
    client_secret_hash: secretHash,
    client_name: `Test App ${Date.now()}`,
    description: 'Test application for OAuth testing',
    redirect_uris: ['http://localhost:3001/callback'],
    scopes: ['openid', 'profile', 'email'],
    application_type: 'web',
    status: 'approved',
    contacts: ['test@example.com'],
    requested_by: new mongoose.Types.ObjectId(),
    reviewed_by: new mongoose.Types.ObjectId(),
    approvedAt: new Date(),
  };
  
  const client = await OAuthClient.create({ ...defaultData, ...overrides });
  
  // Return client with plain secret for testing
  return {
    client,
    clientId,
    clientSecret,
  };
};

/**
 * Create a pending OAuth client (not approved)
 */
export const createPendingOAuthClient = async (overrides = {}) => {
  return createTestOAuthClient({
    status: 'pending',
    reviewed_by: undefined,
    reviewed_at: undefined,
    ...overrides,
  });
};

/**
 * Create a native (mobile) OAuth client
 */
export const createNativeOAuthClient = async (overrides = {}) => {
  return createTestOAuthClient({
    application_type: 'native',
    redirect_uris: ['com.testapp://callback', 'http://localhost:8080/callback'],
    ...overrides,
  });
};

// ============================================================================
// PKCE Helpers
// ============================================================================

/**
 * Generate PKCE pair for testing
 * @returns {Object} { codeVerifier, codeChallenge, codeChallengeMethod }
 */
export const generatePKCEPair = () => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
};

// ============================================================================
// Authorization Code Helpers
// ============================================================================

/**
 * Create an authorization code for testing
 */
export const createTestAuthorizationCode = async (client, user, overrides = {}) => {
  const pkce = generatePKCEPair();
  
  const defaultData = {
    code: generateRandomToken(32),
    client_id: client.client_id,
    user_id: user._id,
    redirect_uri: client.redirect_uris[0],
    scope: 'openid profile',
    code_challenge: pkce.codeChallenge,
    code_challenge_method: 'S256',
    expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  };
  
  const authCode = await AuthorizationCode.create({ ...defaultData, ...overrides });
  
  return {
    authCode,
    codeVerifier: pkce.codeVerifier,
    codeChallenge: pkce.codeChallenge,
  };
};

// ============================================================================
// Refresh Token Helpers
// ============================================================================

/**
 * Create a refresh token for testing
 */
export const createTestRefreshToken = async (client, user, overrides = {}) => {
  const token = generateRandomToken(32);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const familyId = generateRandomToken(16);
  
  const defaultData = {
    token_id: tokenHash,
    family_id: familyId,
    client_id: client.client_id,
    user_id: user._id,
    scope: 'openid profile',
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    is_revoked: false,
    rotation_count: 1,
  };
  
  const refreshToken = await RefreshToken.create({ ...defaultData, ...overrides });
  
  return {
    refreshToken,
    plainToken: token,
    familyId,
  };
};

// ============================================================================
// Consent Helpers
// ============================================================================

/**
 * Create user consent for a client
 */
export const createTestConsent = async (client, user, overrides = {}) => {
  const defaultData = {
    user_id: user._id,
    client_id: client.client_id,
    granted_scopes: ['openid', 'profile'],
  };
  
  const consent = await UserConsent.create({ ...defaultData, ...overrides });
  return consent;
};

// ============================================================================
// Access Token Helpers
// ============================================================================

/**
 * Generate a valid access token for testing
 */
export const generateTestAccessToken = async (client, user, scopes = ['openid', 'profile']) => {
  setupTestKeys(); // Ensure keys are available
  
  const payload = {
    sub: user._id.toString(),
    iss: process.env.OAUTH_ISSUER || 'http://localhost:3000',
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes from now
    client_id: client.client_id,
    scope: scopes.join(' '),
    token_type: 'access_token',
  };
  
  const token = signJWT(payload, '15m');
  return token;
};

/**
 * Generate a valid ID token for testing
 */
export const generateTestIdToken = async (client, user, nonce = null) => {
  setupTestKeys();
  
  const payload = {
    sub: user._id.toString(),
    aud: client.client_id,
    auth_time: Math.floor(Date.now() / 1000),
    name: user.name,
    email: user.email,
  };
  
  if (nonce) {
    payload.nonce = nonce;
  }
  
  const token = signJWT(payload, '15m');
  return token;
};

// ============================================================================
// User Helpers (OAuth-specific)
// ============================================================================

/**
 * Create a user specifically for OAuth testing
 */
export const createTestOAuthUser = async (overrides = {}) => {
  const defaultData = {
    name: 'OAuth Test User',
    email: `oauth-user-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
    password: 'hashedpassword123',
    isVerified: true,
    roles: ['student'],
    studentDetails: {
      usn: `USN-${Date.now()}`,
      batch: 2024,
      section: 'A',
      semester: 3,
      applicationStatus: 'approved',
      isStudentVerified: true,
    },
  };
  
  const user = await User.create({ ...defaultData, ...overrides });
  return user;
};

// ============================================================================
// Cleanup Helpers
// ============================================================================

/**
 * Clean up all OAuth-related test data
 */
export const cleanupOAuthData = async () => {
  await Promise.all([
    OAuthClient.deleteMany({}),
    RefreshToken.deleteMany({}),
    AuthorizationCode.deleteMany({}),
    UserConsent.deleteMany({}),
  ]);
};

// ============================================================================
// URL/Request Builders
// ============================================================================

/**
 * Build authorization URL with parameters
 */
export const buildAuthorizationUrl = (client, pkce, overrides = {}) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: client.redirect_uris[0],
    scope: 'openid profile',
    state: generateRandomToken(16),
    code_challenge: pkce.codeChallenge,
    code_challenge_method: 'S256',
    ...overrides,
  });
  
  return `/api/oauth/authorize?${params.toString()}`;
};

/**
 * Build token request body
 */
export const buildTokenRequestBody = (authResult, client, codeVerifier) => {
  return {
    grant_type: 'authorization_code',
    code: authResult.authCode.code,
    redirect_uri: client.redirect_uris[0],
    client_id: client.clientId,
    client_secret: client.clientSecret,
    code_verifier: codeVerifier,
  };
};

/**
 * Build refresh token request body
 */
export const buildRefreshRequestBody = (refreshToken, client) => {
  return {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: client.clientId,
    client_secret: client.clientSecret,
  };
};

export default {
  setupTestKeys,
  createTestOAuthClient,
  createPendingOAuthClient,
  createNativeOAuthClient,
  generatePKCEPair,
  createTestAuthorizationCode,
  createTestRefreshToken,
  createTestConsent,
  generateTestAccessToken,
  generateTestIdToken,
  createTestOAuthUser,
  cleanupOAuthData,
  buildAuthorizationUrl,
  buildTokenRequestBody,
  buildRefreshRequestBody,
};
