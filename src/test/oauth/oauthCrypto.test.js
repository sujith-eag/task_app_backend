/**
 * OAuth Crypto Utilities Tests
 * 
 * Tests for RSA key management, JWT signing, and PKCE.
 * 
 * @module tests/oauth/oauthCrypto.test
 */

import { jest } from '@jest/globals';

// Mock crypto module before importing
const mockKeys = {
  privateKey: null,
  publicKey: null
};

// Generate test keys
import crypto from 'crypto';
const testKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
mockKeys.privateKey = testKeyPair.privateKey;
mockKeys.publicKey = testKeyPair.publicKey;

// Set up environment variables for testing
process.env.OAUTH_PRIVATE_KEY = mockKeys.privateKey;
process.env.OAUTH_PUBLIC_KEY = mockKeys.publicKey;

// Import after setting env vars
import {
  loadPrivateKey,
  loadPublicKey,
  getKeyId,
  generateJWKS,
  signJWT,
  verifyJWT,
  generateRandomToken,
  generateRandomTokenBase64,
  generateClientId,
  generateClientSecret,
  verifyCodeChallenge,
  generateCodeVerifier,
  generateCodeChallenge,
  clearKeyCache,
  generateKeyPair
} from '../../utils/oauthCrypto.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('OAuth Crypto Utilities', () => {
  beforeEach(() => {
    clearKeyCache();
  });

  // ────────────────────────────────────────────────────────────────────────
  // Key Loading Tests
  // ────────────────────────────────────────────────────────────────────────

  describe('Key Loading', () => {
    test('should load private key from environment', () => {
      const key = loadPrivateKey();
      expect(key).toBeDefined();
      expect(key.type).toBe('private');
      expect(key.asymmetricKeyType).toBe('rsa');
    });

    test('should load public key from environment', () => {
      const key = loadPublicKey();
      expect(key).toBeDefined();
      expect(key.type).toBe('public');
      expect(key.asymmetricKeyType).toBe('rsa');
    });

    test('should cache keys across calls', () => {
      const key1 = loadPrivateKey();
      const key2 = loadPrivateKey();
      expect(key1).toBe(key2);
    });

    test('should generate consistent key ID', () => {
      const kid1 = getKeyId();
      const kid2 = getKeyId();
      expect(kid1).toBe(kid2);
      expect(kid1).toHaveLength(16);
      expect(kid1).toMatch(/^[a-f0-9]+$/);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // JWKS Tests
  // ────────────────────────────────────────────────────────────────────────

  describe('JWKS Generation', () => {
    test('should generate valid JWKS', () => {
      const jwks = generateJWKS();
      
      expect(jwks).toHaveProperty('keys');
      expect(jwks.keys).toHaveLength(1);
      
      const key = jwks.keys[0];
      expect(key.kty).toBe('RSA');
      expect(key.use).toBe('sig');
      expect(key.alg).toBe('RS256');
      expect(key.kid).toBeDefined();
      expect(key.n).toBeDefined();
      expect(key.e).toBeDefined();
    });

    test('should cache JWKS', () => {
      const jwks1 = generateJWKS();
      const jwks2 = generateJWKS();
      expect(jwks1).toBe(jwks2);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // JWT Signing Tests
  // ────────────────────────────────────────────────────────────────────────

  describe('JWT Signing and Verification', () => {
    const testPayload = {
      sub: 'user123',
      name: 'Test User',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    test('should sign and verify JWT', () => {
      const token = signJWT(testPayload);
      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
      
      const decoded = verifyJWT(token);
      expect(decoded.sub).toBe(testPayload.sub);
      expect(decoded.name).toBe(testPayload.name);
    });

    test('should reject expired tokens', () => {
      const expiredPayload = {
        ...testPayload,
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };
      
      const token = signJWT(expiredPayload);
      expect(() => verifyJWT(token)).toThrow('Token expired');
    });

    test('should reject tampered tokens', () => {
      const token = signJWT(testPayload);
      const parts = token.split('.');
      parts[1] = parts[1].replace('a', 'b'); // Tamper with payload
      const tamperedToken = parts.join('.');
      
      expect(() => verifyJWT(tamperedToken)).toThrow();
    });

    test('should verify issuer', () => {
      const payload = { ...testPayload, iss: 'test-issuer' };
      const token = signJWT(payload);
      
      // Should pass with correct issuer
      const decoded = verifyJWT(token, { issuer: 'test-issuer' });
      expect(decoded.iss).toBe('test-issuer');
      
      // Should fail with wrong issuer
      expect(() => verifyJWT(token, { issuer: 'wrong-issuer' }))
        .toThrow('Invalid issuer');
    });

    test('should verify audience', () => {
      const payload = { ...testPayload, aud: 'test-client' };
      const token = signJWT(payload);
      
      // Should pass with correct audience
      const decoded = verifyJWT(token, { audience: 'test-client' });
      expect(decoded.aud).toBe('test-client');
      
      // Should fail with wrong audience
      expect(() => verifyJWT(token, { audience: 'wrong-client' }))
        .toThrow('Invalid audience');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Random Token Tests
  // ────────────────────────────────────────────────────────────────────────

  describe('Random Token Generation', () => {
    test('should generate hex tokens of correct length', () => {
      const token = generateRandomToken(32);
      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    test('should generate unique tokens', () => {
      const token1 = generateRandomToken();
      const token2 = generateRandomToken();
      expect(token1).not.toBe(token2);
    });

    test('should generate base64url tokens', () => {
      const token = generateRandomTokenBase64(32);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      // No padding (=) or regular base64 chars (+/)
      expect(token).not.toContain('=');
      expect(token).not.toContain('+');
      expect(token).not.toContain('/');
    });

    test('should generate client IDs with prefix', () => {
      const clientId = generateClientId();
      expect(clientId).toMatch(/^ec_[a-f0-9]{24}$/);
    });

    test('should generate client secrets', () => {
      const secret = generateClientSecret();
      expect(secret).toHaveLength(64);
      expect(secret).toMatch(/^[a-f0-9]+$/);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // PKCE Tests
  // ────────────────────────────────────────────────────────────────────────

  describe('PKCE', () => {
    test('should generate valid code verifier', () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toBeDefined();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('should generate valid code challenge from verifier', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);
      
      expect(challenge).toBeDefined();
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(challenge).not.toContain('=');
    });

    test('should verify matching code challenge', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);
      
      expect(verifyCodeChallenge(verifier, challenge)).toBe(true);
    });

    test('should reject mismatched code challenge', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier1);
      
      expect(verifyCodeChallenge(verifier2, challenge)).toBe(false);
    });

    test('should reject invalid method', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);
      
      expect(() => verifyCodeChallenge(verifier, challenge, 'plain'))
        .toThrow('Only S256 method is supported');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Key Generation Tests
  // ────────────────────────────────────────────────────────────────────────

  describe('Key Generation', () => {
    test('should generate new key pair', () => {
      const { privateKey, publicKey } = generateKeyPair();
      
      expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });

    test('should generate key pair with custom size', () => {
      const { privateKey } = generateKeyPair(2048);
      expect(privateKey).toBeDefined();
    });
  });
});
