# Data Persistence Architecture Refactor - Comprehensive Implementation Plan

**Status**: 🚧 READY TO EXECUTE  
**Created**: 2025-11-06  
**Priority**: CRITICAL  
**Estimated Effort**: 40-60 hours  
**Complexity**: HIGH

---

## Executive Summary

This document provides a granular, step-by-step plan to resolve the critical data persistence issue identified in `DATA_PERSISTENCE_AUDIT.md`. The problem: trade data, position data, and AI decision logs are currently stored in a 2.7MB JSON blob in the `arena_state` table instead of proper relational tables, causing:

- ❌ History summarization broken
- ❌ Analytics inefficient/broken
- ❌ Data integrity compromised
- ❌ Query performance degraded
- ❌ Multi-tenancy not enforced at DB level

**Solution**: Migrate data from JSON blob to relational tables (`trades`, `positions`, `bot_decisions`) through a phased approach with zero downtime and full data integrity.

---

## Architecture Overview

### Current (BROKEN)
```
arena_state table (single row)
└── state column (2.7MB JSON blob)
    └── bots[] array
        ├── orders[] - 108 trades ❌
        ├── botLogs[] - 40 AI decisions ❌
        └── portfolio.positions[] - 2 positions ❌
```

### Target (FIXED)
```
arena_state table (single row)
└── state column (~100KB JSON)
    └── Essential fields only: balance, pnl, settings, cooldowns

trades table ✅
└── All historical trade records with user_id FK

positions table ✅
└── All open/closed positions with user_id FK

bot_decisions table ✅
└── All AI decision logs with user_id FK
```

---

## Phased Implementation Plan

### PHASE 1: Prerequisites & Preparation (1-2 hours)
**Goal**: Verify current state and create safety backups

**Tasks**:
1. Run database inspection script to document current state
2. Create timestamped backup (critical safety measure)
3. Document arena_state size and record counts

**Files to Check**:
- `data/arena.db`
- `server/scripts/check_arena_state.js`

**Deliverable**: Backup file + state documentation

---

### PHASE 2: Migration Script Enhancement (4-6 hours)
**Goal**: Fix and enhance `migrate_to_relational.js` to properly migrate JSON blob data

**Critical Fixes Needed**:

