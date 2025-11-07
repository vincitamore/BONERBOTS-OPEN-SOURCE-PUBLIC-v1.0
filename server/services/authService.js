/**
 * @license
 * SPDX-License-Identifier: MIT
 * 
 * Authentication Service
 * Handles user registration, login, password management, and JWT tokens
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bip39 = require('bip39');
const Database = require('better-sqlite3');
const path = require('path');

// Constants
const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'bonerbots-default-jwt-secret-change-in-production';
const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'arena.db');

// Warn if using default JWT secret
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: No JWT_SECRET set in environment. Using default secret (not secure!)');
  console.warn('   Please set JWT_SECRET in server/.env to a strong random string');
}

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against its hash
 * @param {string} password - Plain text password
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>} - True if password matches
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a 12-word BIP39 recovery phrase
 * @returns {string} - Space-separated 12-word phrase
 */
function generateRecoveryPhrase() {
  // Generate 128 bits of entropy (12 words)
  const entropy = crypto.randomBytes(16);
  return bip39.entropyToMnemonic(entropy.toString('hex'));
}

/**
 * Hash a recovery phrase using bcrypt
 * @param {string} phrase - 12-word recovery phrase
 * @returns {Promise<string>} - Hashed phrase
 */
async function hashRecoveryPhrase(phrase) {
  // Normalize phrase (trim, lowercase, single spaces)
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  return await bcrypt.hash(normalized, SALT_ROUNDS);
}

/**
 * Verify a recovery phrase against its hash
 * @param {string} phrase - Plain text recovery phrase
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>} - True if phrase matches
 */
async function verifyRecoveryPhrase(phrase, hash) {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  return await bcrypt.compare(normalized, hash);
}

/**
 * Generate JWT access and refresh tokens
 * @param {string} userId - User ID
 * @param {string} username - Username
 * @param {string} role - User role
 * @returns {Object} - { accessToken, refreshToken }
 */
function generateTokens(userId, username, role) {
  const accessToken = jwt.sign(
    { userId, username, role, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES }
  );
  
  const refreshToken = jwt.sign(
    { userId, username, role, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES }
  );
  
  return { accessToken, refreshToken };
}

/**
 * Verify and decode JWT access token
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return payload;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} - { accessToken, refreshToken }
 * @throws {Error} - If refresh token is invalid
 */
