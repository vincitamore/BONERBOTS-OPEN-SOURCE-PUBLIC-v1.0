# BONERBOTS AI Arena - Implementation Roadmap

**Version:** 1.0  
**Date:** 2025-11-04  
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Strategic Vision](#strategic-vision)
4. [Implementation Phases](#implementation-phases)
5. [Database Architecture Redesign](#database-architecture-redesign)
6. [Backend API Enhancements](#backend-api-enhancements)
7. [Frontend Configuration System](#frontend-configuration-system)
8. [Data Visualization & Analytics](#data-visualization--analytics)
9. [Security & Access Control](#security--access-control)
10. [Testing & Quality Assurance](#testing--quality-assurance)
11. [Deployment & Migration](#deployment--migration)
12. [Future Considerations](#future-considerations)

---

## Executive Summary

This document outlines a comprehensive transformation of the BONERBOTS AI Arena from a developer-centric prototype into a professional, self-configurable trading platform. The implementation focuses on three core pillars:

1. **Data Foundation**: Robust relational database schema for deep historical insights
2. **User Empowerment**: Complete UI-based configuration eliminating code dependencies
3. **Professional Experience**: Enterprise-grade security, aesthetics, and functionality

**Estimated Timeline:** 8-12 weeks (phased implementation)  
**Risk Level:** Medium (requires careful data migration and testing)  
**Impact:** High (transforms user experience and scalability)

---

## Current State Analysis

### Strengths

- Clean local-first architecture with Express + SQLite
- Real-time WebSocket updates working well
- Basic multi-bot system operational
- Solid foundation with React + TypeScript

### Limitations

#### Database Layer
- Single JSON blob storage in `arena_state` table
- No relational structure or normalized data
- Limited query capabilities for analytics
- No historical data retention beyond current session
- No audit trail or change tracking

#### Configuration Management
- Hard-coded bot configurations in `useTradingBot.ts`
- API keys stored in server `.env` file (manual editing required)
- Bot prompts hard-coded in `prompts.ts`
- No runtime configuration changes
- LLM endpoints hard-coded in service files

#### User Experience
- Developer tools required for any configuration change
- No historical data visualization
- Limited analytics and insights
- No user management or access control
- Basic UI without advanced features

---

## Strategic Vision

### Target User Profile

**Primary Users:**
- Crypto traders interested in AI-driven strategies
- Researchers experimenting with LLM trading behaviors
- Power users managing multiple bot personalities
- Teams collaborating on trading strategies

**Key User Needs:**
- Add and modify trading bots without touching code
- Analyze historical performance with rich visualizations
- Configure AI providers (OpenAI, Anthropic, local models)
- Manage API keys and wallets through secure UI
- Track every trade with detailed audit logs
- Compare bot performance across multiple dimensions

### Success Metrics

1. **Configuration Time**: Reduce new bot setup from 30 minutes (code changes) to 2 minutes (UI forms)
2. **Data Depth**: Enable analysis of historical data spanning weeks/months
3. **User Independence**: Zero code changes required for 95% of use cases
4. **System Reliability**: 99.9% uptime with proper error handling
5. **Performance**: Sub-second query response for analytics

---

## Implementation Phases

### Phase 1: Database Foundation (Weeks 1-2)

**Objective**: Establish robust relational database schema

**Deliverables:**
- [ ] Complete database schema design
- [ ] Migration scripts from current JSON blob
- [ ] Database seeding utilities
- [ ] Comprehensive indexes for performance
- [ ] Data validation layer
- [ ] Backup and restore utilities

**Dependencies**: None  
**Risk**: Medium (data migration complexity)

### Phase 2: Backend API Layer (Weeks 3-4)

**Objective**: Build RESTful API for configuration and data access

**Deliverables:**
- [ ] Configuration management API endpoints
- [ ] Historical data query API
- [ ] Bot management CRUD operations
- [ ] LLM provider management API
- [ ] Wallet/API key management API
- [ ] Analytics aggregation endpoints
- [ ] API documentation (OpenAPI/Swagger)

**Dependencies**: Phase 1 complete  
**Risk**: Low

### Phase 3: Configuration UI (Weeks 5-7)

**Objective**: Build user-friendly configuration interfaces

**Deliverables:**
- [ ] Bot configuration dashboard
- [ ] Prompt editor with syntax highlighting
- [ ] LLM provider configuration
- [ ] Wallet and API key management UI
- [ ] Trading parameter configuration
- [ ] User preferences and settings
- [ ] Configuration import/export

**Dependencies**: Phase 2 complete  
**Risk**: Low

### Phase 4: Data Visualization & Analytics (Weeks 8-10)

**Objective**: Implement advanced historical data exploration

**Deliverables:**
- [ ] Historical performance charts
- [ ] Trade analytics dashboard
- [ ] Bot comparison tools
- [ ] Market correlation analysis
- [ ] Profit/loss attribution
- [ ] Risk metrics visualization
- [ ] Export capabilities (CSV, JSON)

**Dependencies**: Phases 1 & 2 complete  
**Risk**: Low

### Phase 5: Security & Polish (Weeks 11-12)

**Objective**: Production-ready security and UX refinement

**Deliverables:**
- [ ] User authentication system
- [ ] Role-based access control
- [ ] API key encryption at rest
- [ ] Audit logging system
- [ ] UI/UX polish and consistency
- [ ] Comprehensive error handling
- [ ] Performance optimization

**Dependencies**: All previous phases  
**Risk**: Medium (security requires careful implementation)

---

## Database Architecture Redesign

### Current Schema

```sql
-- Single table with JSON blob
CREATE TABLE arena_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state TEXT NOT NULL,  -- Entire application state as JSON
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Proposed Schema

#### Core Tables

**1. bots**
```sql
CREATE TABLE bots (
  id TEXT PRIMARY KEY,                    -- e.g., 'bot_degen'
  name TEXT NOT NULL,                     -- Display name
  prompt TEXT NOT NULL,                   -- Trading personality prompt
  provider_id INTEGER NOT NULL,           -- FK to llm_providers
  trading_mode TEXT NOT NULL CHECK (trading_mode IN ('paper', 'real')),
  is_active BOOLEAN DEFAULT true,
  is_paused BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES llm_providers(id)
);

CREATE INDEX idx_bots_active ON bots(is_active);
CREATE INDEX idx_bots_provider ON bots(provider_id);
```

**2. llm_providers**
```sql
CREATE TABLE llm_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,              -- e.g., 'Gemini 2.5 Flash'
  provider_type TEXT NOT NULL,            -- 'openai', 'anthropic', 'gemini', 'grok', 'local'
  api_endpoint TEXT NOT NULL,             -- Full API URL
  model_name TEXT,                        -- Model identifier
  api_key_encrypted TEXT,                 -- Encrypted API key
  config_json TEXT,                       -- Additional configuration as JSON
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_providers_active ON llm_providers(is_active);
```

**3. wallets**
```sql
CREATE TABLE wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id TEXT NOT NULL,                   -- FK to bots
  exchange TEXT NOT NULL,                 -- 'asterdex', 'binance', etc.
  api_key_encrypted TEXT NOT NULL,        -- Encrypted API key
  api_secret_encrypted TEXT NOT NULL,     -- Encrypted API secret
  wallet_address TEXT,                    -- Optional public address
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX idx_wallets_bot ON wallets(bot_id);
CREATE UNIQUE INDEX idx_wallets_bot_exchange ON wallets(bot_id, exchange);
```

**4. bot_state_snapshots**
```sql
CREATE TABLE bot_state_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id TEXT NOT NULL,                   -- FK to bots
  balance REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  realized_pnl REAL NOT NULL,
  total_value REAL NOT NULL,
  trade_count INTEGER NOT NULL,
  win_rate REAL NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX idx_snapshots_bot_time ON bot_state_snapshots(bot_id, timestamp);
CREATE INDEX idx_snapshots_timestamp ON bot_state_snapshots(timestamp);
```

**5. positions**
```sql
CREATE TABLE positions (
  id TEXT PRIMARY KEY,                    -- Position identifier
  bot_id TEXT NOT NULL,                   -- FK to bots
  symbol TEXT NOT NULL,
  position_type TEXT NOT NULL CHECK (position_type IN ('LONG', 'SHORT')),
  entry_price REAL NOT NULL,
  size REAL NOT NULL,                     -- Margin used in USD
  leverage INTEGER NOT NULL,
  liquidation_price REAL,
  stop_loss REAL,
  take_profit REAL,
  unrealized_pnl REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX idx_positions_bot ON positions(bot_id);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_positions_opened ON positions(opened_at);
```

**6. trades**
```sql
CREATE TABLE trades (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL,                   -- FK to bots
  position_id TEXT,                       -- FK to positions (nullable for orphaned trades)
  symbol TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('LONG', 'SHORT')),
  action TEXT NOT NULL CHECK (action IN ('OPEN', 'CLOSE')),
  entry_price REAL NOT NULL,
  exit_price REAL,
  size REAL NOT NULL,
  leverage INTEGER NOT NULL,
  pnl REAL NOT NULL,
  fee REAL NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
);

CREATE INDEX idx_trades_bot ON trades(bot_id);
CREATE INDEX idx_trades_position ON trades(position_id);
CREATE INDEX idx_trades_executed ON trades(executed_at);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_pnl ON trades(pnl);
```

**7. bot_decisions**
```sql
CREATE TABLE bot_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id TEXT NOT NULL,                   -- FK to bots
  prompt_sent TEXT NOT NULL,              -- Full prompt sent to LLM
  decisions_json TEXT NOT NULL,           -- Array of decisions as JSON
  notes_json TEXT,                        -- Validation notes and errors
  execution_success BOOLEAN NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX idx_decisions_bot ON bot_decisions(bot_id);
CREATE INDEX idx_decisions_timestamp ON bot_decisions(timestamp);
```

**8. market_data**
```sql
CREATE TABLE market_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  price REAL NOT NULL,
  price_24h_change REAL NOT NULL,
  volume_24h REAL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_market_symbol_time ON market_data(symbol, timestamp);
CREATE INDEX idx_market_timestamp ON market_data(timestamp);
```

**9. system_settings**
```sql
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default settings
INSERT INTO system_settings (key, value, data_type, description) VALUES
  ('paper_bot_initial_balance', '10000', 'number', 'Starting balance for paper trading bots'),
  ('live_bot_initial_balance', '950', 'number', 'Starting balance for live trading bots'),
  ('turn_interval_ms', '300000', 'number', 'Interval between bot trading decisions (ms)'),
  ('refresh_interval_ms', '5000', 'number', 'Portfolio refresh interval (ms)'),
  ('minimum_trade_size_usd', '50', 'number', 'Minimum trade size in USD'),
  ('symbol_cooldown_ms', '1800000', 'number', 'Cooldown after closing position (ms)'),
  ('trading_symbols', '["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","DOGEUSDT","XRPUSDT"]', 'json', 'Symbols available for trading'),
  ('broadcast_password', 'bonerbots', 'string', 'Password for broadcast mode'),
  ('max_bots', '10', 'number', 'Maximum number of bots allowed');
```

**10. audit_log**
```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,               -- 'bot_created', 'bot_updated', 'trade_executed', etc.
  entity_type TEXT NOT NULL,              -- 'bot', 'wallet', 'trade', etc.
  entity_id TEXT,
  user_id TEXT,                           -- For future multi-user support
  details_json TEXT,                      -- Event details as JSON
  ip_address TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
```

**11. users** (Future-proofing for multi-user support)
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(is_active);
```

### Migration Strategy

**Step 1: Create New Schema**
```bash
# Execute migration script
node server/scripts/migrate_to_relational.js
```

**Step 2: Data Transformation**
- Read current `arena_state` JSON blob
- Parse and validate all bot states
- Transform into relational records
- Insert into new tables with proper foreign keys
- Verify data integrity

**Step 3: Backup Strategy**
- Create timestamped backup of old database
- Store in `data/backups/` directory
- Keep backups for 30 days
- Provide rollback script if needed

**Step 4: Validation**
- Compare old vs new data
- Run integrity checks
- Test all API endpoints
- Verify WebSocket updates

---

## Backend API Enhancements

### New API Endpoints

#### Bot Management

**GET /api/bots**
- List all bots with their configurations
- Query parameters: `active`, `trading_mode`, `provider_id`
- Response: Array of bot objects with full details

**GET /api/bots/:id**
- Get specific bot details including current state
- Response: Bot object with latest snapshot

**POST /api/bots**
- Create new bot
- Request body: `{ name, prompt, provider_id, trading_mode }`
- Validation: Unique name, valid provider, prompt not empty
- Response: Created bot object

**PUT /api/bots/:id**
- Update bot configuration
- Request body: Partial bot object
- Cannot change `id` or `created_at`
- Response: Updated bot object

**DELETE /api/bots/:id**
- Soft delete bot (sets `is_active = false`)
- Cascade behavior handled by database
- Response: Success confirmation

**POST /api/bots/:id/pause**
- Pause/unpause bot trading
- Request body: `{ paused: boolean }`
- Response: Updated bot state

**POST /api/bots/:id/reset**
- Reset bot to initial state
- Clear positions, trades, reset balance
- Keep configuration intact
- Response: Reset bot state

#### LLM Provider Management

**GET /api/providers**
- List all LLM providers
- Query parameters: `active`, `provider_type`
- Response: Array of provider objects (API keys redacted)

**POST /api/providers**
- Add new LLM provider
- Request body: `{ name, provider_type, api_endpoint, model_name, api_key, config_json }`
- Encrypts API key before storage
- Response: Created provider object

**PUT /api/providers/:id**
- Update provider configuration
- Can update API key (will be re-encrypted)
- Response: Updated provider object

**DELETE /api/providers/:id**
- Delete provider (fails if bots are using it)
- Response: Success or error with dependent bots

**POST /api/providers/:id/test**
- Test provider connection
- Makes sample API call
- Response: Success/failure with error details

#### Wallet Management

**GET /api/wallets**
- List all wallets
- Query parameters: `bot_id`, `exchange`
- Response: Array of wallet objects (secrets redacted)

**GET /api/wallets/bot/:botId**
- Get wallets for specific bot
- Response: Array of wallet objects

**POST /api/wallets**
- Add wallet for bot
- Request body: `{ bot_id, exchange, api_key, api_secret, wallet_address }`
- Encrypts credentials before storage
- Response: Created wallet object

**PUT /api/wallets/:id**
- Update wallet credentials
- Re-encrypts if credentials changed
- Response: Updated wallet object

**DELETE /api/wallets/:id**
- Delete wallet
- Response: Success confirmation

#### Historical Data & Analytics

**GET /api/analytics/bot/:botId/performance**
- Get performance metrics for bot
- Query parameters: `start_date`, `end_date`, `interval`
- Response: Time-series performance data

**GET /api/analytics/bot/:botId/trades**
- Get trade history
- Query parameters: `start_date`, `end_date`, `symbol`, `limit`, `offset`
- Response: Paginated trade list with totals

**GET /api/analytics/bot/:botId/positions/history**
- Get historical positions (closed positions)
- Query parameters: `start_date`, `end_date`, `symbol`
- Response: Array of closed positions with PnL

**GET /api/analytics/comparison**
- Compare multiple bots
- Query parameters: `bot_ids[]`, `start_date`, `end_date`
- Response: Comparative metrics

**GET /api/analytics/market-correlation**
- Analyze correlation between bot performance and market movements
- Query parameters: `bot_id`, `symbol`, `start_date`, `end_date`
- Response: Correlation coefficients and charts data

**GET /api/analytics/risk-metrics**
- Calculate risk metrics (Sharpe ratio, max drawdown, etc.)
- Query parameters: `bot_id`, `start_date`, `end_date`
- Response: Risk metrics object

#### System Configuration

**GET /api/settings**
- Get all system settings
- Response: Object with all settings

**PUT /api/settings/:key**
- Update specific setting
- Request body: `{ value }`
- Validates value against data type
- Response: Updated setting

**POST /api/settings/reset**
- Reset all settings to defaults
- Response: All settings

#### Audit & Monitoring

**GET /api/audit/logs**
- Get audit logs
- Query parameters: `event_type`, `entity_type`, `start_date`, `end_date`, `limit`
- Response: Paginated audit log entries

**GET /api/system/health**
- System health check
- Response: Database status, WebSocket status, API status

### API Middleware Enhancements

**Authentication Middleware**
```javascript
// server/middleware/auth.js
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
```

**Rate Limiting**
```javascript
// Already have express-rate-limit
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', apiLimiter);
```

**Validation Middleware**
```javascript
// server/middleware/validation.js
const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
}

module.exports = { validateRequest };
```

---

## Frontend Configuration System

### New Routes & Pages

#### Bot Management Dashboard

**Route:** `/config/bots`

**Features:**
- Grid/list view of all bots
- Quick status indicators (active, paused, trading mode)
- Performance summary cards
- Action buttons: Edit, Pause, Reset, Delete
- "Add New Bot" button (opens creation modal)

**Components:**
```
/components/config/
  - BotManagementDashboard.tsx
  - BotCard.tsx
  - BotList.tsx
  - BotCreationModal.tsx
  - BotEditModal.tsx
```

#### Bot Editor

**Route:** `/config/bots/:id/edit`

**Sections:**

1. **Basic Information**
   - Bot Name (text input)
   - Trading Mode (radio: Paper / Real)
   - Status (toggle: Active / Inactive)

2. **Personality Prompt**
   - Large text area with syntax highlighting
   - Character count
   - Template variables helper panel
   - Preview pane showing compiled prompt
   - Save / Revert buttons

3. **AI Provider Selection**
   - Dropdown of available providers
   - Provider details displayed (model, endpoint)
   - "Test Connection" button

4. **Wallet Configuration** (if trading mode = Real)
   - Exchange selection
   - API Key input (password field)
   - API Secret input (password field)
   - Optional: Wallet address
   - "Verify Credentials" button

5. **Trading Parameters**
   - Initial Balance (number input)
   - Leverage Limits (min/max sliders)
   - Risk Management (stop loss %, take profit %)
   - Cooldown Settings (duration input)

#### LLM Provider Manager

**Route:** `/config/providers`

**Features:**
- Table of all providers
- Columns: Name, Type, Model, Status, Actions
- Add Provider button
- Edit / Test / Delete actions

**Provider Form Fields:**
- Provider Name (text)
- Provider Type (dropdown: OpenAI, Anthropic, Gemini, Grok, Local, Custom)
- API Endpoint (URL)
- Model Name (text)
- API Key (password field)
- Additional Config (JSON editor for advanced settings)

**Provider Types & Defaults:**

```typescript
const providerTemplates = {
  openai: {
    api_endpoint: 'https://api.openai.com/v1/chat/completions',
    default_model: 'gpt-4-turbo'
  },
  anthropic: {
    api_endpoint: 'https://api.anthropic.com/v1/messages',
    default_model: 'claude-3-opus-20240229'
  },
  gemini: {
    api_endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    default_model: 'gemini-2.5-flash'
  },
  grok: {
    api_endpoint: 'https://api.x.ai/v1/chat/completions',
    default_model: 'grok-3-mini-beta'
  },
  local: {
    api_endpoint: 'http://localhost:11434/api/generate', // Ollama default
    default_model: 'llama2'
  },
  custom: {
    api_endpoint: '',
    default_model: ''
  }
};
```

#### System Settings

**Route:** `/config/settings`

**Categories:**

1. **Trading Parameters**
   - Turn Interval (minutes)
   - Refresh Interval (seconds)
   - Minimum Trade Size (USD)
   - Symbol Cooldown (minutes)
   - Trading Symbols (multi-select)

2. **Default Balances**
   - Paper Bot Initial Balance
   - Live Bot Initial Balance

3. **Security**
   - Broadcast Mode Password
   - Session Timeout
   - Maximum Login Attempts

4. **System Limits**
   - Maximum Bots
   - Maximum Positions per Bot
   - Data Retention Period (days)

5. **Display Preferences**
   - Default Chart Timeframe
   - Currency Format
   - Timezone

#### API Key Vault

**Route:** `/config/credentials`

**Security First Approach:**
- Master password required to view this page
- All credentials encrypted at rest
- Never show full keys (only last 4 characters)
- Audit log for all access

**Features:**
- List of all stored credentials
- Grouped by: LLM Providers, Exchange Wallets
- "Add Credential" button
- Edit (re-encrypt) / Delete actions
- "Test Connection" for each credential

### UI Component Library

#### Form Components

**TextInput.tsx**
```typescript
interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
}
```

**PasswordInput.tsx**
- Show/hide toggle
- Password strength indicator
- Confirmation field option

**SelectDropdown.tsx**
- Searchable dropdown
- Multi-select capability
- Custom option rendering

**JsonEditor.tsx**
- Syntax highlighting (using Monaco or similar)
- Validation
- Pretty print / minify

**PromptEditor.tsx**
- Code editor for trading prompts
- Variable autocomplete
- Template insertion
- Real-time preview

#### Configuration Wizards

**Bot Creation Wizard**
1. Choose Template (or start from scratch)
2. Configure Personality
3. Select AI Provider
4. Set Trading Parameters
5. Connect Wallet (if live trading)
6. Review & Create

**Provider Setup Wizard**
1. Select Provider Type
2. Enter Credentials
3. Test Connection
4. Configure Advanced Options
5. Save & Activate

### State Management

**Configuration Context**
```typescript
// context/ConfigurationContext.tsx
interface ConfigurationContextType {
  bots: Bot[];
  providers: LLMProvider[];
  wallets: Wallet[];
  settings: SystemSettings;
  
  // Bot operations
  createBot: (bot: BotInput) => Promise<Bot>;
  updateBot: (id: string, updates: Partial<Bot>) => Promise<Bot>;
  deleteBot: (id: string) => Promise<void>;
  
  // Provider operations
  createProvider: (provider: ProviderInput) => Promise<LLMProvider>;
  updateProvider: (id: number, updates: Partial<LLMProvider>) => Promise<LLMProvider>;
  deleteProvider: (id: number) => Promise<void>;
  testProvider: (id: number) => Promise<TestResult>;
  
  // Wallet operations
  createWallet: (wallet: WalletInput) => Promise<Wallet>;
  updateWallet: (id: number, updates: Partial<Wallet>) => Promise<Wallet>;
  deleteWallet: (id: number) => Promise<void>;
  
  // Settings
  updateSetting: (key: string, value: any) => Promise<void>;
  resetSettings: () => Promise<void>;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
}
```

---

## Data Visualization & Analytics

### Historical Performance Dashboard

**Route:** `/analytics`

**Overview Section:**
- Total Portfolio Value (all bots combined)
- Total PnL (realized + unrealized)
- Total Trades Executed
- Average Win Rate
- Best Performing Bot

**Time Range Selector:**
- Presets: 1H, 4H, 1D, 1W, 1M, 3M, ALL
- Custom date range picker

### Bot Performance Deep Dive

**Route:** `/analytics/bot/:id`

**Sections:**

1. **Performance Chart**
   - Portfolio value over time
   - Overlaid with market price (selected symbol)
   - Annotations for trades
   - Zoom and pan capabilities

2. **Trade Statistics**
   - Total Trades
   - Win Rate
   - Average Profit per Trade
   - Largest Win / Loss
   - Profit Factor
   - Average Hold Time

3. **Risk Metrics**
   - Sharpe Ratio
   - Sortino Ratio
   - Maximum Drawdown
   - Value at Risk (VaR)
   - Beta (if comparing to market)

4. **Trade Distribution**
   - By Symbol (pie chart)
   - By Day of Week (bar chart)
   - By Hour of Day (heatmap)
   - Win/Loss distribution (histogram)

5. **Correlation Analysis**
   - Bot performance vs market movements
   - Inter-bot correlation matrix
   - Symbol performance correlation

6. **Recent Trades Table**
   - Symbol, Type, Entry, Exit, PnL, Fee, Date
   - Sortable and filterable
   - Export to CSV

### Bot Comparison Tool

**Route:** `/analytics/compare`

**Features:**
- Multi-select bots to compare
- Side-by-side performance charts
- Comparative metrics table
- Statistical significance testing
- Export comparison report

**Metrics Compared:**
- Total Return (%)
- Sharpe Ratio
- Win Rate
- Max Drawdown
- Average Trade Size
- Risk-Adjusted Return

### Market Analysis

**Route:** `/analytics/market`

**Features:**
- Current prices for all trading symbols
- 24h price changes
- Volume analysis
- Correlation heatmap (all symbols)
- Volatility indicators

### Chart Components

**TimeSeriesChart.tsx**
- Built on Lightweight Charts library
- Multiple series support
- Tooltips with detailed information
- Zoom, pan, reset controls
- Export image capability

**BarChart.tsx**
- Vertical and horizontal orientations
- Grouped and stacked modes
- Customizable colors and labels

**PieChart.tsx**
- Donut mode option
- Interactive legend
- Percentage and value labels

**HeatMap.tsx**
- Color gradients
- Cell labels
- Row/column headers
- Zoom capability

**CandlestickChart.tsx**
- OHLC data visualization
- Volume bars
- Technical indicators overlay

### Data Export

**Export Formats:**
- CSV (trades, positions, performance)
- JSON (full data dump)
- PDF (formatted reports)

**Report Generator:**
- Customizable templates
- Automated scheduling (future feature)
- Email delivery (future feature)

---

## Security & Access Control

### Encryption Strategy

**API Key Encryption**
```javascript
// server/utils/encryption.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted: encrypted
  };
}

function decrypt(encryptedData) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM, 
    KEY, 
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = { encrypt, decrypt };
```

**Database Storage:**
- Store `{ iv, authTag, encrypted }` as JSON string
- Never log decrypted values
- Rotate encryption key periodically

### User Authentication

**JWT-Based Authentication**
```javascript
// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getUserByUsername, createUser } = require('../database/users');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  const user = await getUserByUsername(username);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

module.exports = router;
```

### Role-Based Access Control

**Roles:**
- **Admin**: Full access to all features
- **User**: Can manage bots and view analytics
- **Viewer**: Read-only access to dashboards

**Permission Matrix:**

| Action | Admin | User | Viewer |
|--------|-------|------|--------|
| View Dashboards | Yes | Yes | Yes |
| View Analytics | Yes | Yes | Yes |
| Create/Edit Bots | Yes | Yes | No |
| Delete Bots | Yes | Yes | No |
| Manage Providers | Yes | No | No |
| Manage Wallets | Yes | Yes | No |
| View API Keys | Yes | No | No |
| System Settings | Yes | No | No |
| User Management | Yes | No | No |

**Middleware Implementation:**
```javascript
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const roleHierarchy = { viewer: 1, user: 2, admin: 3 };
    
    if (roleHierarchy[req.user.role] < roleHierarchy[role]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Usage
app.post('/api/bots', authenticateToken, requireRole('user'), createBot);
app.delete('/api/providers/:id', authenticateToken, requireRole('admin'), deleteProvider);
```

### Audit Logging

**All Sensitive Actions Logged:**
- User login/logout
- Bot creation/modification/deletion
- API key access/modification
- Configuration changes
- Trade executions
- Failed authentication attempts

**Log Entry Structure:**
```typescript
interface AuditLogEntry {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  details_json: string;
  ip_address: string;
  timestamp: Date;
}
```

### Input Validation & Sanitization

**All User Inputs:**
- Validated with express-validator
- SQL injection prevention (parameterized queries)
- XSS prevention (escape HTML)
- CSRF protection (CSRF tokens)

**Example Validation:**
```javascript
const { body } = require('express-validator');

const botValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be 1-100 characters'),
  body('prompt')
    .trim()
    .isLength({ min: 10, max: 10000 })
    .withMessage('Prompt must be 10-10000 characters'),
  body('provider_id')
    .isInt({ min: 1 })
    .withMessage('Valid provider required'),
  body('trading_mode')
    .isIn(['paper', 'real'])
    .withMessage('Trading mode must be paper or real')
];

app.post('/api/bots', botValidation, validateRequest, createBot);
```

### Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use strong, unique encryption keys
   - Rotate secrets regularly

2. **Database Security**
   - Use prepared statements exclusively
   - Limit database user permissions
   - Regular backups with encryption

3. **Network Security**
   - HTTPS in production (even locally, use self-signed certs)
   - CORS configured restrictively
   - Rate limiting on all endpoints

4. **Frontend Security**
   - No sensitive data in localStorage
   - Tokens in httpOnly cookies (future improvement)
   - Content Security Policy headers

---

## Testing & Quality Assurance

### Test Coverage Goals

**Backend:**
- Unit tests for all database operations (90%+ coverage)
- Integration tests for API endpoints (80%+ coverage)
- End-to-end tests for critical workflows (100% coverage)

**Frontend:**
- Component unit tests (70%+ coverage)
- Integration tests for user flows
- Visual regression tests

### Testing Strategy

#### Unit Tests (Backend)

**Framework:** Jest

**Database Tests:**
```javascript
// server/tests/database/bots.test.js
const { createBot, getBot, updateBot, deleteBot } = require('../database/bots');

describe('Bot Database Operations', () => {
  beforeEach(async () => {
    // Reset test database
    await resetTestDatabase();
  });
  
  test('createBot creates a new bot', async () => {
    const botData = {
      id: 'test_bot',
      name: 'Test Bot',
      prompt: 'Test prompt',
      provider_id: 1,
      trading_mode: 'paper'
    };
    
    const bot = await createBot(botData);
    
    expect(bot.id).toBe('test_bot');
    expect(bot.name).toBe('Test Bot');
  });
  
  test('createBot fails with duplicate id', async () => {
    const botData = { /* ... */ };
    await createBot(botData);
    
    await expect(createBot(botData)).rejects.toThrow();
  });
  
  // More tests...
});
```

**API Endpoint Tests:**
```javascript
// server/tests/api/bots.test.js
const request = require('supertest');
const app = require('../server');

describe('Bot API Endpoints', () => {
  let authToken;
  
  beforeAll(async () => {
    // Login and get token
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass' });
    authToken = response.body.token;
  });
  
  test('GET /api/bots returns all bots', async () => {
    const response = await request(app)
      .get('/api/bots')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
  
  test('POST /api/bots creates a bot', async () => {
    const response = await request(app)
      .post('/api/bots')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        id: 'new_bot',
        name: 'New Bot',
        prompt: 'Test prompt',
        provider_id: 1,
        trading_mode: 'paper'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.id).toBe('new_bot');
  });
  
  // More tests...
});
```

#### Integration Tests

**Trading Flow Tests:**
```javascript
describe('Full Trading Flow', () => {
  test('Bot makes decision, executes trade, updates state', async () => {
    // 1. Create bot
    const bot = await createBot({ /* ... */ });
    
    // 2. Trigger trading turn
    await triggerTradingTurn(bot.id);
    
    // 3. Verify decision was logged
    const decisions = await getBotDecisions(bot.id);
    expect(decisions.length).toBeGreaterThan(0);
    
    // 4. Verify trade was executed (if applicable)
    const trades = await getTrades(bot.id);
    // Assertions...
    
    // 5. Verify state snapshot was created
    const snapshots = await getBotSnapshots(bot.id);
    // Assertions...
  });
});
```

#### Frontend Tests

**Framework:** React Testing Library + Jest

**Component Tests:**
```typescript
// components/__tests__/BotCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import BotCard from '../BotCard';

describe('BotCard', () => {
  const mockBot = {
    id: 'test_bot',
    name: 'Test Bot',
    portfolio: { balance: 10000, totalValue: 10000, pnl: 0, positions: [] },
    // ... other required fields
  };
  
  test('renders bot name', () => {
    render(<BotCard bot={mockBot} rank={1} mode="spectator" />);
    expect(screen.getByText('Test Bot')).toBeInTheDocument();
  });
  
  test('shows pause button in broadcast mode', () => {
    render(<BotCard bot={mockBot} rank={1} mode="broadcast" onTogglePause={() => {}} />);
    expect(screen.getByLabelText('Pause')).toBeInTheDocument();
  });
  
  test('calls onOpenModal when positions button clicked', () => {
    const mockOpenModal = jest.fn();
    render(<BotCard bot={mockBot} rank={1} mode="broadcast" onOpenModal={mockOpenModal} />);
    
    fireEvent.click(screen.getByText('Positions'));
    expect(mockOpenModal).toHaveBeenCalledWith('positions');
  });
});
```

### Manual Testing Checklist

**Before Each Release:**

- [ ] Fresh installation works
- [ ] Database migration completes successfully
- [ ] All bots can be created, edited, deleted
- [ ] All providers can be configured and tested
- [ ] API keys are encrypted and decrypted correctly
- [ ] Trading decisions execute correctly
- [ ] WebSocket updates work in spectator mode
- [ ] All charts render correctly
- [ ] Export functionality works (CSV, JSON, PDF)
- [ ] Error handling displays user-friendly messages
- [ ] Performance is acceptable (no lag, fast queries)
- [ ] Security: Cannot access admin routes without permission
- [ ] Backup and restore work correctly

---

## Deployment & Migration

### Pre-Migration Steps

1. **Backup Current System**
   ```bash
   # Backup database
   cp data/arena.db data/backups/arena_backup_$(date +%Y%m%d_%H%M%S).db
   
   # Backup environment files
   cp server/.env server/.env.backup
   ```

2. **Install New Dependencies**
   ```bash
   # Backend
   cd server
   pnpm install bcrypt jsonwebtoken express-validator
   
   # Frontend
   cd ..
   pnpm install @monaco-editor/react react-hook-form zod
   ```

3. **Set Environment Variables**
   ```bash
   # Add to server/.env
   ENCRYPTION_KEY=<generate-random-32-char-string>
   JWT_SECRET=<generate-random-string>
   ```

### Migration Execution

**Step 1: Database Schema Migration**
```bash
cd server
node scripts/migrate_to_relational.js
```

This script will:
- Create new tables
- Transform existing data
- Validate data integrity
- Create backup of old schema

**Step 2: Seed Initial Data**
```bash
node scripts/seed_database.js
```

Seeds:
- Default LLM providers (Gemini, Grok)
- System settings with defaults
- Admin user (if not exists)

**Step 3: Verify Migration**
```bash
node scripts/verify_migration.js
```

Checks:
- All bots transferred correctly
- All trades preserved
- Value history maintained
- No data loss

### Rollback Plan

If migration fails:
```bash
cd server
node scripts/rollback_migration.js
```

This will:
- Restore old database from backup
- Revert schema changes
- Restore old code (if needed)

### Post-Migration Steps

1. **Update Frontend Configuration**
   - Add new routes to App.tsx
   - Update API service URLs

2. **Test All Features**
   - Run test suite
   - Manual testing of critical paths

3. **Monitor System**
   - Check logs for errors
   - Monitor database performance
   - Verify WebSocket connections stable

4. **Documentation Update**
   - Update README with new features
   - Create user guide for configuration UI
   - Update API documentation

---

## Future Considerations

### Phase 6: Advanced Features (Months 4-6)

**AI Strategy Backtesting**
- Upload historical market data
- Simulate bot trading on historical data
- Compare strategies without risking capital

**Multi-Exchange Support**
- Binance integration
- Bybit integration
- OKX integration
- Abstract exchange interface

**Advanced Risk Management**
- Portfolio optimization algorithms
- Position sizing calculators
- Kelly criterion implementation
- Risk parity strategies

**Notification System**
- Email alerts for significant events
- Webhook integrations (Discord, Slack)
- SMS notifications (via Twilio)

**Mobile App**
- React Native application
- Real-time push notifications
- Simplified dashboard view
- Bot control and monitoring

### Phase 7: Community & Collaboration (Months 7-9)

**Bot Marketplace**
- Share bot configurations
- Rate and review bots
- Import community strategies
- Leaderboard of best-performing bots

**Social Features**
- Follow other users
- Share performance reports
- Discussion forums
- Strategy collaboration

**Team Management**
- Multi-user accounts
- Team workspaces
- Shared bot portfolios
- Role-based collaboration

### Phase 8: Enterprise Features (Months 10-12)

**White-Label Solution**
- Rebrandable UI
- Custom domain support
- API-only mode for integration

**Institutional Features**
- Multi-account management
- Compliance reporting
- Audit trail exports
- Advanced security (2FA, hardware keys)

**High-Frequency Trading**
- Sub-second decision intervals
- Order book analysis
- Market making strategies
- Arbitrage detection

**Cloud Deployment Option**
- Docker container images
- Kubernetes deployment configs
- Cloud provider guides (AWS, GCP, Azure)
- Managed hosting service

---

## Implementation Timeline

### Month 1-2: Foundation
- Week 1-2: Database schema design and migration scripts
- Week 3-4: Backend API implementation for bot management
- Week 5-6: Basic configuration UI (bot creation/editing)
- Week 7-8: Testing and bug fixes

### Month 3: Configuration & Security
- Week 1-2: LLM provider management UI
- Week 3-4: Wallet and API key management
- Week 5-6: User authentication and RBAC
- Week 7-8: Security hardening and audit logging

### Month 4: Analytics & Visualization
- Week 1-2: Historical data API endpoints
- Week 3-4: Performance dashboard implementation
- Week 5-6: Advanced analytics and comparison tools
- Week 7-8: Chart optimization and export features

### Month 5: Polish & Testing
- Week 1-2: UI/UX refinement
- Week 3-4: Comprehensive testing
- Week 5-6: Performance optimization
- Week 7-8: Documentation and user guides

### Month 6: Launch Preparation
- Week 1-2: Beta testing with select users
- Week 3-4: Bug fixes and feedback integration
- Week 5-6: Final polish and optimization
- Week 7-8: Production deployment and monitoring

---

## Success Metrics & KPIs

### User Experience Metrics
- **Setup Time**: Target < 5 minutes for new bot creation
- **Configuration Complexity**: 90% of users configure bots without documentation
- **User Satisfaction**: Target 4.5+ / 5.0 rating

### Technical Metrics
- **API Response Time**: < 200ms for 95th percentile
- **Database Query Performance**: < 100ms for analytical queries
- **WebSocket Latency**: < 50ms for state updates
- **System Uptime**: 99.9% availability

### Business Metrics
- **User Adoption**: Number of active users per week
- **Bot Creation Rate**: Average bots per user
- **Feature Usage**: Most used configuration options
- **User Retention**: Weekly active users / Monthly active users

### Quality Metrics
- **Test Coverage**: 80%+ backend, 70%+ frontend
- **Bug Rate**: < 1 critical bug per release
- **Code Quality**: SonarQube score > 85
- **Documentation Completeness**: 100% of features documented

---

## Appendix A: Technology Stack

### Backend Technologies
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database**: SQLite 3.x (better-sqlite3)
- **Real-time**: WebSocket (ws library)
- **Authentication**: jsonwebtoken, bcrypt
- **Validation**: express-validator
- **Security**: helmet, cors, express-rate-limit
- **Testing**: Jest, Supertest

### Frontend Technologies
- **Framework**: React 18
- **Language**: TypeScript 5.x
- **Build Tool**: Vite 5.x
- **Styling**: TailwindCSS 3.x
- **Charts**: Lightweight Charts 4.x
- **Forms**: React Hook Form
- **Validation**: Zod
- **Code Editor**: Monaco Editor (React wrapper)
- **Testing**: Jest, React Testing Library

### DevOps & Tools
- **Package Manager**: pnpm
- **Version Control**: Git
- **Process Manager**: PM2 (for production)
- **Monitoring**: Node.js built-in profiler
- **Documentation**: Markdown, JSDoc

---

## Appendix B: Database Migration Script Template

```javascript
// server/scripts/migrate_to_relational.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

async function migrate() {
  console.log('Starting database migration...\n');
  
  // 1. Backup old database
  console.log('Step 1: Creating backup...');
  const backupPath = path.join(__dirname, '../data/backups');
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  fs.copyFileSync(
    path.join(__dirname, '../data/arena.db'),
    path.join(backupPath, `arena_backup_${timestamp}.db`)
  );
  console.log('✓ Backup created\n');
  
  // 2. Read old data
  console.log('Step 2: Reading existing data...');
  const oldDb = new Database(path.join(__dirname, '../data/arena.db'));
  const oldStateRow = oldDb.prepare('SELECT state FROM arena_state WHERE id = 1').get();
  const oldState = oldStateRow ? JSON.parse(oldStateRow.state) : { bots: [], marketData: [] };
  console.log(`✓ Found ${oldState.bots.length} bots and ${oldState.marketData.length} market data points\n`);
  
  // 3. Create new schema
  console.log('Step 3: Creating new schema...');
  const newSchemaSQL = fs.readFileSync(
    path.join(__dirname, '../migrations/002_relational_schema.sql'),
    'utf8'
  );
  oldDb.exec(newSchemaSQL);
  console.log('✓ New schema created\n');
  
  // 4. Transform and insert data
  console.log('Step 4: Transforming data...');
  
  // Insert bots
  const insertBot = oldDb.prepare(`
    INSERT INTO bots (id, name, prompt, provider_id, trading_mode, is_paused)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (const bot of oldState.bots) {
    const providerId = bot.provider === 'grok' ? 2 : 1; // Assuming default providers seeded
    insertBot.run(
      bot.id,
      bot.name,
      bot.prompt,
      providerId,
      bot.tradingMode,
      bot.isPaused ? 1 : 0
    );
    
    // Insert value history as snapshots
    const insertSnapshot = oldDb.prepare(`
      INSERT INTO bot_state_snapshots 
      (bot_id, balance, unrealized_pnl, realized_pnl, total_value, trade_count, win_rate, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const point of bot.valueHistory) {
      insertSnapshot.run(
        bot.id,
        bot.portfolio.balance,
        bot.portfolio.pnl,
        bot.realizedPnl,
        point.value,
        bot.tradeCount,
        bot.winRate,
        new Date(point.timestamp).toISOString()
      );
    }
    
    // Insert positions
    const insertPosition = oldDb.prepare(`
      INSERT INTO positions 
      (id, bot_id, symbol, position_type, entry_price, size, leverage, liquidation_price, stop_loss, take_profit, unrealized_pnl, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const pos of bot.portfolio.positions) {
      insertPosition.run(
        pos.id,
        bot.id,
        pos.symbol,
        pos.type,
        pos.entryPrice,
        pos.size,
        pos.leverage,
        pos.liquidationPrice,
        pos.stopLoss,
        pos.takeProfit,
        pos.pnl || 0,
        'open'
      );
    }
    
    // Insert trades
    const insertTrade = oldDb.prepare(`
      INSERT INTO trades 
      (id, bot_id, symbol, trade_type, entry_price, exit_price, size, leverage, pnl, fee, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const trade of bot.orders) {
      insertTrade.run(
        trade.id,
        bot.id,
        trade.symbol,
        trade.type,
        trade.entryPrice,
        trade.exitPrice,
        trade.size,
        trade.leverage,
        trade.pnl,
        trade.fee,
        new Date(trade.timestamp).toISOString()
      );
    }
    
    console.log(`  ✓ Migrated bot: ${bot.name}`);
  }
  
  console.log('\n✓ Data transformation complete\n');
  
  // 5. Verify migration
  console.log('Step 5: Verifying migration...');
  const newBotCount = oldDb.prepare('SELECT COUNT(*) as count FROM bots').get().count;
  const oldBotCount = oldState.bots.length;
  
  if (newBotCount !== oldBotCount) {
    throw new Error(`Bot count mismatch: expected ${oldBotCount}, got ${newBotCount}`);
  }
  
  console.log(`✓ Verification passed (${newBotCount} bots)\n`);
  
  // 6. Clean up old table (optional - keep for safety)
  console.log('Step 6: Cleaning up...');
  // oldDb.exec('DROP TABLE arena_state'); // Uncomment if you want to remove old table
  console.log('✓ Migration complete!\n');
  
  oldDb.close();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

---

## Appendix C: API Endpoint Reference

### Authentication
```
POST   /api/auth/login          - User login
POST   /api/auth/logout         - User logout
POST   /api/auth/refresh        - Refresh JWT token
```

### Bot Management
```
GET    /api/bots                - List all bots
GET    /api/bots/:id            - Get bot details
POST   /api/bots                - Create new bot
PUT    /api/bots/:id            - Update bot
DELETE /api/bots/:id            - Delete bot
POST   /api/bots/:id/pause      - Pause/unpause bot
POST   /api/bots/:id/reset      - Reset bot state
```

### LLM Providers
```
GET    /api/providers           - List providers
POST   /api/providers           - Add provider
PUT    /api/providers/:id       - Update provider
DELETE /api/providers/:id       - Delete provider
POST   /api/providers/:id/test  - Test provider connection
```

### Wallets
```
GET    /api/wallets             - List all wallets
GET    /api/wallets/bot/:botId  - Get bot wallets
POST   /api/wallets             - Add wallet
PUT    /api/wallets/:id         - Update wallet
DELETE /api/wallets/:id         - Delete wallet
```

### Trading
```
POST   /api/gemini              - Gemini API proxy
POST   /api/grok                - Grok API proxy
GET    /api/asterdex            - Market data
POST   /api/aster/trade         - Execute trade
```

### Analytics
```
GET    /api/analytics/bot/:botId/performance    - Performance metrics
GET    /api/analytics/bot/:botId/trades         - Trade history
GET    /api/analytics/bot/:botId/positions      - Position history
GET    /api/analytics/comparison                - Compare bots
GET    /api/analytics/market-correlation        - Market correlation
GET    /api/analytics/risk-metrics              - Risk metrics
```

### System
```
GET    /api/settings            - Get system settings
PUT    /api/settings/:key       - Update setting
POST   /api/settings/reset      - Reset to defaults
GET    /api/audit/logs          - Audit logs
GET    /api/system/health       - Health check
```

### State Management
```
GET    /api/state               - Get current state (legacy)
POST   /api/state               - Update state (legacy)
```

---

## Appendix D: Configuration File Examples

### Bot Configuration JSON
```json
{
  "id": "bot_analyst",
  "name": "Market Analyst",
  "prompt": "You are a technical analyst...",
  "provider_id": 1,
  "trading_mode": "paper",
  "is_active": true,
  "is_paused": false,
  "parameters": {
    "initial_balance": 10000,
    "min_trade_size": 50,
    "max_leverage": 25,
    "risk_per_trade": 0.02,
    "cooldown_minutes": 30
  }
}
```

### LLM Provider Configuration JSON
```json
{
  "name": "Claude Opus",
  "provider_type": "anthropic",
  "api_endpoint": "https://api.anthropic.com/v1/messages",
  "model_name": "claude-3-opus-20240229",
  "api_key": "[ENCRYPTED]",
  "config_json": {
    "max_tokens": 4096,
    "temperature": 0.7,
    "top_p": 1.0
  },
  "is_active": true
}
```

### System Settings JSON
```json
{
  "trading": {
    "turn_interval_ms": 300000,
    "refresh_interval_ms": 5000,
    "minimum_trade_size_usd": 50,
    "symbol_cooldown_ms": 1800000,
    "trading_symbols": [
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
      "BNBUSDT",
      "DOGEUSDT",
      "XRPUSDT"
    ]
  },
  "balances": {
    "paper_bot_initial": 10000,
    "live_bot_initial": 950
  },
  "security": {
    "broadcast_password": "[ENCRYPTED]",
    "session_timeout_hours": 24,
    "max_login_attempts": 5
  },
  "system": {
    "max_bots": 10,
    "max_positions_per_bot": 5,
    "data_retention_days": 90
  }
}
```

---

## Conclusion

This implementation roadmap provides a comprehensive blueprint for transforming BONERBOTS AI Arena into a professional, self-configurable trading platform. The phased approach ensures steady progress while maintaining system stability. Each phase builds upon the previous, creating a solid foundation for advanced features.

**Key Success Factors:**
1. **Database First**: Robust schema enables all future features
2. **User Empowerment**: Configuration UI removes technical barriers
3. **Security**: Encryption and RBAC protect sensitive data
4. **Scalability**: Design supports growth from 3 to 100+ bots
5. **Maintainability**: Clean code and comprehensive tests

**Next Steps:**
1. Review and approve this roadmap
2. Set up development environment for Phase 1
3. Begin database schema design and migration planning
4. Create detailed task breakdown for first sprint

This transformation will position BONERBOTS AI Arena as a leading platform for AI-driven trading experimentation and research.

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-04  
**Prepared By:** AI Development Team  
**Status:** Ready for Implementation
