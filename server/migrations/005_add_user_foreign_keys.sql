-- ============================================================================
-- BONERBOTS AI Arena - Add User Foreign Keys Migration
-- Migration: 005_add_user_foreign_keys.sql
-- Description: Adds user_id columns to all user-specific tables for multi-tenancy
-- ============================================================================

-- Note: SQLite doesn't support ALTER TABLE ADD COLUMN with FOREIGN KEY constraints directly
-- We need to recreate tables with the new schema

-- Temporarily disable foreign keys during migration (user_id will be NULL initially)
PRAGMA foreign_keys = OFF;

-- ============================================================================
-- 1. Bots Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS bots_new (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  provider_id INTEGER NOT NULL,
  trading_mode TEXT NOT NULL CHECK (trading_mode IN ('paper', 'real')),
  avatar_image TEXT,
  is_active BOOLEAN DEFAULT 1,
  is_paused BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES llm_providers(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing data
INSERT INTO bots_new (id, name, prompt, provider_id, trading_mode, avatar_image, is_active, is_paused, created_at, updated_at)
SELECT id, name, prompt, provider_id, trading_mode, avatar_image, is_active, is_paused, created_at, updated_at
FROM bots;

DROP TABLE bots;
ALTER TABLE bots_new RENAME TO bots;

CREATE INDEX IF NOT EXISTS idx_bots_user ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bots_active ON bots(is_active);
CREATE INDEX IF NOT EXISTS idx_bots_provider ON bots(provider_id);
CREATE INDEX IF NOT EXISTS idx_bots_mode ON bots(trading_mode);

-- ============================================================================
-- 2. LLM Providers Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS llm_providers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('openai', 'anthropic', 'gemini', 'grok', 'local', 'custom')),
  api_endpoint TEXT NOT NULL,
  model_name TEXT,
  api_key_encrypted TEXT,
  config_json TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing data
INSERT INTO llm_providers_new (id, name, provider_type, api_endpoint, model_name, api_key_encrypted, config_json, is_active, created_at, updated_at)
SELECT id, name, provider_type, api_endpoint, model_name, api_key_encrypted, config_json, is_active, created_at, updated_at
FROM llm_providers;

DROP TABLE llm_providers;
ALTER TABLE llm_providers_new RENAME TO llm_providers;

CREATE INDEX IF NOT EXISTS idx_providers_user ON llm_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_active ON llm_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_providers_type ON llm_providers(provider_type);

-- ============================================================================
-- 3. Wallets Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallets_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  bot_id TEXT NOT NULL,
  exchange TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  wallet_address TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing data
INSERT INTO wallets_new (id, bot_id, exchange, api_key_encrypted, api_secret_encrypted, wallet_address, is_active, created_at, updated_at)
SELECT id, bot_id, exchange, api_key_encrypted, api_secret_encrypted, wallet_address, is_active, created_at, updated_at
FROM wallets;

DROP TABLE wallets;
ALTER TABLE wallets_new RENAME TO wallets;

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_bot ON wallets(bot_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_bot_exchange ON wallets(bot_id, exchange);

-- ============================================================================
-- 4. Bot State Snapshots Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_state_snapshots_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  bot_id TEXT NOT NULL,
  balance REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  realized_pnl REAL NOT NULL,
  total_value REAL NOT NULL,
  trade_count INTEGER NOT NULL,
  win_rate REAL NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing data
INSERT INTO bot_state_snapshots_new (id, bot_id, balance, unrealized_pnl, realized_pnl, total_value, trade_count, win_rate, timestamp)
SELECT id, bot_id, balance, unrealized_pnl, realized_pnl, total_value, trade_count, win_rate, timestamp
FROM bot_state_snapshots;

DROP TABLE bot_state_snapshots;
ALTER TABLE bot_state_snapshots_new RENAME TO bot_state_snapshots;

CREATE INDEX IF NOT EXISTS idx_snapshots_user ON bot_state_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_bot_time ON bot_state_snapshots(bot_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON bot_state_snapshots(timestamp);

-- ============================================================================
-- 5. Bot Decisions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_decisions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  bot_id TEXT NOT NULL,
  prompt_sent TEXT NOT NULL,
  decisions_json TEXT NOT NULL,
  notes_json TEXT,
  execution_success BOOLEAN NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing data
INSERT INTO bot_decisions_new (id, bot_id, prompt_sent, decisions_json, notes_json, execution_success, timestamp)
SELECT id, bot_id, prompt_sent, decisions_json, notes_json, execution_success, timestamp
FROM bot_decisions;

DROP TABLE bot_decisions;
ALTER TABLE bot_decisions_new RENAME TO bot_decisions;

CREATE INDEX IF NOT EXISTS idx_decisions_user ON bot_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_decisions_bot ON bot_decisions(bot_id);
CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON bot_decisions(timestamp);

-- ============================================================================
-- 6. Trades Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trades_new (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  bot_id TEXT NOT NULL,
  position_id TEXT,
  symbol TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('LONG', 'SHORT')),
  action TEXT NOT NULL CHECK (action IN ('OPEN', 'CLOSE')),
  entry_price REAL NOT NULL,
  exit_price REAL,
  size REAL NOT NULL,
  leverage INTEGER NOT NULL,
  pnl REAL NOT NULL,
  fee REAL NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing data
INSERT INTO trades_new (id, bot_id, position_id, symbol, trade_type, action, entry_price, exit_price, size, leverage, pnl, fee, executed_at)
SELECT id, bot_id, position_id, symbol, trade_type, action, entry_price, exit_price, size, leverage, pnl, fee, executed_at
FROM trades;

DROP TABLE trades;
ALTER TABLE trades_new RENAME TO trades;

CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_bot ON trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_trades_position ON trades(position_id);
CREATE INDEX IF NOT EXISTS idx_trades_executed ON trades(executed_at);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_pnl ON trades(pnl);

-- ============================================================================
-- 7. Positions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS positions_new (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  bot_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  position_type TEXT NOT NULL CHECK (position_type IN ('LONG', 'SHORT')),
  entry_price REAL NOT NULL,
  size REAL NOT NULL,
  leverage INTEGER NOT NULL,
  liquidation_price REAL,
  stop_loss REAL,
  take_profit REAL,
  unrealized_pnl REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing data
INSERT INTO positions_new (id, bot_id, symbol, position_type, entry_price, size, leverage, liquidation_price, stop_loss, take_profit, unrealized_pnl, status, opened_at, closed_at)
SELECT id, bot_id, symbol, position_type, entry_price, size, leverage, liquidation_price, stop_loss, take_profit, unrealized_pnl, status, opened_at, closed_at
FROM positions;

DROP TABLE positions;
ALTER TABLE positions_new RENAME TO positions;

CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_bot ON positions(bot_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_opened ON positions(opened_at);

-- ============================================================================
-- Note: system_settings table remains global (no user_id)
-- This allows admin to configure global defaults
-- ============================================================================

-- Re-enable foreign keys
-- NOTE: user_id values will be NULL until assign_to_admin script is run
PRAGMA foreign_keys = ON;

-- ============================================================================
-- Migration Complete
-- ============================================================================

