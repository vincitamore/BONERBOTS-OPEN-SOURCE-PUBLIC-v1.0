/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Migration Script: Transform JSON blob to relational database
 * 
 * This script:
 * 1. Creates a backup of the current database
 * 2. Reads existing arena_state JSON blob
 * 3. Creates new relational schema
 * 4. Transforms and inserts data into new tables
 * 5. Verifies data integrity
 */

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'arena.db');
const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'backups');
const MIGRATION_SQL = path.join(__dirname, '..', 'migrations', '002_relational_schema.sql');

function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function createBackup() {
  log('Step 1: Creating backup...');
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const backupPath = path.join(BACKUP_DIR, `arena_backup_${timestamp}.db`);
  
  fs.copyFileSync(DB_PATH, backupPath);
  log(`Backup created: ${backupPath}`);
  
  return backupPath;
}

function readOldState(db) {
  log('Step 2: Reading existing data...');
  
  try {
    const oldStateRow = db.prepare('SELECT state FROM arena_state WHERE id = 1').get();
    
    if (!oldStateRow || !oldStateRow.state) {
      log('No existing state found, starting with empty state');
      return { bots: [], marketData: [] };
    }
    
    const oldState = JSON.parse(oldStateRow.state);
    log(`Found ${oldState.bots?.length || 0} bots and ${oldState.marketData?.length || 0} market data points`);
    
    return oldState;
  } catch (error) {
    log(`Error reading old state: ${error.message}`, true);
    throw error;
  }
}

function createNewSchema(db) {
  log('Step 3: Creating new relational schema...');
  
  try {
    const migrationSQL = fs.readFileSync(MIGRATION_SQL, 'utf8');
    db.exec(migrationSQL);
    log('New schema created successfully');
  } catch (error) {
    log(`Error creating new schema: ${error.message}`, true);
    throw error;
  }
}

function getProviderIdFromType(providerType) {
  // Map provider types to IDs (matching the seeded data)
  const providerMap = {
    'gemini': 1,
    'grok': 2
  };
  return providerMap[providerType] || 1;
}

