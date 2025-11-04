# BONERBOTS AI Arena: Serverless to Local SQLite Refactor Plan

## Executive Summary

This document outlines the comprehensive refactor plan to convert the BONERBOTS AI Arena from a serverless architecture (Cloudflare Workers + Supabase) to a local application using SQLite for persistence. The goal is to maintain all existing functionality while eliminating cloud dependencies.

## Current Architecture Analysis

### Components

1. **Frontend (React + Vite)**
   - Two operational modes:
     - Broadcast Mode: Controller that runs the simulation and manages bot decisions
     - Spectator Mode: Read-only viewer that receives real-time state updates
   - Dependencies: `@supabase/supabase-js`, React, Vite, TailwindCSS, lightweight-charts

2. **Cloudflare Worker (Proxy/API Gateway)**
   - Handles all external API calls (Gemini, Grok, Asterdex exchange)
   - Manages API keys securely via environment variables
   - Implements multi-wallet system (botId-based key selection)
   - Provides CORS handling for browser requests
   - Routes: `/gemini`, `/grok`, `/asterdex`, `/asterdex/exchangeInfo`, `/aster/trade`

3. **Supabase (PostgreSQL + Realtime)**
   - Single table `arena_state` with one row containing JSONB state
   - Real-time subscriptions via WebSocket for spectator synchronization
   - Row-level security: public read-only, service-role write-only
   - Atomic state updates (entire state replaced per update)

4. **Express Server (Static File Server)**
   - Currently only serves built React files
   - No API functionality

### Data Flow

```
Broadcast Mode:
  Frontend (useTradingBot) 
    -> Cloudflare Worker (AI/Exchange APIs) 
    -> Local State Update 
    -> Supabase Realtime Broadcast

Spectator Mode:
  Supabase Realtime Subscription 
    -> Frontend State Update 
    -> UI Render
```

### Key Features

- Real-time state synchronization across multiple viewers
- Secure API key management (never exposed to browser)
- Multi-wallet trading system (3 bots with separate exchange accounts)
- Paper and live trading modes
- AI decision-making via Gemini and Grok APIs
- Cryptocurrency trading via Asterdex exchange

## Target Architecture

### Overview

Transform the application into a self-contained local desktop/server application with:
- Local SQLite database for state persistence
- Node.js Express server replacing Cloudflare Worker
- WebSocket server for real-time updates (replacing Supabase Realtime)
- Environment variable configuration for API keys

### Components

1. **Frontend (React + Vite)** - Minimal Changes
   - Update API endpoints to point to local server
   - Replace Supabase client with WebSocket client
   - Remove Supabase dependencies

2. **Backend Server (Express + WebSocket)**
   - Consolidate and expand existing Express server
   - Implement all Cloudflare Worker routes
   - Add WebSocket server for real-time state broadcasting
   - Add SQLite database integration
   - Implement API key management via environment variables

3. **Database (SQLite)**
   - Replicate `arena_state` table schema
   - Use JSON1 extension for JSONB-like functionality
   - Implement initialization script
   - Add database connection pooling/locking mechanism

4. **Configuration**
   - `.env` file for API keys and configuration
   - Startup validation for required environment variables

### Data Flow

```
Broadcast Mode:
  Frontend (useTradingBot) 
    -> Local Express Server (AI/Exchange APIs) 
    -> Local State Update 
    -> SQLite Write 
    -> WebSocket Broadcast

Spectator Mode:
  WebSocket Subscription 
    -> Frontend State Update 
    -> UI Render
```

## Detailed Refactor Tasks

### Phase 1: Backend Infrastructure

#### Task 1.1: Database Layer Setup

**Objective**: Create SQLite database with equivalent schema and access layer

**Files to Create**:
- `server/database.js` - Database connection and initialization
- `server/migrations/001_initial_schema.sql` - Initial schema
- `server/.env.example` - Template for environment variables

**Implementation Details**:
```javascript
// server/database.js structure:
- Initialize SQLite connection using better-sqlite3
- Implement schema creation (arena_state table)
- Create CRUD operations:
  - getArenaState()
  - updateArenaState(state)
  - initializeArenaState(defaultState)
- Add database locking mechanism for concurrent access
- Enable JSON1 extension
```

