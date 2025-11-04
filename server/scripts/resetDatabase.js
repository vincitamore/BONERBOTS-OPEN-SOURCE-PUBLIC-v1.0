/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Database reset script
 * WARNING: This will delete all existing data and reset to default state
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'arena.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n⚠️  WARNING: DATABASE RESET\n');
console.log('This will permanently delete all arena data including:');
console.log('  - Bot states');
console.log('  - Trading history');
console.log('  - Performance data');
console.log('  - Market snapshots\n');

rl.question('Are you sure you want to reset the database? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    try {
      // Delete the database file
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log('\n✓ Database file deleted');
      } else {
        console.log('\n✓ No database file found');
      }
      
      // Reinitialize
      console.log('✓ Recreating database...');
      const { initializeArenaState, closeDatabase } = require('../database');
      
      const defaultState = { 
        bots: [], 
        marketData: [] 
      };
      
      initializeArenaState(defaultState);
      console.log('✓ Database reset complete\n');
      
      closeDatabase();
    } catch (error) {
      console.error('\n❌ Reset failed:', error.message);
      process.exit(1);
    }
  } else {
    console.log('\n✓ Reset cancelled\n');
  }
  
  rl.close();
  process.exit(0);
});
