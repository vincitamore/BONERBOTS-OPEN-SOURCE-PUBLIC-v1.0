/**
 * Extract Data from arena_state JSON to Relational Tables
 * 
 * This script ONLY extracts and inserts data. It assumes the relational
 * schema already exists with user_id columns.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'arena.db');

function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, '..', '..', 'data', 'backups', `arena_backup_${timestamp}.db`);
  
  fs.copyFileSync(DB_PATH, backupPath);
  log(`Backup created: ${backupPath}`);
  return backupPath;
}

function extractData() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Extract Data from arena_state to Relational Tables');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let db;
  let backupPath;
  
  try {
    // Create backup first
    log('Creating backup...');
    backupPath = createBackup();
    
    // Open database
    console.log('Opening database:', DB_PATH);
    db = new Database(DB_PATH);
    
    // Ensure we're not in read-only mode
    db.pragma('journal_mode = WAL');
    
    // Read arena_state
    log('Reading arena_state...');
    const arenaStateRow = db.prepare('SELECT * FROM arena_state LIMIT 1').get();
    
    if (!arenaStateRow) {
      throw new Error('No arena_state record found');
    }
    
    const state = JSON.parse(arenaStateRow.state);
    log(`Found ${state.bots?.length || 0} bots with data to extract`);
    
    // Clear existing data from tables
    log('\nClearing existing data from relational tables...');
    db.prepare('DELETE FROM bot_decisions').run();
    db.prepare('DELETE FROM trades').run();
    db.prepare('DELETE FROM positions').run();
    log('Tables cleared');
    
    // Prepare INSERT statements
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
    
    // Track counts
    let totalPositions = 0;
    let totalTrades = 0;
    let totalDecisions = 0;
    
    // Process each bot
    log('\nExtracting data from each bot...');
    
    const transaction = db.transaction((bots) => {
      for (const bot of bots) {
        try {
          const userId = bot.userId || bot.user_id;
          
          if (!userId) {
            log(`  Warning: Bot ${bot.name} (${bot.id}) has no user_id, skipping...`, true);
            continue;
          }
          
          log(`  Processing bot: ${bot.name} (${bot.id})`);
          
          // Extract positions
          if (bot.portfolio?.positions && bot.portfolio.positions.length > 0) {
            for (const pos of bot.portfolio.positions) {
              insertPosition.run(
                pos.id,
                userId,
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
              totalPositions++;
            }
            log(`    - Extracted ${bot.portfolio.positions.length} positions`);
          }
          
          // Extract trades
          if (bot.orders && bot.orders.length > 0) {
            for (const trade of bot.orders) {
              // Determine if this is an entry or exit trade
              const isExitTrade = trade.exitPrice !== undefined && trade.exitPrice !== null && trade.exitPrice > 0;
              const action = isExitTrade ? 'CLOSE' : 'OPEN';
              
              insertTrade.run(
                trade.id,
                userId,
                bot.id,
                null, // position_id - we don't have mapping for historical data
                trade.symbol,
                trade.type, // trade_type (LONG or SHORT)
                action,
                trade.entryPrice || trade.price || 0,
                trade.exitPrice || null,
                trade.size,
                trade.leverage || 1,
                trade.pnl || 0,
                trade.fee || 0,
                new Date(trade.timestamp).toISOString()
              );
              totalTrades++;
            }
            log(`    - Extracted ${bot.orders.length} trades`);
          }
          
          // Extract decision logs
          if (bot.botLogs && bot.botLogs.length > 0) {
            for (const logEntry of bot.botLogs) {
              insertDecision.run(
                userId,
                bot.id,
                logEntry.prompt || '',
                JSON.stringify(logEntry.decisions || []),
                JSON.stringify(logEntry.notes || []),
                1, // Assume success if it's logged
                new Date(logEntry.timestamp).toISOString()
              );
              totalDecisions++;
            }
            log(`    - Extracted ${bot.botLogs.length} decisions`);
          }
          
        } catch (error) {
          log(`  Error processing bot ${bot.name}: ${error.message}`, true);
          throw error;
        }
      }
    });
    
    // Run the transaction
    log('\nExecuting transaction...');
    transaction(state.bots || []);
    log('Transaction completed');
    
    // Force a checkpoint to ensure WAL is written
    db.pragma('wal_checkpoint(TRUNCATE)');
    log('WAL checkpoint completed');
    
    // Verify
    log('\nVerifying extraction...');
    const posCount = db.prepare('SELECT COUNT(*) as count FROM positions').get().count;
    const tradeCount = db.prepare('SELECT COUNT(*) as count FROM trades').get().count;
    const decisionCount = db.prepare('SELECT COUNT(*) as count FROM bot_decisions').get().count;
    
    log(`  Positions in database: ${posCount} (expected ${totalPositions})`);
    log(`  Trades in database: ${tradeCount} (expected ${totalTrades})`);
    log(`  Decisions in database: ${decisionCount} (expected ${totalDecisions})`);
    
    if (posCount !== totalPositions) {
      throw new Error(`Position count mismatch: expected ${totalPositions}, got ${posCount}`);
    }
    if (tradeCount !== totalTrades) {
      throw new Error(`Trade count mismatch: expected ${totalTrades}, got ${tradeCount}`);
    }
    if (decisionCount !== totalDecisions) {
      throw new Error(`Decision count mismatch: expected ${totalDecisions}, got ${decisionCount}`);
    }
    
    // Close database
    db.close();
    log('Database connection closed');
    
    // Reopen and verify persistence
    log('\nReopening database to verify persistence...');
    db = new Database(DB_PATH, { readonly: true });
    const finalPosCount = db.prepare('SELECT COUNT(*) as count FROM positions').get().count;
    const finalTradeCount = db.prepare('SELECT COUNT(*) as count FROM trades').get().count;
    const finalDecisionCount = db.prepare('SELECT COUNT(*) as count FROM bot_decisions').get().count;
    
    log(`  Positions after reopen: ${finalPosCount}`);
    log(`  Trades after reopen: ${finalTradeCount}`);
    log(`  Decisions after reopen: ${finalDecisionCount}`);
    
    if (finalPosCount !== totalPositions || finalTradeCount !== totalTrades || finalDecisionCount !== totalDecisions) {
      throw new Error('Data verification failed after reopening database - data did not persist!');
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✓ Data Extraction Complete!');
    console.log(`  Backup: ${backupPath}`);
    console.log(`  Extracted: ${totalPositions} positions, ${totalTrades} trades, ${totalDecisions} decisions`);
    console.log('  ✓ Data persistence verified across database connections');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('  ❌ Data Extraction Failed!');
    console.error(`  Error: ${error.message}`);
    if (backupPath) {
      console.error(`  Backup available at: ${backupPath}`);
      console.error('  Run rollback script to restore if needed');
    }
    console.error('═══════════════════════════════════════════════════════════\n');
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run extraction
extractData();

