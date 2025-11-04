/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get database path from environment or use default
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'arena.db');

// Ensure the database directory exists
const dbDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database connection
const db = new Database(DATABASE_PATH);

// Enable JSON1 extension (should be compiled in by default in modern builds)
db.pragma('journal_mode = WAL'); // Use Write-Ahead Logging for better concurrency

/**
 * Initialize the database schema
 */
function initializeSchema() {
  const schemaPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
  
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('Database schema initialized successfully');
  } else {
    // Fallback: Create schema directly if migration file doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS arena_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database schema created with fallback method');
  }
}

/**
 * Get the current arena state
 * @returns {Object|null} The arena state or null if not found
 */
function getArenaState() {
  try {
    const row = db.prepare('SELECT state, updated_at FROM arena_state WHERE id = 1').get();
    
    if (!row) {
      return null;
    }
    
    return {
      state: JSON.parse(row.state),
      updated_at: row.updated_at
    };
  } catch (error) {
    console.error('Error getting arena state:', error);
    throw error;
  }
}

/**
 * Update the arena state
 * @param {Object} state - The new state object
 * @returns {boolean} True if successful
 */
function updateArenaState(state) {
  try {
    const stateJson = JSON.stringify(state);
    const timestamp = new Date().toISOString();
    
    // Use INSERT OR REPLACE to handle both insert and update
    const stmt = db.prepare(`
      INSERT INTO arena_state (id, state, updated_at) 
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        state = excluded.state,
        updated_at = excluded.updated_at
    `);
    
    stmt.run(stateJson, timestamp);
    return true;
  } catch (error) {
    console.error('Error updating arena state:', error);
    throw error;
  }
}

/**
 * Initialize arena state with default values if it doesn't exist
 * @param {Object} defaultState - The default state object
 * @returns {boolean} True if initialized, false if already exists
 */
function initializeArenaState(defaultState) {
  try {
    const existing = getArenaState();
    
    if (existing) {
      console.log('Arena state already exists, skipping initialization');
      return false;
    }
    
    updateArenaState(defaultState);
    console.log('Arena state initialized with default values');
    return true;
  } catch (error) {
    console.error('Error initializing arena state:', error);
    throw error;
  }
}

/**
 * Close the database connection
 */
function closeDatabase() {
  db.close();
}

// Initialize schema on module load
initializeSchema();

module.exports = {
  db,
  getArenaState,
  updateArenaState,
  initializeArenaState,
  closeDatabase
};