**Schema Design**:
```sql
CREATE TABLE IF NOT EXISTS arena_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state TEXT NOT NULL,  -- JSON as TEXT
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Dependencies to Add**:
- `better-sqlite3` - Fast, synchronous SQLite3 bindings
- `dotenv` - Environment variable management

**Gotchas**:
- SQLite has limited concurrent write support; implement proper locking
- JSON stored as TEXT; need JSON1 extension for querying
- Database file location needs to be configurable
- Handle database file permissions correctly
- Ensure database directory exists before initialization

**Validation**:
- Create unit tests for database operations
- Test concurrent read/write scenarios
- Verify JSON serialization/deserialization

#### Task 1.2: WebSocket Server Implementation

**Objective**: Replace Supabase Realtime with local WebSocket server

**Files to Create/Modify**:
- `server/websocket.js` - WebSocket server implementation
- `server/server.js` - Integrate WebSocket with Express

**Implementation Details**:
```javascript
// WebSocket server requirements:
- Create WebSocket server using 'ws' library
- Implement connection management (track all connected clients)
- Add broadcast function to send state updates to all clients
- Handle client disconnections gracefully
- Implement reconnection logic with exponential backoff
- Add heartbeat/ping-pong for connection health
```

**API Design**:
```javascript
// Message types:
{
  type: 'state_update',
  payload: ArenaState
}

{
  type: 'heartbeat',
  timestamp: number
}
```

**Dependencies**:
- Already have `ws` installed

**Gotchas**:
- WebSocket server must run on different port or same port as HTTP server
- Need to handle WebSocket upgrade requests properly
- Client reconnection must not create duplicate subscriptions
- Message serialization errors must be caught
- Large state objects may need compression

**Validation**:
- Test multiple concurrent connections
- Verify reconnection after network interruption
- Monitor memory usage with many connections
- Test with large state objects

#### Task 1.3: Express Server Migration

**Objective**: Migrate all Cloudflare Worker routes to Express server

**Files to Modify**:
- `server/server.js` - Main server file
- `server/package.json` - Add dependencies

**Routes to Implement**:

1. **POST /api/gemini** - Proxy to Google Gemini API
   ```javascript
   - Accept { prompt } in body
   - Use env.GEMINI_API_KEY
   - Forward to Google's API
   - Return formatted response
   ```

2. **POST /api/grok** - Proxy to xAI Grok API
   ```javascript
   - Accept Grok API request body
   - Use env.XAI_API_KEY
   - Forward to xAI API
   - Return response
   ```

3. **GET /api/asterdex/exchangeInfo** - Public exchange data
   ```javascript
   - Forward to Asterdex API
   - No authentication required
   - Return exchange info
   ```

4. **GET /api/asterdex** - Public market data
   ```javascript
   - Forward to Asterdex 24hr ticker
   - Use any valid API key for header
   - Return market data
   ```

5. **POST /api/aster/trade** - Authenticated trading operations
   ```javascript
   - Accept { method, endpoint, params, botId }
   - Implement getApiKeysForBot(botId):
     - bot_degen -> DEGEN_LIVE_API_KEY, DEGEN_LIVE_SECRET
     - bot_monkey -> ESCAPED_MONKEY_API_KEY, ESCAPED_MONKEY_SECRET
     - bot_astrologer -> ASTROLOGER_API_KEY, ASTROLOGER_SECRET
   - Create HMAC-SHA256 signature
   - Forward signed request to Asterdex
   - Return response
   ```

6. **GET /api/state** - Get current arena state
   ```javascript
   - Read from SQLite
   - Return current state
   ```

7. **POST /api/state** - Update arena state (Broadcast only)
   ```javascript
   - Accept new state in body
   - Validate state structure
   - Write to SQLite
   - Broadcast via WebSocket
   - Return success
   ```

**Dependencies to Add**:
- `cors` - CORS handling
- `express-rate-limit` - Already installed
- `crypto` - Built-in (for HMAC signatures)

**Middleware**:
- CORS configuration (allow localhost origins)
- JSON body parser
- Error handling middleware
- Request logging
- Rate limiting for API routes

**Gotchas**:
- HMAC signature generation must match Cloudflare Worker implementation exactly
- API keys must never be sent to client
- Error responses must match Cloudflare Worker format
- Need to handle streaming responses (for Grok)
- Timeout handling for external API calls
- Proper error messages without leaking sensitive info

**Validation**:
- Test each route independently
- Verify API key selection logic
- Test signature generation against known values
- Verify error handling
- Load test API endpoints

#### Task 1.4: Environment Configuration

**Objective**: Set up secure local configuration management

**Files to Create**:
- `server/.env.example` - Template
- `server/.env` - Actual config (gitignored)
- `server/config.js` - Config validation and loading

**Environment Variables Required**:
```bash
# Server Configuration
PORT=3001
NODE_ENV=development
DATABASE_PATH=./data/arena.db

