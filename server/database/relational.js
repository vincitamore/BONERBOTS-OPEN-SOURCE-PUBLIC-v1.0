/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * Relational Database Operations
 * 
 * This module provides CRUD operations for the new relational schema.
 * It complements the existing database.js file which handles the legacy JSON blob.
 */

// Get database path from environment or use default
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'arena.db');

// Ensure the database directory exists
const dbDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database connection
const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================================
// BOT OPERATIONS
// ============================================================================

/**
 * Get all bots with optional filters
 */
function getBots(filters = {}) {
  let query = `
    SELECT b.*, lp.name as provider_name, lp.provider_type
    FROM bots b
    JOIN llm_providers lp ON b.provider_id = lp.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (filters.active !== undefined) {
    query += ' AND b.is_active = ?';
    params.push(filters.active ? 1 : 0);
  }
  
  if (filters.trading_mode) {
    query += ' AND b.trading_mode = ?';
    params.push(filters.trading_mode);
  }
  
  if (filters.provider_id) {
    query += ' AND b.provider_id = ?';
    params.push(filters.provider_id);
  }
  
  query += ' ORDER BY b.created_at DESC';
  
  return db.prepare(query).all(...params);
}

/**
 * Get a single bot by ID
 */
function getBot(botId) {
  return db.prepare(`
    SELECT b.*, lp.name as provider_name, lp.provider_type
    FROM bots b
    JOIN llm_providers lp ON b.provider_id = lp.id
    WHERE b.id = ?
  `).get(botId);
}

/**
 * Create a new bot
 */
function createBot(botData) {
  const stmt = db.prepare(`
    INSERT INTO bots (id, name, prompt, provider_id, trading_mode, is_active, is_paused, avatar_image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    botData.id,
    botData.name,
    botData.prompt,
    botData.provider_id,
    botData.trading_mode,
    botData.is_active !== undefined ? (botData.is_active ? 1 : 0) : 1,
    botData.is_paused !== undefined ? (botData.is_paused ? 1 : 0) : 0,
    botData.avatar_image || null
  );
  
  return getBot(botData.id);
}

/**
 * Update a bot
 */
function updateBot(botId, updates) {
  const allowedFields = ['name', 'prompt', 'provider_id', 'trading_mode', 'is_active', 'is_paused', 'avatar_image'];
  const setters = [];
  const params = [];
  
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setters.push(`${field} = ?`);
      if (typeof updates[field] === 'boolean') {
        params.push(updates[field] ? 1 : 0);
      } else {
        params.push(updates[field]);
      }
    }
  }
  
  if (setters.length === 0) {
    return getBot(botId);
  }
  
  setters.push('updated_at = CURRENT_TIMESTAMP');
  params.push(botId);
  
  const query = `UPDATE bots SET ${setters.join(', ')} WHERE id = ?`;
  db.prepare(query).run(...params);
  
  return getBot(botId);
}

/**
 * Delete (soft delete) a bot
 */
function deleteBot(botId) {
  return db.prepare('UPDATE bots SET is_active = 0 WHERE id = ?').run(botId);
}

/**
 * Toggle bot pause state
 */
function toggleBotPause(botId, isPaused) {
  return db.prepare('UPDATE bots SET is_paused = ? WHERE id = ?').run(isPaused ? 1 : 0, botId);
}

// ============================================================================
// LLM PROVIDER OPERATIONS
// ============================================================================

/**
 * Get all LLM providers
 */
function getProviders(filters = {}) {
  let query = 'SELECT * FROM llm_providers WHERE 1=1';
  const params = [];
  
  if (filters.active !== undefined) {
    query += ' AND is_active = ?';
    params.push(filters.active ? 1 : 0);
  }
  
  if (filters.provider_type) {
    query += ' AND provider_type = ?';
    params.push(filters.provider_type);
  }
  
  query += ' ORDER BY created_at DESC';
  
  return db.prepare(query).all(...params);
}

/**
 * Get a single provider by ID
 */
function getProvider(providerId) {
  return db.prepare('SELECT * FROM llm_providers WHERE id = ?').get(providerId);
}

/**
 * Create a new LLM provider
 */
