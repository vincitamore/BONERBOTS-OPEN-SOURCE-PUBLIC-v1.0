/**
 * Database State Inspection Script
 * Pre-migration analysis for data persistence refactor
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
const db = new Database(dbPath, { readonly: true });

console.log('═══════════════════════════════════════════════════════════');
console.log('  DATABASE STATE INSPECTION - Pre-Migration Analysis');
console.log('═══════════════════════════════════════════════════════════\n');

// Get database file size
const stats = fs.statSync(dbPath);
const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
console.log(`Database file size: ${fileSizeMB} MB\n`);

// ============================================================================
// 1. Check arena_state table
// ============================================================================
console.log('1. ARENA_STATE TABLE');
console.log('─'.repeat(60));

try {
  const arenaState = db.prepare('SELECT * FROM arena_state LIMIT 1').get();
  
  if (arenaState) {
    console.log(`✓ Found arena_state record (id: ${arenaState.id})`);
    console.log(`  Updated at: ${arenaState.updated_at}`);
    
    // Parse the state
    let state;
    try {
      state = JSON.parse(arenaState.state);
      const stateSize = Buffer.byteLength(arenaState.state, 'utf8');
      const stateSizeMB = (stateSize / 1024 / 1024).toFixed(2);
      console.log(`  State JSON size: ${stateSizeMB} MB`);
      
      // Analyze bots in state
      if (state.bots && Array.isArray(state.bots)) {
        console.log(`  Number of bots: ${state.bots.length}\n`);
        
        // Analyze each bot
        let totalOrders = 0;
        let totalBotLogs = 0;
        let totalPositions = 0;
        
        console.log('  Bot Details:');
        state.bots.forEach((bot, idx) => {
          const orders = bot.orders?.length || 0;
          const logs = bot.botLogs?.length || 0;
          const positions = bot.portfolio?.positions?.length || 0;
          
          totalOrders += orders;
          totalBotLogs += logs;
          totalPositions += positions;
          
          console.log(`    ${idx + 1}. ${bot.name || bot.id}`);
          console.log(`       - Orders (trades): ${orders}`);
          console.log(`       - Bot logs (AI decisions): ${logs}`);
          console.log(`       - Open positions: ${positions}`);
          console.log(`       - User ID: ${bot.userId || 'NOT SET ❌'}`);
        });
        
        console.log(`\n  TOTALS:`);
        console.log(`    - Total orders across all bots: ${totalOrders}`);
        console.log(`    - Total bot logs across all bots: ${totalBotLogs}`);
        console.log(`    - Total open positions: ${totalPositions}`);
      } else {
        console.log('  No bots array found in state');
      }
      
      // Market data
      if (state.marketData && Array.isArray(state.marketData)) {
        console.log(`\n  Market data entries: ${state.marketData.length}`);
      }
    } catch (parseError) {
      console.log(`  ❌ Error parsing state JSON: ${parseError.message}`);
    }
  } else {
    console.log('❌ No arena_state record found');
  }
} catch (error) {
  console.log(`❌ Error querying arena_state: ${error.message}`);
}

// ============================================================================
// 2. Check relational tables
// ============================================================================
console.log('\n\n2. RELATIONAL TABLES');
console.log('─'.repeat(60));

const tables = [
  { name: 'bots', description: 'Bot configurations' },
  { name: 'trades', description: 'Trade records' },
  { name: 'positions', description: 'Position records' },
  { name: 'bot_decisions', description: 'AI decision logs' },
  { name: 'bot_state_snapshots', description: 'Portfolio snapshots' },
  { name: 'llm_providers', description: 'LLM provider configs' },
  { name: 'users', description: 'User accounts' }
];

tables.forEach(table => {
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
    const status = count.count > 0 ? '✓' : '○';
    console.log(`${status} ${table.name.padEnd(20)} ${count.count.toString().padStart(6)} rows - ${table.description}`);
  } catch (error) {
    console.log(`✗ ${table.name.padEnd(20)} ERROR - ${error.message}`);
  }
});

// ============================================================================
// 3. Check for user_id columns
// ============================================================================
console.log('\n\n3. USER_ID FOREIGN KEY STATUS');
console.log('─'.repeat(60));

const tablesWithUserId = ['bots', 'trades', 'positions', 'bot_decisions', 'bot_state_snapshots'];

tablesWithUserId.forEach(tableName => {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const hasUserId = tableInfo.some(col => col.name === 'user_id');
    
    if (hasUserId) {
      // Check how many rows have user_id set
      const totalRows = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      const rowsWithUserId = db.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE user_id IS NOT NULL`).get();
      
      const status = rowsWithUserId.count === totalRows.count ? '✓' : '⚠';
      console.log(`${status} ${tableName.padEnd(20)} ${rowsWithUserId.count}/${totalRows.count} rows have user_id`);
    } else {
      console.log(`✗ ${tableName.padEnd(20)} NO user_id column`);
    }
  } catch (error) {
    console.log(`✗ ${tableName.padEnd(20)} ERROR: ${error.message}`);
  }
});

// ============================================================================
// 4. Sample data from populated tables
// ============================================================================
console.log('\n\n4. SAMPLE DATA FROM POPULATED TABLES');
console.log('─'.repeat(60));

// Check bot_state_snapshots
try {
  const snapshotCount = db.prepare('SELECT COUNT(*) as count FROM bot_state_snapshots').get();
  if (snapshotCount.count > 0) {
    const latestSnapshot = db.prepare(`
      SELECT bot_id, balance, total_value, trade_count, win_rate, timestamp
      FROM bot_state_snapshots
      ORDER BY timestamp DESC
      LIMIT 1
    `).get();
    console.log('\nLatest bot_state_snapshot:');
    console.log(`  Bot ID: ${latestSnapshot.bot_id}`);
    console.log(`  Balance: $${latestSnapshot.balance.toFixed(2)}`);
    console.log(`  Total Value: $${latestSnapshot.total_value.toFixed(2)}`);
    console.log(`  Trade Count: ${latestSnapshot.trade_count}`);
    console.log(`  Win Rate: ${(latestSnapshot.win_rate * 100).toFixed(2)}%`);
    console.log(`  Timestamp: ${latestSnapshot.timestamp}`);
  }
} catch (error) {
  console.log(`Error querying snapshots: ${error.message}`);
}

// Check bots table
try {
  const botCount = db.prepare('SELECT COUNT(*) as count FROM bots WHERE is_active = 1').get();
  if (botCount.count > 0) {
    const activeBots = db.prepare(`
      SELECT id, name, user_id, trading_mode, is_paused
      FROM bots
      WHERE is_active = 1
      ORDER BY created_at DESC
      LIMIT 5
    `).all();
    console.log(`\nActive bots (${botCount.count} total):`);
    activeBots.forEach(bot => {
      const userIdStatus = bot.user_id ? '✓' : '✗';
      console.log(`  ${userIdStatus} ${bot.name.padEnd(20)} [${bot.id}]`);
      console.log(`     user_id: ${bot.user_id || 'NOT SET'} | mode: ${bot.trading_mode} | paused: ${bot.is_paused ? 'yes' : 'no'}`);
    });
  }
} catch (error) {
  console.log(`Error querying bots: ${error.message}`);
}

// ============================================================================
// 5. Summary and Recommendations
// ============================================================================
console.log('\n\n5. SUMMARY & STATUS');
console.log('─'.repeat(60));

const tradesCount = db.prepare('SELECT COUNT(*) as count FROM trades').get().count;
const positionsCount = db.prepare('SELECT COUNT(*) as count FROM positions').get().count;
const decisionsCount = db.prepare('SELECT COUNT(*) as count FROM bot_decisions').get().count;

console.log('\nRelational Tables Status:');
if (tradesCount === 0) {
  console.log('  ❌ trades table is EMPTY - migration needed');
} else {
  console.log(`  ✓ trades table has ${tradesCount} rows`);
}

if (positionsCount === 0) {
  console.log('  ❌ positions table is EMPTY - migration needed');
} else {
  console.log(`  ✓ positions table has ${positionsCount} rows`);
}

if (decisionsCount === 0) {
  console.log('  ❌ bot_decisions table is EMPTY - migration needed');
} else {
  console.log(`  ✓ bot_decisions table has ${decisionsCount} rows`);
}

console.log('\n' + '═'.repeat(60));
console.log('  Inspection Complete');
console.log('═'.repeat(60) + '\n');

db.close();

