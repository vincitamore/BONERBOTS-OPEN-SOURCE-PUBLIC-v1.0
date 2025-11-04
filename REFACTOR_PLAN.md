# Refactor Plan: Serverless to Local SQLite Application

## Executive Summary

This document outlines a comprehensive refactor plan to convert the BONERBOTS AI Arena from a serverless architecture (Supabase + Cloudflare Workers) to a self-contained local application using SQLite for persistence and a local Express server for API proxying.

## Current Architecture Analysis

### Components to Replace

1. **Supabase Database** (`services/supabaseClient.ts`, `services/stateService.ts`)
   - Single table `arena_state` storing JSONB state
   - Real-time subscriptions via Supabase Realtime
   - Used for: state persistence, real-time broadcasting to spectators

2. **Cloudflare Worker** (`cloudflare-worker.js`)
   - Proxy for Gemini API (`/gemini`)
   - Proxy for Grok API (`/grok`)
   - Proxy for Asterdex market data (`/asterdex`, `/asterdex/exchangeInfo`)
   - Proxy for Asterdex trading API (`/aster/trade`)
   - Secure API key management via environment variables

3. **Frontend Dependencies**
   - `@supabase/supabase-js` package
   - Configuration expecting Supabase URL and keys
   - Real-time subscription logic in components

## Target Architecture

### New Components

1. **Local SQLite Database**
   - Single table `arena_state` with JSON storage
   - File-based persistence
   - Local-only access

2. **Express Backend Server**
   - SQLite database operations
   - WebSocket server for real-time updates
   - API proxy endpoints (same routes as Cloudflare Worker)
   - Environment variable-based API key management

3. **Updated Frontend**
   - WebSocket client for real-time updates
   - API calls to local Express server
   - Removed Supabase dependencies

## Detailed Refactor Steps

### Phase 1: Database Layer Replacement

#### 1.1 Create SQLite Database Schema
**File**: `server/database/schema.sql` (new)
**Task**: Create SQLite schema equivalent to Supabase table
```sql
CREATE TABLE IF NOT EXISTS arena_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state TEXT NOT NULL, -- JSON string
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS arena_state_single_row ON arena_state(id);
```

**Considerations**:
- SQLite doesn't have native JSONB type, use TEXT with JSON validation
- Single row constraint via CHECK constraint and UNIQUE index
- Timestamp handling differences (SQLite uses TEXT/datetime vs PostgreSQL TIMESTAMPTZ)
- Initial state insertion needed

#### 1.2 Create SQLite Database Service
**File**: `server/database/db.js` (new)
**Task**: Database operations wrapper
- Initialize database connection
- Create tables if they don't exist
- Provide functions: `getState()`, `saveState(state)`
- Handle JSON serialization/deserialization
- Error handling for database operations

**Gotchas**:
- SQLite WAL mode for better concurrency
- File path configuration (absolute vs relative)
- Database file permissions
- Error handling for locked database scenarios
- JSON validation before storing

#### 1.3 Create Database Migration Script
**File**: `server/database/migrate.js` (new)
**Task**: Ensure database schema is up-to-date
- Run schema.sql on first startup
- Handle version migrations if needed in future
- Idempotent execution

### Phase 2: Backend API Server Refactor

#### 2.1 Refactor Express Server
**File**: `server/server.js` (modify)
**Current**: Simple static file server
**New**: Full-featured API server with:
- Express routes for all API endpoints
- SQLite database integration
- WebSocket server for real-time updates
- Static file serving (for production builds)
- CORS configuration
- Environment variable management

**Routes to Implement**:
- `GET /api/state` - Get current arena state
- `POST /api/state` - Update arena state (broadcast mode)
- `GET /api/gemini` - Proxy to Gemini API
- `POST /api/gemini` - Proxy to Gemini API
- `POST /api/grok` - Proxy to Grok API
- `GET /api/asterdex` - Proxy to Asterdex market data
- `GET /api/asterdex/exchangeInfo` - Proxy to Asterdex exchange info
- `POST /api/aster/trade` - Proxy to Asterdex trading API

**Dependencies to Add**:
- `better-sqlite3` or `sqlite3` for SQLite
- `ws` for WebSocket server (already present)
- `dotenv` for environment variables (already present)
- `cors` for CORS handling

