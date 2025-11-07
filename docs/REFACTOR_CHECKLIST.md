# Data Persistence Refactor - Implementation Checklist

Quick reference checklist for implementing the data persistence architecture refactor.

---

## Pre-Flight Checks

- [ ] Read `DATA_PERSISTENCE_AUDIT.md` completely
- [ ] Read `DATA_PERSISTENCE_REFACTOR_PLAN.md` completely  
- [ ] Review current database schema in `server/migrations/`
- [ ] Verify development environment is ready
- [ ] Ensure you have database backup tools available

---

## Phase 1: Preparation ⏱️ 1-2 hours ✅ COMPLETED

- [x] Run `node server/scripts/inspect_database_state.js` to inspect current state
- [x] Document current arena_state size and record counts (2.74 MB, 186 trades, 136 logs, 4 positions)
- [x] Create backup: `arena_backup_pre_migration_20251106_121535.db` (8.1 MB)
- [x] Verify backup integrity (✅ verified)
- [x] Document findings in PRE_MIGRATION_REPORT.md

---

## Phase 2: Migration Script ⏱️ 4-6 hours ✅ COMPLETED

### Code Changes

- [x] Open `server/scripts/migrate_to_relational.js`

**Fix insertTrade (lines ~115-119)**:
- [x] Add `user_id` parameter to INSERT statement
- [x] Add `user_id` to .run() call: `bot.userId`

**Fix insertPosition (lines ~109-113)**:
- [x] Add `user_id` parameter to INSERT statement  
- [x] Add `user_id` to .run() call: `bot.userId`

**Fix insertDecision (lines ~121-125)**:
- [x] Add `user_id` parameter to INSERT statement
- [x] Add `user_id` to .run() call: `bot.userId`

**Fix trade migration logic (lines ~180-199)**:
- [x] Distinguish between entry trades (action='OPEN') and exit trades (action='CLOSE')
- [x] Map bot.orders fields correctly to trades table
- [x] Add position_id linkage for trades
- [x] Handle timestamp conversion properly

**Enhance verification (verifyMigration function)**:
- [x] Add trade count verification
- [x] Add position count verification  
- [x] Add decision count verification
- [x] Add data integrity checks

**Created `extract_data_from_arena_state.js`**:
- [x] Production-ready data extraction script
- [x] Reads from arena_state JSON blob
- [x] Inserts into relational tables with user_id
- [x] Comprehensive verification with reopen test
- [x] Auto-creates backups before modifications

### Testing

- [x] Create a test copy of database
- [x] Run migration script on test database
- [x] Verify all data migrated correctly (186 trades, 4 positions, 136 decisions)
- [x] Check for any errors in migration logs
- [x] Verify row counts match expectations
- [x] Run on production database (✅ completed 2025-11-06 12:30 PM)

---

## Phase 3: BotManager Writes ⏱️ 6-8 hours ✅ COMPLETED

### Setup

- [x] Open `server/services/BotManager.js`
- [x] Add import at top: `const db = require('../database/relational');`

### executePaperTrade() - Lines ~2038-2078

**After creating position object (line ~2044-2055)**:
- [x] Add try-catch block
- [x] Call `db.createPosition()` with all fields including `user_id: bot.userId`
- [x] Log errors but don't fail trade execution

**After creating entry order (line ~2060-2073)**:
- [x] Add try-catch block
- [x] Call `db.createTrade()` with `action: 'OPEN'`, `user_id: bot.userId`, `position_id: position.id`
- [x] Log errors but don't fail trade execution

### closePosition() - Lines ~2083-2150

**After calculating PnL**:
- [x] Add try-catch block for position update (paper trading)
- [x] Call `db.updatePosition()` to set `status: 'closed'`, `closed_at: timestamp`
- [x] Add try-catch block for exit trade (paper trading)
- [x] Call `db.createTrade()` with `action: 'CLOSE'`, complete PnL data
- [x] Log errors but don't fail position close
- [x] Add same logic for real trading close

### runTradingTurn() - Lines ~943-952

**After creating newLog object**:
- [x] Add try-catch block
- [x] Call `db.createDecision()` with all fields including `user_id: bot.userId`
- [x] Log errors but don't fail trading turn

