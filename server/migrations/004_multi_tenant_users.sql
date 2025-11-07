-- ============================================================================
-- BONERBOTS AI Arena - Multi-Tenant Users Migration
-- Migration: 004_multi_tenant_users.sql
-- Description: Adds user management tables for multi-tenant SaaS architecture
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users_new (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    recovery_phrase_hash TEXT NOT NULL, -- Hashed 12-word recovery phrase
    email TEXT UNIQUE,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin', 'moderator')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active INTEGER DEFAULT 1
);

-- Copy existing users data if any (use password hash as placeholder for recovery phrase)
INSERT INTO users_new (id, username, password_hash, recovery_phrase_hash, email, role, is_active, created_at, last_login)
SELECT 
  id, 
  username, 
  password_hash, 
  password_hash, -- Use password hash as placeholder for existing users without recovery phrase
  email, 
  role, 
  is_active, 
  created_at, 
  last_login
FROM users
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='users');

-- Drop old users table and rename new one
DROP TABLE IF EXISTS users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- User sessions table (for refresh tokens)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- User profiles table (extended info)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    country TEXT,
    timezone TEXT,
    preferences TEXT, -- JSON for UI preferences
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Enhanced audit log table (rename existing if needed)
CREATE TABLE IF NOT EXISTS audit_log_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Copy existing audit log data if any
INSERT INTO audit_log_new (id, user_id, action, resource_type, resource_id, ip_address, details, created_at)
SELECT id, user_id, event_type, entity_type, entity_id, ip_address, details_json, timestamp
FROM audit_log
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='audit_log');

-- Drop old audit_log and rename
DROP TABLE IF EXISTS audit_log;
ALTER TABLE audit_log_new RENAME TO audit_log;

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================

