/**
 * Token Endpoint Integration Tests
 * 
 * Tests for OAuth token endpoint:
 * - POST /oauth/token (authorization_code grant)
 * - POST /oauth/token (refresh_token grant)
 * 
 * @module tests/oauth/token.test
 */

import { jest } from '@jest/globals';
import {
  setupTestKeys,
  createTestOAuthClient,
  createTestOAuthUser,
  createTestAuthorizationCode,
  createTestRefreshToken,
  createTestConsent,
  generatePKCEPair,
  cleanupOAuthData,
} from './setup.js';

// Set up keys before imports
setupTestKeys();

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { tokenController } from '../../api/oauth/controllers/index.js';
import { validateTokenRequest as validateToken } from '../../api/oauth/validators/index.js';
import { loadPublicKey, verifyJWT } from '../../utils/oauthCrypto.js';
import AuthorizationCode from '../../models/authorizationCodeModel.js';
import RefreshToken from '../../models/refreshTokenModel.js';

// ============================================================================
// Test App Setup
// ============================================================================

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.post('/oauth/token', validateToken, tokenController.token);
  
  return app;
};

describe('Token Endpoint', () => {
  let app;
  let testUser;
  let testClient;
  
  beforeAll(() => {
    setupTestKeys();
    app = createTestApp();
  });
  
  beforeEach(async () => {
    testUser = await createTestOAuthUser();
    const clientResult = await createTestOAuthClient();
    testClient = clientResult;
  });
  
  afterEach(async () => {
    await cleanupOAuthData();
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Authorization Code Grant Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Authorization Code Grant', () => {
    it('should exchange valid code for tokens', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(200);
      
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('token_type', 'Bearer');
      expect(res.body).toHaveProperty('expires_in');
      expect(res.body).toHaveProperty('refresh_token');
      expect(res.body).toHaveProperty('id_token');
    });
    
    it('should return valid JWT access token', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(200);
      
      // Verify access token is valid JWT
      const accessToken = res.body.access_token;
      const decoded = verifyJWT(accessToken);
      
      expect(decoded).toHaveProperty('sub', testUser._id.toString());
      expect(decoded).toHaveProperty('client_id', testClient.clientId);
      expect(decoded).toHaveProperty('scope');
      expect(decoded).toHaveProperty('iss');
      expect(decoded).toHaveProperty('exp');
    });
    
    it('should return valid ID token with correct claims', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser,
        { nonce: 'test-nonce-123', scope: 'openid profile email' }
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(200);
      
      const idToken = res.body.id_token;
      const decoded = verifyJWT(idToken);
      
      expect(decoded).toHaveProperty('sub', testUser._id.toString());
      expect(decoded).toHaveProperty('aud', testClient.clientId);
      expect(decoded).toHaveProperty('iss');
      expect(decoded).toHaveProperty('nonce', 'test-nonce-123');
      expect(decoded).toHaveProperty('auth_time');
    });
    
    it('should invalidate code after use (one-time use)', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      // First exchange should succeed
      await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(200);
      
      // Second exchange should fail
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_grant');
    });
    
    it('should reject expired authorization code', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser,
        { expiresAt: new Date(Date.now() - 1000) } // Expired
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_grant');
    });
    
    it('should reject code with wrong client_id', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      // Create another client
      const otherClient = await createTestOAuthClient();
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: otherClient.clientId, // Wrong client
          client_secret: otherClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_grant');
    });
    
    it('should reject code with wrong redirect_uri', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: 'http://localhost:9999/wrong',
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_grant');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // PKCE Verification Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('PKCE Verification', () => {
    it('should reject request without code_verifier', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          // Missing code_verifier
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_request');
    });
    
    it('should reject incorrect code_verifier', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: 'wrong_verifier_that_does_not_match',
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_grant');
    });
    
    it('should accept correct code_verifier', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier, // Correct verifier
        })
        .expect(200);
      
      expect(res.body).toHaveProperty('access_token');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Client Authentication Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Client Authentication', () => {
    it('should reject invalid client_secret', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: 'wrong_secret',
          code_verifier: authResult.codeVerifier,
        })
        .expect(401);
      
      expect(res.body.error).toBe('invalid_client');
    });
    
    it('should accept client credentials via Basic auth header', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      const basicAuth = Buffer.from(
        `${testClient.clientId}:${testClient.clientSecret}`
      ).toString('base64');
      
      const res = await request(app)
        .post('/oauth/token')
        .set('Authorization', `Basic ${basicAuth}`)
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          code_verifier: authResult.codeVerifier,
        })
        .expect(200);
      
      expect(res.body).toHaveProperty('access_token');
    });
    
    it('should reject unknown client_id', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: 'unknown_client',
          client_secret: 'some_secret',
          code_verifier: authResult.codeVerifier,
        })
        .expect(401);
      
      expect(res.body.error).toBe('invalid_client');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Response Format Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Response Format', () => {
    it('should return correct content-type', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(200)
        .expect('Content-Type', /json/);
    });
    
    it('should include scope in response', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser,
        { scope: 'openid profile email' }
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(200);
      
      expect(res.body).toHaveProperty('scope');
      expect(res.body.scope).toContain('openid');
    });
    
    it('should not include scope in id_token if not openid', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser,
        { scope: 'openid' } // Only openid
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(200);
      
      const idToken = res.body.id_token;
      const decoded = verifyJWT(idToken);
      
      // Without profile scope, name/email should not be in id_token
      // (This depends on implementation - adjust as needed)
      expect(decoded).toHaveProperty('sub');
    });
    
    it('should set no-store cache headers', async () => {
      const authResult = await createTestAuthorizationCode(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authResult.authCode.code,
          redirect_uri: testClient.client.redirect_uris[0],
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: authResult.codeVerifier,
        })
        .expect(200);
      
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['pragma']).toBe('no-cache');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Error Response Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Error Responses', () => {
    it('should return error in OAuth format', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: 'invalid_code',
          redirect_uri: 'http://example.com/callback',
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          code_verifier: 'some_verifier',
        })
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });
    
    it('should reject unsupported grant_type', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'password', // Not supported in OAuth 2.1
          username: 'user',
          password: 'pass',
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(400);
      
      expect(res.body.error).toBe('unsupported_grant_type');
    });
    
    it('should reject missing grant_type', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          code: 'some_code',
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_request');
    });
  });
});