#### 2.2 Implement WebSocket Server
**File**: `server/websocket.js` (new) or integrated into `server.js`
**Task**: Real-time state broadcasting
- WebSocket server attached to Express server
- Broadcast state updates to all connected clients
- Handle client connections/disconnections
- Replace Supabase Realtime functionality

**Considerations**:
- WebSocket connection management
- Broadcasting to all spectators
- Handling connection drops gracefully
- Memory management for many concurrent connections
- Authentication if needed (currently none)

#### 2.3 Port Cloudflare Worker Logic
**File**: `server/proxy.js` (new) or integrated into `server.js`
**Task**: Move all proxy logic from Cloudflare Worker
- Gemini API proxy with HMAC handling
- Grok API proxy
- Asterdex public API proxy
- Asterdex authenticated trading API proxy
- Multi-wallet API key selection based on botId
- Error handling and CORS headers

**Gotchas**:
- HMAC signature generation for Asterdex (same algorithm)
- Environment variable structure (maintain compatibility)
- API key management (use .env file or config)
- Rate limiting considerations
- Error response formatting

### Phase 3: Frontend Service Layer Refactor

#### 3.1 Replace Supabase Client
**File**: `services/supabaseClient.ts` (delete or replace)
**Task**: Remove Supabase dependency
- Delete file or replace with local API client
- Remove `@supabase/supabase-js` from package.json

**Alternative**: Create `services/localApiClient.ts`
- Functions: `getState()`, `subscribeToStateChanges(callback)`
- WebSocket client implementation
- Fallback to polling if WebSocket unavailable

#### 3.2 Refactor State Service
**File**: `services/stateService.ts` (modify)
**Current**: Uses Supabase channels for broadcasting
**New**: Use WebSocket for real-time updates
- `updateState()` - POST to `/api/state`
- `subscribeToStateChanges()` - WebSocket subscription
- Handle WebSocket reconnection logic
- Handle connection state (connected/disconnected)

**Gotchas**:
- WebSocket reconnection strategy
- State synchronization on reconnect
- Error handling for network issues
- Fallback mechanism if WebSocket fails

#### 3.3 Update API Service Endpoints
**Files**: 
- `services/geminiService.ts` (modify)
- `services/grokService.ts` (modify)
- `services/asterdexService.ts` (modify)

**Task**: Change PROXY_URL references to local server
- Update endpoints from `${PROXY_URL}/gemini` to `/api/gemini` (relative URLs)
- Or use `http://localhost:PORT/api/...` in development
- Ensure CORS is handled correctly
- Update error handling if needed

**Considerations**:
- Use relative URLs for same-origin requests
- Or configure base URL in config.ts
- Handle both development and production scenarios

#### 3.4 Update Configuration
**File**: `config.ts` (modify)
**Current**: Supabase URL, Supabase Anon Key, Cloudflare Worker URL
**New**: Local server configuration
- Remove Supabase-related config
- Add local server URL/port
- Add WebSocket URL
- Update `isAppConfigured` check

