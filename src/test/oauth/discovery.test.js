/**
 * Discovery Endpoints Integration Tests
 * 
 * Tests for OIDC discovery endpoints:
 * - GET /.well-known/openid-configuration
 * - GET /.well-known/jwks.json
 * 
 * @module tests/oauth/discovery.test
 */

import { jest } from '@jest/globals';
import { setupTestKeys } from './setup.js';

// Set up keys before importing modules that need them
setupTestKeys();

import request from 'supertest';
import express from 'express';
import { discoveryController } from '../../api/oauth/controllers/index.js';

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mount discovery routes
  app.get('/.well-known/openid-configuration', discoveryController.getOpenIDConfiguration);
  app.get('/.well-known/jwks.json', discoveryController.getJWKS);
  
  return app;
};

describe('Discovery Endpoints', () => {
  let app;
  
  beforeAll(() => {
    setupTestKeys();
    app = createTestApp();
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // OpenID Configuration Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('GET /.well-known/openid-configuration', () => {
    it('should return valid OpenID configuration', async () => {
      const res = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200)
        .expect('Content-Type', /json/);
      
      // Verify required fields
      expect(res.body).toHaveProperty('issuer');
      expect(res.body).toHaveProperty('authorization_endpoint');
      expect(res.body).toHaveProperty('token_endpoint');
      expect(res.body).toHaveProperty('userinfo_endpoint');
      expect(res.body).toHaveProperty('jwks_uri');
    });
    
    it('should include required OAuth 2.1 endpoints', async () => {
      const res = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200);
      
      // OAuth 2.1 required endpoints
      expect(res.body.authorization_endpoint).toContain('/oauth/authorize');
      expect(res.body.token_endpoint).toContain('/oauth/token');
      expect(res.body.jwks_uri).toContain('/jwks.json');
    });
    
    it('should include revocation and introspection endpoints', async () => {
      const res = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200);
      
      expect(res.body).toHaveProperty('revocation_endpoint');
      expect(res.body).toHaveProperty('introspection_endpoint');
      expect(res.body.revocation_endpoint).toContain('/oauth/revoke');
      expect(res.body.introspection_endpoint).toContain('/oauth/introspect');
    });
    
    it('should support only authorization_code response type', async () => {
      const res = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200);
      
      expect(res.body.response_types_supported).toEqual(['code']);
    });
    
    it('should require PKCE with S256', async () => {
      const res = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200);
      
      expect(res.body.code_challenge_methods_supported).toEqual(['S256']);
    });
    
    it('should support only authorization_code grant type', async () => {
      const res = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200);
      
      expect(res.body.grant_types_supported).toContain('authorization_code');
      expect(res.body.grant_types_supported).toContain('refresh_token');
      // OAuth 2.1: No implicit or password grants
      expect(res.body.grant_types_supported).not.toContain('implicit');
      expect(res.body.grant_types_supported).not.toContain('password');
    });
    
    it('should include supported scopes', async () => {
      const res = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200);
      
      expect(res.body.scopes_supported).toContain('openid');
      expect(res.body.scopes_supported).toContain('profile');
      expect(res.body.scopes_supported).toContain('email');
    });
    
    it('should use RS256 signing algorithm', async () => {
      const res = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200);
      
      expect(res.body.id_token_signing_alg_values_supported).toEqual(['RS256']);
      expect(res.body.token_endpoint_auth_signing_alg_values_supported).toEqual(['RS256']);
    });
    
    it('should include token endpoint auth methods', async () => {
      const res = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200);
      
      expect(res.body.token_endpoint_auth_methods_supported).toContain('client_secret_post');
      expect(res.body.token_endpoint_auth_methods_supported).toContain('client_secret_basic');
    });
    
    it('should set appropriate cache headers', async () => {
      const res = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200);
      
      // Should be cacheable
      expect(res.headers['cache-control']).toBeDefined();
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // JWKS Endpoint Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('GET /.well-known/jwks.json', () => {
    it('should return valid JWKS', async () => {
      const res = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(res.body).toHaveProperty('keys');
      expect(Array.isArray(res.body.keys)).toBe(true);
      expect(res.body.keys.length).toBeGreaterThan(0);
    });
    
    it('should contain RSA public key with required fields', async () => {
      const res = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200);
      
      const key = res.body.keys[0];
      
      // Required JWK fields
      expect(key).toHaveProperty('kty', 'RSA');
      expect(key).toHaveProperty('use', 'sig');
      expect(key).toHaveProperty('alg', 'RS256');
      expect(key).toHaveProperty('kid');
      expect(key).toHaveProperty('n'); // modulus
      expect(key).toHaveProperty('e'); // exponent
    });
    
    it('should NOT include private key components', async () => {
      const res = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200);
      
      const key = res.body.keys[0];
      
      // These should NOT be present (private key components)
      expect(key).not.toHaveProperty('d');
      expect(key).not.toHaveProperty('p');
      expect(key).not.toHaveProperty('q');
      expect(key).not.toHaveProperty('dp');
      expect(key).not.toHaveProperty('dq');
      expect(key).not.toHaveProperty('qi');
    });
    
    it('should return consistent key ID', async () => {
      const res1 = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200);
      
      const res2 = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200);
      
      expect(res1.body.keys[0].kid).toBe(res2.body.keys[0].kid);
    });
    
    it('should set appropriate cache headers', async () => {
      const res = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200);
      
      // JWKS should be cacheable
      expect(res.headers['cache-control']).toBeDefined();
    });
    
    it('key modulus and exponent should be valid base64url', async () => {
      const res = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200);
      
      const key = res.body.keys[0];
      
      // Base64url regex (no padding)
      const base64urlRegex = /^[A-Za-z0-9_-]+$/;
      
      expect(key.n).toMatch(base64urlRegex);
      expect(key.e).toMatch(base64urlRegex);
    });
  });
});