1. **Add user_id to all INSERT statements** (lines 115-125)
   ```javascript
   const insertTrade = db.prepare(`
     INSERT OR REPLACE INTO trades 
     (id, user_id, bot_id, position_id, symbol, trade_type, action, entry_price, exit_price, size, leverage, pnl, fee, executed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   `);
   ```

2. **Fix trade mapping** (lines 180-199)
   - Current code assumes all trades are CLOSE actions
   - Need to distinguish entry trades (action='OPEN') vs exit trades (action='CLOSE')
   - Map bot.orders fields correctly to trades table schema
   - Handle position_id linkage

3. **Fix position mapping** (lines 160-178)
   - Add user_id
   - Verify status field set correctly

4. **Fix decision mapping** (lines 201-214)
   - Add user_id
   - Ensure JSON fields properly serialized

5. **Enhanced verification** (verifyMigration function)
   ```javascript
   // Verify row counts match
   const tradeCount = db.prepare('SELECT COUNT(*) as count FROM trades WHERE bot_id = ?').get(bot.id).count;
   if (tradeCount !== bot.orders.length) {
     throw new Error(`Trade count mismatch for ${bot.name}`);
   }
   ```

**Testing**: Run on backup copy first, verify data integrity

**Files Modified**:
- `server/scripts/migrate_to_relational.js`

---

### PHASE 3: BotManager Write Operations (6-8 hours)
**Goal**: Modify BotManager to write to database tables in real-time during trading

**Critical Changes**:

1. **Import relational database module** (top of BotManager.js)
   ```javascript
   const db = require('../database/relational');
   ```

2. **executePaperTrade() - Line 2038-2078**
   ```javascript
   // After creating position object (line 2044-2055)
   try {
     db.createPosition({
       id: position.id,
       user_id: bot.userId, // CRITICAL: Add user_id
       bot_id: bot.id,
       symbol: position.symbol,
       position_type: position.type,
       entry_price: position.entryPrice,
       size: position.size,
       leverage: position.leverage,
       liquidation_price: position.liquidationPrice,
       stop_loss: position.stopLoss,
       take_profit: position.takeProfit,
       unrealized_pnl: 0,
       status: 'open'
     });
   } catch (error) {
     console.error(`DB write error (position): ${error.message}`);
     // Don't fail trade execution if DB write fails
   }

   // After creating entry order (line 2060-2073)
   try {
     db.createTrade({
       id: entryOrder.id,
       user_id: bot.userId, // CRITICAL: Add user_id
       bot_id: bot.id,
       position_id: position.id,
       symbol: entryOrder.symbol,
       trade_type: entryOrder.type,
       action: 'OPEN',
       entry_price: entryOrder.entryPrice,
       exit_price: null,
       size: entryOrder.size,
       leverage: entryOrder.leverage,
       pnl: entryOrder.pnl,
       fee: entryOrder.fee,
       executed_at: new Date(entryOrder.timestamp).toISOString()
     });
   } catch (error) {
     console.error(`DB write error (trade): ${error.message}`);
   }
   ```

3. **closePosition() - Lines 2083-2150**
   ```javascript
   // After calculating PnL and updating balance
   try {
     // Update position status
     db.updatePosition(posToClose.id, {
       status: 'closed',
       closed_at: new Date().toISOString()
     }, bot.userId);

     // Create exit trade record
     db.createTrade({
       id: `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
       user_id: bot.userId,
       bot_id: bot.id,
       position_id: posToClose.id,
       symbol: posToClose.symbol,
       trade_type: posToClose.type,
       action: 'CLOSE',
       entry_price: posToClose.entryPrice,
       exit_price: currentMarket.price,
       size: posToClose.size,
       leverage: posToClose.leverage,
       pnl: finalPnl,
       fee: exitFee,
       executed_at: new Date().toISOString()
     });
   } catch (error) {
     console.error(`DB write error (close position): ${error.message}`);
   }
   ```

4. **runTradingTurn() - Lines 943-952**
   ```javascript
   // After creating newLog object
   try {
     db.createDecision({
       user_id: bot.userId, // CRITICAL: Add user_id
       bot_id: bot.id,
       prompt_sent: prompt,
       decisions: decisions,
       notes: notes,
       execution_success: !error,
       timestamp: new Date().toISOString()
     });
   } catch (error) {
     console.error(`DB write error (decision): ${error.message}`);
   }
   ```

5. **executeRealTrade() - Lines 1951-2033**
   - Add same database writes for real trading
   - Ensure position and trade records created

**Error Handling**: Wrap all DB writes in try-catch, never fail trading operations due to DB errors

**Files Modified**:
- `server/services/BotManager.js`

---

### PHASE 4: BotManager Read Operations (4-6 hours)
**Goal**: Load data from database tables on startup instead of arena_state JSON

**Critical Changes**:

**loadBots() - Lines 336-360**
```javascript
// After finding bot config and checking for savedBot

