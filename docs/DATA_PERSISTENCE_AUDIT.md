# Data Persistence Architecture Audit

## Executive Summary

**Status**: ❌ CRITICAL ARCHITECTURAL ISSUE  
**Impact**: History summarization broken, analytics inefficient, data integrity compromised  
**Root Cause**: Trade, position, and AI log data stored in JSON blob instead of relational tables  
**Solution**: Multi-phase refactoring to persist data in proper tables

---

## Current State (DETAILED ANALYSIS)

### What's Stored Where

#### ✅ **Properly Stored in Database Tables**
1. **bot_state_snapshots** - 18,068 rows ✓
   - Periodic snapshots of bot portfolio state
   - Used by leaderboard calculations
   - Correctly persisted

2. **bots** - Bot configurations ✓
   - Bot metadata (id, name, prompt, provider_id, etc.)
   - Correctly persisted

3. **users** - User accounts ✓
   - User authentication data
   - Correctly persisted

4. **llm_providers** - LLM provider configs ✓
   - API keys, endpoints, model names
   - Correctly persisted

#### ❌ **INCORRECTLY Stored in arena_state JSON Blob**

**Table**: `arena_state`
**Location**: Single row in database
**Size**: 2.7MB JSON blob
**Updated**: After every bot trading turn via `BotManager.saveState()`

Current `arena_state.state` structure:
```json
{
  "bots": [
    {
      "id": "bot_astrologer",
      "userId": "0b880cf70bdc6ad15cd49ff0600dc023",
      "name": "Astrologer",
      "prompt": "You are \"Astrologer\", a mystical trading bot...",
      "provider": "gemini",
      "tradingMode": "paper",
      "initialBalance": 10000,
      
      // ❌ PROBLEM: 108 trades stored as in-memory array
      "orders": [
        {
          "id": "order_1234",
          "symbol": "XRPUSDT",
          "action": "LONG",
          "side": "entry",
          "price": 2.45,
          "size": 100,
          "leverage": 3,
          "timestamp": 1730912107000,
          "pnl": 5.23
        },
        // ... 107 more trades
      ],
      
      // ❌ PROBLEM: 40 AI decision logs stored as in-memory array
      "botLogs": [
        {
          "timestamp": 1730912107000,
          "prompt": "You are \"Astrologer\"...[FULL 2984 char prompt]",
          "decisions": [
            {
              "action": "LONG",
              "symbol": "XRPUSDT",
              "reasoning": "The stars align...",
              "size": 100,
              "leverage": 3,
              "stopLoss": 2.40,
              "takeProfit": 2.55
            }
          ],
          "notes": [
            "✅ Position opened successfully",
            "Entry price: $2.45"
          ]
        },
        // ... 39 more decision logs
      ],
      
      // ❌ PROBLEM: 2 open positions stored as in-memory array
      "portfolio": {
        "balance": 8234.12,
        "pnl": 289.33,
        "totalValue": 10523.45,
        "positions": [
          {
            "id": "pos_5678",
            "symbol": "BTCUSDT",
            "type": "LONG",
            "entryPrice": 45230.50,
            "size": 500,
            "leverage": 3,
            "pnl": 125.50,
            "stopLoss": 44800,
            "takeProfit": 46500,
            "liquidationPrice": 43200
          },
          {
            "id": "pos_5679",
            "symbol": "ETHUSDT",
            "type": "SHORT",
            "entryPrice": 2450.30,
            "size": 300,
            "leverage": 2,
            "pnl": -45.20,
            "stopLoss": 2500,
            "takeProfit": 2380,
            "liquidationPrice": 2580
          }
        ]
      },
      
      "realizedPnl": 523.45,
      "tradeCount": 108,
      "winRate": 0.625,
      "valueHistory": [...],  // OK - can stay in memory
      "symbolCooldowns": {...},  // OK - can stay in memory
      "isLoading": false,
      "isPaused": false
    },
    // ... 3 more bots with similar structure
  ],
  "marketData": [
    {
      "symbol": "BTCUSDT",
      "price": 45340.00,
      "price24hChange": 2.3,
      // ... more market data
    },
    // ... 217 more symbols
  ]
}

#### ⚠️ **Empty Tables (Not Being Used)**
1. **trades** - 0 rows
   - Should contain: All completed trades (entries/exits)
   - Currently in: `arena_state.state.bots[].orders`

2. **positions** - 0 rows
   - Should contain: All open/closed positions
   - Currently in: `arena_state.state.bots[].portfolio.positions`

3. **bot_decisions** - 0 rows
   - Should contain: All AI decision logs (prompts + decisions)
   - Currently in: `arena_state.state.bots[].botLogs`

### Impact of Current Architecture

#### 🔴 **Critical Issues**
1. **No Data Integrity**
   - No foreign key enforcement
   - No constraints
   - Data can become inconsistent

2. **Poor Query Performance**
   - Must parse 2.7MB JSON blob to query anything
   - No indexes on trade data
   - No efficient filtering/aggregation

3. **History Summarization Broken**
   - Looking for data in `bot_decisions` table (empty)
   - Data actually in `arena_state` JSON blob
   - Can't efficiently paginate or filter

4. **Leaderboard Inefficiency**
   - Currently works (uses `bot_state_snapshots` ✓)
   - But could be more accurate with actual trade data

5. **Analytics Broken/Inefficient**
   - Queries expect data in proper tables
   - Data actually in JSON blob
   - Performance degrades as state grows

6. **Multi-Tenancy Compromised**
   - User isolation not enforced at DB level
   - Relies on application logic only

#### 🟡 **Secondary Issues**
1. **Backup/Recovery Difficult**
   - Can't selectively backup trade data
   - All-or-nothing with arena_state

2. **Audit Trail Incomplete**
   - No proper audit log for trades
   - Can't track who made what trade when

3. **Data Migration Challenges**
   - Hard to migrate to new structure
   - Hard to export/import data

### Complete Data Flow Analysis

#### 1. Server Startup Sequence
```
server.js:28
├─ BotManager constructor()
│  └─ Initialize empty: this.bots = new Map()
│
└─ BotManager.start() [line 71]
   ├─ loadSettings() [line 103] ✓ Loads from system_settings table
   │  └─ Sets: this.settings
   │
   ├─ loadExchangeInfo() [line 167] ✓ Fetches from exchange API
   │  └─ Sets: this.symbolPrecisions
   │
   ├─ loadBots() [line 269] ⚠️ CRITICAL METHOD
   │  ├─ Query: SELECT * FROM bots WHERE is_active = 1
   │  ├─ Query: SELECT state FROM arena_state LIMIT 1
   │  │  └─ Parses 2.7MB JSON blob
   │  │
   │  ├─ For each bot config from database:
   │  │  ├─ Find matching savedBot in arena_state.bots[]
   │  │  │
   │  │  ├─ IF savedBot found: [line 345-360]
   │  │  │  ├─ Restore bot.orders from JSON (108 trades) ❌
   │  │  │  ├─ Restore bot.botLogs from JSON (40 logs) ❌
   │  │  │  ├─ Restore bot.portfolio.positions from JSON (2 positions) ❌
   │  │  │  └─ Load into: this.bots.get(userId).set(botId, botState)
   │  │  │
   │  │  └─ ELSE create fresh state: [line 364-389]
   │  │     ├─ orders: []
   │  │     ├─ botLogs: []
   │  │     └─ portfolio: { positions: [] }
   │  │
   │  └─ Initialize round-robin scheduling
   │
   └─ startTrading() [line 484]
      ├─ Starts refresh interval (fetch market data)
      └─ Starts turn interval (process bot decisions)