# AI Provider API Keys
GEMINI_API_KEY=your_gemini_api_key_here
XAI_API_KEY=your_xai_api_key_here

# Asterdex Multi-Wallet API Keys
# Bot: DEGEN
DEGEN_LIVE_API_KEY=your_degen_api_key_here
DEGEN_LIVE_SECRET=your_degen_api_secret_here

# Bot: Escaped Monkey
ESCAPED_MONKEY_API_KEY=your_monkey_api_key_here
ESCAPED_MONKEY_SECRET=your_monkey_api_secret_here

# Bot: Astrologer
ASTROLOGER_API_KEY=your_astrologer_api_key_here
ASTROLOGER_SECRET=your_astrologer_api_secret_here

# WebSocket Configuration
WS_PORT=3002
```

**Config Validation**:
- Check all required variables on startup
- Fail fast with clear error messages
- Provide helpful setup instructions

**Security Considerations**:
- Add `.env` to `.gitignore`
- Document setup process clearly
- Never log API keys
- Consider encryption for stored keys (future enhancement)

**Gotchas**:
- Different environments (dev/prod) need different configs
- API keys with special characters need proper escaping
- Empty/undefined values should cause startup failure
- Need clear documentation for obtaining each API key

**Validation**:
- Test with missing variables
- Test with invalid variables
- Verify gitignore is working
- Document setup process

### Phase 2: Frontend Migration

#### Task 2.1: Remove Supabase Dependencies

**Objective**: Remove all Supabase-related code and dependencies

**Files to Delete**:
- `services/supabaseClient.ts`
- `SUPABASE_SETUP.md`

**Files to Modify**:
- `package.json` - Remove `@supabase/supabase-js`
- `services/stateService.ts` - Complete rewrite
- `hooks/useTradingBot.ts` - Remove Supabase imports and usage
- `components/SpectatorDashboard.tsx` - Remove Supabase imports

**Search and Replace**:
- Remove all imports from `./services/supabaseClient`
- Remove all imports from `@supabase/supabase-js`
- Remove `isAppConfigured` checks related to Supabase

**Gotchas**:
- Ensure no orphaned type imports
- Check for conditional rendering based on Supabase config
- Remove RealtimeChannel types

**Validation**:
- Build should complete without errors
- No runtime errors related to Supabase
- TypeScript compilation succeeds

#### Task 2.2: Implement WebSocket Client Service

**Objective**: Create WebSocket client to replace Supabase Realtime

**Files to Create/Modify**:
- `services/websocketService.ts` - New WebSocket client
- `services/stateService.ts` - Rewrite to use WebSocket

**Implementation Details**:
```typescript
// services/websocketService.ts
class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private listeners: Map<string, Function[]>;
  
  connect(url: string): void;
  disconnect(): void;
  subscribe(event: string, callback: Function): void;
  unsubscribe(event: string, callback: Function): void;
  send(message: any): void;
  private handleReconnect(): void;
  private setupHeartbeat(): void;
}
```

**Reconnection Strategy**:
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s (max)
- Clear reconnection on successful connection
- Notify listeners of connection status changes
- Automatic resubscription after reconnect

**Gotchas**:
- WebSocket URL construction (ws:// vs wss://)
- Browser WebSocket vs Node.js WebSocket API
- Handle connection timing issues during app startup
- Prevent memory leaks from orphaned listeners
- Handle binary vs text messages appropriately

**Validation**:
- Test reconnection scenarios
- Verify no memory leaks
- Test rapid connect/disconnect cycles
- Monitor network tab for connection behavior

#### Task 2.3: Update Configuration System

**Objective**: Replace Supabase config with local server config

**Files to Modify**:
- `config.ts` - Complete rewrite
- `components/ConfigurationWarning.tsx` - Update warning messages

**New Configuration**:
```typescript
// config.ts
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

