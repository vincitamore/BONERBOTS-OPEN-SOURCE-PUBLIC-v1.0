# BONERBOTS AI Arena (Local Edition)

A 24/7 autonomous AI trading simulation where multiple AI bots with unique personalities compete to maximize profits in cryptocurrency markets.

## 🎯 Project Mission

Can a Large Language Model (LLM), when given the right personality and strategy via a prompt, consistently outperform the market? This project creates a controlled environment to answer that question through continuous, real-time trading simulations.

## 🏗️ Architecture Overview

This application uses a **local-first architecture** with:
- **Express Server**: Handles API requests and manages trading operations
- **SQLite Database**: Stores persistent state locally
- **WebSocket Server**: Broadcasts real-time updates to spectators
- **React Frontend**: Displays the arena and bot performance

### How It Works

```
Broadcast Mode (Controller):
  Frontend → Express API → AI/Exchange APIs → SQLite → WebSocket Broadcast

Spectator Mode (Viewer):
  WebSocket Connection → Real-time State Updates → UI Render
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
- **pnpm** (recommended) or npm

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bonerbots-ai-arena
   ```

2. **Run the setup script**
   ```bash
   pnpm run setup
   ```
   This installs all dependencies and initializes the database.

3. **Configure API keys**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env and add your API keys
   ```

4. **Start the application**
   ```bash
   # From the root directory
   pnpm run dev:all
   ```
   
   This starts both the backend server and frontend in development mode.

5. **Access the application**
   - Spectator mode: http://localhost:5173
   - Broadcast mode: http://localhost:5173/?mode=broadcast

## 📋 Required API Keys

You'll need the following API keys to run the bots:

### AI Providers
- **Google Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **xAI (Grok) API Key**: Get from [xAI Console](https://console.x.ai/)

### Trading Exchange  
- **Asterdex API Keys**: Three sets of keys for three bots
  - Get from [Asterdex](https://asterdex.com/) (requires account creation)
  - Each bot needs its own API key and secret

## 📖 Documentation

- **[SETUP.md](./SETUP.md)**: Detailed setup instructions and configuration guide
- **[DEVELOPMENT.md](./DEVELOPMENT.md)**: Developer guide and architecture documentation

## 🎮 Usage

### Running in Broadcast Mode (Controller)

The broadcast mode runs the simulation and makes trading decisions:

1. Navigate to: http://localhost:5173/?mode=broadcast
2. Enter the broadcast password (default: `bonerbots`)
3. The simulation will start automatically

The broadcast client:
- Fetches market data
- Queries AI models for trading decisions
- Executes trades (paper or live)
- Persists state to database
- Broadcasts updates to spectators

### Running in Spectator Mode (Viewer)

Spectator mode displays real-time updates from the broadcast controller:

1. Navigate to: http://localhost:5173
2. Watch the bots compete in real-time

Multiple spectators can connect simultaneously and receive synchronized updates.

## 🤖 The Bots

The arena includes three bots, each with unique personalities:

1. **DEGEN** - Aggressive risk-taker (Grok AI, Live Trading)
2. **Escaped Monkey** - Balanced trader (Gemini AI, Live Trading)
3. **Astrologer** - Conservative strategist (Gemini AI, Live Trading)

Each bot:
- Has its own wallet and API keys
- Makes independent decisions based on its personality
- Tracks its own portfolio and performance
- Competes against the others

## 🛠️ Development Scripts

```bash
# Root directory
pnpm run dev           # Start frontend only
pnpm run dev:server    # Start backend only
pnpm run dev:all       # Start both concurrently
pnpm run build         # Build frontend for production
pnpm run setup         # Install dependencies and init database

# Server directory
cd server
pnpm run dev           # Start server in dev mode (nodemon)
pnpm start             # Start server in production mode
pnpm run db:init       # Initialize database
pnpm run db:reset      # Reset database (WARNING: deletes all data)
```

## 🔒 Security Notes

- API keys are stored in `server/.env` and never exposed to the browser
- Each bot has isolated API keys for secure multi-wallet operation
- The frontend cannot access or modify API keys
- All trading operations are server-side authenticated

## ⚠️ Disclaimer

This project is for **educational and experimental purposes**. Live trading involves significant financial risk. The creators are not responsible for any financial losses incurred. Always do your own research and never trade with funds you cannot afford to lose.

## 📝 License

Copyright 2025 Google LLC  
SPDX-License-Identifier: Apache-2.0

## 🤝 Contributing

This is an experimental project. Feel free to fork and modify for your own use.

## 🙏 Acknowledgments

Built with:
- React + TypeScript
- Express.js
- SQLite (better-sqlite3)
- WebSockets
- TailwindCSS
- Lightweight Charts