### executeRealTrade() - Lines ~1951-2033

- [x] Add same database writes as executePaperTrade()
- [x] Ensure error handling is robust
- [x] Calculate liquidation price for tracking
- [x] Write position and entry trade to database

### Testing

- [ ] Test paper trade execution - verify DB writes
- [ ] Test real trade execution - verify DB writes  
- [ ] Test position opening - check `positions` table
- [ ] Test position closing - check `positions` and `trades` tables
- [ ] Test AI decision logging - check `bot_decisions` table
- [ ] Verify user_id is set correctly on all records
- [ ] Verify no trading failures due to DB write errors

---

## Phase 4: BotManager Reads ⏱️ 4-6 hours ✅ COMPLETED

### loadBots() - Lines ~336-360

**In the savedBot block**:

- [x] Add query for recent trades:
```javascript
const recentTrades = db.getTrades(config.id, { user_id: config.user_id, limit: 100 });
```

- [x] Transform trades to expected format (orders array)

- [x] Add query for recent decisions:
```javascript
const recentDecisions = db.getBotDecisions(config.id, 50, config.user_id);
```

- [x] Transform decisions to expected format (botLogs array)

- [x] Add query for open positions:
```javascript
const dbPositions = db.getPositions(config.id, 'open', config.user_id);
```

- [x] Transform positions to expected format

- [x] Build botState object using database data instead of savedBot arrays

- [x] Keep savedBot values for: balance, realizedPnl, tradeCount, winRate, valueHistory, symbolCooldowns

### Testing

- [x] Restart server and verify bots load from database
- [x] Check orders array populated from trades table
- [x] Check botLogs array populated from bot_decisions table
- [x] Check positions array populated from positions table
- [x] Verify data format matches UI expectations
- [ ] Test with multiple users (multi-tenant)

### Additional Enhancements Completed

- [x] **Smart Summarization Logic** - Only re-summarize when 10+ new decisions accumulated (prevents every-turn summarization)
- [x] **Learning History Management** - Separate controls for clearing learning vs full reset
- [x] **Custom Tooltip System** - Beautiful dark-themed tooltips matching app aesthetic
- [x] **Frontend API Integration** - Added `clearLearningHistory` function and UI button
- [x] **Backend Endpoints** - Added `POST /api/bots/:id/clear-learning` endpoint

---

## Phase 5: Dual Write Testing ⏱️ 2-3 days monitoring ✅ IN PROGRESS

### Deployment

- [x] Deploy Phase 3 & 4 changes to staging/production
- [x] Verify saveState() still writing to arena_state (✅ 5.43 MB, actively writing)
- [ ] Monitor for 24-48 hours minimum (⏳ ongoing)

### Verification

- [x] Create `server/scripts/verify_data_consistency.js` script
- [x] Compare arena_state JSON vs relational tables
- [x] Check for any discrepancies (✅ Expected differences: DB has full history, State has current snapshot)
- [ ] Monitor database growth
- [ ] Monitor query performance

### Testing

- [x] Test bot reset functionality (✅ working with learning history options)
- [x] Test force summarization endpoint (✅ working with smart throttling)
- [x] Test bot trading execution (✅ writing to both arena_state and relational DB)
- [x] Test server restart/reload (✅ bots load from relational tables)
- [x] Test WebSocket broadcasts (✅ working)
- [x] Test frontend UI display (✅ working with custom tooltips)

---

## Phase 6: Frontend Compatibility ⏱️ 2-4 hours

### Components to Test

- [ ] `OrderHistory` component - verify displays trades correctly
- [ ] `BotStatus` component - verify displays AI logs correctly
- [ ] `PositionsTable` component - verify displays positions correctly
- [ ] Performance metrics - verify realizedPnl, tradeCount, winRate
- [ ] Value history chart - verify historical data displays

### Browser Testing

- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari (if applicable)
- [ ] Test on mobile browser

---

## Phase 7: API Routes ⏱️ 4-6 hours ✅ COMPLETED

### Endpoints Created in `server/routes/bots.js`

**GET `/api/bots/:id/trades`**:
- [x] Pagination support (limit, offset, hasMore)
- [x] Filter by symbol
- [x] Filter by action (OPEN/CLOSE)
- [x] Filter by date range (startDate, endDate)
- [x] Multi-tenant security (user_id enforcement)
- [x] Comprehensive error handling

