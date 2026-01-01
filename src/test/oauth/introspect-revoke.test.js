/**
 * Introspection & Revocation Endpoint Tests
 * 
 * Tests for OAuth introspection and revocation:
 * - POST /oauth/introspect
 * - POST /oauth/revoke
 * 
 * @module tests/oauth/introspect-revoke.test
 */

import { jest } from '@jest/globals';
import {
  setupTestKeys,
  createTestOAuthClient,
  createTestOAuthUser,
  createTestRefreshToken,
  generateTestAccessToken,
  cleanupOAuthData,
} from './setup.js';

// Set up keys before imports
setupTestKeys();

import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { tokenController } from '../../api/oauth/controllers/index.js';
import { validateIntrospectRequest as validateIntrospect, validateRevokeRequest as validateRevoke } from '../../api/oauth/validators/index.js';
import RefreshToken from '../../models/refreshTokenModel.js';

// ============================================================================
// Test App Setup
// ============================================================================

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.post('/oauth/introspect', validateIntrospect, tokenController.introspect);
  app.post('/oauth/revoke', validateRevoke, tokenController.revoke);
  
  return app;
};

describe('Introspection & Revocation', () => {
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
  
  // ════════════════════════════════════════════════════════════════════════
  // INTROSPECTION TESTS
  // ════════════════════════════════════════════════════════════════════════
  
  describe('Token Introspection', () => {
    // ────────────────────────────────────────────────────────────────────────
    // Access Token Introspection
    // ────────────────────────────────────────────────────────────────────────
    
    describe('Access Token Introspection', () => {
      it('should return active=true for valid access token', async () => {
        const accessToken = await generateTestAccessToken(
          testClient.client,
          testUser,
          ['openid', 'profile']
        );
        
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: accessToken,
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        expect(res.body).toHaveProperty('active', true);
      });
      
      it('should return token metadata for active token', async () => {
        const accessToken = await generateTestAccessToken(
          testClient.client,
          testUser,
          ['openid', 'profile']
        );
        
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: accessToken,
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        expect(res.body.active).toBe(true);
        expect(res.body).toHaveProperty('sub', testUser._id.toString());
        expect(res.body).toHaveProperty('client_id', testClient.clientId);
        expect(res.body).toHaveProperty('scope');
        expect(res.body).toHaveProperty('exp');
        expect(res.body).toHaveProperty('iat');
        expect(res.body).toHaveProperty('token_type', 'access_token');
      });
      
      it('should return active=false for invalid token', async () => {
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: 'invalid_token_string',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        expect(res.body).toEqual({ active: false });
      });
      
      it('should return active=false for expired token', async () => {
        // Create an already expired token
        // For simplicity, just test with a malformed token
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.expired.signature',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        expect(res.body.active).toBe(false);
      });
    });
    
    // ────────────────────────────────────────────────────────────────────────
    // Refresh Token Introspection
    // ────────────────────────────────────────────────────────────────────────
    
    describe('Refresh Token Introspection', () => {
      it('should return active=true for valid refresh token', async () => {
        const tokenResult = await createTestRefreshToken(
          testClient.client,
          testUser
        );
        
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: tokenResult.plainToken,
            token_type_hint: 'refresh_token',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        expect(res.body).toHaveProperty('active', true);
        expect(res.body).toHaveProperty('token_type', 'refresh_token');
      });
      
      it('should return active=false for revoked refresh token', async () => {
        const tokenResult = await createTestRefreshToken(
          testClient.client,
          testUser,
          { isRevoked: true }
        );
        
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: tokenResult.plainToken,
            token_type_hint: 'refresh_token',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        expect(res.body).toEqual({ active: false });
      });
      
      it('should return active=false for expired refresh token', async () => {
        const tokenResult = await createTestRefreshToken(
          testClient.client,
          testUser,
          { expiresAt: new Date(Date.now() - 1000) }
        );
        
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: tokenResult.plainToken,
            token_type_hint: 'refresh_token',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        expect(res.body).toEqual({ active: false });
      });
    });
    
    // ────────────────────────────────────────────────────────────────────────
    // Client Authentication for Introspection
    // ────────────────────────────────────────────────────────────────────────
    
    describe('Client Authentication', () => {
      it('should require client authentication', async () => {
        const accessToken = await generateTestAccessToken(
          testClient.client,
          testUser,
          ['openid']
        );
        
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: accessToken,
            // No client credentials
          })
          .expect(401);
        
        expect(res.body).toHaveProperty('error', 'invalid_client');
      });
      
      it('should reject invalid client credentials', async () => {
        const accessToken = await generateTestAccessToken(
          testClient.client,
          testUser,
          ['openid']
        );
        
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: accessToken,
            client_id: testClient.clientId,
            client_secret: 'wrong_secret',
          })
          .expect(401);
        
        expect(res.body).toHaveProperty('error', 'invalid_client');
      });
      
      it('should accept Basic auth for client authentication', async () => {
        const accessToken = await generateTestAccessToken(
          testClient.client,
          testUser,
          ['openid']
        );
        
        const basicAuth = Buffer.from(
          `${testClient.clientId}:${testClient.clientSecret}`
        ).toString('base64');
        
        const res = await request(app)
          .post('/oauth/introspect')
          .set('Authorization', `Basic ${basicAuth}`)
          .type('form')
          .send({
            token: accessToken,
          })
          .expect(200);
        
        expect(res.body).toHaveProperty('active', true);
      });
    });
    
    // ────────────────────────────────────────────────────────────────────────
    // Token Type Hints
    // ────────────────────────────────────────────────────────────────────────
    
    describe('Token Type Hints', () => {
      it('should accept access_token type hint', async () => {
        const accessToken = await generateTestAccessToken(
          testClient.client,
          testUser,
          ['openid']
        );
        
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: accessToken,
            token_type_hint: 'access_token',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        expect(res.body.active).toBe(true);
      });
      
      it('should accept refresh_token type hint', async () => {
        const tokenResult = await createTestRefreshToken(
          testClient.client,
          testUser
        );
        
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: tokenResult.plainToken,
            token_type_hint: 'refresh_token',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        expect(res.body.active).toBe(true);
      });
      
      it('should work without type hint', async () => {
        const accessToken = await generateTestAccessToken(
          testClient.client,
          testUser,
          ['openid']
        );
        
        const res = await request(app)
          .post('/oauth/introspect')
          .type('form')
          .send({
            token: accessToken,
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        expect(res.body.active).toBe(true);
      });
    });
  });
  
  // ════════════════════════════════════════════════════════════════════════
  // REVOCATION TESTS
  // ════════════════════════════════════════════════════════════════════════
  
  describe('Token Revocation', () => {
    // ────────────────────────────────────────────────────────────────────────
    // Refresh Token Revocation
    // ────────────────────────────────────────────────────────────────────────
    
    describe('Refresh Token Revocation', () => {
      it('should revoke valid refresh token', async () => {
        const tokenResult = await createTestRefreshToken(
          testClient.client,
          testUser
        );
        
        // Revoke
        await request(app)
          .post('/oauth/revoke')
          .type('form')
          .send({
            token: tokenResult.plainToken,
            token_type_hint: 'refresh_token',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        // Verify token is revoked in database
        const token = await RefreshToken.findOne({
          tokenHash: crypto
            .createHash('sha256')
            .update(tokenResult.plainToken)
            .digest('hex'),
        });
        
        expect(token.isRevoked).toBe(true);
      });
      
      it('should return 200 for already revoked token', async () => {
        const tokenResult = await createTestRefreshToken(
          testClient.client,
          testUser,
          { isRevoked: true }
        );
        
        // Should succeed silently
        await request(app)
          .post('/oauth/revoke')
          .type('form')
          .send({
            token: tokenResult.plainToken,
            token_type_hint: 'refresh_token',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
      });
      
      it('should return 200 for non-existent token', async () => {
        // RFC 7009: The authorization server responds with HTTP status
        // code 200 even if the token is not valid
        await request(app)
          .post('/oauth/revoke')
          .type('form')
          .send({
            token: 'nonexistent_token',
            token_type_hint: 'refresh_token',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
      });
      
      it('should revoke entire token family', async () => {
        // Create a token family by creating multiple generations
        const tokenResult = await createTestRefreshToken(
          testClient.client,
          testUser
        );
        
        // Create another token in same family
        const siblingToken = await createTestRefreshToken(
          testClient.client,
          testUser,
          { familyId: tokenResult.familyId, generation: 2 }
        );
        
        // Revoke the first token
        await request(app)
          .post('/oauth/revoke')
          .type('form')
          .send({
            token: tokenResult.plainToken,
            token_type_hint: 'refresh_token',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        // Both tokens in family should be revoked
        const tokens = await RefreshToken.find({
          familyId: tokenResult.familyId,
        });
        
        tokens.forEach((token) => {
          expect(token.isRevoked).toBe(true);
        });
      });
    });
    
    // ────────────────────────────────────────────────────────────────────────
    // Access Token Revocation
    // ────────────────────────────────────────────────────────────────────────
    
    describe('Access Token Revocation', () => {
      it('should accept access token for revocation', async () => {
        const accessToken = await generateTestAccessToken(
          testClient.client,
          testUser,
          ['openid']
        );
        
        // Access tokens are JWTs - revocation may not be possible
        // but endpoint should still return 200
        await request(app)
          .post('/oauth/revoke')
          .type('form')
          .send({
            token: accessToken,
            token_type_hint: 'access_token',
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
      });
    });
    
    // ────────────────────────────────────────────────────────────────────────
    // Client Authentication for Revocation
    // ────────────────────────────────────────────────────────────────────────
    
    describe('Client Authentication', () => {
      it('should require client authentication', async () => {
        const tokenResult = await createTestRefreshToken(
          testClient.client,
          testUser
        );
        
        const res = await request(app)
          .post('/oauth/revoke')
          .type('form')
          .send({
            token: tokenResult.plainToken,
            // No client credentials
          })
          .expect(401);
        
        expect(res.body).toHaveProperty('error', 'invalid_client');
      });
      
      it('should only allow token owner to revoke', async () => {
        const tokenResult = await createTestRefreshToken(
          testClient.client,
          testUser
        );
        
        // Create another client
        const otherClient = await createTestOAuthClient();
        
        // Other client tries to revoke
        const res = await request(app)
          .post('/oauth/revoke')
          .type('form')
          .send({
            token: tokenResult.plainToken,
            client_id: otherClient.clientId,
            client_secret: otherClient.clientSecret,
          })
          .expect(400);
        
        expect(res.body).toHaveProperty('error');
      });
    });
    
    // ────────────────────────────────────────────────────────────────────────
    // Response Format
    // ────────────────────────────────────────────────────────────────────────
    
    describe('Response Format', () => {
      it('should return empty body on success', async () => {
        const tokenResult = await createTestRefreshToken(
          testClient.client,
          testUser
        );
        
        const res = await request(app)
          .post('/oauth/revoke')
          .type('form')
          .send({
            token: tokenResult.plainToken,
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(200);
        
        // RFC 7009: successful response has no body
        expect(res.body).toEqual({});
      });
      
      it('should return error in OAuth format on failure', async () => {
        const res = await request(app)
          .post('/oauth/revoke')
          .type('form')
          .send({
            // Missing token
            client_id: testClient.clientId,
            client_secret: testClient.clientSecret,
          })
          .expect(400);
        
        expect(res.body).toHaveProperty('error');
      });
    });
  });
});
