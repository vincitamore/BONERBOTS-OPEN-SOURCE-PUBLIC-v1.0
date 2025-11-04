# Developer Guide

This document provides comprehensive information about the BONERBOTS AI Arena architecture, development workflow, and guidelines for contributors.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Technology Stack](#technology-stack)
4. [Data Flow](#data-flow)
5. [Development Workflow](#development-workflow)
6. [API Reference](#api-reference)
7. [Database Schema](#database-schema)
8. [Adding Features](#adding-features)
9. [Best Practices](#best-practices)

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  ┌──────────────────┐              ┌────────────────────┐  │
│  │ Broadcast Mode   │              │  Spectator Mode    │  │
│  │ (Controller)     │              │  (Viewer)          │  │
│  └────────┬─────────┘              └─────────┬──────────┘  │
│           │                                   │              │
└───────────┼───────────────────────────────────┼──────────────┘
            │                                   │
            │ HTTP API                          │ WebSocket
            │ (State Updates)                   │ (Real-time Updates)
            │                                   │
┌───────────▼───────────────────────────────────▼──────────────┐
│                    Backend (Express Server)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  API Routes  │  │   WebSocket  │  │   Database       │  │
│  │              │  │   Server     │  │   (SQLite)       │  │
│  │ /api/gemini  │  │              │  │                  │  │
│  │ /api/grok    │  │  Broadcasts  │  │  arena_state     │  │
│  │ /api/aster   │  │  state       │  │  table           │  │
│  │ /api/state   │  │  updates     │  │                  │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘  │
│         │                                                     │
└─────────┼─────────────────────────────────────────────────────┘
          │
          │ External API Calls
          │
┌─────────▼─────────────────────────────────────────────────────┐
│                     External Services                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Google       │  │ xAI          │  │  Asterdex          │  │
│  │ Gemini API   │  │ Grok API     │  │  Exchange API      │  │
│  └──────────────┘  └──────────────┘  └────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Local-First**: All data stored locally in SQLite, no cloud dependencies
2. **Security**: API keys never exposed to frontend, server-side only
3. **Real-time**: WebSocket for instant state updates to spectators
4. **Multi-Wallet**: Each bot has isolated API keys for separate trading accounts
5. **Modular**: Clear separation between frontend, backend, and services

## Project Structure

```
bonerbots-ai-arena/
├── server/                    # Backend server
│   ├── config.js             # Configuration management
│   ├── database.js           # SQLite database layer
│   ├── server.js             # Main Express server
│   ├── websocket.js          # WebSocket server
│   ├── middleware/           # Express middleware
│   │   └── errorHandler.js   # Error handling
│   ├── utils/                # Utility functions
│   │   └── logger.js         # Logging utility
│   ├── scripts/              # Database scripts
│   │   ├── initDatabase.js   # Initialize database
│   │   └── resetDatabase.js  # Reset database
│   ├── migrations/           # Database migrations
│   │   └── 001_initial_schema.sql
│   ├── .env.example          # Environment variables template
│   └── package.json          # Server dependencies
│
├── services/                  # Frontend service layer
│   ├── asterdexService.ts    # Exchange API integration
│   ├── geminiService.ts      # Gemini AI integration
│   ├── grokService.ts        # Grok AI integration
│   ├── stateService.ts       # State management
│   └── websocketService.ts   # WebSocket client
│
├── components/                # React components
│   ├── Dashboard.tsx         # Broadcast mode dashboard
│   ├── SpectatorDashboard.tsx # Spectator mode dashboard
│   ├── BotCard.tsx           # Individual bot display
│   ├── BotColumn.tsx         # Bot column layout
│   ├── PerformanceChart.tsx  # Performance visualization
│   ├── MarketPrices.tsx      # Market data display
│   ├── PositionsTable.tsx    # Trading positions
│   ├── OrderHistory.tsx      # Order history
│   └── ...                   # Other UI components
│
├── hooks/                     # React hooks
│   └── useTradingBot.ts      # Main trading bot logic
│
├── config.ts                  # Frontend configuration
├── constants.ts               # Application constants
├── types.ts                   # TypeScript type definitions
├── prompts.ts                 # Bot personality prompts
├── App.tsx                    # Main React app
├── index.tsx                  # React entry point
├── package.json               # Frontend dependencies
└── README.md                  # Project documentation
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **WebSocket**: ws library
- **HTTP Client**: axios
- **Environment**: dotenv

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Charts**: Lightweight Charts
- **State**: React Hooks

### Development Tools
- **Package Manager**: pnpm
- **Process Management**: concurrently, nodemon
- **Type Checking**: TypeScript compiler

## Data Flow

### Broadcast Mode Data Flow

1. **Bot Decision Cycle** (every 2 minutes):
   ```
   Timer Trigger
     → Fetch Market Data (Asterdex API)
     → For each bot:
         → Build prompt with portfolio + market data
         → Query AI (Gemini or Grok)
         → Parse trading decision
         → Validate decision
         → Execute trade (paper or live)
         → Update bot state
     → Update market data snapshot
     → Save state to database
     → Broadcast state via WebSocket
   ```

2. **State Persistence**:
   ```
   State Change
     → POST /api/state
     → Validate state structure
     → Write to SQLite database
     → Broadcast to WebSocket clients
     → Return success response
   ```

### Spectator Mode Data Flow

1. **Initial Connection**:
   ```
   Component Mount
     → Connect to WebSocket (ws://localhost:3002)
     → Subscribe to 'state_update' events
     → Wait for initial broadcast
   ```

2. **Real-time Updates**:
   ```
   Server Broadcasts State
     → WebSocket receives message
     → Parse state_update payload
     → Update React state
     → Re-render components
   ```

## Development Workflow

### Setting Up Development Environment

1. **Install dependencies**:
   ```bash
   pnpm install
   cd server && pnpm install
   ```

2. **Configure environment**:
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your API keys
   ```

3. **Initialize database**:
   ```bash
   cd server
   pnpm run db:init
   ```

4. **Start development servers**:
   ```bash
   # From root directory
   pnpm run dev:all
   ```

### Running Individual Services

```bash
# Backend only
pnpm run dev:server

# Frontend only
pnpm run dev

# Both with live reload
pnpm run dev:all
```

### Hot Reload

- **Frontend**: Vite provides instant HMR for React components
- **Backend**: Nodemon watches for file changes and auto-restarts

### Debugging

#### Backend Debugging
```javascript
// Add breakpoints in server code
const config = require('./config');
debugger; // Use with Node inspector

// Or use console logging
console.log('Debug info:', someVariable);
```

Run with debugger:
```bash
node --inspect server/server.js
```

#### Frontend Debugging
- Use React DevTools browser extension
- Use browser console for logging
- Add breakpoints in browser DevTools

## API Reference

### Backend API Endpoints

#### POST /api/gemini
Proxy to Google Gemini API for AI decision-making.

**Request**:
```json
{
  "prompt": "Trading prompt with market data..."
}
```

**Response**:
```json
{
  "text": "{ \"action\": \"buy\", \"symbol\": \"BTCUSDT\", ... }"
}
```

#### POST /api/grok
Proxy to xAI Grok API for AI decision-making.

**Request**:
```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "model": "grok-3-mini-beta",
  "stream": false
}
```

**Response**:
```json
{
  "choices": [{
    "message": { "content": "..." }
  }]
}
```

#### GET /api/asterdex
Fetch public market data from Asterdex.

**Response**:
```json
[
  {
    "symbol": "BTCUSDT",
    "lastPrice": "50000.00",
    "priceChangePercent": "2.5"
  }
]
```

#### GET /api/asterdex/exchangeInfo
Get exchange trading rules and precision info.

**Response**:
```json
{
  "symbols": [{
    "symbol": "BTCUSDT",
    "quantityPrecision": 3
  }]
}
```

#### POST /api/aster/trade
Execute authenticated trading operations.

**Request**:
```json
{
  "method": "POST",
  "endpoint": "/fapi/v1/order",
  "botId": "bot_degen",
  "params": {
    "symbol": "BTCUSDT",
    "side": "BUY",
    "type": "MARKET",
    "quantity": "0.001"
  }
}
```

**Response**: Asterdex API response

#### GET /api/state
Get current arena state.

**Response**:
```json
{
  "bots": [ /* array of bot states */ ],
  "marketData": [ /* array of market prices */ ]
}
```

#### POST /api/state
Update arena state (broadcast mode only).

**Request**:
```json
{
  "bots": [ /* updated bot states */ ],
  "marketData": [ /* updated market data */ ]
}
```

**Response**:
```json
{
  "success": true,
  "clients": 3
}
```

## Database Schema

### Table: arena_state

Stores the entire arena state as a JSON blob.

```sql
CREATE TABLE arena_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Only one row allowed
  state TEXT NOT NULL,                     -- JSON as TEXT
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**State Structure**:
```typescript
{
  bots: BotState[],      // Array of bot states
  marketData: Market[]   // Array of market prices
}
```

**Indexes**: None (single row table)

**Constraints**:
- `id` must always be 1 (single row table)
- `state` must be valid JSON

## Adding Features

### Adding a New Bot

1. **Create bot configuration** in `hooks/useTradingBot.ts`:
   ```typescript
   const botConfigs = [
     // ... existing bots
     {
       id: 'bot_newbot',
       name: 'New Bot',
       prompt: NEW_BOT_PROMPT,
       provider: 'gemini',
       mode: 'paper'
     }
   ];
   ```

2. **Create bot prompt** in `prompts.ts`:
   ```typescript
   export const NEW_BOT_PROMPT = `
     You are a new trading bot with...
   `;
   ```

3. **Add API keys** (if live trading) to `server/.env`:
   ```env
   NEWBOT_API_KEY=...
   NEWBOT_SECRET=...
   ```

4. **Update key mapping** in `server/config.js`:
   ```javascript
   case 'bot_newbot':
     apiKey = process.env.NEWBOT_API_KEY;
     apiSecret = process.env.NEWBOT_SECRET;
     break;
   ```

### Adding a New AI Provider

1. **Create service** in `services/newAiService.ts`:
   ```typescript
   export const getNewAiDecision = async (
     portfolio: Portfolio,
     marketData: Market[],
     prompt: string
   ): Promise<{ prompt: string, decisions: AiDecision[] }> => {
     // Implementation
   };
   ```

2. **Add to bot configuration**:
   ```typescript
   provider: 'newai'
   ```

3. **Update getDecision** in `useTradingBot.ts`:
   ```typescript
   if (provider === 'newai') {
     return getNewAiDecision(portfolio, marketData, prompt);
   }
   ```

### Adding a New Exchange

Similar process to AI providers:
1. Create exchange service
2. Update trading logic
3. Add API key configuration
4. Test thoroughly

## Best Practices

### Code Style
- Use TypeScript for type safety
- Follow existing naming conventions
- Add comments for complex logic
- Keep functions small and focused

### Error Handling
- Always catch and log errors
- Return meaningful error messages
- Never expose sensitive data in errors
- Use try-catch for async operations

### Security
- Never commit API keys or secrets
- Validate all user inputs
- Sanitize data before database operations
- Use environment variables for configuration

### Performance
- Minimize API calls
- Cache market data when appropriate
- Use efficient database queries
- Avoid unnecessary re-renders in React

### Testing
- Test critical trading logic
- Verify API integrations
- Test WebSocket connections
- Manual testing for UI changes

---

**Happy coding!** 🚀
