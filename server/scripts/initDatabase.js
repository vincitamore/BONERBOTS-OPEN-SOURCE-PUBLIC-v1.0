/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Database initialization script
 * Run this to set up the database and ensure it's ready for use
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { db, initializeArenaState, closeDatabase } = require('../database');

console.log('\n🔧 Initializing BONERBOTS Arena Database...\n');

try {
  // Check if database file exists
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'arena.db');
  const dbExists = fs.existsSync(dbPath);
  
  if (dbExists) {
    console.log(`✓ Database file found at: ${dbPath}`);
  } else {
    console.log(`✓ Creating new database at: ${dbPath}`);
  }
  
  // Initialize with default state if needed
  const defaultState = { 
    bots: [], 
    marketData: [] 
  };
  
  const wasInitialized = initializeArenaState(defaultState);
  
  if (wasInitialized) {
    console.log('✓ Database initialized with default state');
  } else {
    console.log('✓ Database already contains state data');
  }
  
  // Verify the database is working
  const { getArenaState } = require('../database');
  const state = getArenaState();
  
  if (state) {
    console.log('✓ Database verification successful');
    console.log(`  - Bots: ${state.state.bots?.length || 0}`);
    console.log(`  - Last updated: ${state.updated_at || 'Never'}`);
  }
  
  console.log('\n✅ Database initialization complete!\n');
  
} catch (error) {
  console.error('\n❌ Database initialization failed:');
  console.error(error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
} finally {
  closeDatabase();
}