export const isAppConfigured = Boolean(API_URL && WS_URL);
```

**Environment Variables** (Frontend):
```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3002
```

**Files to Create**:
- `.env.local.example` - Frontend env template

**Gotchas**:
- Vite env vars must be prefixed with `VITE_`
- Production build needs different URLs
- WebSocket URL protocol (ws:// vs wss://)
- CORS configuration must match

**Validation**:
- Test with missing config
- Verify ConfigurationWarning displays correctly
- Test in dev and prod modes

#### Task 2.4: Update Service Layer

**Objective**: Update all services to use local Express server

**Files to Modify**:
- `services/geminiService.ts` - Update endpoint
- `services/grokService.ts` - Update endpoint
- `services/asterdexService.ts` - Update all endpoints
- `services/stateService.ts` - Complete rewrite

**Changes Required**:

1. **geminiService.ts**:
   ```typescript
   // Change from:
   const API_ENDPOINT = `${PROXY_URL}/gemini`;
   // To:
   const API_ENDPOINT = `${API_URL}/api/gemini`;
   ```

2. **grokService.ts**:
   ```typescript
   // Change from:
   const API_ENDPOINT = `${PROXY_URL}/grok`;
   // To:
   const API_ENDPOINT = `${API_URL}/api/grok`;
   ```

3. **asterdexService.ts**:
   ```typescript
   // Update all endpoints:
   - `/asterdex` -> `${API_URL}/api/asterdex`
   - `/asterdex/exchangeInfo` -> `${API_URL}/api/asterdex/exchangeInfo`
   - `/aster/trade` -> `${API_URL}/api/aster/trade`
   ```

4. **stateService.ts** (Complete Rewrite):
   ```typescript
   import { wsService } from './websocketService';
   
   // Replace updateState() with:
   export const updateState = async (newState: ArenaState) => {
     await fetch(`${API_URL}/api/state`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(newState)
     });
   };
   
   // Replace subscribeToStateChanges() with:
   export const subscribeToStateChanges = (callback: (state: ArenaState) => void) => {
     wsService.connect(WS_URL);
     wsService.subscribe('state_update', callback);
     return () => wsService.unsubscribe('state_update', callback);
   };
   ```

**Gotchas**:
- Error handling must be consistent across services
- Timeouts for long-running operations
- Network error handling and retries
- Response validation

**Validation**:
- Test each service method individually
- Verify error handling
- Test network failure scenarios
- Monitor network requests in dev tools

#### Task 2.5: Update Trading Bot Hook

**Objective**: Update state persistence logic in useTradingBot

**Files to Modify**:
- `hooks/useTradingBot.ts`

**Changes Required**:

1. **Remove Supabase Initialization**:
   ```typescript
   // Remove:
   const { data, error } = await supabase.from('arena_state').select('state').single();
   
   // Replace with:
   const response = await fetch(`${API_URL}/api/state`);
   const data = response.ok ? await response.json() : null;
   ```

2. **Update Error Handling**:
   - Remove Supabase-specific error checks
   - Add HTTP error handling

3. **Keep updateState Call**:
   - Already using stateService.updateState()
   - No changes needed for broadcasting

**Gotchas**:
- State initialization on first run
- Handle 404 when no state exists
- Preserve state resume logic
- Maintain backward compatibility with saved states

**Validation**:
- Test fresh start (no saved state)
- Test resume from saved state
- Test state corruption handling
- Verify bot initialization

#### Task 2.6: Update Components

**Objective**: Update React components for new architecture

**Files to Modify**:
- `components/Dashboard.tsx` - Minor updates
- `components/SpectatorDashboard.tsx` - Update subscription logic
- `components/ConfigurationWarning.tsx` - Update message
- `App.tsx` - Update config check

**Changes Required**:

1. **SpectatorDashboard.tsx**:
   ```typescript
   useEffect(() => {
     const unsubscribe = subscribeToStateChanges(handleStateChange);
     return unsubscribe;
   }, []);
   ```

2. **ConfigurationWarning.tsx**:
   - Update warning text to mention local server
   - Provide setup instructions for local environment

3. **Dashboard.tsx**:
   - No major changes needed
   - Already uses stateService

**Gotchas**:
- Cleanup functions must properly disconnect WebSocket
- Prevent multiple subscriptions
- Handle component unmount during connection

**Validation**:
- Test both broadcast and spectator modes
- Verify real-time updates work
- Test navigation between modes
- Check for memory leaks

### Phase 3: Integration and Testing

#### Task 3.1: Development Workflow Setup

**Objective**: Configure development environment for local architecture

**Files to Modify**:
- `package.json` - Update scripts
- `server/package.json` - Update scripts
- Create `package.json` in root for monorepo management

**New Scripts**:
```json
{
  "scripts": {
    "dev:server": "cd server && pnpm run dev",
    "dev:client": "pnpm run dev",
    "dev": "concurrently \"pnpm run dev:server\" \"pnpm run dev:client\"",
    "build:server": "cd server && pnpm run build",
    "build:client": "pnpm run build",
    "build": "pnpm run build:server && pnpm run build:client",
    "start": "cd server && pnpm start"
  }
}
```

**Dependencies to Add** (Root):
- `concurrently` - Run multiple commands

**Server Scripts**:
```json
{
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js",
    "db:init": "node scripts/initDatabase.js"
  }
}
```

**Gotchas**:
- Path resolution in monorepo structure
- Port conflicts between services
- Environment variable loading order
- Build output directories

**Validation**:
- Test all scripts individually
- Verify concurrent development mode
- Test production build process

#### Task 3.2: Database Initialization Script

**Objective**: Create automated database setup

**Files to Create**:
- `server/scripts/initDatabase.js`
- `server/scripts/resetDatabase.js`

**Implementation**:
```javascript
// initDatabase.js
- Check if database exists
- Create database file if needed
- Run schema migrations
- Insert default state if empty
- Verify database integrity
```

**Default State**:
```json
{
  "bots": [],
  "marketData": []
}
```

**Gotchas**:
- Database file location must be relative to server directory
- Handle existing database files
- Provide rollback mechanism
- Validate schema after creation

**Validation**:
- Test fresh initialization
- Test with existing database
- Test with corrupted database
- Verify default state

#### Task 3.3: Error Handling and Logging

**Objective**: Implement comprehensive error handling

**Files to Create**:
- `server/middleware/errorHandler.js`
- `server/utils/logger.js`

**Error Handler**:
```javascript
- Catch all errors
- Log with appropriate level
- Return sanitized error response
- Never leak sensitive information
- Handle different error types (DB, Network, Validation)
```

**Logger**:
```javascript
- Use winston or pino for structured logging
- Log levels: error, warn, info, debug
- Separate log files for different concerns
- Rotate logs to prevent disk fill
```

**Gotchas**:
- Don't log API keys
- Don't leak stack traces to client
- Handle uncaught exceptions
- Handle unhandled promise rejections

**Validation**:
- Trigger various error scenarios
- Review log output
- Verify client error responses
- Test log rotation

#### Task 3.4: Integration Testing

**Objective**: Validate complete system functionality

**Test Scenarios**:

1. **Fresh Start**:
   - Start server with no database
   - Verify database initialization
   - Start frontend
   - Open broadcast mode
   - Verify bots initialize
   - Wait for first decision cycle

2. **State Persistence**:
   - Run simulation for 5 minutes
   - Stop server
   - Restart server
   - Verify state restored
   - Verify bots resume correctly

3. **Multi-Client**:
   - Start broadcast mode
   - Open 3 spectator tabs
   - Verify all spectators receive updates
   - Close/reopen spectators
   - Verify reconnection works

4. **Trading Operations**:
   - Verify market data fetches
   - Trigger bot decision
   - Verify AI API calls work
   - Verify exchange API calls work (if live trading)
   - Verify state updates

5. **Error Scenarios**:
   - Kill network during operation
   - Provide invalid API keys
   - Corrupt database file
   - Fill disk space
   - Verify graceful degradation

**Gotchas**:
- Race conditions between server and client startup
- WebSocket connection timing
- Database locking under concurrent access
- Memory leaks in long-running processes

**Validation Criteria**:
- All tests pass without manual intervention
- No memory leaks after 1 hour
- No errors in logs (except expected ones)
- Real-time updates have <500ms latency

#### Task 3.5: Documentation Updates

**Objective**: Update all documentation for new architecture

**Files to Modify**:
- `README.md` - Complete rewrite
- Delete `CLOUDFLARE_SETUP.md`
- Delete `SUPABASE_SETUP.md`
- Create `SETUP.md` - Local setup guide
- Create `DEVELOPMENT.md` - Developer guide

**New README Structure**:
```markdown
# BONERBOTS AI Arena (Local Edition)