**GET `/api/bots/:id/positions`**:
- [x] Pagination support (limit, offset, hasMore)
- [x] Filter by status (open/closed/all)
- [x] Filter by symbol
- [x] Multi-tenant security (user_id enforcement)
- [x] Comprehensive error handling

**GET `/api/bots/:id/decisions`**:
- [x] Pagination support (limit, offset, hasMore)
- [x] Filter by execution success
- [x] Multi-tenant security (user_id enforcement)
- [x] Automatically parses JSON fields
- [x] Comprehensive error handling

**Enhanced GET `/api/bots/:id`**:
- [x] Added `statistics` object with database counts:
  - totalTrades, totalPositions, openPositions, closedPositions
  - totalDecisions, successfulDecisions
- [x] All counts retrieved from relational tables

### Design Decisions

- ✅ Added to existing `bots.js` (simpler than separate route files)
- ✅ Max limit 500 per request (prevents memory issues)
- ✅ Consistent response: `{ data[], pagination{total, limit, offset, hasMore}, filters{} }`
- ✅ All endpoints authenticated with role checking

---

## Phase 8: Analytics ⏱️ 4-6 hours

### `server/routes/analytics.js`

- [ ] Update win rate calculation to query trades table
- [ ] Add PnL over time query
- [ ] Add best/worst trades query
- [ ] Add position analysis queries
- [ ] Add trade volume analysis
- [ ] Remove any arena_state JSON parsing

### Performance

- [ ] Run EXPLAIN QUERY PLAN on all queries
- [ ] Verify indexes are being used
- [ ] Optimize slow queries (>100ms)
- [ ] Add query performance logging

### Testing

- [ ] Test with small dataset
- [ ] Test with large dataset (1000+ trades)
- [ ] Verify query performance acceptable
- [ ] Test with multiple concurrent users

---

## Phase 9: Snapshot Service ⏱️ 1-2 hours

### Verification

- [ ] Review `server/services/snapshotCleanupService.js`
- [ ] Verify creates snapshots with user_id
- [ ] Check bot_state_snapshots table being populated
- [ ] Review `server/services/leaderboardService.js`
- [ ] Verify leaderboard calculations work correctly

### Testing

- [ ] Manually trigger snapshot creation
- [ ] Verify data in bot_state_snapshots table
- [ ] Test leaderboard calculation
- [ ] Verify cleanup service runs correctly

---

## Phase 10: Arena State Cleanup Phase 1 ⏱️ 2-3 hours

### Prerequisites

- [ ] **WAIT 1 WEEK** after Phase 5 deployment
- [ ] Verify all systems working correctly
- [ ] Create fresh backup before modifications

### Code Changes: `server/services/BotManager.js`

**saveState() method - Lines ~2182-2204**:

- [ ] Modify to exclude `bot.orders` array from serialization
- [ ] Modify to exclude `bot.botLogs` array from serialization  
- [ ] Modify to exclude `bot.portfolio.positions` array from serialization
- [ ] Keep essential fields: balance, pnl, totalValue, realizedPnl, tradeCount, winRate, valueHistory, symbolCooldowns, isPaused, isLoading

### Deployment & Monitoring

- [ ] Deploy changes
- [ ] Monitor arena_state size
- [ ] Verify size reduced from ~2.7MB to ~100KB
- [ ] Monitor for any errors
- [ ] Verify UI still works correctly

---

## Phase 11: Arena State Cleanup Phase 2 ⏱️ 2-3 hours

### Code Changes: `server/services/BotManager.js`

**Remove in-memory arrays**:
- [ ] Remove bot.orders array from in-memory state
- [ ] Remove bot.botLogs array from in-memory state
- [ ] Keep bot.portfolio.positions in memory for performance

**Update broadcastState()**:
- [ ] Query last 10 trades from database for WebSocket payload
- [ ] Query last 5 decisions from database for WebSocket payload
- [ ] Send current positions from in-memory state
- [ ] Optimize payload size

### Testing