```

#### 2. Bot Trading Turn Flow (Every 3.33 minutes)
```
BotManager.runTradingTurn() [line 517]
├─ For each active bot:
│  │
│  ├─ getTradingDecision(bot) [line 971]
│  │  ├─ getTradingDecisionStandard(bot) [line 1108]
│  │  │  ├─ loadAndManageHistory(bot) [line 987] ❌ BROKEN
│  │  │  │  └─ Tries to query bot_decisions table (EMPTY)
│  │  │  │  └─ Should read from bot.botLogs instead
│  │  │  │
│  │  │  ├─ generatePromptWithHistory() [line 1695]
│  │  │  │  └─ Builds prompt with market data + history
│  │  │  │
│  │  │  └─ callAIProvider() [line 1456]
│  │  │     └─ Returns: { text: "[{action: 'LONG', ...}]" }
│  │  │
│  │  └─ OR getTradingDecisionWithSandbox(bot) [line 1286]
│  │     └─ Multi-step analysis for advanced bots
│  │
│  ├─ validateDecisions() [line 1826]
│  │  └─ Validates size, leverage, balance
│  │
│  ├─ executeDecisions() [line 1854] ⚠️ NO DATABASE WRITES
│  │  │
│  │  ├─ For LONG/SHORT action: [line 1869-2073]
│  │  │  ├─ Calculate position details
│  │  │  ├─ Create position object
│  │  │  ├─ bot.portfolio.positions.push(position) ❌ In-memory only
│  │  │  ├─ Update bot.portfolio.balance
│  │  │  ├─ Create order record
│  │  │  ├─ bot.orders.unshift(entryOrder) ❌ In-memory only
│  │  │  └─ notes.push("SUCCESS: Opened position...")
│  │  │
│  │  └─ For CLOSE action: [line 2075-2166]
│  │     ├─ Find position in bot.portfolio.positions
│  │     ├─ Calculate PnL
│  │     ├─ Update bot.portfolio.balance
│  │     ├─ Remove from bot.portfolio.positions
│  │     ├─ Create exit order record
│  │     ├─ bot.orders.unshift(exitOrder) ❌ In-memory only
│  │     ├─ Update bot.realizedPnl
│  │     ├─ Update bot.tradeCount
│  │     ├─ Update bot.winRate
│  │     └─ notes.push("SUCCESS: Closed position...")
│  │
│  ├─ Log decision: [line 944-952]
│  │  ├─ Create newLog = { timestamp, decisions, prompt, notes }
│  │  ├─ bot.botLogs.unshift(newLog) ❌ In-memory only
│  │  └─ bot.botLogs = bot.botLogs.slice(0, 50)  // Keep last 50
│  │
│  └─ Update bot.isLoading = false
│
├─ saveState() [line 2182] ⚠️ WRITES EVERYTHING TO JSON
│  ├─ Serialize: { bots: this.getAllBots(), marketData: this.markets }
│  ├─ JSON.stringify() -> Creates 2.7MB string
│  ├─ DELETE FROM arena_state
│  └─ INSERT INTO arena_state (state, updated_at) VALUES (?, ?)
│     └─ Writes entire 2.7MB blob to database
│
└─ broadcastState() [line 2217]
   └─ Send state to all WebSocket clients