## Overview
- What is this project
- Architecture overview
- Features

## Quick Start
- Prerequisites
- Installation
- Configuration
- Running the app

## Usage
- Broadcast mode
- Spectator mode
- Configuration options

## Development
- Project structure
- Making changes
- Testing

## Troubleshooting
- Common issues
- Debugging tips
```

**SETUP.md Contents**:
```markdown
# Complete Setup Guide

## Prerequisites
- Node.js 18+
- pnpm

## Installation Steps
1. Clone repository
2. Install dependencies
3. Configure API keys
4. Initialize database
5. Start services

## Obtaining API Keys
- Gemini
- xAI (Grok)
- Asterdex

## Configuration
- Environment variables
- Server settings
- Database location

## Verification
- Test checklist
```

**DEVELOPMENT.md Contents**:
```markdown
# Developer Guide

## Architecture
- Overview diagram
- Component interaction
- Data flow

## Project Structure
- Directory layout
- File purposes

## Development Workflow
- Running locally
- Hot reload
- Debugging

## Adding Features
- New bot personalities
- New exchanges
- New AI providers

## Database Schema
- Tables
- Indexes
- Migrations

## API Reference
- Endpoints
- Request/response formats
```

**Gotchas**:
- Keep docs in sync with code
- Provide examples for all steps
- Include troubleshooting for common issues
- Add screenshots where helpful

### Phase 4: Cleanup and Optimization

#### Task 4.1: Remove Legacy Code

**Objective**: Clean up all unused code and dependencies

**Files to Delete**:
- `cloudflare-worker.js`
- `CLOUDFLARE_SETUP.md`
- `SUPABASE_SETUP.md`
- `services/supabaseClient.ts`
- Any unused components (verify first)

**Dependencies to Remove**:
- `@supabase/supabase-js`

**Search for Dead Code**:
- Unused imports
- Commented code blocks
- Deprecated functions
- Orphaned utility files

**Gotchas**:
- Don't delete code that might be useful for reference
- Verify components aren't used before deletion
- Check for dynamic imports

**Validation**:
- Build succeeds
- No import errors
- No unused dependency warnings

#### Task 4.2: Performance Optimization

**Objective**: Optimize for local execution

**Database Optimizations**:
- Add indexes if needed (likely not with single-row table)
- Use transactions for state updates
- Implement connection pooling
- Add prepared statements

**WebSocket Optimizations**:
- Implement message compression (optional)
- Batch updates if frequent
- Add message queuing for reliability
- Implement selective updates (only changed data)

**Server Optimizations**:
- Enable compression middleware
- Add caching for exchange info
- Implement request debouncing
- Add response streaming for large data

**Frontend Optimizations**:
- Already using React best practices
- Verify no unnecessary re-renders
- Check bundle size

**Gotchas**:
- Don't over-optimize prematurely
- Measure before optimizing
- Balance complexity vs performance gain

**Validation**:
- Benchmark before and after
- Monitor memory usage
- Profile CPU usage
- Test with large states

#### Task 4.3: Security Hardening

**Objective**: Ensure secure local execution

**Security Measures**:

1. **Input Validation**:
   - Validate all API inputs
   - Sanitize state before saving
   - Reject malformed requests

2. **API Key Protection**:
   - Never log keys
   - Never send to client
   - Use environment variables only
   - Clear error messages without leaking keys

3. **Database Security**:
   - File permissions (600 or 640)
   - Parameterized queries
   - Validate JSON structure

4. **WebSocket Security**:
   - Optional: Add authentication
   - Validate message structure
   - Rate limiting

5. **Server Security**:
   - CORS configuration
   - Rate limiting on API routes
   - Timeout on external API calls
   - Error message sanitization

**Gotchas**:
- Balance security with usability
- Don't break legitimate use cases
- Consider different deployment scenarios

**Validation**:
- Security audit checklist
- Test with malformed inputs
- Verify API key protection
- Review error messages

#### Task 4.4: Build and Distribution

**Objective**: Create production-ready builds

**Build Process**:

1. **Frontend Build**:
   ```bash
   pnpm run build
   # Output: dist/
   ```

2. **Server Preparation**:
   - Copy server/ directory
   - Install production dependencies only
   - Exclude dev files

3. **Package Structure**:
   ```
   bonerbots-local/
   ├── server/
   │   ├── server.js
   │   ├── database.js
   │   ├── websocket.js
   │   ├── package.json
   │   └── .env.example
   ├── dist/           (built frontend)
   ├── data/           (database location)
   ├── package.json
   ├── README.md
   └── SETUP.md
   ```

4. **Startup Script**:
   ```javascript
   // start.js
   - Check Node version
   - Check for .env file
   - Initialize database if needed
   - Start server
   - Open browser to app
   ```

**Distribution Options**:

1. **Simple Archive**:
   - Zip file with all files
   - Requires Node.js installed
   - User runs `pnpm install && pnpm start`

2. **Executable (Future)**:
   - Use pkg or nexe
   - Bundle Node.js runtime
   - Single executable file

**Gotchas**:
- Path resolution in production
- Database location relative to executable
- Environment variable loading
- Different OS support (Windows/Mac/Linux)

**Validation**:
- Test build on clean machine
- Verify all dependencies included
- Test startup script
- Check bundle size

#### Task 4.5: Testing Suite

**Objective**: Create comprehensive test coverage

**Test Categories**:

1. **Unit Tests**:
   - Database operations
   - API route handlers
   - WebSocket message handling
   - State serialization
   - Signature generation

2. **Integration Tests**:
   - Full API request/response cycles
   - WebSocket connection/reconnection
   - State persistence and retrieval
   - Multi-client scenarios

3. **E2E Tests** (Optional):
   - Full user workflows
   - Broadcast mode operations
   - Spectator mode viewing
   - Bot decision cycles

**Testing Tools**:
- Jest for unit/integration tests
- Supertest for API testing
- ws for WebSocket testing
- Playwright for E2E (optional)

**Test Scripts**:
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:watch": "jest --watch"
  }
}
```

