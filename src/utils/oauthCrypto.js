/**
 * Cryptographic Utilities for OAuth/OIDC
 * 
 * Provides RSA key management, JWT signing, and JWKS generation.
 * Uses RS256 (RSA with SHA-256) as required by OIDC spec.
 * 
 * Key Management Strategy:
 * - Keys are loaded from environment variables or files
 * - Key ID (kid) is derived from key content for consistency
 * - JWKS is cached and regenerated only when needed
 * 
 * @module utils/oauthCrypto
 * @see /docs/oidc-idp-transformation/08-FINALIZED-IMPLEMENTATION-PLAN.md
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Constants
// ============================================================================

const KEY_ALGORITHM = 'RS256';
const KEY_USE = 'sig'; // Signature use

// ============================================================================
// Key Loading
// ============================================================================

/**
 * Cached keys to avoid reloading
 */
let cachedPrivateKey = null;
let cachedPublicKey = null;
let cachedKeyId = null;
let cachedJWKS = null;

/**
 * Load RSA private key from environment or file
 * @returns {crypto.KeyObject}
 * @throws {Error} If key cannot be loaded
 */
export function loadPrivateKey() {
  if (cachedPrivateKey) {
    return cachedPrivateKey;
  }

  let keyPem;

  // Try environment variable first (for production/container deployments)
  if (process.env.OAUTH_PRIVATE_KEY) {
    keyPem = process.env.OAUTH_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  // Try file path
  else if (process.env.OAUTH_PRIVATE_KEY_PATH) {
    const keyPath = path.resolve(process.env.OAUTH_PRIVATE_KEY_PATH);
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Private key file not found: ${keyPath}`);
    }
    keyPem = fs.readFileSync(keyPath, 'utf8');
  }
  // Default development path
  else {
    const devKeyPath = path.resolve(process.cwd(), 'keys', 'private.pem');
    if (fs.existsSync(devKeyPath)) {
      keyPem = fs.readFileSync(devKeyPath, 'utf8');
    } else {
      throw new Error(
        'OAuth private key not found. Set OAUTH_PRIVATE_KEY env var, ' +
        'OAUTH_PRIVATE_KEY_PATH env var, or create keys/private.pem'
      );
    }
  }

  try {
    cachedPrivateKey = crypto.createPrivateKey(keyPem);
    return cachedPrivateKey;
  } catch (err) {
    throw new Error(`Failed to parse private key: ${err.message}`);
  }
}

/**
 * Load RSA public key from environment or file
 * @returns {crypto.KeyObject}
 * @throws {Error} If key cannot be loaded
 */
export function loadPublicKey() {
  if (cachedPublicKey) {
    return cachedPublicKey;
  }

  let keyPem;

  // Try environment variable first
  if (process.env.OAUTH_PUBLIC_KEY) {
    keyPem = process.env.OAUTH_PUBLIC_KEY.replace(/\\n/g, '\n');
  }
  // Try file path
  else if (process.env.OAUTH_PUBLIC_KEY_PATH) {
    const keyPath = path.resolve(process.env.OAUTH_PUBLIC_KEY_PATH);
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Public key file not found: ${keyPath}`);
    }
    keyPem = fs.readFileSync(keyPath, 'utf8');
  }
  // Try deriving from private key
  else {
    try {
      const privateKey = loadPrivateKey();
      cachedPublicKey = crypto.createPublicKey(privateKey);
      return cachedPublicKey;
    } catch {
      // Try default development path
      const devKeyPath = path.resolve(process.cwd(), 'keys', 'public.pem');
      if (fs.existsSync(devKeyPath)) {
        keyPem = fs.readFileSync(devKeyPath, 'utf8');
      } else {
        throw new Error(
          'OAuth public key not found. Set OAUTH_PUBLIC_KEY env var, ' +
          'OAUTH_PUBLIC_KEY_PATH env var, or create keys/public.pem'
        );
      }
    }
  }

  try {
    cachedPublicKey = crypto.createPublicKey(keyPem);
    return cachedPublicKey;
  } catch (err) {
    throw new Error(`Failed to parse public key: ${err.message}`);
  }
}

// ============================================================================
// Key ID Generation
// ============================================================================

/**
 * Generate a key ID (kid) from the public key
 * Uses SHA-256 of the public key modulus for consistency
 * @returns {string} Key ID (first 16 chars of hash)
 */
export function getKeyId() {
  if (cachedKeyId) {
    return cachedKeyId;
  }

  const publicKey = loadPublicKey();
  const keyDetails = publicKey.export({ format: 'jwk' });
  
  // Hash the modulus (n) to create a stable key ID
  const hash = crypto
    .createHash('sha256')
    .update(keyDetails.n)
    .digest('hex');
  
  cachedKeyId = hash.substring(0, 16);
  return cachedKeyId;
}

// ============================================================================
// JWKS (JSON Web Key Set)
// ============================================================================

/**
 * Convert base64 to base64url
 * @param {string} base64 - Base64 encoded string
 * @returns {string} Base64URL encoded string
 */
