# Complete Setup Guide

This guide provides step-by-step instructions for setting up the BONERBOTS AI Arena on your local machine.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Obtaining API Keys](#obtaining-api-keys)
5. [Running the Application](#running-the-application)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js** (version 18 or higher)
  - Download from: https://nodejs.org/
  - Verify installation: `node --version`

- **pnpm** (recommended package manager)
  - Install with: `npm install -g pnpm`
  - Verify installation: `pnpm --version`
  - Alternative: You can use `npm` instead, but commands may differ

### System Requirements

- **Operating System**: Windows, macOS, or Linux
- **RAM**: 2GB minimum, 4GB recommended
- **Disk Space**: 500MB for dependencies and database

## Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd bonerbots-ai-arena
```

### Step 2: Run Setup Script

The easiest way to set up the project is using the setup script:

```bash
pnpm run setup
```

This will:
- Install all backend dependencies
- Install all frontend dependencies  
- Initialize the SQLite database
- Create necessary directories

### Step 3: Manual Installation (Alternative)

If the setup script fails, you can install manually:

```bash
# Install frontend dependencies
pnpm install

# Install backend dependencies
cd server
pnpm install

# Initialize database
pnpm run db:init

# Return to root
cd ..
```

## Configuration

### Backend Configuration (Server)

1. **Navigate to the server directory**:
   ```bash
   cd server
   ```

2. **Copy the example environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Edit the `.env` file** with your API keys:
   ```bash
   # Use your preferred text editor
   nano .env
   # or
   code .env
   ```

4. **Required environment variables**:
   ```env
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

### Frontend Configuration (Optional)

The frontend uses default URLs for local development. To customize:

1. **Create a `.env.local` file** in the root directory:
   ```bash
   cp .env.local.example .env.local
   ```

2. **Edit if needed** (optional - defaults should work):
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_WS_URL=ws://localhost:3002
   ```

## Obtaining API Keys

### Google Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it as `GEMINI_API_KEY` in your `.env` file

**Cost**: Free tier available with generous limits

### xAI (Grok) API Key

1. Visit [xAI Console](https://console.x.ai/)
2. Sign up or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and paste it as `XAI_API_KEY` in your `.env` file

**Cost**: Paid service, check xAI pricing

### Asterdex Exchange API Keys

You need **three separate sets** of API keys for the three bots:

1. Visit [Asterdex](https://asterdex.com/)
2. Create **three separate accounts** (one per bot):
   - Account 1: For DEGEN bot
   - Account 2: For Escaped Monkey bot
   - Account 3: For Astrologer bot

3. For each account:
   - Navigate to Account Settings → API Management
   - Create a new API Key
   - Enable futures trading permissions
   - Copy the API Key and Secret
   
4. Add the keys to your `.env` file:
   ```env
   # First account keys
   DEGEN_LIVE_API_KEY=first_account_api_key
   DEGEN_LIVE_SECRET=first_account_api_secret
   
   # Second account keys
   ESCAPED_MONKEY_API_KEY=second_account_api_key
   ESCAPED_MONKEY_SECRET=second_account_api_secret
   
   # Third account keys
   ASTROLOGER_API_KEY=third_account_api_key
   ASTROLOGER_SECRET=third_account_api_secret
   ```

**Important**: 
- Fund each account with USDT if you want live trading
- Start with small amounts for testing
- Paper trading is recommended initially

## Running the Application

### Development Mode (Recommended)

Run both backend and frontend concurrently:

```bash
# From the root directory
pnpm run dev:all
```

This will start:
- Backend server on http://localhost:3001
- WebSocket server on ws://localhost:3002
- Frontend dev server on http://localhost:5173

### Production Mode

1. **Build the frontend**:
   ```bash
   pnpm run build
   ```

2. **Start the server**:
   ```bash
   cd server
   pnpm start
   ```

3. **Access the application**:
   - Navigate to http://localhost:3001

## Verification

### Check Server Status

1. **Server should log**:
   ```
   🚀 BONERBOTS AI Arena Server
      HTTP Server: http://localhost:3001
      WebSocket Server: ws://localhost:3002
      Environment: development
      Database: ./data/arena.db
   ```

2. **Test API endpoint**:
   ```bash
   curl http://localhost:3001/api/state
   ```
   
   Should return: `{"bots":[],"marketData":[]}`

### Check Database

```bash
cd server
pnpm run db:init
```

Should show:
```
✓ Database file found at: <path>
✓ Database already contains state data
✓ Database verification successful
✅ Database initialization complete!
```

### Access the Frontend

1. **Spectator Mode**: http://localhost:5173
   - Should show "Connecting to the Arena..."
   - This is normal if broadcast mode isn't running

2. **Broadcast Mode**: http://localhost:5173/?mode=broadcast
   - Should prompt for password
   - Default password: `bonerbots`
   - After authentication, bots should initialize

## Troubleshooting

### Common Issues

#### 1. "Configuration validation failed"

**Problem**: Missing or invalid API keys in `.env` file

**Solution**:
- Ensure all required API keys are set in `server/.env`
- Check for typos in variable names
- Make sure there are no extra spaces or quotes

#### 2. "Cannot connect to database"

**Problem**: Database file not initialized or corrupted

**Solution**:
```bash
cd server
pnpm run db:reset
pnpm run db:init
```

#### 3. "Port already in use"

**Problem**: Ports 3001 or 3002 are already occupied

**Solution**:
- Change ports in `server/.env`:
  ```env
  PORT=3003
  WS_PORT=3004
  ```
- Update frontend `.env.local` to match

#### 4. "WebSocket connection failed"

**Problem**: WebSocket server not running or port blocked

**Solution**:
- Ensure backend server is running
- Check firewall settings
- Try a different WebSocket port

#### 5. "Module not found" errors

**Problem**: Dependencies not installed correctly

**Solution**:
```bash
# Clean install
rm -rf node_modules server/node_modules
pnpm install
cd server && pnpm install
```

#### 6. "API request timeout"

**Problem**: External API (Gemini, Grok, Asterdex) not responding

**Solution**:
- Check your internet connection
- Verify API keys are correct
- Check API service status

### Database Issues

#### Reset Database

To completely reset the database:
```bash
cd server
pnpm run db:reset
```

**Warning**: This deletes all bot states, trading history, and performance data.

#### View Database Contents

The database is located at `server/../data/arena.db`. You can inspect it using:
```bash
sqlite3 data/arena.db
.tables
SELECT * FROM arena_state;
.quit
```

### Getting Help

If you encounter issues not covered here:

1. Check the console logs for error messages
2. Review the [DEVELOPMENT.md](./DEVELOPMENT.md) file
3. Ensure all prerequisites are met
4. Try a fresh installation

## Next Steps

Once setup is complete:

1. **Read the documentation**: Check out [DEVELOPMENT.md](./DEVELOPMENT.md) for architecture details
2. **Start the simulation**: Run in broadcast mode to see the bots in action
3. **Monitor performance**: Open spectator tabs to watch real-time updates
4. **Customize bots**: Edit bot prompts in `prompts.ts` to change strategies

---

**Ready to compete?** Start the arena and let the bots trade! 🚀