async function refreshAccessToken(refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    const db = new Database(DB_PATH);
    
    try {
      // Check if refresh token exists in sessions
      const session = db.prepare(`
        SELECT * FROM user_sessions 
        WHERE refresh_token = ? AND expires_at > datetime('now')
      `).get(refreshToken);
      
      if (!session) {
        throw new Error('Session not found or expired');
      }
      
      // Check if user is still active
      const user = db.prepare(`
        SELECT id, username, role, is_active 
        FROM users 
        WHERE id = ?
      `).get(payload.userId);
      
      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }
      
      // Generate new tokens
      const tokens = generateTokens(user.id, user.username, user.role);
      
      // Update session with new refresh token
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      db.prepare('DELETE FROM user_sessions WHERE refresh_token = ?').run(refreshToken);
      db.prepare(`
        INSERT INTO user_sessions (id, user_id, refresh_token, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(sessionId, user.id, tokens.refreshToken, expiresAt.toISOString());
      
      return tokens;
    } finally {
      db.close();
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Create a new user
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {string} email - Email (optional)
 * @param {string} role - Role (default: 'user')
 * @returns {Promise<Object>} - { userId, username, recoveryPhrase }
 * @throws {Error} - If username/email already exists
 */
async function createUser(username, password, email = null, role = 'user') {
  const db = new Database(DB_PATH);
  
  try {
    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }
    
    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingEmail) {
        throw new Error('Email already exists');
      }
    }
    
    // Generate user ID, hash password, and generate recovery phrase
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const recoveryPhrase = generateRecoveryPhrase();
    const recoveryPhraseHash = await hashRecoveryPhrase(recoveryPhrase);
    
    // Insert user
    db.prepare(`
      INSERT INTO users (id, username, password_hash, recovery_phrase_hash, email, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(userId, username, passwordHash, recoveryPhraseHash, email, role);
    
    // Create user profile
    db.prepare(`
      INSERT INTO user_profiles (user_id, display_name)
      VALUES (?, ?)
    `).run(userId, username);
    
    console.log(`✅ User created: ${username} (${userId})`);
    
    return {
      userId,
      username,
      recoveryPhrase // CRITICAL: Return this ONCE to user, never store it plain
    };
  } finally {
    db.close();
  }
}

/**
 * Authenticate a user
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {string} ipAddress - IP address (optional)
 * @param {string} userAgent - User agent (optional)
 * @returns {Promise<Object>} - { user, accessToken, refreshToken }
 * @throws {Error} - If credentials are invalid
 */
async function authenticateUser(username, password, ipAddress = null, userAgent = null) {
  const db = new Database(DB_PATH);
  
  try {
    // Get user
    const user = db.prepare(`
      SELECT id, username, password_hash, email, role, is_active
      FROM users
      WHERE username = ?
    `).get(username);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    if (!user.is_active) {
      throw new Error('Account is disabled');
    }
    
    // Verify password
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }
    
    // Generate tokens
    const tokens = generateTokens(user.id, user.username, user.role);
    
    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    db.prepare(`
      INSERT INTO user_sessions (id, user_id, refresh_token, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, user.id, tokens.refreshToken, expiresAt.toISOString(), ipAddress, userAgent);
    
    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    
    console.log(`✅ User authenticated: ${username}`);
    
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  } finally {
    db.close();
  }
}

/**
 * Recover account using recovery phrase
 * @param {string} username - Username
 * @param {string} recoveryPhrase - 12-word recovery phrase
 * @returns {Promise<Object>} - { userId, username }
 * @throws {Error} - If recovery fails
 */
async function recoverAccount(username, recoveryPhrase) {
  const db = new Database(DB_PATH);
  
  try {
    const user = db.prepare(`
      SELECT id, username, recovery_phrase_hash, is_active
      FROM users
      WHERE username = ?
    `).get(username);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (!user.is_active) {
      throw new Error('Account is disabled');
    }
    
    // Verify recovery phrase
    const validPhrase = await verifyRecoveryPhrase(recoveryPhrase, user.recovery_phrase_hash);
    if (!validPhrase) {
      throw new Error('Invalid recovery phrase');
    }
    
    console.log(`✅ Account recovered: ${username}`);
    
    return {
      userId: user.id,
      username: user.username
    };
  } finally {
    db.close();
  }
}

/**
 * Reset password using recovery phrase
 * @param {string} username - Username
 * @param {string} recoveryPhrase - 12-word recovery phrase
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} - { userId, username }
 * @throws {Error} - If reset fails
 */
async function resetPassword(username, recoveryPhrase, newPassword) {
  const db = new Database(DB_PATH);
  
  try {
    // First verify the recovery phrase
    const accountInfo = await recoverAccount(username, recoveryPhrase);
    
    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);
    
    // Update password
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPasswordHash, accountInfo.userId);
    
    // Revoke all existing sessions for security
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(accountInfo.userId);
    
    console.log(`✅ Password reset for: ${username}`);
    
    return accountInfo;
  } finally {
    db.close();
  }
}

/**
 * Revoke a session (logout)
 * @param {string} refreshToken - Refresh token to revoke
 * @returns {Promise<boolean>} - True if session was revoked
 */
async function revokeSession(refreshToken) {
  const db = new Database(DB_PATH);
  
  try {
    const result = db.prepare('DELETE FROM user_sessions WHERE refresh_token = ?').run(refreshToken);
    return result.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * Revoke all sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of sessions revoked
 */
async function revokeAllUserSessions(userId) {
  const db = new Database(DB_PATH);
  
  try {
    const result = db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
    return result.changes;
  } finally {
    db.close();
  }
}

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - User object or null
 */
async function getUserById(userId) {
  const db = new Database(DB_PATH);
  
  try {
    const user = db.prepare(`
      SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at, u.last_login,
             p.display_name, p.bio, p.avatar_url, p.country, p.timezone, p.preferences
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(userId);
    
    if (!user) {
      return null;
    }
    
    // Parse preferences JSON if exists
    if (user.preferences) {
      try {
        user.preferences = JSON.parse(user.preferences);
      } catch (e) {
        user.preferences = {};
      }
    }
    
    return user;
  } finally {
    db.close();
  }
}

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updates - Profile updates
 * @returns {Promise<boolean>} - True if updated
 */
async function updateUserProfile(userId, updates) {
  const db = new Database(DB_PATH);
  
  try {
    const allowedFields = ['display_name', 'bio', 'avatar_url', 'country', 'timezone', 'preferences'];
    const updateFields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(key === 'preferences' ? JSON.stringify(value) : value);
      }
    }
    
    if (updateFields.length === 0) {
      return false;
    }
    
    values.push(userId);
    
    db.prepare(`
      UPDATE user_profiles 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(...values);
    
    return true;
  } finally {
    db.close();
  }
}

/**
 * Change user password (requires current password)
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} - True if changed
 * @throws {Error} - If current password is wrong
 */
async function changePassword(userId, currentPassword, newPassword) {
  const db = new Database(DB_PATH);
  
  try {
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Verify current password
    const validPassword = await verifyPassword(currentPassword, user.password_hash);
    if (!validPassword) {
      throw new Error('Current password is incorrect');
    }
    
    // Hash and update new password
    const newPasswordHash = await hashPassword(newPassword);
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPasswordHash, userId);
    
    // Revoke all other sessions for security (keep current session)
    // Note: Caller should handle keeping current session
    
    console.log(`✅ Password changed for user: ${userId}`);
    return true;
  } finally {
    db.close();
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateRecoveryPhrase,
  hashRecoveryPhrase,
  verifyRecoveryPhrase,
  generateTokens,
  verifyAccessToken,
  refreshAccessToken,
  createUser,
  authenticateUser,
  recoverAccount,
  resetPassword,
  revokeSession,
  revokeAllUserSessions,
  getUserById,
  updateUserProfile,
  changePassword,
  JWT_SECRET
};