function createProvider(providerData) {
  const stmt = db.prepare(`
    INSERT INTO llm_providers (name, provider_type, api_endpoint, model_name, api_key_encrypted, config_json, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    providerData.name,
    providerData.provider_type,
    providerData.api_endpoint,
    providerData.model_name || null,
    providerData.api_key_encrypted || null,
    providerData.config_json || null,
    providerData.is_active !== undefined ? (providerData.is_active ? 1 : 0) : 1
  );
  
  return getProvider(result.lastInsertRowid);
}

/**
 * Update a provider
 */
function updateProvider(providerId, updates) {
  const allowedFields = ['name', 'provider_type', 'api_endpoint', 'model_name', 'api_key_encrypted', 'config_json', 'is_active'];
  const setters = [];
  const params = [];
  
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setters.push(`${field} = ?`);
      if (typeof updates[field] === 'boolean') {
        params.push(updates[field] ? 1 : 0);
      } else {
        params.push(updates[field]);
      }
    }
  }
  
  if (setters.length === 0) {
    return getProvider(providerId);
  }
  
  setters.push('updated_at = CURRENT_TIMESTAMP');
  params.push(providerId);
  
  const query = `UPDATE llm_providers SET ${setters.join(', ')} WHERE id = ?`;
  db.prepare(query).run(...params);
  
  return getProvider(providerId);
}

/**
 * Delete a provider
 */
function deleteProvider(providerId) {
  // Check if any bots are using this provider
  const botsCount = db.prepare('SELECT COUNT(*) as count FROM bots WHERE provider_id = ?').get(providerId);
  
  if (botsCount.count > 0) {
    throw new Error(`Cannot delete provider: ${botsCount.count} bot(s) are using it`);
  }
  
  return db.prepare('DELETE FROM llm_providers WHERE id = ?').run(providerId);
}

// ============================================================================
// WALLET OPERATIONS
// ============================================================================

/**
 * Get wallets by bot ID
 */
function getWalletsByBot(botId) {
  return db.prepare('SELECT * FROM wallets WHERE bot_id = ? AND is_active = 1').all(botId);
}

/**
 * Get a specific wallet
 */
function getWallet(walletId) {
  return db.prepare('SELECT * FROM wallets WHERE id = ?').get(walletId);
}

/**
 * Create a wallet
 */
function createWallet(walletData) {
  const stmt = db.prepare(`
    INSERT INTO wallets (bot_id, exchange, api_key_encrypted, api_secret_encrypted, wallet_address, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    walletData.bot_id,
    walletData.exchange,
    walletData.api_key_encrypted,
    walletData.api_secret_encrypted,
    walletData.wallet_address || null,
    walletData.is_active !== undefined ? (walletData.is_active ? 1 : 0) : 1
  );
  
  return getWallet(result.lastInsertRowid);
}

/**
 * Update a wallet
 */
function updateWallet(walletId, updates) {
  const allowedFields = ['exchange', 'api_key_encrypted', 'api_secret_encrypted', 'wallet_address', 'is_active'];
  const setters = [];
  const params = [];
  
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setters.push(`${field} = ?`);
      if (typeof updates[field] === 'boolean') {
        params.push(updates[field] ? 1 : 0);
      } else {
        params.push(updates[field]);
      }
    }
  }
  
  if (setters.length === 0) {
    return getWallet(walletId);
  }
  
  setters.push('updated_at = CURRENT_TIMESTAMP');
  params.push(walletId);
  
  const query = `UPDATE wallets SET ${setters.join(', ')} WHERE id = ?`;
  db.prepare(query).run(...params);
  
  return getWallet(walletId);
}

/**
 * Delete a wallet
 */
function deleteWallet(walletId) {
  return db.prepare('DELETE FROM wallets WHERE id = ?').run(walletId);
}

// ============================================================================
// STATE SNAPSHOT OPERATIONS
// ============================================================================

/**
 * Create a bot state snapshot
 */
