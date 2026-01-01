/**
 * OAuth End-to-End Flow Tests
 * 
 * Complete integration tests that verify the full OAuth flow:
 * 1. Client registration → Approval
 * 2. Authorization request → Consent → Code
 * 3. Token exchange with PKCE
 * 4. Token refresh with rotation
 * 5. Token introspection
 * 6. Token revocation
 * 
 * @module tests/oauth/e2e-flow.test
 */

import { jest } from '@jest/globals';
import {
  setupTestKeys,
  createTestOAuthUser,
  generatePKCEPair,
  cleanupOAuthData,
} from './setup.js';

// Set up keys before imports
setupTestKeys();

import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import User from '../../models/userModel.js';
import OAuthClient from '../../models/oauthClientModel.js';
import UserConsent from '../../models/userConsentModel.js';
import RefreshToken from '../../models/refreshTokenModel.js';

// Import all controllers and middleware
import {
  discoveryController,
  authorizationController,
  tokenController,
  userinfoController,
  clientController,
} from '../../api/oauth/controllers/index.js';
import {
  validateAuthorizeRequest as validateAuthorize,
  validateTokenRequest as validateToken,
  validateClientRegistration,
  validateIntrospectRequest as validateIntrospect,
  validateRevokeRequest as validateRevoke,
} from '../../api/oauth/validators/index.js';
import {
  requireBearerToken,
  requireScope,
} from '../../api/oauth/middleware/index.js';
import { verifyJWT } from '../../utils/oauthCrypto.js';

// ============================================================================
// Full Application Setup
// ============================================================================

const createFullApp = (authUser = null) => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Auth middleware
  app.use((req, res, next) => {
    if (authUser) {
      req.user = authUser;
    }
    next();
  });
  
  // Discovery
  app.get('/.well-known/openid-configuration', discoveryController.getOpenIDConfiguration);
  app.get('/.well-known/jwks.json', discoveryController.getJWKS);
  
  // Authorization
  app.get('/oauth/authorize', validateAuthorize, authorizationController.authorize);
  app.post('/oauth/authorize/consent', authorizationController.approveConsent);
  app.post('/oauth/authorize/deny', authorizationController.denyConsent);
  
  // Token
  app.post('/oauth/token', validateToken, tokenController.token);
  app.post('/oauth/introspect', validateIntrospect, tokenController.introspect);
  app.post('/oauth/revoke', validateRevoke, tokenController.revoke);
  
  // UserInfo
  app.get('/oauth/userinfo', requireBearerToken(), requireScope('openid'), userinfoController.userinfo);
  
  // Client Management
  app.post('/oauth/clients', validateClientRegistration, clientController.register);
  app.get('/oauth/clients', clientController.list);
  app.get('/oauth/clients/:id', clientController.getById);
  app.post('/oauth/clients/:id/approve', clientController.approve);
  
  return app;
};

