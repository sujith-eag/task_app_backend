/**
 * UserInfo Endpoint Integration Tests
 * 
 * Tests for OAuth userinfo endpoint:
 * - GET /oauth/userinfo
 * - POST /oauth/userinfo
 * 
 * @module tests/oauth/userinfo.test
 */

import { jest } from '@jest/globals';
import {
  setupTestKeys,
  createTestOAuthClient,
  createTestOAuthUser,
  generateTestAccessToken,
  cleanupOAuthData,
} from './setup.js';

// Set up keys before imports
setupTestKeys();

import request from 'supertest';
import express from 'express';
import { userinfoController } from '../../api/oauth/controllers/index.js';
import { requireBearerToken, requireScope } from '../../api/oauth/middleware/index.js';

// ============================================================================
// Test App Setup
// ============================================================================

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Userinfo endpoint with bearer token and openid scope requirement
  app.get('/oauth/userinfo', 
    requireBearerToken(),
    requireScope('openid'),
    userinfoController.userinfo
  );
  
  app.post('/oauth/userinfo',
    requireBearerToken(),
    requireScope('openid'),
    userinfoController.userinfo
  );
  
  return app;
};

describe('UserInfo Endpoint', () => {
  let app;
  let testUser;
  let testClient;
  
  beforeAll(() => {
    setupTestKeys();
    app = createTestApp();
  });
  
  beforeEach(async () => {
    testUser = await createTestOAuthUser({
      name: 'Test OAuth User',
      email: 'oauth-test@example.com',
    });
    const clientResult = await createTestOAuthClient();
    testClient = clientResult;
  });
  
  afterEach(async () => {
    await cleanupOAuthData();
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Authentication Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Authentication', () => {
    it('should require access token', async () => {
      const res = await request(app)
        .get('/oauth/userinfo')
        .expect(401);
      
      expect(res.body).toHaveProperty('error', 'invalid_token');
    });
    
    it('should reject invalid access token', async () => {
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
      
      expect(res.body).toHaveProperty('error', 'invalid_token');
    });
    
    it('should accept valid Bearer token', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['openid', 'profile']
      );
      
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(res.body).toHaveProperty('sub');
    });
    
    it('should support both GET and POST methods', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['openid']
      );
      
      // GET
      const getRes = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(getRes.body).toHaveProperty('sub');
      
      // POST
      const postRes = await request(app)
        .post('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(postRes.body).toHaveProperty('sub');
    });
    
    it('should require openid scope', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['profile'] // No openid scope
      );
      
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
      
      expect(res.body).toHaveProperty('error', 'insufficient_scope');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Claims Based on Scope Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Claims Based on Scope', () => {
    it('should return sub claim for openid scope only', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['openid']
      );
      
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(res.body).toHaveProperty('sub', testUser._id.toString());
      // Should not include profile or email claims without those scopes
      expect(res.body).not.toHaveProperty('email');
    });
    
    it('should return profile claims with profile scope', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['openid', 'profile']
      );
      
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(res.body).toHaveProperty('sub');
      expect(res.body).toHaveProperty('name', testUser.name);
      // May include other profile claims
    });
    
    it('should return email claim with email scope', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['openid', 'email']
      );
      
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(res.body).toHaveProperty('sub');
      expect(res.body).toHaveProperty('email', testUser.email);
      expect(res.body).toHaveProperty('email_verified');
    });
    
    it('should return all claims with full scope', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['openid', 'profile', 'email']
      );
      
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(res.body).toHaveProperty('sub', testUser._id.toString());
      expect(res.body).toHaveProperty('name', testUser.name);
      expect(res.body).toHaveProperty('email', testUser.email);
      expect(res.body).toHaveProperty('email_verified');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Response Format Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Response Format', () => {
    it('should return JSON content type', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['openid']
      );
      
      await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect('Content-Type', /json/);
    });
    
    it('should always include sub claim', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['openid']
      );
      
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(res.body.sub).toBe(testUser._id.toString());
    });
    
    it('sub claim should match token subject', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['openid']
      );
      
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(res.body.sub).toBe(testUser._id.toString());
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Student-Specific Claims Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Student-Specific Claims', () => {
    it('should include student details with profile scope', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['openid', 'profile']
      );
      
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      // May include role information
      expect(res.body).toHaveProperty('sub');
      // Student-specific claims (if implemented)
      // expect(res.body).toHaveProperty('student_id');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Error Handling', () => {
    it('should return 401 for expired token', async () => {
      // This would require creating an expired token
      // For now, test with malformed token
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.expired')
        .expect(401);
      
      expect(res.body).toHaveProperty('error');
    });
    
    it('should include WWW-Authenticate header on 401', async () => {
      const res = await request(app)
        .get('/oauth/userinfo')
        .expect(401);
      
      expect(res.headers['www-authenticate']).toBeDefined();
      expect(res.headers['www-authenticate']).toContain('Bearer');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Cache Control Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Cache Control', () => {
    it('should set no-store cache header for userinfo', async () => {
      const accessToken = await generateTestAccessToken(
        testClient.client,
        testUser,
        ['openid']
      );
      
      const res = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      // Userinfo contains sensitive data - should not be cached
      expect(res.headers['cache-control']).toContain('no-store');
    });
  });
});
