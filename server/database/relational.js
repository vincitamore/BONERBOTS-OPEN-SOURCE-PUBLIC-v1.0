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
 * @param {Object} filters - Optional filters (active, trading_mode, provider_id, user_id)
 */
function getBots(filters = {}) {
  let query = `
    SELECT b.*, lp.name as provider_name, lp.provider_type
    FROM bots b
    JOIN llm_providers lp ON b.provider_id = lp.id
    WHERE 1=1
  `;
  
  const params = [];
  
  // CRITICAL: Filter by user_id for multi-tenancy (unless admin viewing all)
  if (filters.user_id) {
    query += ' AND b.user_id = ?';
    params.push(filters.user_id);
  }
  
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
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID (optional, for ownership verification)
 */
function getBot(botId, userId = null) {
  let query = `
    SELECT b.*, lp.name as provider_name, lp.provider_type
    FROM bots b
    JOIN llm_providers lp ON b.provider_id = lp.id
    WHERE b.id = ?
  `;
  
  const params = [botId];
  
  // If userId provided, verify ownership
  if (userId) {
    query += ' AND b.user_id = ?';
    params.push(userId);
  }
  
  return db.prepare(query).get(...params);
}

/**
 * Create a new bot
 * @param {Object} botData - Bot data including user_id
 */
function createBot(botData) {
  const stmt = db.prepare(`
    INSERT INTO bots (id, user_id, name, prompt, provider_id, trading_mode, is_active, is_paused, avatar_image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    botData.id,
    botData.user_id, // CRITICAL: Must provide user_id
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
 * @param {string} botId - Bot ID
 * @param {Object} updates - Fields to update
 * @param {string} userId - User ID (for ownership verification)
 */
function updateBot(botId, updates, userId = null) {
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
    return getBot(botId, userId);
  }
  
  setters.push('updated_at = CURRENT_TIMESTAMP');
  params.push(botId);
  
  let query = `UPDATE bots SET ${setters.join(', ')} WHERE id = ?`;
  
  // If userId provided, verify ownership
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  db.prepare(query).run(...params);
  
  return getBot(botId, userId);
}

/**
 * Delete (soft delete) a bot
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID (for ownership verification)
 */
function deleteBot(botId, userId = null) {
  let query = 'UPDATE bots SET is_active = 0 WHERE id = ?';
  const params = [botId];
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  return db.prepare(query).run(...params);
}

/**
 * Toggle bot pause state
 * @param {string} botId - Bot ID
 * @param {boolean} isPaused - Pause state
 * @param {string} userId - User ID (for ownership verification)
 */
function toggleBotPause(botId, isPaused, userId = null) {
  let query = 'UPDATE bots SET is_paused = ? WHERE id = ?';
  const params = [isPaused ? 1 : 0, botId];
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  return db.prepare(query).run(...params);
}

// ============================================================================
// LLM PROVIDER OPERATIONS
// ============================================================================

/**
 * Get all LLM providers
 * @param {Object} filters - Optional filters (active, provider_type, user_id)
 */
function getProviders(filters = {}) {
  let query = 'SELECT * FROM llm_providers WHERE 1=1';
  const params = [];
  
  // CRITICAL: Filter by user_id for multi-tenancy
  if (filters.user_id) {
    query += ' AND user_id = ?';
    params.push(filters.user_id);
  }
  
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
 * @param {number} providerId - Provider ID
 * @param {string} userId - User ID (for ownership verification)
 */
function getProvider(providerId, userId = null) {
  let query = 'SELECT * FROM llm_providers WHERE id = ?';
  const params = [providerId];
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  return db.prepare(query).get(...params);
}

/**
 * Create a new LLM provider
 * @param {Object} providerData - Provider data including user_id
 */
function createProvider(providerData) {
  const stmt = db.prepare(`
    INSERT INTO llm_providers (user_id, name, provider_type, api_endpoint, model_name, api_key_encrypted, config_json, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    providerData.user_id, // CRITICAL: Must provide user_id
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
 * @param {number} providerId - Provider ID
 * @param {Object} updates - Fields to update
 * @param {string} userId - User ID (for ownership verification)
 */
function updateProvider(providerId, updates, userId = null) {
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
    return getProvider(providerId, userId);
  }
  
  setters.push('updated_at = CURRENT_TIMESTAMP');
  params.push(providerId);
  
  let query = `UPDATE llm_providers SET ${setters.join(', ')} WHERE id = ?`;
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  db.prepare(query).run(...params);
  
  return getProvider(providerId, userId);
}

/**
 * Delete a provider
 * @param {number} providerId - Provider ID
 * @param {string} userId - User ID (for ownership verification)
 */
function deleteProvider(providerId, userId = null) {
  // Check if any bots are using this provider
  let checkQuery = 'SELECT COUNT(*) as count FROM bots WHERE provider_id = ?';
  const checkParams = [providerId];
  
  if (userId) {
    checkQuery += ' AND user_id = ?';
    checkParams.push(userId);
  }
  
  const botsCount = db.prepare(checkQuery).get(...checkParams);
  
  if (botsCount.count > 0) {
    throw new Error(`Cannot delete provider: ${botsCount.count} bot(s) are using it`);
  }
  
  let deleteQuery = 'DELETE FROM llm_providers WHERE id = ?';
  const deleteParams = [providerId];
  
  if (userId) {
    deleteQuery += ' AND user_id = ?';
    deleteParams.push(userId);
  }
  
  return db.prepare(deleteQuery).run(...deleteParams);
}

// ============================================================================
// WALLET OPERATIONS
// ============================================================================

/**
 * Get wallets by bot ID
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID (for ownership verification)
 */
function getWalletsByBot(botId, userId = null) {
  let query = 'SELECT * FROM wallets WHERE bot_id = ? AND is_active = 1';
  const params = [botId];
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  return db.prepare(query).all(...params);
}

/**
 * Get a specific wallet
 * @param {number} walletId - Wallet ID
 * @param {string} userId - User ID (for ownership verification)
 */
function getWallet(walletId, userId = null) {
  let query = 'SELECT * FROM wallets WHERE id = ?';
  const params = [walletId];
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  return db.prepare(query).get(...params);
}

/**
 * Create a wallet
 * @param {Object} walletData - Wallet data including user_id
 */
function createWallet(walletData) {
  const stmt = db.prepare(`
    INSERT INTO wallets (user_id, bot_id, exchange, api_key_encrypted, api_secret_encrypted, wallet_address, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    walletData.user_id, // CRITICAL: Must provide user_id
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
 * @param {number} walletId - Wallet ID
 * @param {Object} updates - Fields to update
 * @param {string} userId - User ID (for ownership verification)
 */
function updateWallet(walletId, updates, userId = null) {
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
    return getWallet(walletId, userId);
  }
  
  setters.push('updated_at = CURRENT_TIMESTAMP');
  params.push(walletId);
  
  let query = `UPDATE wallets SET ${setters.join(', ')} WHERE id = ?`;
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  db.prepare(query).run(...params);
  
  return getWallet(walletId, userId);
}

/**
 * Delete a wallet
 * @param {number} walletId - Wallet ID
 * @param {string} userId - User ID (for ownership verification)
 */
function deleteWallet(walletId, userId = null) {
  let query = 'DELETE FROM wallets WHERE id = ?';
  const params = [walletId];
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  return db.prepare(query).run(...params);
}

// ============================================================================
// STATE SNAPSHOT OPERATIONS
// ============================================================================

/**
 * Create a bot state snapshot
 * @param {Object} snapshotData - Snapshot data including user_id
 */
function createSnapshot(snapshotData) {
  const stmt = db.prepare(`
    INSERT INTO bot_state_snapshots (user_id, bot_id, balance, unrealized_pnl, realized_pnl, total_value, trade_count, win_rate, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    snapshotData.user_id, // CRITICAL: Must provide user_id
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
 * @param {string} botId - Bot ID
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @param {string} userId - User ID (for ownership verification)
 */
function getBotSnapshots(botId, startDate, endDate, userId = null) {
  let query = 'SELECT * FROM bot_state_snapshots WHERE bot_id = ?';
  const params = [botId];
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
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
 * @param {string} botId - Bot ID
 * @param {string} status - Position status
 * @param {string} userId - User ID (for ownership verification)
 */
function getPositions(botId, status = 'open', userId = null) {
  let query = 'SELECT * FROM positions WHERE bot_id = ? AND status = ?';
  const params = [botId, status];
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  query += ' ORDER BY opened_at DESC';
  
  return db.prepare(query).all(...params);
}

/**
 * Create a position
 * @param {Object} positionData - Position data including user_id
 */
function createPosition(positionData) {
  const stmt = db.prepare(`
    INSERT INTO positions (id, user_id, bot_id, symbol, position_type, entry_price, size, leverage, liquidation_price, stop_loss, take_profit, unrealized_pnl, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    positionData.id,
    positionData.user_id, // CRITICAL: Must provide user_id
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
 * @param {string} positionId - Position ID
 * @param {Object} updates - Fields to update
 * @param {string} userId - User ID (for ownership verification)
 */
function updatePosition(positionId, updates, userId = null) {
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
  
  let query = `UPDATE positions SET ${setters.join(', ')} WHERE id = ?`;
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  db.prepare(query).run(...params);
}

/**
 * Close a position
 * @param {string} positionId - Position ID
 * @param {string} userId - User ID (for ownership verification)
 */
function closePosition(positionId, userId = null) {
  let query = 'UPDATE positions SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?';
  const params = ['closed', positionId];
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  return db.prepare(query).run(...params);
}

// ============================================================================
// TRADE OPERATIONS
// ============================================================================

/**
 * Get trades for a bot
 * @param {string} botId - Bot ID
 * @param {Object} filters - Optional filters (symbol, start_date, end_date, limit, offset, user_id)
 */
function getTrades(botId, filters = {}) {
  let query = 'SELECT * FROM trades WHERE bot_id = ?';
  const params = [botId];
  
  if (filters.user_id) {
    query += ' AND user_id = ?';
    params.push(filters.user_id);
  }
  
  if (filters.action) {
    query += ' AND action = ?';
    params.push(filters.action);
  }
  
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
 * @param {Object} tradeData - Trade data including user_id
 */
function createTrade(tradeData) {
  const stmt = db.prepare(`
    INSERT INTO trades (id, user_id, bot_id, position_id, symbol, trade_type, action, entry_price, exit_price, size, leverage, pnl, fee, executed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    tradeData.id,
    tradeData.user_id, // CRITICAL: Must provide user_id
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
 * @param {Object} decisionData - Decision data including user_id
 */
function createDecision(decisionData) {
  const stmt = db.prepare(`
    INSERT INTO bot_decisions (user_id, bot_id, prompt_sent, decisions_json, notes_json, execution_success, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    decisionData.user_id, // CRITICAL: Must provide user_id
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
 * @param {string} botId - Bot ID
 * @param {number} limit - Max number of decisions to return
 * @param {string} userId - User ID (for ownership verification)
 */
function getBotDecisions(botId, limit = 50, userId = null) {
  let query = 'SELECT * FROM bot_decisions WHERE bot_id = ?';
  const params = [botId];
  
  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);
  
  return db.prepare(query).all(...params);
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
    INSERT INTO audit_log (action, resource_type, resource_id, user_id, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    logData.event_type || logData.action,
    logData.entity_type || logData.resource_type,
    logData.entity_id || logData.resource_id || null,
    logData.user_id || null,
    JSON.stringify(logData.details || {}),
    logData.ip_address || null,
    logData.timestamp || logData.created_at || new Date().toISOString()
  );
}

/**
 * Get audit logs
 */
function getAuditLogs(filters = {}) {
  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  
  if (filters.event_type || filters.action) {
    query += ' AND action = ?';
    params.push(filters.event_type || filters.action);
  }
  
  if (filters.entity_type || filters.resource_type) {
    query += ' AND resource_type = ?';
    params.push(filters.entity_type || filters.resource_type);
  }
  
  if (filters.start_date) {
    query += ' AND created_at >= ?';
    params.push(filters.start_date);
  }
  
  if (filters.end_date) {
    query += ' AND created_at <= ?';
    params.push(filters.end_date);
  }
  
  query += ' ORDER BY created_at DESC';
  
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
  hasRelationalSchema,
  // Direct database access for custom queries
  prepare: (sql) => db.prepare(sql)
};

