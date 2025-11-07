/**
 * Reset all bots to clear stale trade data and start fresh
 * This properly clears both database tables AND bot in-memory state
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
const db = new Database(dbPath);

try {
  console.log('🔄 Resetting all paper trading bots to clear stale data...\n');
  
  // Get all paper trading bots
  const paperBots = db.prepare(`
    SELECT id, name, trading_mode, user_id
    FROM bots
    WHERE trading_mode = 'paper' AND is_active = 1
  `).all();
  
  if (paperBots.length === 0) {
    console.log('No paper trading bots found.');
    db.close();
    process.exit(0);
  }
  
  console.log(`Found ${paperBots.length} paper trading bot(s):\n`);
  paperBots.forEach(bot => {
    console.log(`  - ${bot.name} (${bot.id})`);
  });
  
  console.log('\n⚠️  This will:');
  console.log('  1. Delete all trades, positions, decisions, snapshots, leaderboard, and performance history');
  console.log('  2. Reset bot balance to initial amount ($10,000)');
  console.log('  3. Preserve learning history (history_summary)');
  console.log('  4. Clear in-memory bot state on next server restart\n');
  
  // Get settings for initial balance
  const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'paper_bot_initial_balance'").get();
  const initialBalance = setting ? parseFloat(setting.value) : 10000;
  
  console.log(`Initial balance will be set to: $${initialBalance}\n`);
  console.log('Proceeding with reset...\n');
  
  // Reset each bot
  for (const bot of paperBots) {
    console.log(`Resetting ${bot.name}...`);
    
    // 1. Delete all positions
    const posResult = db.prepare('DELETE FROM positions WHERE bot_id = ?').run(bot.id);
    console.log(`  ✓ Deleted ${posResult.changes} positions`);
    
    // 2. Delete all trades  
    const tradesResult = db.prepare('DELETE FROM trades WHERE bot_id = ?').run(bot.id);
    console.log(`  ✓ Deleted ${tradesResult.changes} trades`);
    
    // 3. Delete all bot decisions
    const decisionsResult = db.prepare('DELETE FROM bot_decisions WHERE bot_id = ?').run(bot.id);
    console.log(`  ✓ Deleted ${decisionsResult.changes} decisions`);
    
    // 4. Delete all snapshots
    const snapshotsResult = db.prepare('DELETE FROM bot_state_snapshots WHERE bot_id = ?').run(bot.id);
    console.log(`  ✓ Deleted ${snapshotsResult.changes} snapshots`);
    
    // 5. Delete leaderboard entries
    const leaderboardResult = db.prepare('DELETE FROM leaderboard WHERE bot_id = ?').run(bot.id);
    console.log(`  ✓ Deleted ${leaderboardResult.changes} leaderboard entries`);
    
    // 6. Delete performance history
    const perfHistoryResult = db.prepare('DELETE FROM bot_performance_history WHERE bot_id = ?').run(bot.id);
    console.log(`  ✓ Deleted ${perfHistoryResult.changes} performance history records`);
    
    // 7. Create fresh initial snapshot
    db.prepare(`
      INSERT INTO bot_state_snapshots (
        user_id, bot_id, balance, total_value, realized_pnl, 
        unrealized_pnl, trade_count, win_rate, timestamp
      ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, datetime('now'))
    `).run(bot.user_id, bot.id, initialBalance, initialBalance);
    console.log(`  ✓ Created fresh snapshot with $${initialBalance} balance`);
    
    console.log(`  ✅ ${bot.name} reset complete\n`);
  }
  
  // Clear arena_state to force bot state reload on server restart
  console.log('Clearing arena_state to reset in-memory bot state...');
  const arenaResult = db.prepare('DELETE FROM arena_state').run();
  console.log(`  ✓ Cleared ${arenaResult.changes} arena_state record(s)\n`);
  
  console.log('🎉 All bots reset successfully!\n');
  console.log('⚠️  IMPORTANT: Restart the server for changes to take effect.');
  console.log('The bots will start fresh with clean state and empty trade history.\n');
  
} catch (error) {
  console.error('❌ Error resetting bots:', error);
  process.exit(1);
} finally {
  db.close();
}

