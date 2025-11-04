/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');

const config = require('./config');
const { getArenaState, updateArenaState, initializeArenaState } = require('./database');
const WebSocketServer = require('./websocket');

// Validate configuration before starting
if (!config.validateConfig()) {
  console.error('Configuration validation failed. Exiting...');
  process.exit(1);
}

const app = express();
const wsServer = new WebSocketServer(config.wsPort);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

/**
 * Create HMAC-SHA256 signature for Asterdex API
 */
function createHmacSha256Signature(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
}

// ============ API ROUTES ============

// Authentication routes (no /v2 prefix)
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

/**
 * POST /api/gemini - Forward requests to Google Gemini API
 */
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt in request body' });
    }
    
    // Get Gemini API key from database (llm_providers table) or fallback to env var
    const Database = require('better-sqlite3');
    const { decrypt } = require('./utils/encryption');
    const path = require('path');
    
    const dbPath = path.join(__dirname, '..', 'data', 'arena.db');
    const db = new Database(dbPath);
    
    let apiKey = null;
    
    try {
      // Try to get API key from database
      const provider = db.prepare(`
        SELECT api_key_encrypted 
        FROM llm_providers 
        WHERE provider_type = 'gemini' AND is_active = 1
        LIMIT 1
      `).get();
      
      if (provider && provider.api_key_encrypted) {
        apiKey = decrypt(provider.api_key_encrypted);
      } else {
        // Fallback to environment variable
        apiKey = config.geminiApiKey;
      }
    } finally {
      db.close();
    }
    
    if (!apiKey) {
      return res.status(503).json({ 
        error: 'Gemini API key not configured',
        message: 'Please configure a Gemini provider via /config/providers'
      });
    }
    
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    
    const decisionText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    res.json({ text: decisionText });
    
  } catch (error) {
    console.error('Gemini API error:', error.message);
    res.status(500).json({ 
      error: 'Error calling Gemini API',
      message: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * POST /api/grok - Forward requests to xAI Grok API
 */
app.post('/api/grok', async (req, res) => {
  try {
    // Get Grok API key from database (llm_providers table) or fallback to env var
    const Database = require('better-sqlite3');
    const { decrypt } = require('./utils/encryption');
    const path = require('path');
    
    const dbPath = path.join(__dirname, '..', 'data', 'arena.db');
    const db = new Database(dbPath);
    
    let apiKey = null;
    
    try {
      // Try to get API key from database
      const provider = db.prepare(`
        SELECT api_key_encrypted 
        FROM llm_providers 
        WHERE provider_type = 'grok' AND is_active = 1
        LIMIT 1
      `).get();
      
      if (provider && provider.api_key_encrypted) {
        apiKey = decrypt(provider.api_key_encrypted);
      } else {
        // Fallback to environment variable
        apiKey = config.xaiApiKey;
      }
    } finally {
      db.close();
    }
    
    if (!apiKey) {
      return res.status(503).json({ 
        error: 'Grok API key not configured',
        message: 'Please configure a Grok provider via /config/providers'
      });
    }
    
    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 30000
      }
    );
    
    res.json(response.data);
    
  } catch (error) {
    console.error('Grok API error:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Error calling Grok API',
      message: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * GET /api/asterdex/exchangeInfo - Get exchange information
 */
app.get('/api/asterdex/exchangeInfo', async (req, res) => {
  try {
    const response = await axios.get('https://fapi.asterdex.com/fapi/v1/exchangeInfo', {
      timeout: 10000
    });
    
    res.json(response.data);
    
  } catch (error) {
    console.error('Asterdex exchangeInfo error:', error.message);
    res.status(500).json({ 
      error: 'Error fetching exchange info',
      message: error.message 
    });
  }
});

/**
 * GET /api/asterdex - Get public market data (24hr ticker)
 */
app.get('/api/asterdex', async (req, res) => {
  try {
    // Market data is public - no API key required
    // Try to get API key if available, but don't fail if not found
    let headers = {};
    try {
      const { apiKey } = await config.getApiKeysForBot('bot_degen');
      if (apiKey) {
        headers = { 'X-MBX-APIKEY': apiKey };
      }
    } catch (err) {
      // No API key configured - that's OK for public market data
      console.log('No API key found for market data, using public endpoint');
    }
    
    const response = await axios.get('https://fapi.asterdex.com/fapi/v1/ticker/24hr', {
      headers,
      timeout: 10000
    });
    
    res.json(response.data);
    
  } catch (error) {
    console.error('Asterdex market data error:', error.message);
    res.status(500).json({ 
      error: 'Error fetching market data',
      message: error.message 
    });
  }
});

/**
 * POST /api/aster/trade - Authenticated trading operations
 */
app.post('/api/aster/trade', async (req, res) => {
  try {
    const { method, endpoint, params, botId } = req.body;
    
    if (!botId) {
      return res.status(400).json({ error: 'Missing botId in request body' });
    }
    
    if (!method || !endpoint) {
      return res.status(400).json({ error: 'Missing method or endpoint in request body' });
    }
    
    // Get API keys for the specific bot (from database or environment)
    const { apiKey, apiSecret } = await config.getApiKeysForBot(botId);
    
    // Add timestamp to params
    const timestamp = Date.now();
    const fullParams = { ...params, timestamp };
    
    // Create query string and signature
    const queryString = new URLSearchParams(fullParams).toString();
    const signature = createHmacSha256Signature(queryString, apiSecret);
    const finalUrl = `https://fapi.asterdex.com${endpoint}?${queryString}&signature=${signature}`;
    
    // Make the request
    const response = await axios({
      method: method,
      url: finalUrl,
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 10000
    });
    
    res.status(response.status).json(response.data);
    
  } catch (error) {
    console.error('Asterdex trade error:', error.message);
    const status = error.response?.status || 500;
    res.status(status).json({ 
      error: 'Error executing trade',
      message: error.response?.data?.msg || error.message 
    });
  }
});

/**
 * GET /api/state - Get current arena state
 */
app.get('/api/state', async (req, res) => {
  try {
    const stateData = getArenaState();
    
    if (!stateData) {
      // Return empty state if none exists
      return res.json({ bots: [], marketData: [] });
    }
    
    res.json(stateData.state);
    
  } catch (error) {
    console.error('Error getting state:', error);
    res.status(500).json({ error: 'Error retrieving arena state' });
  }
});

/**
 * POST /api/state - Update arena state (Broadcast mode only)
 */
app.post('/api/state', async (req, res) => {
  try {
    const newState = req.body;
    
    // Basic validation
    if (!newState || typeof newState !== 'object') {
      return res.status(400).json({ error: 'Invalid state object' });
    }
    
    // Update database
    updateArenaState(newState);
    
    // Broadcast to all WebSocket clients
    wsServer.broadcastState(newState);
    
    res.json({ success: true, clients: wsServer.getClientCount() });
    
  } catch (error) {
    console.error('Error updating state:', error);
    res.status(500).json({ error: 'Error updating arena state' });
  }
});

/**
 * DELETE /api/state - Clear arena state
 */
app.delete('/api/state', async (req, res) => {
  try {
    // Clear the arena_state table
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '..', 'data', 'arena.db');
    const db = new Database(dbPath);
    
    db.prepare('DELETE FROM arena_state').run();
    db.close();
    
    console.log('✅ Arena state cleared');
    res.json({ success: true, message: 'Arena state cleared' });
    
  } catch (error) {
    console.error('Error clearing state:', error);
    res.status(500).json({ error: 'Error clearing arena state' });
  }
});

// ============ NEW API ROUTES (v2.0) ============

// Check if relational schema exists, if so, mount new routes
const relationalDb = require('./database/relational');
const apiRoutes = require('./routes');

if (relationalDb.hasRelationalSchema()) {
  app.use('/api/v2', apiRoutes);
  console.log('✓ Relational API (v2) routes loaded');
} else {
  console.log('⚠️  Relational schema not detected. Run migration to enable v2 API.');
  console.log('   Run: cd server && node scripts/migrate_to_relational.js');
}

// ============ STATIC FILE SERVING ============

const staticPath = path.join(__dirname, '..', 'dist');
app.use(express.static(staticPath));

// For any other request, serve the index.html file for client-side routing
app.get('*', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(500).send('Error serving the application. Did you run `pnpm run build`?');
    }
  });
});

// ============ ERROR HANDLING ============

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============ SERVER STARTUP ============

// Initialize default state if needed
const defaultState = { bots: [], marketData: [] };
initializeArenaState(defaultState);

// Start WebSocket server
wsServer.start();

// Start HTTP server
app.listen(config.port, () => {
  console.log('\n🚀 BONERBOTS AI Arena Server');
  console.log(`   HTTP Server: http://localhost:${config.port}`);
  console.log(`   WebSocket Server: ws://localhost:${config.wsPort}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Database: ${config.databasePath}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing servers');
  wsServer.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing servers');
  wsServer.close();
  process.exit(0);
});
