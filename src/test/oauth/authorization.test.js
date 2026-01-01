/**
 * Authorization Endpoint Integration Tests
 * 
 * Tests for OAuth authorization endpoint:
 * - GET /oauth/authorize
 * - POST /oauth/authorize/consent
 * 
 * @module tests/oauth/authorization.test
 */

import { jest } from '@jest/globals';
import {
  setupTestKeys,
  createTestOAuthClient,
  createPendingOAuthClient,
  createTestOAuthUser,
  createTestConsent,
  generatePKCEPair,
  buildAuthorizationUrl,
  cleanupOAuthData,
} from './setup.js';

// Set up keys before importing modules that need them
setupTestKeys();

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authorizationController } from '../../api/oauth/controllers/index.js';
import { validateAuthorizeRequest as validateAuthorize } from '../../api/oauth/validators/index.js';
import AuthorizationCode from '../../models/authorizationCodeModel.js';

// ============================================================================
// Test App Setup
// ============================================================================

const createTestApp = (authUser = null) => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Mock authentication middleware
  app.use((req, res, next) => {
    if (authUser) {
      req.user = authUser;
    }
    next();
  });
  
  // Authorization routes
  app.get('/oauth/authorize', validateAuthorize, authorizationController.authorize);
  app.post('/oauth/authorize/consent', authorizationController.approveConsent);
  app.post('/oauth/authorize/deny', authorizationController.denyConsent);
  
  return app;
};