if (savedBot) {
  console.log(`      Resuming ${config.name} from database...`);
  
  // Load recent trades from database (instead of savedBot.orders)
  const recentTrades = db.getTrades(config.id, { 
    user_id: config.user_id, 
    limit: 100 
  });
  
  // Load recent AI decisions from database (instead of savedBot.botLogs)
  const recentDecisions = db.getBotDecisions(config.id, 50, config.user_id);
  
  // Transform to expected format
  const orders = recentTrades.map(t => ({
    id: t.id,
    symbol: t.symbol,
    type: t.trade_type,
    size: t.size,
    leverage: t.leverage,
    pnl: t.pnl,
    fee: t.fee,
    timestamp: new Date(t.executed_at).getTime(),
    entryPrice: t.entry_price,
    exitPrice: t.exit_price
  }));
  
  const botLogs = recentDecisions.map(d => ({
    timestamp: new Date(d.timestamp).getTime(),
    prompt: d.prompt_sent,
    decisions: JSON.parse(d.decisions_json),
    notes: JSON.parse(d.notes_json || '[]')
  }));
  
  // Load open positions from database
  const dbPositions = db.getPositions(config.id, 'open', config.user_id);
  const positions = dbPositions.map(p => ({
    id: p.id,
    symbol: p.symbol,
    type: p.position_type,
    entryPrice: p.entry_price,
    size: p.size,
    leverage: p.leverage,
    liquidationPrice: p.liquidation_price,
    stopLoss: p.stop_loss,
    takeProfit: p.take_profit,
    pnl: p.unrealized_pnl
  }));
  
  botState = {
    ...savedBot,
    userId: config.user_id,
    // Use database data instead of savedBot arrays
    orders,
    botLogs,
    portfolio: {
      ...savedBot.portfolio,
      positions
    },
    // Keep other fields from savedBot
    tradingMode: config.trading_mode,
    isPaused: config.is_paused,
    providerName: config.provider_name,
    provider,
    prompt: config.prompt,
    name: config.name,
    avatarUrl: config.avatar_image,
    isLoading: false,
    initialBalance,
    symbolCooldowns: savedBot.symbolCooldowns || {}
  };
}
```

**Backward Compatibility**: Keep arena_state as fallback for:
- balance
- realizedPnl
- tradeCount
- winRate
- valueHistory
- symbolCooldowns

**Files Modified**:
- `server/services/BotManager.js`

---

### PHASE 5: Dual Write Testing (2-3 days monitoring)
**Goal**: Verify both systems work simultaneously

**Actions**:
1. Keep saveState() writing to arena_state (no changes)
2. Deploy Phase 3 & 4 changes
3. Monitor for 24-48 hours
4. Verify data consistency between JSON blob and relational tables

**Verification Script** (create new):
```javascript
// server/scripts/verify_data_consistency.js
const db = require('../database/relational');
const Database = require('better-sqlite3');

// Compare arena_state JSON vs database tables
// Report any discrepancies
```

**Tests**:
- Bot reset functionality (routes/bots.js:509-593)
- History summarization (routes/bots.js:363-465)
- Trading execution
- Server restart/reload

---

### PHASE 6: Frontend Compatibility (2-4 hours)
**Goal**: Ensure UI continues to work with database-sourced data

**Components to Test**:
- `OrderHistory` - displays bot.orders array
- `BotStatus` - displays bot.botLogs array
- `PositionsTable` - displays bot.portfolio.positions array
- Performance metrics display

**Verification**: No UI changes needed if data format preserved

---

### PHASE 7: API Routes Enhancement (4-6 hours)
**Goal**: Add endpoints to query relational data directly

**New Endpoints** (create routes/trades.js, routes/positions.js):
```javascript
// GET /api/bots/:id/trades?limit=50&offset=0&symbol=BTCUSDT
router.get('/:id/trades', authenticateToken, async (req, res) => {
  const userId = req.user.role === 'admin' ? null : req.user.userId;
  const trades = db.getTrades(req.params.id, {
    user_id: userId,
    limit: req.query.limit || 50,
    offset: req.query.offset || 0,
    symbol: req.query.symbol
  });
  res.json(trades);
});

// GET /api/bots/:id/positions?status=open
router.get('/:id/positions', authenticateToken, async (req, res) => {
  const userId = req.user.role === 'admin' ? null : req.user.userId;
  const positions = db.getPositions(
    req.params.id, 
    req.query.status || 'open', 
    userId
  );
  res.json(positions);
});

// GET /api/bots/:id/decisions?limit=20
router.get('/:id/decisions', authenticateToken, async (req, res) => {
  const userId = req.user.role === 'admin' ? null : req.user.userId;
  const decisions = db.getBotDecisions(
    req.params.id,
    req.query.limit || 20,
    userId
  );
  res.json(decisions);
});
```

**Security**: All endpoints enforce user_id filtering for multi-tenancy

**Files Created**:
- `server/routes/trades.js`
- `server/routes/positions.js`

---

### PHASE 8: Analytics Enhancement (4-6 hours)
**Goal**: Update analytics to use relational queries

**Analytics Queries** (routes/analytics.js):
```javascript
// Win rate calculation
const winRateQuery = `
  SELECT 
    COUNT(*) as total_trades,
    SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
    CAST(SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as win_rate
  FROM trades
  WHERE bot_id = ? AND user_id = ? AND action = 'CLOSE'
`;