**Gotchas**:
- Development vs production URLs
- WebSocket URL construction (ws:// vs wss://)
- Port configuration

### Phase 4: Hook and Component Updates

#### 4.1 Update Trading Bot Hook
**File**: `hooks/useTradingBot.ts` (modify)
**Task**: Replace Supabase state loading
- Change initial state loading from Supabase query to API call
- Update state persistence logic
- Ensure compatibility with new state service

**Current Flow**:
1. Check Supabase for saved state
2. Load or create new bots
3. Sync with real exchange if needed

**New Flow**:
1. Call `/api/state` to get saved state
2. Load or create new bots
3. Sync with real exchange if needed

**Gotchas**:
- Error handling for missing state
- Initial state creation
- State format compatibility

#### 4.2 Update Dashboard Component
**File**: `components/Dashboard.tsx` (modify)
**Task**: Update state broadcasting
- Change `updateState()` call (already uses service, should work)
- Verify WebSocket connection status
- Handle connection errors gracefully

**Minimal Changes**: Already uses `updateState` from service, should work after service refactor

#### 4.3 Update Spectator Dashboard
**File**: `components/SpectatorDashboard.tsx` (modify)
**Task**: Replace Supabase subscription
- Change `subscribeToStateChanges()` call
- Update WebSocket connection handling
- Handle connection state UI feedback

**Gotchas**:
- Remove Supabase RealtimeChannel type imports
- Update connection status handling
- Handle initial state load vs real-time updates

### Phase 5: Environment and Configuration

#### 5.1 Environment Variables
**File**: `.env.example` (new)
**Task**: Document required environment variables
```
# Server Configuration
PORT=3001
WS_PORT=3002

# Database
DB_PATH=./data/arena.db

# API Keys
GEMINI_API_KEY=your_gemini_key
XAI_API_KEY=your_grok_key

# Asterdex API Keys (per bot)
DEGEN_LIVE_API_KEY=your_key
DEGEN_LIVE_SECRET=your_secret
ESCAPED_MONKEY_API_KEY=your_key
ESCAPED_MONKEY_SECRET=your_secret
ASTROLOGER_API_KEY=your_key
ASTROLOGER_SECRET=your_secret
```

**File**: `.env` (new, gitignored)
**Task**: Actual environment variables file

#### 5.2 Update Package.json Files
**File**: `package.json` (modify)
**Task**: Remove Supabase, add any needed dependencies
- Remove `@supabase/supabase-js`
- Verify no other Supabase dependencies

**File**: `server/package.json` (modify)
**Task**: Add SQLite and WebSocket dependencies
- Add `better-sqlite3` (recommended) or `sqlite3`
- Add `ws` (already present)
- Add `cors` if not present
- Add `dotenv` (already present)

#### 5.3 Update Build and Run Scripts
**File**: `package.json` (modify)
**Task**: Add convenience scripts
- `dev:server` - Run backend server
- `dev:client` - Run frontend dev server
- `dev` - Run both concurrently (may need `concurrently` package)
- `build` - Build frontend (unchanged)
- `start` - Start production server (serve frontend + backend)

### Phase 6: Documentation Updates

#### 6.1 Update README
**File**: `README.md` (modify)
**Task**: Rewrite setup instructions
- Remove Supabase setup steps
- Remove Cloudflare Worker setup steps
- Add local SQLite setup instructions
- Add environment variable configuration
- Update architecture description
- Update deployment instructions (if applicable)

#### 6.2 Delete Setup Guides
**Files**: 
- `SUPABASE_SETUP.md` (delete or archive)
- `CLOUDFLARE_SETUP.md` (delete or archive)

**Alternative**: Rename to `ARCHIVED_SUPABASE_SETUP.md` for reference

#### 6.3 Create New Setup Guide
**File**: `LOCAL_SETUP.md` (new)
**Task**: Step-by-step local setup instructions
- Prerequisites
- Installation steps
- Environment variable configuration
- Database initialization
- Running the application
- Troubleshooting

### Phase 7: Testing and Validation

#### 7.1 Database Testing
**Task**: Verify SQLite operations
- Test state save/load
- Test concurrent access
- Test JSON serialization/deserialization
- Test error handling

#### 7.2 API Testing
**Task**: Verify all API endpoints
- Test each proxy endpoint
- Test state API endpoints
- Test WebSocket connections
- Test error responses

#### 7.3 Integration Testing
**Task**: End-to-end functionality
- Test broadcast mode (save state)
- Test spectator mode (receive updates)
- Test real trading integration
- Test paper trading simulation
- Test state persistence across restarts

## Critical Gotchas and Considerations

### Database Concurrency
**Issue**: SQLite handles concurrent writes differently than PostgreSQL
**Solution**: 
- Use WAL mode for better concurrency
- Implement proper locking/retry logic
- Consider using `better-sqlite3` for synchronous operations
- Document concurrent access limitations

### WebSocket Reliability
**Issue**: WebSockets can drop connections
**Solution**:
- Implement reconnection logic with exponential backoff
- Handle connection state in UI
- Consider fallback to polling if WebSocket unavailable
- Test reconnection scenarios

### State Persistence Format
**Issue**: JSON stored as TEXT in SQLite vs JSONB in PostgreSQL
**Solution**:
- Validate JSON before storing
- Use SQLite JSON functions for querying if needed
- Ensure JSON serialization is consistent
- Handle JSON parse errors gracefully

### API Key Security
**Issue**: API keys now stored locally vs encrypted in Cloudflare
**Solution**:
- Use `.env` file (gitignored)
- Document security best practices
- Warn against committing API keys
- Consider encryption for sensitive keys (optional)

### Port Configuration
**Issue**: Need to configure ports for server and WebSocket
**Solution**:
- Use environment variables for ports
- Default to common ports (3001 for HTTP, 3002 for WS or same port)
- Document port configuration
- Handle port conflicts gracefully

### CORS Configuration
**Issue**: Local development may need CORS for separate ports
**Solution**:
- Configure CORS for development
- Use same origin in production (if frontend served from same server)
- Test CORS in both scenarios

### File Path Handling
**Issue**: Database file path needs to be absolute or relative correctly
**Solution**:
- Use absolute paths or relative to project root
- Create data directory if it doesn't exist
- Handle path differences between dev/prod
- Document database file location

### Migration from Existing Data
**Issue**: If migrating from Supabase, need to export/import data
**Solution**:
- Create migration script to export from Supabase
- Import script to load into SQLite
- Document migration process
- Test migration with real data

### Real-time Update Latency
**Issue**: WebSocket may have different latency than Supabase Realtime
**Solution**:
- Test real-time performance
- Optimize broadcast logic
- Consider batching updates if needed
- Document expected performance

### Production Deployment
**Issue**: Local app deployment differs from serverless
**Solution**:
- Document deployment options (Docker, systemd, PM2)
- Consider Docker containerization
- Update deployment instructions
- Consider environment-specific configurations

## Implementation Checklist

### Phase 1: Database Layer
- [ ] Create SQLite schema file
- [ ] Implement database service module
- [ ] Create migration script
- [ ] Test database operations
- [ ] Document database file location

### Phase 2: Backend API Server
- [ ] Refactor Express server structure
- [ ] Implement state API endpoints
- [ ] Port Cloudflare Worker proxy logic
- [ ] Implement WebSocket server
- [ ] Add CORS configuration
- [ ] Add error handling middleware
- [ ] Test all API endpoints
- [ ] Update server package.json

### Phase 3: Frontend Services
- [ ] Create local API client service
- [ ] Refactor state service for WebSocket
- [ ] Update geminiService endpoints
- [ ] Update grokService endpoints
- [ ] Update asterdexService endpoints
- [ ] Update config.ts
- [ ] Remove Supabase dependencies
- [ ] Test service layer

### Phase 4: Components and Hooks
- [ ] Update useTradingBot hook
- [ ] Update Dashboard component
- [ ] Update SpectatorDashboard component
- [ ] Test component integration
- [ ] Handle WebSocket connection states

### Phase 5: Configuration
- [ ] Create .env.example file
- [ ] Update package.json scripts
- [ ] Update server package.json
- [ ] Test configuration loading

### Phase 6: Documentation
- [ ] Update README.md
- [ ] Create LOCAL_SETUP.md
- [ ] Archive or delete old setup guides
- [ ] Update code comments

### Phase 7: Testing
- [ ] Test database operations
- [ ] Test API endpoints
- [ ] Test WebSocket connections
- [ ] Test end-to-end workflows
- [ ] Test error scenarios
- [ ] Test state persistence
- [ ] Performance testing

## Rollback Plan

If issues arise during refactoring:

1. **Keep original files**: Don't delete Supabase/Cloudflare files until refactor is complete
2. **Feature flags**: Consider using feature flags to switch between old/new implementations
3. **Branch strategy**: Keep refactor in separate branch until fully tested
4. **Data backup**: Export Supabase data before migration
5. **Documentation**: Keep old setup docs for reference

## Success Criteria

The refactor is complete when:

1. All Supabase dependencies removed from frontend
2. All Cloudflare Worker logic moved to local server
3. SQLite database stores and retrieves state correctly
4. WebSocket provides real-time updates equivalent to Supabase
5. All API endpoints work correctly
6. Broadcast mode saves state successfully
7. Spectator mode receives real-time updates
8. Application runs entirely locally without external services
9. Documentation updated and accurate
10. No functionality lost compared to original implementation

## Timeline Estimate

- Phase 1 (Database): 4-6 hours
- Phase 2 (Backend): 8-12 hours
- Phase 3 (Frontend Services): 4-6 hours
- Phase 4 (Components): 3-4 hours
- Phase 5 (Configuration): 1-2 hours
- Phase 6 (Documentation): 2-3 hours
- Phase 7 (Testing): 6-8 hours

**Total Estimated Time**: 28-41 hours

## Notes

- This refactor maintains the same external API contracts (Asterdex, Gemini, Grok)
- Internal architecture changes significantly but user-facing functionality remains the same
- Consider performance implications of local SQLite vs cloud PostgreSQL
- WebSocket implementation may need tuning for production use
- Consider adding database backup/restore functionality
- May want to add database migration system for future schema changes