describe('Authorization Endpoint', () => {
  let testUser;
  let testClient;
  let pkce;
  
  beforeEach(async () => {
    setupTestKeys();
    testUser = await createTestOAuthUser();
    const clientResult = await createTestOAuthClient();
    testClient = clientResult;
    pkce = generatePKCEPair();
  });
  
  afterEach(async () => {
    await cleanupOAuthData();
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Parameter Validation Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Parameter Validation', () => {
    it('should reject request without client_id', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
    });
    
    it('should reject request without response_type', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
    });
    
    it('should reject unsupported response_type', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'token', // Implicit flow not supported
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(400);
      
      expect(res.body.error).toBe('unsupported_response_type');
    });
    
    it('should reject request without PKCE code_challenge', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid',
          // Missing code_challenge
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_request');
    });
    
    it('should reject plain PKCE method (only S256 allowed)', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid',
          code_challenge: 'plainchallenge',
          code_challenge_method: 'plain',
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_request');
    });
    
    it('should reject request with invalid redirect_uri', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: 'https://evil.com/callback',
          scope: 'openid',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_redirect_uri');
    });
    
    it('should reject request without openid scope', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'profile', // Missing openid
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_scope');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Client Validation Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Client Validation', () => {
    it('should reject unknown client_id', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: 'unknown_client_id',
          redirect_uri: 'http://localhost:3001/callback',
          scope: 'openid',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_client');
    });
    
    it('should reject pending (non-approved) client', async () => {
      const pendingClient = await createPendingOAuthClient();
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: pendingClient.clientId,
          redirect_uri: pendingClient.client.redirect_uris[0],
          scope: 'openid',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_client');
    });
    
    it('should reject scope not allowed for client', async () => {
      // Create client with limited scopes
      const limitedClient = await createTestOAuthClient({
        allowedScopes: ['openid'], // No profile or email
      });
      
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: limitedClient.clientId,
          redirect_uri: limitedClient.client.redirect_uris[0],
          scope: 'openid profile', // profile not allowed
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_scope');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Authentication Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('User Authentication', () => {
    it('should redirect to login when user is not authenticated', async () => {
      const app = createTestApp(null); // No authenticated user
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid profile',
          state: 'teststate',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(302);
      
      // Should redirect to login with return URL
      expect(res.headers.location).toContain('/login');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Consent Flow Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Consent Flow', () => {
    it('should show consent screen for first authorization', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid profile',
          state: 'teststate',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        });
      
      // Should either return consent info or redirect to consent page
      expect([200, 302]).toContain(res.status);
      
      if (res.status === 200) {
        // API response with consent details
        expect(res.body).toHaveProperty('requiresConsent', true);
        expect(res.body).toHaveProperty('client');
        expect(res.body).toHaveProperty('requestedScopes');
      }
    });
    
    it('should skip consent if user already approved same scopes', async () => {
      // Create existing consent
      await createTestConsent(testClient.client, testUser, {
        grantedScopes: ['openid', 'profile'],
      });
      
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid profile',
          state: 'teststate',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(302);
      
      // Should redirect with code
      expect(res.headers.location).toContain('code=');
      expect(res.headers.location).toContain('state=teststate');
    });
    
    it('should require consent if requesting new scopes', async () => {
      // Existing consent for limited scopes
      await createTestConsent(testClient.client, testUser, {
        grantedScopes: ['openid'],
      });
      
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid profile', // profile is new
          state: 'teststate',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        });
      
      // Should show consent for new scope
      if (res.status === 200) {
        expect(res.body.requiresConsent).toBe(true);
      }
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Authorization Code Generation Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Authorization Code Generation', () => {
    it('should generate valid authorization code on consent approval', async () => {
      // Pre-create consent
      await createTestConsent(testClient.client, testUser);
      
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid profile',
          state: 'teststate',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(302);
      
      // Parse redirect URL
      const redirectUrl = new URL(res.headers.location);
      const code = redirectUrl.searchParams.get('code');
      const state = redirectUrl.searchParams.get('state');
      
      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(20);
      expect(state).toBe('teststate');
      
      // Verify code is stored in database
      const storedCode = await AuthorizationCode.findOne({ code });
      expect(storedCode).toBeDefined();
      expect(storedCode.clientId).toBe(testClient.clientId);
      expect(storedCode.userId.toString()).toBe(testUser._id.toString());
      expect(storedCode.codeChallenge).toBe(pkce.codeChallenge);
    });
    
    it('should include state in redirect', async () => {
      await createTestConsent(testClient.client, testUser);
      
      const app = createTestApp(testUser);
      const customState = 'my-custom-state-123';
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid profile',
          state: customState,
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(302);
      
      expect(res.headers.location).toContain(`state=${customState}`);
    });
    
    it('should store nonce with authorization code', async () => {
      await createTestConsent(testClient.client, testUser);
      
      const app = createTestApp(testUser);
      const nonce = 'test-nonce-123';
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          scope: 'openid profile',
          state: 'teststate',
          nonce,
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(302);
      
      const redirectUrl = new URL(res.headers.location);
      const code = redirectUrl.searchParams.get('code');
      
      const storedCode = await AuthorizationCode.findOne({ code });
      expect(storedCode.nonce).toBe(nonce);
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Consent Denial Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Consent Denial', () => {
    it('should redirect with access_denied error when user denies', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .post('/oauth/authorize/deny')
        .send({
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0],
          state: 'teststate',
        })
        .expect(302);
      
      const redirectUrl = new URL(res.headers.location);
      expect(redirectUrl.searchParams.get('error')).toBe('access_denied');
      expect(redirectUrl.searchParams.get('state')).toBe('teststate');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Security Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Security', () => {
    it('should not allow redirect to non-registered URI', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: 'https://attacker.com/steal',
          scope: 'openid',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_redirect_uri');
    });
    
    it('should validate redirect_uri exactly (no partial match)', async () => {
      const app = createTestApp(testUser);
      
      // Try to add extra path
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.client.redirect_uris[0] + '/extra',
          scope: 'openid',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(400);
      
      expect(res.body.error).toBe('invalid_redirect_uri');
    });
    
    it('should generate unique codes for each request', async () => {
      await createTestConsent(testClient.client, testUser);
      
      const app = createTestApp(testUser);
      
      const codes = [];
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .get('/oauth/authorize')
          .query({
            response_type: 'code',
            client_id: testClient.clientId,
            redirect_uri: testClient.client.redirect_uris[0],
            scope: 'openid profile',
            state: `state${i}`,
            code_challenge: generatePKCEPair().codeChallenge,
            code_challenge_method: 'S256',
          })
          .expect(302);
        
        const redirectUrl = new URL(res.headers.location);
        codes.push(redirectUrl.searchParams.get('code'));
      }
      
      // All codes should be unique
      expect(new Set(codes).size).toBe(codes.length);
    });
  });
});
