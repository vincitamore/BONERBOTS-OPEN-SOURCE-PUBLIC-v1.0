// Debug script to inspect all bot data in the database
// Usage: node server/scripts/debug_bot_data.js [bot_id]
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
const botId = process.argv[2] || 'bot_chronospeculator';

console.log('Database path:', dbPath);

const db = new Database(dbPath);

console.log('\n========================================');
console.log(`DEBUGGING BOT DATA FOR: ${botId}`);
console.log('========================================\n');

// 1. Check bot config
console.log('1. BOT CONFIG:');
const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId);
console.log(bot || 'Bot not found');

if (!bot) {
    db.close();
    process.exit(0);
}

// 2. Check bot_state_snapshots
console.log('\n2. BOT STATE SNAPSHOTS:');
const snapshots = db.prepare('SELECT * FROM bot_state_snapshots WHERE bot_id = ? ORDER BY timestamp DESC').all(botId);
console.log(`Found ${snapshots.length} snapshots`);
snapshots.slice(0, 3).forEach((s, i) => {
    console.log(`\nSnapshot ${i + 1}:`);
    console.log(`  - Timestamp: ${s.timestamp}`);
    console.log(`  - Balance: $${s.balance}`);
    console.log(`  - Realized PNL: $${s.realized_pnl}`);
    console.log(`  - Unrealized PNL: $${s.unrealized_pnl}`);
    console.log(`  - Total Value: $${s.total_value}`);
    console.log(`  - Trade Count: ${s.trade_count}`);
    console.log(`  - Win Rate: ${s.win_rate}`);
});

// 3. Check positions
console.log('\n3. POSITIONS:');
const positions = db.prepare('SELECT * FROM positions WHERE bot_id = ?').all(botId);
console.log(`Found ${positions.length} positions`);
positions.slice(0, 5).forEach((p, i) => {
    console.log(`\nPosition ${i + 1}:`);
    console.log(`  - ID: ${p.id}`);
    console.log(`  - Symbol: ${p.symbol}`);
    console.log(`  - Status: ${p.status}`);
    console.log(`  - Entry Price: $${p.entry_price}`);
    console.log(`  - Size: ${p.size}`);
});

// 4. Check trades
console.log('\n4. TRADES:');
const trades = db.prepare('SELECT * FROM trades WHERE bot_id = ? ORDER BY executed_at DESC').all(botId);
console.log(`Found ${trades.length} trades`);
trades.slice(0, 5).forEach((t, i) => {
    console.log(`\nTrade ${i + 1}:`);
    console.log(`  - ID: ${t.id}`);
    console.log(`  - Symbol: ${t.symbol}`);
    console.log(`  - Action: ${t.action}`);
    console.log(`  - PNL: $${t.pnl}`);
    console.log(`  - Fee: $${t.fee}`);
    console.log(`  - Executed At: ${t.executed_at}`);
});

// 5. Check bot_decisions
console.log('\n5. BOT DECISIONS (AI LOGS):');
const decisions = db.prepare('SELECT * FROM bot_decisions WHERE bot_id = ? ORDER BY timestamp DESC LIMIT 5').all(botId);
console.log(`Found ${decisions.length} decisions (showing last 5)`);
decisions.forEach((d, i) => {
    console.log(`\nDecision ${i + 1}:`);
    console.log(`  - Timestamp: ${d.timestamp}`);
    console.log(`  - Execution Success: ${d.execution_success}`);
    const decisionData = JSON.parse(d.decisions_json);
    console.log(`  - Decisions:`, decisionData);
});

// 6. Check arena_state
console.log('\n6. ARENA_STATE JSON BLOB:');
const arenaState = db.prepare('SELECT * FROM arena_state WHERE id = 1').get();
if (arenaState && arenaState.state_json) {
    const state = JSON.parse(arenaState.state_json);
    console.log(`Updated At: ${arenaState.updated_at}`);
    console.log(`Number of bots in state: ${state.bots?.length || 0}`);
    
    const botInState = state.bots?.find(b => b.id === botId);
    if (botInState) {
        console.log(`\nBot found in arena_state:`);
        console.log(`  - Balance: $${botInState.portfolio?.balance}`);
        console.log(`  - Realized PNL: $${botInState.realizedPnl}`);
        console.log(`  - Trade Count: ${botInState.tradeCount}`);
        console.log(`  - Win Rate: ${botInState.winRate}`);
        console.log(`  - Positions: ${botInState.portfolio?.positions?.length || 0}`);
        console.log(`  - Bot Logs: ${botInState.botLogs?.length || 0}`);
    } else {
        console.log('Bot NOT found in arena_state');
    }
} else {
    console.log('No arena_state found');
}

console.log('\n========================================');
console.log('DEBUG COMPLETE');
console.log('========================================\n');

db.close();