// PnL over time
const pnlTimeSeriesQuery = `
  SELECT 
    DATE(executed_at) as date,
    SUM(pnl) as daily_pnl
  FROM trades
  WHERE bot_id = ? AND user_id = ?
  GROUP BY DATE(executed_at)
  ORDER BY date
`;

// Best/worst trades
const topTradesQuery = `
  SELECT *
  FROM trades
  WHERE bot_id = ? AND user_id = ? AND action = 'CLOSE'
  ORDER BY pnl DESC
  LIMIT ?
`;
```

**Performance**: Verify indexes on frequently queried columns:
- `idx_trades_bot` ✓
- `idx_trades_executed` ✓
- `idx_trades_pnl` ✓

**Files Modified**:
- `server/routes/analytics.js`

---

### PHASE 9: Snapshot Service Verification (1-2 hours)
**Goal**: Ensure snapshots work with new architecture

**Verification**:
1. Check snapshotCleanupService.js uses db.createSnapshot() with user_id ✓
2. Verify bot_state_snapshots table populated during trading
3. Verify leaderboard calculations work

**Files to Review**:
- `server/services/snapshotCleanupService.js`
- `server/services/leaderboardService.js`

---

### PHASE 10-11: Arena State Cleanup (4-6 hours + testing)
**Goal**: Remove redundant data from JSON blob

**Phase 10 - Serialization Changes**:

**saveState() - Lines 2182-2204**:
```javascript
saveState() {
  const stateToSave = {
    bots: this.getAllBots().map(bot => ({
      id: bot.id,
      userId: bot.userId,
      name: bot.name,
      prompt: bot.prompt,
      provider: bot.provider,
      tradingMode: bot.tradingMode,
      initialBalance: bot.initialBalance,
      
      // Keep essential state
      portfolio: {
        balance: bot.portfolio.balance,
        pnl: bot.portfolio.pnl,
        totalValue: bot.portfolio.totalValue
        // ✅ REMOVED: positions array (now in DB)
      },
      
      realizedPnl: bot.realizedPnl,
      tradeCount: bot.tradeCount,
      winRate: bot.winRate,
      valueHistory: bot.valueHistory,
      symbolCooldowns: bot.symbolCooldowns,
      isLoading: bot.isLoading,
      isPaused: bot.isPaused,
      avatarUrl: bot.avatarUrl
      
      // ✅ REMOVED: orders array (now in DB)
      // ✅ REMOVED: botLogs array (now in DB)
    })),
    marketData: this.markets
  };
  
  // Serialize and save
  const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
  const db = new Database(dbPath);
  
  try {
    db.prepare(`
      INSERT INTO arena_state (id, state, updated_at) 
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        state = excluded.state,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(stateToSave), new Date().toISOString());
  } finally {
    db.close();
  }
}
```

**Expected Result**: arena_state size reduced from ~2.7MB to ~100KB

**Phase 11 - In-Memory State Cleanup**:
- Remove bot.orders from in-memory state entirely
- Remove bot.botLogs from in-memory state entirely
- Keep bot.portfolio.positions in memory (trading performance)
- Update broadcastState() to query database for WebSocket payload

**Files Modified**:
- `server/services/BotManager.js`

---

### PHASE 12: Performance Optimization (2-4 hours)
**Goal**: Ensure optimal query performance

**Tasks**:
1. Add query performance logging
2. Run EXPLAIN QUERY PLAN on all queries
3. Verify index usage
4. Add connection pooling if needed
5. Set up VACUUM schedule

**Monitoring**:
```javascript
// Add to all DB queries
const start = Date.now();
const result = db.prepare(query).all(...params);
const duration = Date.now() - start;
if (duration > 100) {
  console.warn(`Slow query (${duration}ms): ${query}`);
}
```

---

### PHASE 13: Documentation (2-4 hours)
**Goal**: Update all documentation

**Documents to Update**:
1. `DATA_PERSISTENCE_AUDIT.md` - mark as RESOLVED
2. Create `MIGRATION_COMPLETED.md` - document changes
3. `DEVELOPMENT.md` - add schema docs
4. Create backup/restore procedures
5. Performance optimization guidelines

---

### PHASE 14: Comprehensive Testing (4-8 hours)
**Goal**: Verify all functionality

**Test Cases**:
1. ✅ Bot trading turn execution
2. ✅ Bot restart/reload from database
3. ✅ Multi-user data isolation
4. ✅ Concurrent trading (no race conditions)
5. ✅ Database backup/restore
6. ✅ Load test with multiple bots
7. ✅ Analytics queries with large dataset

---

### PHASE 15: Final Deployment (1-2 days)
**Goal**: Production deployment with monitoring

**Checklist**:
- [ ] Remove deprecated scripts
- [ ] Clean up console.log statements
- [ ] Final code review
- [ ] Create deployment checklist
- [ ] Prepare rollback plan
- [ ] Deploy to production
- [ ] Monitor for 48 hours
- [ ] Mark audit as RESOLVED

---

## Success Criteria

✅ **Data Integrity**
- All trades in `trades` table
- All positions in `positions` table
- All AI logs in `bot_decisions` table
- Foreign keys enforced
- user_id properly set on all records

✅ **Performance**
- Queries execute in <100ms
- No JSON parsing for data queries
- Proper indexes used
- arena_state size < 200KB

✅ **Functionality**
- Bots trade normally
- History summarization works
- Leaderboard accurate
- Analytics functional
- Data survives restart
- Multi-tenancy enforced

✅ **Maintainability**
- Clear separation of concerns
- Standard SQL queries
- Easy to debug
- Easy to extend

---

## Risk Mitigation

### High Risk Areas
1. **Data loss during migration** → Multiple backups before each phase
2. **Breaking changes to frontend** → Preserve data format, test extensively
3. **Performance degradation** → Monitor query times, optimize indexes
4. **Multi-tenant data leakage** → Test user_id filtering thoroughly

### Rollback Plan
1. Keep arena_state JSON blob during Phase 5 dual-write period
2. All backups stored in `data/backups/` with timestamps
3. Can restore from backup within 5 minutes if critical issue
4. Phase 10-11 (cleanup) only after 1 week of verified stability

---

## Timeline Estimate

| Phase | Duration | Dependency |
|-------|----------|------------|
| Phase 1 | 1-2 hours | None |
| Phase 2 | 4-6 hours | Phase 1 |
| Phase 3 | 6-8 hours | Phase 2 |
| Phase 4 | 4-6 hours | Phase 2 |
| Phase 5 | 2-3 days | Phase 3, 4 |
| Phase 6 | 2-4 hours | Phase 5 |
| Phase 7 | 4-6 hours | Phase 5 |
| Phase 8 | 4-6 hours | Phase 7 |
| Phase 9 | 1-2 hours | Phase 5 |
| Phase 10-11 | 4-6 hours | Phase 5 (1 week wait) |
| Phase 12 | 2-4 hours | Phase 10-11 |
| Phase 13 | 2-4 hours | Phase 12 |
| Phase 14 | 4-8 hours | Phase 12 |
| Phase 15 | 1-2 days | Phase 14 |

**Total Active Development**: ~40-60 hours  
**Total Calendar Time**: 2-3 weeks (including monitoring periods)

---

## Next Steps

1. **Review this plan** - Ensure alignment with team and requirements
2. **Approve Phase 1-2** - Start with migration script fixes
3. **Execute Phase by Phase** - Don't skip phases or rush
4. **Monitor continuously** - Data integrity is paramount
5. **Document learnings** - Update docs as we progress

---

## Contact & Support

For questions or issues during implementation:
- Reference: `DATA_PERSISTENCE_AUDIT.md` for original analysis
- Todo List: 81 granular tasks in project TODO system
- Backup Location: `data/backups/`

---

**Last Updated**: 2025-11-06  
**Status**: ✅ READY TO BEGIN PHASE 1