describe('OAuth 2.1 End-to-End Flow', () => {
  let student;
  let admin;
  
  beforeEach(async () => {
    setupTestKeys();
    
    student = await createTestOAuthUser({
      name: 'Test Student',
      email: 'student@campus.edu',
    });
    
    admin = await User.create({
      name: 'Admin',
      email: 'admin@campus.edu',
      password: 'hashedpassword',
      isVerified: true,
      roles: ['admin'],
    });
  });
  
  afterEach(async () => {
    await cleanupOAuthData();
    await User.deleteMany({});
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Complete OAuth Flow Test
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Complete Authorization Code Flow', () => {
    it('should complete full OAuth flow from registration to userinfo', async () => {
      // ═══════════════════════════════════════════════════════════════════
      // Step 1: Client Registration (Student registers their app)
      // ═══════════════════════════════════════════════════════════════════
      
      let studentApp = createFullApp(student);
      
      const registerRes = await request(studentApp)
        .post('/oauth/clients')
        .send({
          name: 'My Student Project',
          description: 'A cool student project using OAuth',
          redirect_uris: ['http://localhost:8080/callback'],
          contacts: ['student@campus.edu'],
        })
        .expect(201);
      
      const clientId = registerRes.body.client_id;
      const clientSecret = registerRes.body.client_secret;
      
      expect(registerRes.body.status).toBe('pending');
      
      // Get client DB ID for approval
      const pendingClient = await OAuthClient.findOne({ clientId });
      
      // ═══════════════════════════════════════════════════════════════════
      // Step 2: Admin Approval
      // ═══════════════════════════════════════════════════════════════════
      
      const adminApp = createFullApp(admin);
      
      await request(adminApp)
        .post(`/oauth/clients/${pendingClient._id}/approve`)
        .send({
          allowedScopes: ['openid', 'profile', 'email'],
        })
        .expect(200);
      
      // Verify client is approved
      const approvedClient = await OAuthClient.findById(pendingClient._id);
      expect(approvedClient.status).toBe('approved');
      
      // ═══════════════════════════════════════════════════════════════════
      // Step 3: Discovery (Client fetches configuration)
      // ═══════════════════════════════════════════════════════════════════
      
      const configRes = await request(studentApp)
        .get('/.well-known/openid-configuration')
        .expect(200);
      
      expect(configRes.body.authorization_endpoint).toBeDefined();
      expect(configRes.body.token_endpoint).toBeDefined();
      
      const jwksRes = await request(studentApp)
        .get('/.well-known/jwks.json')
        .expect(200);
      
      expect(jwksRes.body.keys.length).toBeGreaterThan(0);
      
      // ═══════════════════════════════════════════════════════════════════
      // Step 4: Authorization Request with PKCE
      // ═══════════════════════════════════════════════════════════════════
      
      const pkce = generatePKCEPair();
      const state = crypto.randomBytes(16).toString('hex');
      const nonce = crypto.randomBytes(16).toString('hex');
      
      // First auth request - needs consent
      const authRes = await request(studentApp)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: 'http://localhost:8080/callback',
          scope: 'openid profile email',
          state,
          nonce,
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        });
      
      // ═══════════════════════════════════════════════════════════════════
      // Step 5: User Grants Consent
      // ═══════════════════════════════════════════════════════════════════
      
      // Grant consent directly in database (simulating user action)
      await UserConsent.create({
        userId: student._id,
        clientId,
        grantedScopes: ['openid', 'profile', 'email'],
      });
      
      // Retry authorization - should now redirect with code
      const authRes2 = await request(studentApp)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: 'http://localhost:8080/callback',
          scope: 'openid profile email',
          state,
          nonce,
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(302);
      
      // Parse authorization code from redirect
      const redirectUrl = new URL(authRes2.headers.location);
      const authorizationCode = redirectUrl.searchParams.get('code');
      const returnedState = redirectUrl.searchParams.get('state');
      
      expect(authorizationCode).toBeDefined();
      expect(returnedState).toBe(state);
      
      // ═══════════════════════════════════════════════════════════════════
      // Step 6: Token Exchange with PKCE verification
      // ═══════════════════════════════════════════════════════════════════
      
      const tokenRes = await request(studentApp)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: 'http://localhost:8080/callback',
          client_id: clientId,
          client_secret: clientSecret,
          code_verifier: pkce.codeVerifier,
        })
        .expect(200);
      
      const accessToken = tokenRes.body.access_token;
      const refreshToken = tokenRes.body.refresh_token;
      const idToken = tokenRes.body.id_token;
      
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(idToken).toBeDefined();
      expect(tokenRes.body.token_type).toBe('Bearer');
      
      // ═══════════════════════════════════════════════════════════════════
      // Step 7: Validate ID Token
      // ═══════════════════════════════════════════════════════════════════
      
      const decodedIdToken = verifyJWT(idToken);
      
      expect(decodedIdToken.sub).toBe(student._id.toString());
      expect(decodedIdToken.aud).toBe(clientId);
      expect(decodedIdToken.nonce).toBe(nonce);
      expect(decodedIdToken.iss).toBeDefined();
      
      // ═══════════════════════════════════════════════════════════════════
      // Step 8: Access Protected UserInfo
      // ═══════════════════════════════════════════════════════════════════
      
      const userinfoRes = await request(studentApp)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(userinfoRes.body.sub).toBe(student._id.toString());
      expect(userinfoRes.body.name).toBe('Test Student');
      expect(userinfoRes.body.email).toBe('student@campus.edu');
      
      // ═══════════════════════════════════════════════════════════════════
      // Step 9: Introspect Token
      // ═══════════════════════════════════════════════════════════════════
      
      const introspectRes = await request(studentApp)
        .post('/oauth/introspect')
        .type('form')
        .send({
          token: accessToken,
          client_id: clientId,
          client_secret: clientSecret,
        })
        .expect(200);
      
      expect(introspectRes.body.active).toBe(true);
      expect(introspectRes.body.sub).toBe(student._id.toString());
      
      // ═══════════════════════════════════════════════════════════════════
      // Step 10: Refresh Token (with rotation)
      // ═══════════════════════════════════════════════════════════════════
      
      const refreshRes = await request(studentApp)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        })
        .expect(200);
      
      const newAccessToken = refreshRes.body.access_token;
      const newRefreshToken = refreshRes.body.refresh_token;
      
      expect(newAccessToken).toBeDefined();
      expect(newRefreshToken).toBeDefined();
      expect(newRefreshToken).not.toBe(refreshToken); // Rotation!
      
      // Old refresh token should no longer work
      const oldRefreshRes = await request(studentApp)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: refreshToken, // Old token
          client_id: clientId,
          client_secret: clientSecret,
        })
        .expect(400);
      
      expect(oldRefreshRes.body.error).toBe('invalid_grant');
      
      // ═══════════════════════════════════════════════════════════════════
      // Step 11: Revoke Token
      // ═══════════════════════════════════════════════════════════════════
      
      await request(studentApp)
        .post('/oauth/revoke')
        .type('form')
        .send({
          token: newRefreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        })
        .expect(200);
      
      // Token should no longer work
      const revokedIntrospectRes = await request(studentApp)
        .post('/oauth/introspect')
        .type('form')
        .send({
          token: newRefreshToken,
          token_type_hint: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
        })
        .expect(200);
      
      expect(revokedIntrospectRes.body.active).toBe(false);
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Security Attack Prevention Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Security Attack Prevention', () => {
    it('should prevent authorization code replay attack', async () => {
      const app = createFullApp(student);
      
      // Create approved client
      const client = await OAuthClient.create({
        clientId: 'attack_test_client',
        clientSecretHash: crypto.createHash('sha256').update('secret123').digest('hex'),
        name: 'Attack Test',
        redirect_uris: ['http://localhost:8080/callback'],
        allowedScopes: ['openid'],
        status: 'approved',
        createdBy: student._id,
      });
      
      // Create consent
      await UserConsent.create({
        userId: student._id,
        clientId: 'attack_test_client',
        grantedScopes: ['openid'],
      });
      
      const pkce = generatePKCEPair();
      
      // Get authorization code
      const authRes = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: 'attack_test_client',
          redirect_uri: 'http://localhost:8080/callback',
          scope: 'openid',
          state: 'test',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(302);
      
      const code = new URL(authRes.headers.location).searchParams.get('code');
      
      // First use - success
      await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:8080/callback',
          client_id: 'attack_test_client',
          client_secret: 'secret123',
          code_verifier: pkce.codeVerifier,
        })
        .expect(200);
      
      // Replay attack - should fail
      const replayRes = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:8080/callback',
          client_id: 'attack_test_client',
          client_secret: 'secret123',
          code_verifier: pkce.codeVerifier,
        })
        .expect(400);
      
      expect(replayRes.body.error).toBe('invalid_grant');
    });
    
    it('should detect refresh token reuse attack', async () => {
      // Create client and initial tokens
      const client = await OAuthClient.create({
        clientId: 'reuse_test_client',
        clientSecretHash: crypto.createHash('sha256').update('secret123').digest('hex'),
        name: 'Reuse Test',
        redirect_uris: ['http://localhost:8080/callback'],
        allowedScopes: ['openid'],
        status: 'approved',
        createdBy: student._id,
      });
      
      const plainToken = crypto.randomBytes(32).toString('hex');
      const familyId = crypto.randomBytes(16).toString('hex');
      
      await RefreshToken.create({
        tokenHash: crypto.createHash('sha256').update(plainToken).digest('hex'),
        familyId,
        clientId: 'reuse_test_client',
        userId: student._id,
        scope: 'openid',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        generation: 1,
      });
      
      const app = createFullApp(student);
      
      // Legitimate use - get new token
      const res1 = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: plainToken,
          client_id: 'reuse_test_client',
          client_secret: 'secret123',
        })
        .expect(200);
      
      const newToken = res1.body.refresh_token;
      
      // Attacker tries to use old token (reuse)
      await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: plainToken, // Old token
          client_id: 'reuse_test_client',
          client_secret: 'secret123',
        })
        .expect(400);
      
      // Now even the legitimate new token should be revoked (entire family)
      const res3 = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'refresh_token',
          refresh_token: newToken,
          client_id: 'reuse_test_client',
          client_secret: 'secret123',
        })
        .expect(400);
      
      expect(res3.body.error).toBe('invalid_grant');
    });
    
    it('should prevent PKCE bypass attempt', async () => {
      const client = await OAuthClient.create({
        clientId: 'pkce_bypass_client',
        clientSecretHash: crypto.createHash('sha256').update('secret123').digest('hex'),
        name: 'PKCE Bypass Test',
        redirect_uris: ['http://localhost:8080/callback'],
        allowedScopes: ['openid'],
        status: 'approved',
        createdBy: student._id,
      });
      
      await UserConsent.create({
        userId: student._id,
        clientId: 'pkce_bypass_client',
        grantedScopes: ['openid'],
      });
      
      const app = createFullApp(student);
      const pkce = generatePKCEPair();
      
      // Get code with PKCE
      const authRes = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: 'pkce_bypass_client',
          redirect_uri: 'http://localhost:8080/callback',
          scope: 'openid',
          state: 'test',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: 'S256',
        })
        .expect(302);
      
      const code = new URL(authRes.headers.location).searchParams.get('code');
      
      // Try to exchange without code_verifier
      const bypassRes = await request(app)
        .post('/oauth/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:8080/callback',
          client_id: 'pkce_bypass_client',
          client_secret: 'secret123',
          // Missing code_verifier!
        })
        .expect(400);
      
      expect(bypassRes.body.error).toBe('invalid_request');
    });
  });
});