- [ ] Test WebSocket broadcasts
- [ ] Verify frontend receives correct data
- [ ] Test with multiple connected clients
- [ ] Monitor WebSocket performance

---

## Phase 12: Performance Optimization ⏱️ 2-4 hours

### Monitoring

- [ ] Add query performance logging to all DB operations
- [ ] Log slow queries (>100ms)
- [ ] Monitor database file size
- [ ] Monitor memory usage

### Optimization

- [ ] Run EXPLAIN QUERY PLAN on all queries
- [ ] Verify all indexes are being used effectively
- [ ] Add connection pooling if needed
- [ ] Set up automated VACUUM schedule

### Testing

- [ ] Load test with 10+ active bots
- [ ] Monitor query performance under load
- [ ] Test concurrent access patterns
- [ ] Verify no performance regressions

---

## Phase 13: Documentation ⏱️ 2-4 hours

### Update Existing Docs

- [ ] Update `DATA_PERSISTENCE_AUDIT.md` - mark as RESOLVED
- [ ] Update `DEVELOPMENT.md` - add schema documentation
- [ ] Update `README.md` if needed

### Create New Docs

- [ ] Create `MIGRATION_COMPLETED.md` - document the changes
- [ ] Document backup/restore procedures
- [ ] Document performance optimization guidelines
- [ ] Create troubleshooting guide

---

## Phase 14: Comprehensive Testing ⏱️ 4-8 hours

### Functional Tests

- [ ] Test bot trading turn execution
- [ ] Test bot restart/reload from database
- [ ] Test bot reset functionality
- [ ] Test position opening and closing
- [ ] Test AI decision logging
- [ ] Test history summarization

### Multi-User Tests

- [ ] Create test users
- [ ] Test data isolation between users
- [ ] Verify user_id filtering works
- [ ] Test admin access to all data

### Performance Tests

- [ ] Load test with multiple bots
- [ ] Test concurrent trading
- [ ] Test database backup/restore
- [ ] Test with large dataset

### Edge Cases

- [ ] Test server crash recovery
- [ ] Test database connection failure
- [ ] Test rapid bot creation/deletion
- [ ] Test concurrent position closes

---

## Phase 15: Final Deployment ⏱️ 1-2 days

### Pre-Deployment

- [ ] Remove deprecated migration scripts (if any)
- [ ] Clean up console.log statements
- [ ] Final code review
- [ ] Update version numbers

### Deployment Checklist

- [ ] Create production backup
- [ ] Document current production state
- [ ] Prepare rollback plan
- [ ] Schedule maintenance window if needed
- [ ] Deploy to production
- [ ] Verify deployment successful

### Post-Deployment

- [ ] Monitor for 48 hours minimum
- [ ] Check error logs daily
- [ ] Monitor database size growth
- [ ] Monitor query performance
- [ ] Verify all features working
- [ ] Gather user feedback

### Completion

- [ ] Mark `DATA_PERSISTENCE_AUDIT.md` as RESOLVED
- [ ] Update project status
- [ ] Celebrate! 🎉

---

## Emergency Rollback Procedure

If critical issues arise:

1. **Stop the server**
   ```bash
   pm2 stop bonerbots-server
   ```

2. **Restore from backup**
   ```bash
   cp data/backups/arena_backup_TIMESTAMP.db data/arena.db
   ```

3. **Revert code changes**
   ```bash
   git checkout [previous-commit-hash]
   ```

4. **Restart server**
   ```bash
   pm2 start bonerbots-server
   ```

5. **Verify system operational**

6. **Document what went wrong**

7. **Plan fixes before re-attempting**

---

## Success Verification

After completing all phases, verify:

- [ ] All trades stored in `trades` table with user_id
- [ ] All positions stored in `positions` table with user_id
- [ ] All AI logs stored in `bot_decisions` table with user_id
- [ ] arena_state size < 200KB
- [ ] All queries execute in < 100ms
- [ ] Bots trade normally
- [ ] History summarization works
- [ ] Analytics functional
- [ ] Leaderboard accurate
- [ ] Multi-tenancy enforced
- [ ] No data integrity issues
- [ ] Frontend UI works perfectly
- [ ] Documentation complete

---

**Status**: Ready to begin Phase 1  
**Last Updated**: 2025-11-06