**Gotchas**:
- Mock external APIs for tests
- Clean up test database after each run
- Handle async operations properly
- Avoid flaky tests (timing issues)

**Validation**:
- All tests pass consistently
- Coverage >80% for critical paths
- Tests run in CI environment
- Fast test execution (<30s)

## Migration Checklist

Use this checklist to track progress during the refactor:

### Backend Infrastructure
- [ ] Task 1.1: Database layer setup complete
- [ ] Task 1.2: WebSocket server implemented
- [ ] Task 1.3: Express server migrated
- [ ] Task 1.4: Environment configuration complete
- [ ] Backend integration tests passing

### Frontend Migration
- [ ] Task 2.1: Supabase dependencies removed
- [ ] Task 2.2: WebSocket client implemented
- [ ] Task 2.3: Configuration system updated
- [ ] Task 2.4: Service layer updated
- [ ] Task 2.5: Trading bot hook updated
- [ ] Task 2.6: Components updated
- [ ] Frontend builds without errors

### Integration and Testing
- [ ] Task 3.1: Development workflow configured
- [ ] Task 3.2: Database initialization scripts complete
- [ ] Task 3.3: Error handling implemented
- [ ] Task 3.4: Integration testing passed
- [ ] Task 3.5: Documentation updated

### Cleanup and Optimization
- [ ] Task 4.1: Legacy code removed
- [ ] Task 4.2: Performance optimized
- [ ] Task 4.3: Security hardened
- [ ] Task 4.4: Build and distribution ready
- [ ] Task 4.5: Testing suite complete