```

#### 3. Snapshot Service (Every 10 minutes)
```
snapshotService.js
├─ Query: SELECT state FROM arena_state
├─ Parse JSON blob
├─ For each bot:
│  ├─ Extract current portfolio state
│  └─ INSERT INTO bot_state_snapshots ✓ WORKS
│     └─ (bot_id, balance, realized_pnl, total_value, trade_count, win_rate, timestamp)
│
└─ ✅ This is why leaderboard works!
```

#### 4. User Views Trade History (Frontend)
```
Frontend: OrderHistory component
├─ Receives bot.orders[] via WebSocket
├─ bot.orders comes from: arena_state.bots[].orders
└─ Displays in UI ✓ WORKS (but only while server running)
```

#### 5. User Views AI Log (Frontend)
```
Frontend: BotStatus component
├─ Receives bot.botLogs[] via WebSocket
├─ bot.botLogs comes from: arena_state.bots[].botLogs
└─ Displays in UI ✓ WORKS (but only while server running)
```

#### 6. Force History Summarization (Broken)
```
POST /api/v2/bots/:id/force-summarize [routes/bots.js:363]
├─ Query: SELECT * FROM bot_decisions WHERE bot_id = ? ❌ RETURNS 0 ROWS
├─ Check: if (decisions.length < 5) return 400 error
└─ ❌ FAILS because bot_decisions table is empty
```

#### 7. Leaderboard Calculation (Works)
```
leaderboardService.calculateRankings() [services/leaderboardService.js]
├─ Query: SELECT * FROM bot_state_snapshots ✓ 18,068 rows
├─ Calculate metrics from snapshots
└─ ✅ WORKS because snapshots are properly persisted
```

#### 8. Analytics Queries (Inefficient)
```
analytics routes [routes/analytics.js]
├─ Query trades: ❌ Would query trades table (empty)
├─ Query positions: ❌ Would query positions table (empty)
└─ ⚠️ Currently must parse arena_state JSON for analysis
```

#### Data Persistence Layers

**Layer 1: In-Memory (BotManager)**
- `this.bots` Map - Current bot states
  - `bot.orders[]` - Trade history
  - `bot.botLogs[]` - AI decision logs
  - `bot.portfolio.positions[]` - Open positions
  - `bot.valueHistory[]` - Portfolio value over time

**Layer 2: arena_state Table**
- Serialized JSON of `this.bots`
- Written by `saveState()` after each turn
- Read by `loadState()` on server startup
- ✓ Ensures persistence across restarts
- ❌ But terrible for queries/analytics

**Layer 3: Relational Tables (MOSTLY UNUSED)**
- `trades` - Empty ❌
- `positions` - Empty ❌
- `bot_decisions` - Empty ❌
- `bot_state_snapshots` - Used ✓ (18k rows)

###  Methods That Need Modification

| File | Method | Line | Current Behavior | Required Change |
|------|--------|------|------------------|-----------------|
| `BotManager.js` | `executeDecisions()` | 1854 | Adds to `bot.orders[]` in-memory | Add: `db.createTrade()` call |
| `BotManager.js` | `executeDecisions()` | 1869 | Adds to `bot.portfolio.positions[]` | Add: `db.createPosition()` call |
| `BotManager.js` | `executeDecisions()` | 2075 | Removes from `bot.portfolio.positions[]` | Add: `db.updatePosition()` + `db.createTrade()` |
| `BotManager.js` | `runTradingTurn()` | 944 | Adds to `bot.botLogs[]` | Add: `db.createDecision()` call |
| `BotManager.js` | `loadBots()` | 336 | Loads from `arena_state.bots[].orders` | Change: Load from `trades` table |
| `BotManager.js` | `loadBots()` | 337 | Loads from `arena_state.bots[].botLogs` | Change: Load from `bot_decisions` table |
| `BotManager.js` | `loadBots()` | 345 | Loads from `arena_state.bots[].portfolio.positions` | Change: Load from `positions` table |
| `BotManager.js` | `loadAndManageHistory()` | 987 | ~~Queries `bot_decisions` table~~ | Fix: Currently broken, read from `bot.botLogs` temporarily |
| `routes/bots.js` | `POST /force-summarize` | 399 | Queries `bot_decisions` table (empty) | Will work after `bot_decisions` populated |
| `database/relational.js` | `createPosition()` | NEW | Doesn't exist | Create: Insert into `positions` table |
| `database/relational.js` | `updatePosition()` | NEW | Doesn't exist | Create: Update `positions` table |
| `database/relational.js` | `getPositions()` | NEW | Doesn't exist | Create: Query open positions for bot |

### What Needs to Happen

#### Phase 1: Migration Script
Create `server/scripts/migrate_state_to_tables.js`:
- Read `arena_state.state`
- Extract all bot data
- Insert into proper tables:
  - `bot.orders[]` → `trades` table
  - `bot.botLogs[]` → `bot_decisions` table
  - `bot.portfolio.positions[]` → `positions` table

#### Phase 2: Refactor BotManager Write Operations
Update these methods to write to DB:
1. **`executeDecisions()`**
   - When opening position: INSERT into `positions` table
   - When closing position: UPDATE `positions` table + INSERT into `trades` table

2. **`runTradingTurn()`**
   - After getting AI decision: INSERT into `bot_decisions` table

3. **Keep `saveState()` for now**
   - Still serialize to `arena_state` for backwards compatibility
   - But primary source of truth becomes relational tables

#### Phase 3: Refactor BotManager Read Operations
Update these methods to read from DB:
1. **`loadState()` / bot initialization**
   - Load recent positions from `positions` table
   - Load recent orders from `trades` table
   - Load recent decisions from `bot_decisions` table
   - Still use `arena_state` as fallback for other state

2. **`loadAndManageHistory()`**
   - Read from `bot_decisions` table
   - No longer read from `arena_state.botLogs`

#### Phase 4: Update Dependent Systems
1. **Leaderboard** - Already works (uses snapshots) ✓
2. **Analytics** - Update to use proper tables
3. **History Summarization** - Already fixed to use bot_decisions

#### Phase 5: Cleanup
1. Remove `orders`, `botLogs`, `positions` from arena_state after verification
2. Keep only essential state (valueHistory, settings, etc.)
3. Reduce arena_state size from 2.7MB to ~100KB

### Database Schema Reference

#### trades table
```sql
CREATE TABLE trades (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  bot_id TEXT NOT NULL,
  position_id TEXT,
  symbol TEXT NOT NULL,
  trade_type TEXT NOT NULL,  -- 'entry' or 'exit'
  action TEXT NOT NULL,       -- 'LONG' or 'SHORT'
  entry_price REAL,
  exit_price REAL,
  size REAL NOT NULL,
  leverage INTEGER,
  pnl REAL,
  fee REAL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### positions table
```sql
CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  bot_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  position_type TEXT NOT NULL,  -- 'LONG' or 'SHORT'
  entry_price REAL NOT NULL,
  size REAL NOT NULL,
  leverage INTEGER DEFAULT 1,
  stop_loss REAL,
  take_profit REAL,
  liquidation_price REAL,
  unrealized_pnl REAL DEFAULT 0,
  status TEXT DEFAULT 'open',   -- 'open' or 'closed'
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### bot_decisions table
```sql
CREATE TABLE bot_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  bot_id TEXT NOT NULL,
  prompt_sent TEXT NOT NULL,      -- Full prompt with context
  decisions_json TEXT NOT NULL,   -- Array of decisions
  notes_json TEXT,                -- Execution notes/outcomes
  execution_success BOOLEAN NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Success Criteria

✅ **Data Integrity**
- All trades in `trades` table
- All positions in `positions` table
- All AI logs in `bot_decisions` table
- Foreign keys enforced

✅ **Performance**
- Queries execute in <100ms
- No need to parse large JSON blobs
- Proper indexes on frequently queried columns

✅ **Functionality**
- Bots continue trading normally
- History summarization works
- Leaderboard accurate
- Analytics functional
- Data survives server restart

✅ **Maintainability**
- Clear separation of concerns
- Standard SQL queries
- Easy to add new features
- Easy to debug issues

