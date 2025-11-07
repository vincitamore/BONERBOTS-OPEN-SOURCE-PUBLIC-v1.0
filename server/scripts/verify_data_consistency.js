// server/scripts/verify_data_consistency.js
// Verification script to compare arena_state JSON blob vs relational tables
// Ensures both persistence mechanisms are in sync during dual-write period

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/arena.db');
const db = new Database(dbPath, { readonly: true });

console.log(`📂 Database: ${dbPath}\n`);

console.log('═══════════════════════════════════════════════════════════════');
console.log('DATA CONSISTENCY VERIFICATION');
console.log('Comparing arena_state JSON vs Relational Tables');
console.log('═══════════════════════════════════════════════════════════════\n');

// Get all bots
const bots = db.prepare('SELECT id, name, user_id FROM bots WHERE is_active = 1').all();
console.log(`📊 Analyzing ${bots.length} active bots...\n`);

let totalIssues = 0;
const issues = [];

for (const bot of bots) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🤖 Bot: ${bot.name} (${bot.id})`);
  console.log(`${'─'.repeat(70)}\n`);

  // Get data from relational tables
  const dbTrades = db.prepare('SELECT * FROM trades WHERE bot_id = ? ORDER BY executed_at DESC').all(bot.id);
  const dbPositions = db.prepare('SELECT * FROM positions WHERE bot_id = ? ORDER BY opened_at DESC').all(bot.id);
  const dbDecisions = db.prepare('SELECT * FROM bot_decisions WHERE bot_id = ? ORDER BY timestamp DESC').all(bot.id);

  console.log(`📈 Relational Tables:`);
  console.log(`   Trades: ${dbTrades.length}`);
  console.log(`   Positions: ${dbPositions.length}`);
  console.log(`   Decisions: ${dbDecisions.length}`);

  // Get data from arena_state
  const arenaState = db.prepare('SELECT state FROM arena_state WHERE id = 1').get();
  
  let stateTrades = 0;
  let statePositions = 0;
  let stateDecisions = 0;
  let botState = null;

  if (arenaState && arenaState.state) {
    try {
      const state = JSON.parse(arenaState.state);
      // Bots are stored as an array, find by ID
      const botData = Array.isArray(state.bots) 
        ? state.bots.find(b => b.id === bot.id)
        : state.bots?.[bot.id]; // Fallback to object access if format changed
      
      if (botData) {
        botState = botData;
        stateTrades = botData.orders?.length || 0;
        statePositions = botData.portfolio?.positions?.length || 0;
        stateDecisions = botData.botLogs?.length || 0;
      }
    } catch (e) {
      console.log(`   ⚠️  Could not parse arena_state: ${e.message}`);
    }
  }

  console.log(`\n📦 Arena State (JSON):`);
  console.log(`   Trades (orders): ${stateTrades}`);
  console.log(`   Positions: ${statePositions}`);
  console.log(`   Decisions (botLogs): ${stateDecisions}`);

  // Compare counts
  console.log(`\n🔍 Consistency Check:`);
  
  const tradeDiff = Math.abs(dbTrades.length - stateTrades);
  const positionDiff = Math.abs(dbPositions.length - statePositions);
  const decisionDiff = Math.abs(dbDecisions.length - stateDecisions);

  if (tradeDiff > 0) {
    const msg = `   ⚠️  Trades mismatch: DB has ${dbTrades.length}, State has ${stateTrades} (diff: ${tradeDiff})`;
    console.log(msg);
    issues.push({ bot: bot.name, type: 'trades', dbCount: dbTrades.length, stateCount: stateTrades, diff: tradeDiff });
    totalIssues++;
  } else {
    console.log(`   ✅ Trades match: ${dbTrades.length}`);
  }

  if (positionDiff > 0) {
    const msg = `   ⚠️  Positions mismatch: DB has ${dbPositions.length}, State has ${statePositions} (diff: ${positionDiff})`;
    console.log(msg);
    issues.push({ bot: bot.name, type: 'positions', dbCount: dbPositions.length, stateCount: statePositions, diff: positionDiff });
    totalIssues++;
  } else {
    console.log(`   ✅ Positions match: ${dbPositions.length}`);
  }

  if (decisionDiff > 0) {
    const msg = `   ⚠️  Decisions mismatch: DB has ${dbDecisions.length}, State has ${stateDecisions} (diff: ${decisionDiff})`;
    console.log(msg);
    issues.push({ bot: bot.name, type: 'decisions', dbCount: dbDecisions.length, stateCount: stateDecisions, diff: decisionDiff });
    totalIssues++;
  } else {
    console.log(`   ✅ Decisions match: ${dbDecisions.length}`);
  }

  // Detailed data validation for recent trades
  if (dbTrades.length > 0 && stateTrades > 0) {
    console.log(`\n🔬 Detailed Trade Validation (checking latest 3 trades):`);
    
    const recentDbTrades = dbTrades.slice(0, 3);
    const recentStateTrades = botState?.orders?.slice(-3) || [];

    for (let i = 0; i < Math.min(3, recentDbTrades.length); i++) {
      const dbTrade = recentDbTrades[i];
      // Try to find matching trade in state by symbol and approximate timestamp
      const matchingStateTrade = recentStateTrades.find(st => 
        st.symbol === dbTrade.symbol && 
        Math.abs(new Date(st.timestamp).getTime() - new Date(dbTrade.executed_at).getTime()) < 5000
      );

      if (matchingStateTrade) {
        console.log(`   ✅ Trade ${i + 1}: ${dbTrade.symbol} @ ${dbTrade.price} matched`);
      } else {
        console.log(`   ⚠️  Trade ${i + 1}: ${dbTrade.symbol} @ ${dbTrade.price} NOT found in state`);
        totalIssues++;
      }
    }
  }

  // Check for open positions consistency
  const openDbPositions = dbPositions.filter(p => p.status === 'open');
  const openStatePositions = botState?.portfolio?.positions?.filter(p => !p.closedAt) || [];
  
  console.log(`\n📊 Open Positions:`);
  console.log(`   DB: ${openDbPositions.length} open`);
  console.log(`   State: ${openStatePositions.length} open`);
  
  if (openDbPositions.length !== openStatePositions.length) {
    console.log(`   ⚠️  Open positions count mismatch!`);
    issues.push({ 
      bot: bot.name, 
      type: 'open_positions', 
      dbCount: openDbPositions.length, 
      stateCount: openStatePositions.length 
    });
    totalIssues++;
  } else {
    console.log(`   ✅ Open positions count matches`);
  }
}

// Summary
console.log(`\n\n${'═'.repeat(70)}`);
console.log('VERIFICATION SUMMARY');
console.log(`${'═'.repeat(70)}\n`);

if (totalIssues === 0) {
  console.log('✅ ALL DATA CONSISTENT - No discrepancies found!');
  console.log('✅ Relational tables and arena_state JSON are in sync.');
} else {
  console.log(`⚠️  FOUND ${totalIssues} INCONSISTENCIES`);
  console.log(`\nDetails:`);
  issues.forEach((issue, idx) => {
    console.log(`\n${idx + 1}. ${issue.bot} - ${issue.type}:`);
    console.log(`   Database: ${issue.dbCount}`);
    console.log(`   Arena State: ${issue.stateCount}`);
    if (issue.diff) {
      console.log(`   Difference: ${issue.diff}`);
    }
  });
  
  console.log(`\n⚠️  ACTION REQUIRED:`);
  console.log(`   1. Review discrepancies above`);
  console.log(`   2. Check BotManager write operations`);
  console.log(`   3. Verify saveState() is being called`);
  console.log(`   4. Monitor next trading cycle for data sync`);
}

// Database statistics
console.log(`\n${'═'.repeat(70)}`);
console.log('DATABASE STATISTICS');
console.log(`${'═'.repeat(70)}\n`);

const dbStats = {
  trades: db.prepare('SELECT COUNT(*) as count FROM trades').get().count,
  positions: db.prepare('SELECT COUNT(*) as count FROM positions').get().count,
  decisions: db.prepare('SELECT COUNT(*) as count FROM bot_decisions').get().count,
  snapshots: db.prepare('SELECT COUNT(*) as count FROM bot_state_snapshots').get().count,
  bots: db.prepare('SELECT COUNT(*) as count FROM bots WHERE is_active = 1').get().count
};

console.log(`Total Records:`);
console.log(`   Bots (active): ${dbStats.bots}`);
console.log(`   Trades: ${dbStats.trades}`);
console.log(`   Positions: ${dbStats.positions}`);
console.log(`   Decisions: ${dbStats.decisions}`);
console.log(`   Snapshots: ${dbStats.snapshots}`);

// Arena state size
const arenaStateForSize = db.prepare('SELECT state FROM arena_state WHERE id = 1').get();
if (arenaStateForSize && arenaStateForSize.state) {
  const sizeKB = (Buffer.byteLength(arenaStateForSize.state, 'utf8') / 1024).toFixed(2);
  const sizeMB = (sizeKB / 1024).toFixed(2);
  console.log(`\nArena State Size: ${sizeKB} KB (${sizeMB} MB)`);
} else {
  console.log(`\n⚠️  Arena State: EMPTY or not found`);
}

console.log(`\n${'═'.repeat(70)}`);
console.log('Verification complete!');
console.log(`${'═'.repeat(70)}\n`);

db.close();

// Exit with appropriate code
process.exit(totalIssues > 0 ? 1 : 0);