function transformAndInsertData(db, oldState) {
  log('Step 4: Transforming and inserting data...');
  
  if (!oldState.bots || oldState.bots.length === 0) {
    log('No bots to migrate');
    return;
  }
  
  const insertBot = db.prepare(`
    INSERT OR REPLACE INTO bots (id, name, prompt, provider_id, trading_mode, is_paused)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const insertSnapshot = db.prepare(`
    INSERT INTO bot_state_snapshots 
    (user_id, bot_id, balance, unrealized_pnl, realized_pnl, total_value, trade_count, win_rate, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertPosition = db.prepare(`
    INSERT OR REPLACE INTO positions 
    (id, user_id, bot_id, symbol, position_type, entry_price, size, leverage, liquidation_price, stop_loss, take_profit, unrealized_pnl, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertTrade = db.prepare(`
    INSERT OR REPLACE INTO trades 
    (id, user_id, bot_id, position_id, symbol, trade_type, action, entry_price, exit_price, size, leverage, pnl, fee, executed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertDecision = db.prepare(`
    INSERT INTO bot_decisions 
    (user_id, bot_id, prompt_sent, decisions_json, notes_json, execution_success, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const bot of oldState.bots) {
    try {
      // Insert bot
      const providerId = getProviderIdFromType(bot.provider);
      insertBot.run(
        bot.id,
        bot.name,
        bot.prompt,
        providerId,
        bot.tradingMode || 'paper',
        bot.isPaused ? 1 : 0
      );
      
      log(`  Migrated bot: ${bot.name} (${bot.id})`);
      
      // Insert value history as snapshots
      if (bot.valueHistory && bot.valueHistory.length > 0) {
        for (const point of bot.valueHistory) {
          insertSnapshot.run(
            bot.userId, // user_id
            bot.id,
            bot.portfolio?.balance || 0,
            bot.portfolio?.pnl || 0,
            bot.realizedPnl || 0,
            point.value,
            bot.tradeCount || 0,
            bot.winRate || 0,
            new Date(point.timestamp).toISOString()
          );
        }
        log(`    - Migrated ${bot.valueHistory.length} value history points`);
      }
      
      // Insert positions
      if (bot.portfolio?.positions && bot.portfolio.positions.length > 0) {
        for (const pos of bot.portfolio.positions) {
          insertPosition.run(
            pos.id,
            bot.userId, // user_id
            bot.id,
            pos.symbol,
            pos.type,
            pos.entryPrice,
            pos.size,
            pos.leverage,
            pos.liquidationPrice || null,
            pos.stopLoss || null,
            pos.takeProfit || null,
            pos.pnl || 0,
            'open'
          );
        }
        log(`    - Migrated ${bot.portfolio.positions.length} open positions`);
      }
      
      // Insert trades
      // bot.orders contains both entry and exit trades
      // We need to determine which is which based on the data structure
      if (bot.orders && bot.orders.length > 0) {
        for (const trade of bot.orders) {
          // Determine if this is an entry or exit trade
          // Entry trades typically have only entryPrice, exit trades have both entry and exit
          const isExitTrade = trade.exitPrice !== undefined && trade.exitPrice !== null && trade.exitPrice > 0;
          const action = isExitTrade ? 'CLOSE' : 'OPEN';
          
          // Try to find matching position ID if this trade references a position
          // For now, use null - position_id can be linked later if needed
          const positionId = null;
          
          insertTrade.run(
            trade.id,
            bot.userId, // user_id
            bot.id,
            positionId, // position_id - null for historical data
            trade.symbol,
            trade.type, // trade_type (LONG or SHORT)
            action, // action (OPEN or CLOSE)
            trade.entryPrice || trade.price || 0,
            trade.exitPrice || null,
            trade.size,
            trade.leverage || 1,
            trade.pnl || 0,
            trade.fee || 0,
            new Date(trade.timestamp).toISOString()
          );
        }
        log(`    - Migrated ${bot.orders.length} trade records`);
      }
      
      // Insert bot decisions/logs
      if (bot.botLogs && bot.botLogs.length > 0) {
        for (const logEntry of bot.botLogs) {
          insertDecision.run(
            bot.userId, // user_id
            bot.id,
            logEntry.prompt || '',
            JSON.stringify(logEntry.decisions || []),
            JSON.stringify(logEntry.notes || []),
            1, // Assume success if it's logged
            new Date(logEntry.timestamp).toISOString()
          );
        }
        log(`    - Migrated ${bot.botLogs.length} decision logs`);
      }
      
    } catch (error) {
      log(`  Error migrating bot ${bot.name}: ${error.message}`, true);
      throw error;
    }
  }
  
  // Insert market data if available
  if (oldState.marketData && oldState.marketData.length > 0) {
    const insertMarket = db.prepare(`
      INSERT INTO market_data (symbol, price, price_24h_change, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    
    for (const market of oldState.marketData) {
      insertMarket.run(
        market.symbol,
        market.price,
        market.price24hChange || 0,
        new Date().toISOString()
      );
    }
    log(`Migrated ${oldState.marketData.length} market data points`);
  }
  
  log('Data transformation complete');
}

function verifyMigration(db, oldState) {
  log('Step 5: Verifying migration...');
  
  try {
    // Verify bot count
    const newBotCount = db.prepare('SELECT COUNT(*) as count FROM bots').get().count;
    const oldBotCount = oldState.bots?.length || 0;
    
    if (newBotCount !== oldBotCount) {
      throw new Error(`Bot count mismatch: expected ${oldBotCount}, got ${newBotCount}`);
    }
    
    log(`Bot count verified: ${newBotCount} bots`);
    
    // Verify tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
    
    const requiredTables = [
      'bots', 'llm_providers', 'wallets', 'bot_state_snapshots',
      'positions', 'trades', 'bot_decisions', 'market_data',
      'system_settings', 'audit_log', 'users'
    ];
    
    const existingTables = tables.map(t => t.name);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    }
    
    log(`All ${requiredTables.length} tables verified`);
    
    // Verify system settings
    const settingsCount = db.prepare('SELECT COUNT(*) as count FROM system_settings').get().count;
    if (settingsCount === 0) {
      throw new Error('System settings not seeded');
    }
    log(`System settings verified: ${settingsCount} settings`);
    
    // Verify providers
    const providersCount = db.prepare('SELECT COUNT(*) as count FROM llm_providers').get().count;
    if (providersCount === 0) {
      throw new Error('LLM providers not seeded');
    }
    log(`LLM providers verified: ${providersCount} providers`);
    
    // Verify trade counts match
    const totalTradesInDb = db.prepare('SELECT COUNT(*) as count FROM trades').get().count;
    let expectedTradeCount = 0;
    if (oldState.bots) {
      for (const bot of oldState.bots) {
        expectedTradeCount += bot.orders?.length || 0;
      }
    }
    if (totalTradesInDb !== expectedTradeCount) {
      throw new Error(`Trade count mismatch: expected ${expectedTradeCount}, got ${totalTradesInDb}`);
    }
    log(`Trade count verified: ${totalTradesInDb} trades migrated`);
    
    // Verify position counts match
    const totalPositionsInDb = db.prepare('SELECT COUNT(*) as count FROM positions').get().count;
    let expectedPositionCount = 0;
    if (oldState.bots) {
      for (const bot of oldState.bots) {
        expectedPositionCount += bot.portfolio?.positions?.length || 0;
      }
    }
    if (totalPositionsInDb !== expectedPositionCount) {
      throw new Error(`Position count mismatch: expected ${expectedPositionCount}, got ${totalPositionsInDb}`);
    }
    log(`Position count verified: ${totalPositionsInDb} positions migrated`);
    
    // Verify decision counts match
    const totalDecisionsInDb = db.prepare('SELECT COUNT(*) as count FROM bot_decisions').get().count;
    let expectedDecisionCount = 0;
    if (oldState.bots) {
      for (const bot of oldState.bots) {
        expectedDecisionCount += bot.botLogs?.length || 0;
      }
    }
    if (totalDecisionsInDb !== expectedDecisionCount) {
      throw new Error(`Decision count mismatch: expected ${expectedDecisionCount}, got ${totalDecisionsInDb}`);
    }
    log(`Decision count verified: ${totalDecisionsInDb} decisions migrated`);
    
    // Verify user_id is set on all records
    const tradesWithoutUserId = db.prepare('SELECT COUNT(*) as count FROM trades WHERE user_id IS NULL').get().count;
    if (tradesWithoutUserId > 0) {
      throw new Error(`${tradesWithoutUserId} trades are missing user_id`);
    }
    
    const positionsWithoutUserId = db.prepare('SELECT COUNT(*) as count FROM positions WHERE user_id IS NULL').get().count;
    if (positionsWithoutUserId > 0) {
      throw new Error(`${positionsWithoutUserId} positions are missing user_id`);
    }
    
    const decisionsWithoutUserId = db.prepare('SELECT COUNT(*) as count FROM bot_decisions WHERE user_id IS NULL').get().count;
    if (decisionsWithoutUserId > 0) {
      throw new Error(`${decisionsWithoutUserId} decisions are missing user_id`);
    }
    
    log('✓ All user_id foreign keys verified');
    log('✓ Verification passed - Migration successful!');
    
  } catch (error) {
    log(`Verification failed: ${error.message}`, true);
    throw error;
  }
}

async function migrate() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  BONERBOTS AI Arena - Database Migration to Relational');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let db;
  let backupPath;
  
  try {
    // Create backup
    backupPath = createBackup();
    
    // Open database
    db = new Database(DB_PATH);
    
    // Read old state
    const oldState = readOldState(db);
    
    // Create new schema
    createNewSchema(db);
    
    // Transform and insert data
    transformAndInsertData(db, oldState);
    
    // Verify migration
    verifyMigration(db, oldState);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✓ Migration Complete!');
    console.log(`  Backup: ${backupPath}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('  ❌ Migration Failed!');
    console.error(`  Error: ${error.message}`);
    console.error(`  Backup: ${backupPath}`);
    console.error('  Run rollback script to restore from backup');
    console.error('═══════════════════════════════════════════════════════════\n');
    
    if (db) db.close();
    process.exit(1);
  }
  
  if (db) db.close();
}

// Run migration
migrate().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

