/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const crypto = require('crypto');

/**
 * Encryption Utility for API Keys and Secrets
 * 
 * Uses AES-256-GCM for encryption with authentication tags
 * Supports per-user encryption keys derived from master key + user ID
 */

const ALGORITHM = 'aes-256-gcm';

// Get master encryption key from environment or generate a default one (not recommended for production)
const MASTER_ENCRYPTION_KEY = process.env.MASTER_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
  ? process.env.MASTER_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
  : 'default-key-change-this-in-production';

if (!process.env.MASTER_ENCRYPTION_KEY && !process.env.ENCRYPTION_KEY) {
  console.warn('⚠️  WARNING: No MASTER_ENCRYPTION_KEY set in environment. Using default key (not secure!)');
  console.warn('   Please set MASTER_ENCRYPTION_KEY in server/.env to a random 32+ character string');
}

/**
 * Derive a user-specific encryption key from master key + user ID
 * This ensures that data encrypted for one user cannot be decrypted with another user's key
 * @param {string} userId - The user ID to derive the key for
 * @returns {Buffer} - The derived encryption key
 */
function deriveUserKey(userId) {
  if (!userId) {
    throw new Error('User ID is required for key derivation');
  }
  
  // Use userId as salt for key derivation
  return crypto.scryptSync(MASTER_ENCRYPTION_KEY, userId, 32);
}

/**
 * Encrypt a plaintext string with optional user-specific key
 * @param {string} text - The text to encrypt
 * @param {string} [userId] - Optional user ID for per-user encryption
 * @returns {string} - JSON string containing iv, authTag, and encrypted data
 */
function encrypt(text, userId = null) {
  if (!text) {
    throw new Error('Text to encrypt cannot be empty');
  }
  
  // Use user-specific key if userId provided, otherwise use master key
  const encryptionKey = userId 
    ? deriveUserKey(userId)
    : crypto.scryptSync(MASTER_ENCRYPTION_KEY, 'salt', 32);
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return as JSON string for easy storage in database
  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted: encrypted
  });
}

/**
 * Decrypt an encrypted string with optional user-specific key
 * @param {string} encryptedData - JSON string containing iv, authTag, and encrypted data
 * @param {string} [userId] - Optional user ID for per-user decryption
 * @returns {string} - The decrypted plaintext
 */
function decrypt(encryptedData, userId = null) {
  if (!encryptedData) {
    throw new Error('Encrypted data cannot be empty');
  }
  
  let data;
  try {
    data = JSON.parse(encryptedData);
  } catch (error) {
    throw new Error('Invalid encrypted data format');
  }
  
  // Use user-specific key if userId provided, otherwise use master key
  const encryptionKey = userId 
    ? deriveUserKey(userId)
    : crypto.scryptSync(MASTER_ENCRYPTION_KEY, 'salt', 32);
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    encryptionKey,
    Buffer.from(data.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
  
  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Redact sensitive data for display (shows only last 4 characters)
 * @param {string} text - The text to redact
 * @returns {string} - Redacted text like "****1234"
 */
function redact(text) {
  if (!text || text.length < 4) {
    return '****';
  }
  
  return '****' + text.slice(-4);
}

/**
 * Test encryption/decryption (both global and per-user)
 * @returns {boolean} - True if all tests pass
 */
function testEncryption() {
  try {
    // Test global encryption (backward compatible)
    const testString = 'test-api-key-12345';
    const encrypted = encrypt(testString);
    const decrypted = decrypt(encrypted);
    
    if (testString !== decrypted) {
      console.error('Global encryption test failed');
      return false;
    }
    
    // Test per-user encryption
    const testUserId = 'test-user-123';
    const userEncrypted = encrypt(testString, testUserId);
    const userDecrypted = decrypt(userEncrypted, testUserId);
    
    if (testString !== userDecrypted) {
      console.error('Per-user encryption test failed');
      return false;
    }
    
    // Ensure user-encrypted data cannot be decrypted with different user key
    try {
      const differentUserId = 'different-user-456';
      decrypt(userEncrypted, differentUserId);
      console.error('User isolation test failed - data was decrypted with wrong user key');
      return false;
    } catch (error) {
      // Expected - data should not decrypt with wrong user key
    }
    
    return true;
  } catch (error) {
    console.error('Encryption test failed:', error.message);
    return false;
  }
}

module.exports = {
  encrypt,
  decrypt,
  redact,
  deriveUserKey,
  testEncryption
};