function createSnapshot(snapshotData) {
  const stmt = db.prepare(`
    INSERT INTO bot_state_snapshots (bot_id, balance, unrealized_pnl, realized_pnl, total_value, trade_count, win_rate, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    snapshotData.bot_id,
    snapshotData.balance,
    snapshotData.unrealized_pnl,
    snapshotData.realized_pnl,
    snapshotData.total_value,
    snapshotData.trade_count,
    snapshotData.win_rate,
    snapshotData.timestamp || new Date().toISOString()
  );
}

/**
 * Get bot snapshots within a time range
 */
function getBotSnapshots(botId, startDate, endDate) {
  let query = 'SELECT * FROM bot_state_snapshots WHERE bot_id = ?';
  const params = [botId];
  
  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY timestamp ASC';
  
  return db.prepare(query).all(...params);
}

// ============================================================================
// POSITION OPERATIONS
// ============================================================================

/**
 * Get positions for a bot
 */
function getPositions(botId, status = 'open') {
  return db.prepare('SELECT * FROM positions WHERE bot_id = ? AND status = ? ORDER BY opened_at DESC').all(botId, status);
}

/**
 * Create a position
 */
function createPosition(positionData) {
  const stmt = db.prepare(`
    INSERT INTO positions (id, bot_id, symbol, position_type, entry_price, size, leverage, liquidation_price, stop_loss, take_profit, unrealized_pnl, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    positionData.id,
    positionData.bot_id,
    positionData.symbol,
    positionData.position_type,
    positionData.entry_price,
    positionData.size,
    positionData.leverage,
    positionData.liquidation_price || null,
    positionData.stop_loss || null,
    positionData.take_profit || null,
    positionData.unrealized_pnl || 0,
    positionData.status || 'open'
  );
}

/**
 * Update a position
 */
function updatePosition(positionId, updates) {
  const allowedFields = ['unrealized_pnl', 'stop_loss', 'take_profit', 'status', 'closed_at'];
  const setters = [];
  const params = [];
  
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setters.push(`${field} = ?`);
      params.push(updates[field]);
    }
  }
  
  if (setters.length === 0) {
    return;
  }
  
  params.push(positionId);
  
  const query = `UPDATE positions SET ${setters.join(', ')} WHERE id = ?`;
  db.prepare(query).run(...params);
}

/**
 * Close a position
 */
function closePosition(positionId) {
  return db.prepare('UPDATE positions SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?').run('closed', positionId);
}

// ============================================================================
// TRADE OPERATIONS
// ============================================================================

/**
 * Get trades for a bot
 */
function getTrades(botId, filters = {}) {
  let query = 'SELECT * FROM trades WHERE bot_id = ?';
  const params = [botId];
  
  if (filters.symbol) {
    query += ' AND symbol = ?';
    params.push(filters.symbol);
  }
  
  if (filters.start_date) {
    query += ' AND executed_at >= ?';
    params.push(filters.start_date);
  }
  
  if (filters.end_date) {
    query += ' AND executed_at <= ?';
    params.push(filters.end_date);
  }
  
  query += ' ORDER BY executed_at DESC';
  
  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  if (filters.offset) {
    query += ' OFFSET ?';
    params.push(filters.offset);
  }
  
  return db.prepare(query).all(...params);
}

/**
 * Create a trade
 */