## Risk Assessment

### High Risk Items

1. **Real-time Synchronization**
   - Risk: WebSocket implementation may not match Supabase Realtime reliability
   - Mitigation: Implement robust reconnection logic, add heartbeats, extensive testing
   - Fallback: Polling as backup mechanism

2. **Database Concurrency**
   - Risk: SQLite has limited concurrent write support
   - Mitigation: Implement proper locking, queue writes if necessary
   - Fallback: Switch to PostgreSQL if concurrency issues persist

3. **State Size Growth**
   - Risk: Large state objects may cause performance issues
   - Mitigation: Implement state pruning, limit history size
   - Fallback: Implement pagination or segmented state

### Medium Risk Items

1. **API Key Security**
   - Risk: Local storage less secure than Cloudflare secrets
   - Mitigation: File permissions, clear documentation, consider encryption
   - Fallback: Implement key vault or external secrets manager

2. **WebSocket Connection Stability**
   - Risk: Browser may close inactive connections
   - Mitigation: Implement heartbeat, automatic reconnection
   - Fallback: HTTP long polling

3. **Cross-Platform Compatibility**
   - Risk: Different behavior on Windows/Mac/Linux
   - Mitigation: Test on all platforms, use cross-platform libraries
   - Fallback: Document platform-specific setup

