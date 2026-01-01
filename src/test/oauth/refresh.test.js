/**
 * Refresh Token Integration Tests
 * 
 * Tests for refresh token rotation and security:
 * - Token rotation
 * - Reuse detection
 * - Token revocation
 * 
 * @module tests/oauth/refresh.test
 */

import { jest } from '@jest/globals';
import {
  setupTestKeys,
  createTestOAuthClient,
  createTestOAuthUser,
  createTestRefreshToken,
  createTestAuthorizationCode,
  cleanupOAuthData,
} from './setup.js';

// Set up keys before imports
setupTestKeys();

import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { tokenController } from '../../api/oauth/controllers/index.js';
import { validateTokenRequest as validateToken } from '../../api/oauth/validators/index.js';
import { verifyJWT } from '../../utils/oauthCrypto.js';
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

describe('Refresh Token', () => {
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
  // Basic Refresh Flow Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Basic Refresh Flow', () => {
    it('should exchange refresh token for new tokens', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(200);
      
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('token_type', 'Bearer');
      expect(res.body).toHaveProperty('refresh_token');
      expect(res.body).toHaveProperty('expires_in');
    });
    
    it('should return new access token with valid claims', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(200);
      
      const decoded = verifyJWT(res.body.access_token);
      
      expect(decoded).toHaveProperty('sub', testUser._id.toString());
      expect(decoded).toHaveProperty('client_id', testClient.clientId);
    });
    
    it('should preserve scope in refreshed token', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser,
        { scope: 'openid profile email' }
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(200);
      
      expect(res.body.scope).toContain('openid');
      expect(res.body.scope).toContain('profile');
      expect(res.body.scope).toContain('email');
    });
    
    it('should reject expired refresh token', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser,
        { expiresAt: new Date(Date.now() - 1000) } // Expired
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_grant');
    });
    
    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: 'invalid_token_that_doesnt_exist',
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_grant');
    });
    
    it('should reject refresh token with wrong client', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser
      );
      
      // Create another client
      const otherClient = await createTestOAuthClient();
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: otherClient.clientId,
          client_secret: otherClient.clientSecret,
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_grant');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Token Rotation Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Token Rotation', () => {
    it('should issue new refresh token on each use (rotation)', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(200);
      
      // New refresh token should be different
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.refresh_token).not.toBe(tokenResult.plainToken);
    });
    
    it('should invalidate old refresh token after rotation', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser
      );
      
      // First refresh - should succeed
      await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(200);
      
      // Second use of old token - should fail
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_grant');
    });
    
    it('should maintain family_id across rotations', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(200);
      
      // Find new token in database
      const newTokenHash = crypto
        .createHash('sha256')
        .update(res.body.refresh_token)
        .digest('hex');
      
      const newToken = await RefreshToken.findOne({ tokenHash: newTokenHash });
      
      // Should have same family ID
      expect(newToken).toBeDefined();
      expect(newToken.familyId).toBe(tokenResult.familyId);
    });
    
    it('should increment generation on rotation', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser,
        { generation: 1 }
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(200);
      
      const newTokenHash = crypto
        .createHash('sha256')
        .update(res.body.refresh_token)
        .digest('hex');
      
      const newToken = await RefreshToken.findOne({ tokenHash: newTokenHash });
      
      expect(newToken.generation).toBe(2);
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Reuse Detection Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Reuse Detection', () => {
    it('should detect token reuse and revoke family', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser
      );
      
      // First use - rotates to new token
      const res1 = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(200);
      
      const newRefreshToken = res1.body.refresh_token;
      
      // Attacker tries to reuse old token
      await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(400);
      
      // Now even the legitimate new token should be revoked
      const res2 = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: newRefreshToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(400);
      
      expect(res2.body.error).toBe('invalid_grant');
    });
    
    it('should mark all tokens in family as revoked on reuse', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser
      );
      
      // First use
      await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(200);
      
      // Reuse old token (triggers revocation)
      await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(400);
      
      // Check database - all tokens in family should be revoked
      const familyTokens = await RefreshToken.find({
        familyId: tokenResult.familyId,
      });
      
      familyTokens.forEach((token) => {
        expect(token.isRevoked).toBe(true);
      });
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Revoked Token Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Revoked Tokens', () => {
    it('should reject revoked refresh token', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser,
        { isRevoked: true }
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_grant');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Client Authentication Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Client Authentication for Refresh', () => {
    it('should require client authentication', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          // No client credentials
        })
        .expect(401);
      
      expect(res.body.error).toBe('invalid_client');
    });
    
    it('should reject wrong client_secret', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: 'wrong_secret',
        })
        .expect(401);
      
      expect(res.body.error).toBe('invalid_client');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Scope Downgrading Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Scope Handling', () => {
    it('should allow requesting fewer scopes', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser,
        { scope: 'openid profile email' }
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          scope: 'openid profile', // Less than original
        })
        .expect(200);
      
      expect(res.body.scope).toContain('openid');
      expect(res.body.scope).toContain('profile');
      expect(res.body.scope).not.toContain('email');
    });
    
    it('should reject requesting more scopes than original', async () => {
      const tokenResult = await createTestRefreshToken(
        testClient.client,
        testUser,
        { scope: 'openid' }
      );
      
      const res = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: tokenResult.plainToken,
          client_id: testClient.clientId,
          client_secret: testClient.clientSecret,
          scope: 'openid profile email', // More than original
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_scope');
    });
  });
});
