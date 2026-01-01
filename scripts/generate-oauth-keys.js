#!/usr/bin/env node

/**
 * Generate RSA Key Pair for OAuth/OIDC
 * 
 * This script generates an RSA key pair for signing OAuth tokens.
 * Keys are saved to the keys/ directory.
 * 
 * Usage:
 *   node scripts/generate-oauth-keys.js
 *   node scripts/generate-oauth-keys.js --force  (overwrite existing)
 * 
 * Output:
 *   keys/private.pem - RSA private key (keep secret!)
 *   keys/public.pem  - RSA public key (can be shared)
 * 
 * @module scripts/generate-oauth-keys
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// Configuration
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const KEYS_DIR = path.join(ROOT_DIR, 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

// RSA key size (2048 is minimum for OAuth, 4096 for extra security)
const KEY_SIZE = 2048;

// ============================================================================
// Main
// ============================================================================

async function main() {
  const forceOverwrite = process.argv.includes('--force');
  
  console.log('🔐 OAuth Key Pair Generator');
  console.log('============================\n');
  
  // Check if keys already exist
  if (fs.existsSync(PRIVATE_KEY_PATH) && !forceOverwrite) {
    console.log('⚠️  Keys already exist!');
    console.log(`   Private: ${PRIVATE_KEY_PATH}`);
    console.log(`   Public:  ${PUBLIC_KEY_PATH}`);
    console.log('\n   Use --force to overwrite existing keys.');
    console.log('   ⚠️  WARNING: This will invalidate all existing tokens!\n');
    process.exit(1);
  }
  
  // Create keys directory if needed
  if (!fs.existsSync(KEYS_DIR)) {
    console.log(`📁 Creating keys directory: ${KEYS_DIR}`);
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }
  
  // Generate key pair
  console.log(`🔑 Generating ${KEY_SIZE}-bit RSA key pair...`);
  
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: KEY_SIZE,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  // Save private key
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
  console.log(`✅ Private key saved: ${PRIVATE_KEY_PATH}`);
  
  // Save public key
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });
  console.log(`✅ Public key saved: ${PUBLIC_KEY_PATH}`);
  
  // Generate key ID
  const publicKeyObj = crypto.createPublicKey(publicKey);
  const jwk = publicKeyObj.export({ format: 'jwk' });
  const keyId = crypto
    .createHash('sha256')
    .update(jwk.n)
    .digest('hex')
    .substring(0, 16);
  
  console.log(`\n📋 Key ID (kid): ${keyId}`);
  
  // Security reminders
  console.log('\n🔒 Security Reminders:');
  console.log('   1. Keep private.pem SECRET - never commit to git!');
  console.log('   2. Add "keys/" to your .gitignore');
  console.log('   3. For production, use environment variables:');
  console.log('      - OAUTH_PRIVATE_KEY (the entire PEM content)');
  console.log('      - OAUTH_PUBLIC_KEY (the entire PEM content)');
  console.log('   4. Rotate keys periodically (e.g., yearly)');
  
  // Add to .gitignore if needed
  const gitignorePath = path.join(ROOT_DIR, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignore.includes('keys/')) {
      fs.appendFileSync(gitignorePath, '\n# OAuth keys\nkeys/\n');
      console.log('\n✅ Added "keys/" to .gitignore');
    }
  }
  
  console.log('\n✨ Done! Your OAuth IdP is ready to sign tokens.\n');
}

// ============================================================================
// Run
// ============================================================================

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