function createTrade(tradeData) {
  const stmt = db.prepare(`
    INSERT INTO trades (id, bot_id, position_id, symbol, trade_type, action, entry_price, exit_price, size, leverage, pnl, fee, executed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    tradeData.id,
    tradeData.bot_id,
    tradeData.position_id || null,
    tradeData.symbol,
    tradeData.trade_type,
    tradeData.action,
    tradeData.entry_price,
    tradeData.exit_price || null,
    tradeData.size,
    tradeData.leverage,
    tradeData.pnl,
    tradeData.fee,
    tradeData.executed_at || new Date().toISOString()
  );
}

// ============================================================================
// BOT DECISION OPERATIONS
// ============================================================================

/**
 * Create a bot decision log
 */
function createDecision(decisionData) {
  const stmt = db.prepare(`
    INSERT INTO bot_decisions (bot_id, prompt_sent, decisions_json, notes_json, execution_success, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    decisionData.bot_id,
    decisionData.prompt_sent,
    JSON.stringify(decisionData.decisions),
    JSON.stringify(decisionData.notes || []),
    decisionData.execution_success ? 1 : 0,
    decisionData.timestamp || new Date().toISOString()
  );
}

/**
 * Get bot decisions
 */
function getBotDecisions(botId, limit = 50) {
  return db.prepare('SELECT * FROM bot_decisions WHERE bot_id = ? ORDER BY timestamp DESC LIMIT ?').all(botId, limit);
}

// ============================================================================
// MARKET DATA OPERATIONS
// ============================================================================

/**
 * Insert market data
 */
function insertMarketData(marketData) {
  const stmt = db.prepare(`
    INSERT INTO market_data (symbol, price, price_24h_change, volume_24h, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    marketData.symbol,
    marketData.price,
    marketData.price_24h_change,
    marketData.volume_24h || null,
    marketData.timestamp || new Date().toISOString()
  );
}

/**
 * Get latest market data
 */
function getLatestMarketData() {
  return db.prepare(`
    SELECT DISTINCT symbol, price, price_24h_change, volume_24h
    FROM market_data
    WHERE timestamp = (SELECT MAX(timestamp) FROM market_data)
  `).all();
}

// ============================================================================
// SYSTEM SETTINGS OPERATIONS
// ============================================================================

/**
 * Get all system settings
 */
function getSettings() {
  const rows = db.prepare('SELECT key, value, data_type FROM system_settings').all();
  const settings = {};
  
  for (const row of rows) {
    switch (row.data_type) {
      case 'number':
        settings[row.key] = parseFloat(row.value);
        break;
      case 'boolean':
        settings[row.key] = row.value === 'true' || row.value === '1';
        break;
      case 'json':
        settings[row.key] = JSON.parse(row.value);
        break;
      default:
        settings[row.key] = row.value;
    }
  }
  
  return settings;
}

/**
 * Get a specific setting
 */
function getSetting(key) {
  const row = db.prepare('SELECT value, data_type FROM system_settings WHERE key = ?').get(key);
  
  if (!row) return null;
  
  switch (row.data_type) {
    case 'number':
      return parseFloat(row.value);
    case 'boolean':
      return row.value === 'true' || row.value === '1';
    case 'json':
      return JSON.parse(row.value);
    default:
      return row.value;
  }
}

/**
 * Update a setting
 */
function updateSetting(key, value) {
  const row = db.prepare('SELECT data_type FROM system_settings WHERE key = ?').get(key);
  
  if (!row) {
    throw new Error(`Setting key '${key}' does not exist`);
  }
  
  let stringValue;
  switch (row.data_type) {
    case 'json':
      stringValue = JSON.stringify(value);
      break;
    default:
      stringValue = String(value);
  }
  
  return db.prepare('UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(stringValue, key);
}

// ============================================================================
// AUDIT LOG OPERATIONS
// ============================================================================

/**
 * Create an audit log entry
 */
function createAuditLog(logData) {
  const stmt = db.prepare(`
    INSERT INTO audit_log (event_type, entity_type, entity_id, user_id, details_json, ip_address, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    logData.event_type,
    logData.entity_type,
    logData.entity_id || null,
    logData.user_id || null,
    JSON.stringify(logData.details || {}),
    logData.ip_address || null,
    logData.timestamp || new Date().toISOString()
  );
}

/**
 * Get audit logs
 */
function getAuditLogs(filters = {}) {
  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  
  if (filters.event_type) {
    query += ' AND event_type = ?';
    params.push(filters.event_type);
  }
  
  if (filters.entity_type) {
    query += ' AND entity_type = ?';
    params.push(filters.entity_type);
  }
  
  if (filters.start_date) {
    query += ' AND timestamp >= ?';
    params.push(filters.start_date);
  }
  
  if (filters.end_date) {
    query += ' AND timestamp <= ?';
    params.push(filters.end_date);
  }
  
  query += ' ORDER BY timestamp DESC';
  
  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  return db.prepare(query).all(...params);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Close the database connection
 */
function closeDatabase() {
  db.close();
}

/**
 * Check if relational schema exists
 */
function hasRelationalSchema() {
  try {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bots'").get();
    return !!result;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  db,
  // Bot operations
  getBots,
  getBot,
  createBot,
  updateBot,
  deleteBot,
  toggleBotPause,
  // Provider operations
  getProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  // Wallet operations
  getWalletsByBot,
  getWallet,
  createWallet,
  updateWallet,
  deleteWallet,
  // Snapshot operations
  createSnapshot,
  getBotSnapshots,
  // Position operations
  getPositions,
  createPosition,
  updatePosition,
  closePosition,
  // Trade operations
  getTrades,
  createTrade,
  // Decision operations
  createDecision,
  getBotDecisions,
  // Market data operations
  insertMarketData,
  getLatestMarketData,
  // Settings operations
  getSettings,
  getSetting,
  updateSetting,
  // Audit log operations
  createAuditLog,
  getAuditLogs,
  // Utilities
  closeDatabase,
  hasRelationalSchema
};