### Low Risk Items

1. **Performance Degradation**
   - Risk: Local SQLite slower than cloud PostgreSQL
   - Mitigation: Unlikely with current scale, optimize if needed
   - Fallback: Database optimization, caching

2. **Port Conflicts**
   - Risk: Required ports already in use
   - Mitigation: Make ports configurable, check on startup
   - Fallback: Auto-select available ports

## Success Criteria

The refactor is considered successful when:

1. **Functional Requirements**:
   - [ ] All existing features work identically to serverless version
   - [ ] Broadcast mode can run simulations
   - [ ] Spectator mode receives real-time updates
   - [ ] State persists across restarts
   - [ ] Multi-bot trading system works
   - [ ] AI decision-making functions
   - [ ] Exchange trading operations work

2. **Non-Functional Requirements**:
   - [ ] Real-time updates have <500ms latency
   - [ ] Application starts in <5 seconds
   - [ ] No memory leaks during 24-hour run
   - [ ] Handles 10+ concurrent spectators
   - [ ] Database file size reasonable (<100MB for 7 days)

3. **Development Requirements**:
   - [ ] Clear setup documentation
   - [ ] Simple installation process
   - [ ] Good developer experience
   - [ ] Comprehensive error messages

4. **Deployment Requirements**:
   - [ ] Single command to start
   - [ ] Works on Windows, Mac, Linux
   - [ ] Minimal system requirements
   - [ ] No external dependencies except Node.js

## Post-Refactor Considerations

### Immediate Follow-ups
1. Monitor application in production-like environment for 48 hours
2. Gather feedback on setup process
3. Document common issues encountered
4. Create FAQ based on user questions

### Future Enhancements
1. Desktop application wrapper (Electron/Tauri)
2. Docker containerization
3. Database backup/restore functionality
4. State export/import features
5. Multi-user authentication
6. Cloud sync option (hybrid mode)
7. Mobile-responsive spectator view
8. Advanced analytics and reporting

### Maintenance Considerations
1. Keep dependencies updated
2. Monitor for security vulnerabilities
3. Optimize database as usage grows
4. Add telemetry for debugging (opt-in)
5. Create upgrade path for future versions

## Conclusion

This refactor plan provides a comprehensive roadmap for converting the BONERBOTS AI Arena from a serverless architecture to a local SQLite-based application. The plan is organized into logical phases with clear tasks, gotchas, and validation steps.

Key success factors:
- Methodical execution of each phase
- Thorough testing at each stage
- Clear documentation throughout
- Regular validation against success criteria

Estimated total effort: 40-60 hours of focused development work, depending on experience level and unforeseen issues.

The resulting application will be self-contained, easier to run locally, and independent of cloud services while maintaining all existing functionality.