function base64ToBase64Url(base64) {
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate JWKS (JSON Web Key Set) for the public key
 * This is exposed at /.well-known/jwks.json
 * @returns {Object} JWKS object
 */
export function generateJWKS() {
  if (cachedJWKS) {
    return cachedJWKS;
  }

  const publicKey = loadPublicKey();
  const keyId = getKeyId();
  
  // Export as JWK format
  const jwk = publicKey.export({ format: 'jwk' });
  
  cachedJWKS = {
    keys: [
      {
        kty: jwk.kty,           // Key type: "RSA"
        use: KEY_USE,            // Use: "sig" (signature)
        alg: KEY_ALGORITHM,      // Algorithm: "RS256"
        kid: keyId,              // Key ID
        n: jwk.n,                // Modulus
        e: jwk.e                 // Exponent
      }
    ]
  };

  return cachedJWKS;
}

// ============================================================================
// Token Signing & Verification
// ============================================================================

/**
 * Create JWT header
 * @returns {Object} JWT header
 */
function createJWTHeader() {
  return {
    alg: KEY_ALGORITHM,
    typ: 'JWT',
    kid: getKeyId()
  };
}

/**
 * Sign a JWT payload
 * @param {Object} payload - JWT payload
 * @returns {string} Signed JWT
 */
export function signJWT(payload) {
  const privateKey = loadPrivateKey();
  const header = createJWTHeader();
  
  // Encode header and payload
  const encodedHeader = base64ToBase64Url(
    Buffer.from(JSON.stringify(header)).toString('base64')
  );
  const encodedPayload = base64ToBase64Url(
    Buffer.from(JSON.stringify(payload)).toString('base64')
  );
  
  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .sign('sha256', Buffer.from(signatureInput), privateKey);
  const encodedSignature = base64ToBase64Url(signature.toString('base64'));
  
  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Verify a JWT
 * @param {string} token - JWT to verify
 * @param {Object} options - Verification options
 * @returns {Object} Decoded payload if valid
 * @throws {Error} If verification fails
 */
export function verifyJWT(token, options = {}) {
  const publicKey = loadPublicKey();
  
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  
  // Decode header
  const header = JSON.parse(
    Buffer.from(encodedHeader, 'base64url').toString()
  );
  
  // Verify algorithm
  if (header.alg !== KEY_ALGORITHM) {
    throw new Error(`Invalid algorithm: expected ${KEY_ALGORITHM}, got ${header.alg}`);
  }
  
  // Verify key ID if checking
  if (options.verifyKid && header.kid !== getKeyId()) {
    throw new Error('Key ID mismatch');
  }
  
  // Verify signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = Buffer.from(encodedSignature, 'base64url');
  
  const isValid = crypto.verify(
    'sha256',
    Buffer.from(signatureInput),
    publicKey,
    signature
  );
  
  if (!isValid) {
    throw new Error('Invalid signature');
  }
  
  // Decode payload
  const payload = JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString()
  );
  
  // Verify expiration
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token expired');
  }
  
  // Verify not before
  if (payload.nbf && Date.now() < payload.nbf * 1000) {
    throw new Error('Token not yet valid');
  }
  
  // Verify issuer
  if (options.issuer && payload.iss !== options.issuer) {
    throw new Error(`Invalid issuer: expected ${options.issuer}, got ${payload.iss}`);
  }
  
  // Verify audience
  if (options.audience) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(options.audience)) {
      throw new Error('Invalid audience');
    }
  }
  
  return payload;
}

// ============================================================================
// Random Token Generation
// ============================================================================

/**
 * Generate a cryptographically secure random token
 * @param {number} bytes - Number of random bytes (default 32)
 * @returns {string} Hex-encoded random token
 */
export function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a cryptographically secure random token (base64url)
 * @param {number} bytes - Number of random bytes (default 32)
 * @returns {string} Base64URL-encoded random token
 */
export function generateRandomTokenBase64(bytes = 32) {
  return base64ToBase64Url(crypto.randomBytes(bytes).toString('base64'));
}

/**
 * Generate a client ID
 * Format: ec_ prefix + 24 random hex chars
 * @returns {string} Client ID
 */
export function generateClientId() {
  return `ec_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Generate a client secret
 * Format: 64 random hex characters
 * @returns {string} Client secret
 */
export function generateClientSecret() {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================================================
// PKCE Helpers
// ============================================================================

/**
 * Verify PKCE code challenge
 * @param {string} codeVerifier - The code_verifier from token request
 * @param {string} codeChallenge - The stored code_challenge
 * @param {string} method - Challenge method ('S256')
 * @returns {boolean} True if valid
 */
export function verifyCodeChallenge(codeVerifier, codeChallenge, method = 'S256') {
  if (method !== 'S256') {
    throw new Error('Only S256 method is supported');
  }
  
  // S256: BASE64URL(SHA256(code_verifier))
  const hash = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest();
  
  const computed = base64ToBase64Url(hash.toString('base64'));
  
  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(codeChallenge)
    );
  } catch {
    return false; // Length mismatch
  }
}

/**
 * Generate PKCE code verifier (for testing)
 * @returns {string} Code verifier
 */
export function generateCodeVerifier() {
  return generateRandomTokenBase64(32);
}

/**
 * Generate PKCE code challenge from verifier (for testing)
 * @param {string} codeVerifier - The code_verifier
 * @returns {string} Code challenge (S256)
 */
export function generateCodeChallenge(codeVerifier) {
  const hash = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest();
  
  return base64ToBase64Url(hash.toString('base64'));
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear all cached keys
 * Useful for key rotation or testing
 */
export function clearKeyCache() {
  cachedPrivateKey = null;
  cachedPublicKey = null;
  cachedKeyId = null;
  cachedJWKS = null;
}

// ============================================================================
// Key Generation (Development Only)
// ============================================================================

/**
 * Generate a new RSA keypair
 * FOR DEVELOPMENT/TESTING ONLY
 * @param {number} modulusLength - Key size in bits (default 2048)
 * @returns {Object} { privateKey, publicKey } as PEM strings
 */
export function generateKeyPair(modulusLength = 2048) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  return { privateKey, publicKey };
}

export default {
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
};
