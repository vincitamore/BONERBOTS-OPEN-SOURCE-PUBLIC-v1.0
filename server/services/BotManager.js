/**
 * @license
 * SPDX-License-Identifier: MIT
 * 
 * BotManager - Server-side autonomous bot trading engine
 * Manages bot lifecycle, trading decisions, and state persistence independently of client connections
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');
const { executeSandboxTool, resetSandbox } = require('./sandboxService');
const { manageHistorySize, calculateHistoryTokens } = require('./historySummarizer');
const relationalDb = require('../database/relational');

// Constants for non-configurable values
const MAX_VALUE_HISTORY = 300; // Keep last 300 data points
const MAX_BOT_LOGS = 50; // Keep last 50 decision logs
const MAX_ITERATIONS = 5; // Maximum iterations for multi-step analysis
const ITERATION_TIMEOUT_MS = 10000; // Timeout per iteration

class BotManager {
  constructor(config, websocketServer) {
    this.config = config;
    this.wsServer = websocketServer;
    this.bots = new Map(); // userId -> Map<botId, botState> (multi-tenant structure)
    this.userBotOrder = []; // Array of userIds for round-robin scheduling
    this.currentUserIndex = 0; // Current position in round-robin
    this.markets = [];
    this.symbolPrecisions = new Map();
    this.initialBalances = new Map();
    this.isRunning = false;
    this.turnInterval = null;
    this.refreshInterval = null;
    this.leverageLimits = this.loadLeverageLimits();
    
    // Load dynamic settings from database
    this.settings = null;
    
    console.log('🤖 BotManager initialized (Multi-Tenant Mode)');
  }

  /**
   * Load leverage limits from the leverageLimits.ts file
   */
  loadLeverageLimits() {
    try {
      // Parse the TypeScript file to extract leverage limits
      const fs = require('fs');
      const leverageFile = path.join(__dirname, '..', '..', 'leverageLimits.ts');
      const content = fs.readFileSync(leverageFile, 'utf-8');
      
      const limits = new Map();
      const regex = /\['([^']+)',\s*(\d+)\]/g;
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        limits.set(match[1], parseInt(match[2]));
      }
      
      console.log(`📊 Loaded ${limits.size} leverage limits`);
      return limits;
    } catch (error) {
      console.warn('⚠️ Could not load leverage limits, using defaults:', error.message);
      return new Map();
    }
  }

  /**
   * Initialize the bot manager - load settings, bots, fetch exchange info, start trading
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ BotManager already running');
      return;
    }

    console.log('🚀 Starting BotManager...');
    
    try {
      // 1. Load system settings from database
      await this.loadSettings();
      
      // 2. Load exchange info (symbol precisions)
      await this.loadExchangeInfo();
      
      // 3. Load bot configurations from database
      await this.loadBots();
      
      // 4. Start trading intervals
      this.startTrading();
      
      this.isRunning = true;
      console.log('✅ BotManager started successfully');
    } catch (error) {
      console.error('❌ Failed to start BotManager:', error);
      throw error;
    }
  }
  
  /**
   * Load system settings from database
   */
  async loadSettings() {
    console.log('⚙️ Loading system settings from database...');
    
    const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
    const db = new Database(dbPath, { readonly: true });
    
    try {
      const rows = db.prepare('SELECT key, value, data_type FROM system_settings').all();
      this.settings = {};
      
      for (const row of rows) {
        switch (row.data_type) {
          case 'number':
            this.settings[row.key] = parseFloat(row.value);
            break;
          case 'boolean':
            this.settings[row.key] = row.value === 'true' || row.value === '1';
            break;
          case 'json':
            this.settings[row.key] = JSON.parse(row.value);
            break;
          default:
            this.settings[row.key] = row.value;
        }
      }
      
      console.log(`✅ Loaded ${Object.keys(this.settings).length} settings:`, {
        tradingSymbols: this.settings.trading_symbols?.length || 0,
        minTradeSize: this.settings.minimum_trade_size_usd,
        turnInterval: this.settings.turn_interval_ms,
        refreshInterval: this.settings.refresh_interval_ms
      });
    } finally {
      db.close();
    }
  }

  /**
   * Stop the bot manager
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping BotManager...');
    
    if (this.turnInterval) {
      clearInterval(this.turnInterval);
      this.turnInterval = null;
    }
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    this.isRunning = false;
    console.log('✅ BotManager stopped');
  }

  /**
   * Load exchange information (symbol precisions)
   */
  async loadExchangeInfo() {
    try {
      console.log('📊 Fetching exchange info...');
      const response = await axios.get('https://fapi.asterdex.com/fapi/v1/exchangeInfo', {
        timeout: 10000
      });
      
      if (response.data && response.data.symbols) {
        response.data.symbols.forEach(symbol => {
          this.symbolPrecisions.set(symbol.symbol, {
            quantityPrecision: symbol.quantityPrecision || 3,
            pricePrecision: symbol.pricePrecision || 2
          });
        });
        console.log(`✅ Loaded precision data for ${this.symbolPrecisions.size} symbols`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch exchange info (exchange API may not be configured):', error.message);
    }
  }

  /**
   * Reload a single bot's configuration from the database
   * Updates name, prompt, provider, trading mode, etc. while preserving trading state
   */
  async reloadBotConfig(botId) {
    console.log(`🔄 Reloading configuration for bot ${botId}...`);
    
    const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
    const db = new Database(dbPath, { readonly: true });
    
    try {
      // Fetch bot config from database
      const configQuery = db.prepare(`
        SELECT 
          b.id, b.name, b.prompt, b.trading_mode, 
          b.is_paused, b.is_active, b.avatar_image,
          p.id as provider_id, p.name as provider_name, p.provider_type
        FROM bots b
        JOIN llm_providers p ON b.provider_id = p.id
        WHERE b.id = ?
      `);
      
      const config = configQuery.get(botId);
      db.close();
      
      if (!config) {
        console.warn(`⚠️ Bot ${botId} not found in database`);
        return { success: false, message: 'Bot not found' };
      }
      
      // Find existing bot in memory (multi-tenant aware)
      const existingBot = this.getBot(botId);
      
      if (!existingBot) {
        console.warn(`⚠️ Bot ${botId} not found in active bots`);
        return { success: false, message: 'Bot not in active memory' };
      }
      
      const provider = (config.provider_type === 'gemini' || config.provider_type === 'grok') 
        ? config.provider_type 
        : 'gemini';
      
      // Update bot configuration while preserving state
      const updatedBot = {
        ...existingBot,
        name: config.name,
        prompt: config.prompt,
        provider,
        providerName: config.provider_name,
        avatarUrl: config.avatar_image,
        tradingMode: config.trading_mode,
        isPaused: config.is_paused
      };
      
      // Update in the user's bot map
      const userId = existingBot.userId;
      const userBots = this.bots.get(userId);
      if (userBots) {
        userBots.set(botId, updatedBot);
      }
      
      // Broadcast updated state
      this.broadcastState();
      
      console.log(`✅ Reloaded configuration for ${config.name}`);
      return { 
        success: true, 
        message: `Bot ${config.name} configuration reloaded successfully`,
        bot: updatedBot
      };
    } catch (error) {
      console.error(`❌ Failed to reload bot ${botId}:`, error);
      if (db) db.close();
      return { success: false, message: error.message };
    }
  }

  /**
   * Load bot configurations from database (Multi-Tenant)
   * Groups bots by user for fair scheduling
   */
  async loadBots() {
    console.log('🤖 Loading bot configurations from database (Multi-Tenant)...');
    
    const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
    const db = new Database(dbPath, { readonly: true });
    
    try {
      // Fetch active bots and their providers WITH user_id
      const botsQuery = db.prepare(`
        SELECT 
          b.id, b.name, b.prompt, b.trading_mode, 
          b.is_paused, b.avatar_image, b.user_id, b.history_summary,
          p.id as provider_id, p.name as provider_name, p.provider_type
        FROM bots b
        JOIN llm_providers p ON b.provider_id = p.id
        WHERE b.is_active = 1 AND b.user_id IS NOT NULL
        ORDER BY b.user_id, b.id
      `);
      
      const botConfigs = botsQuery.all();
      console.log(`📝 Found ${botConfigs.length} active bots across multiple users`);
      
      if (botConfigs.length === 0) {
        console.warn('⚠️ No active bots found in database');
        return;
      }
      
      // Try to load saved state from arena_state
      let savedState = null;
      try {
        const stateRow = db.prepare('SELECT state FROM arena_state LIMIT 1').get();
        if (stateRow && stateRow.state) {
          savedState = JSON.parse(stateRow.state);
          console.log('📦 Found saved state with', savedState.bots?.length || 0, 'bots');
        }
      } catch (error) {
        console.log('ℹ️ No saved state found, starting fresh');
      }
      
      // Group bots by user
      const userBotsMap = new Map(); // Temporary grouping
      for (const config of botConfigs) {
        if (!userBotsMap.has(config.user_id)) {
          userBotsMap.set(config.user_id, []);
        }
        userBotsMap.get(config.user_id).push(config);
      }
      
      console.log(`👥 Loading bots for ${userBotsMap.size} users...`);
      
      // Initialize bots per user
      let totalBots = 0;
      for (const [userId, userBotConfigs] of userBotsMap.entries()) {
        console.log(`   👤 Loading ${userBotConfigs.length} bots for user ${userId.substring(0, 8)}...`);
        
        // Create user bot map if it doesn't exist
        if (!this.bots.has(userId)) {
          this.bots.set(userId, new Map());
        }
        
        const userBots = this.bots.get(userId);
        
        for (const config of userBotConfigs) {
        const provider = (config.provider_type === 'gemini' || config.provider_type === 'grok') 
          ? config.provider_type 
          : 'gemini';
        
        // Check if we have saved state for this bot
        const savedBot = savedState?.bots?.find(b => b.id === config.id);
        
        // Load data from relational database
        let dbTrades = [];
        let dbPositions = [];
        let dbDecisions = [];
        
        try {
          // Load recent trades (last 100)
          dbTrades = relationalDb.getTrades(config.id, { user_id: config.user_id, limit: 100 });
          
          // Load open positions
          dbPositions = relationalDb.getPositions(config.id, 'open', config.user_id);
          
          // Load recent decisions (last 50)
          dbDecisions = relationalDb.getBotDecisions(config.id, 50, config.user_id);
          
          console.log(`      📊 Loaded from DB: ${dbTrades.length} trades, ${dbPositions.length} positions, ${dbDecisions.length} decisions`);
        } catch (dbError) {
          console.warn(`      ⚠️ Failed to load database data for ${config.name}:`, dbError.message);
          // Continue with empty arrays - will fall back to savedBot data if available
        }
        
        // Transform database data to in-memory format
        const orders = dbTrades.map(trade => ({
          id: trade.id,
          symbol: trade.symbol,
          type: trade.trade_type,
          size: trade.size,
          leverage: trade.leverage,
          pnl: trade.pnl,
          fee: trade.fee,
          timestamp: new Date(trade.executed_at).getTime(),
          entryPrice: trade.entry_price,
          exitPrice: trade.exit_price || 0
        }));
        
        const positions = dbPositions.map(pos => ({
          id: pos.id,
          symbol: pos.symbol,
          type: pos.position_type,
          entryPrice: pos.entry_price,
          size: pos.size,
          leverage: pos.leverage,
          liquidationPrice: pos.liquidation_price,
          stopLoss: pos.stop_loss,
          takeProfit: pos.take_profit,
          pnl: pos.unrealized_pnl || 0
        }));
        
        const botLogs = dbDecisions.map(decision => ({
          timestamp: new Date(decision.timestamp).getTime(),
          decisions: JSON.parse(decision.decisions_json || '[]'),
          prompt: decision.prompt_sent,
          notes: JSON.parse(decision.notes_json || '[]')
        }));
        
        let botState;
        // Determine initial balance based on trading mode
        const initialBalance = config.trading_mode === 'real' 
          ? this.settings.live_bot_initial_balance 
          : this.settings.paper_bot_initial_balance;
        
        if (savedBot) {
            console.log(`      Resuming ${config.name} from saved state + database`);
          botState = {
            ...savedBot,
              userId: config.user_id, // Add userId to bot state
              provider_id: config.provider_id, // Add provider_id for history summarization
              history_summary: config.history_summary, // Load history summary from database
            tradingMode: config.trading_mode,
            isPaused: config.is_paused,
            providerName: config.provider_name,
            provider,
            prompt: config.prompt,
            name: config.name,
            avatarUrl: config.avatar_image,
            isLoading: false,
              initialBalance,
            symbolCooldowns: savedBot.symbolCooldowns || {},
            // Override with database data
            orders: orders.length > 0 ? orders : (savedBot.orders || []),
            botLogs: botLogs.length > 0 ? botLogs : (savedBot.botLogs || []),
            portfolio: {
              ...savedBot.portfolio,
              positions: positions.length > 0 ? positions : (savedBot.portfolio?.positions || [])
            }
          };
        } else {
            console.log(`      Creating fresh state for ${config.name} (using database data if available)`);
          
          botState = {
            id: config.id,
              userId: config.user_id, // Add userId to bot state
              provider_id: config.provider_id, // Add provider_id for history summarization
              history_summary: config.history_summary, // Load history summary from database
            name: config.name,
            prompt: config.prompt,
            provider,
            providerName: config.provider_name,
            avatarUrl: config.avatar_image,
            tradingMode: config.trading_mode,
              initialBalance,
            portfolio: {
              balance: initialBalance,
              pnl: 0,
              totalValue: initialBalance,
              positions: positions  // Use database positions
            },
            orders: orders,  // Use database trades
            botLogs: botLogs,  // Use database decisions
            valueHistory: [{ timestamp: Date.now(), value: initialBalance }],
            isLoading: false,
            isPaused: config.is_paused,
            realizedPnl: 0,
            tradeCount: orders.length,  // Count from database trades
            winRate: 0,
            symbolCooldowns: {}
          };
        }
        
        // For live trading bots, sync with exchange
        if (config.trading_mode === 'real') {
          try {
              console.log(`      [${config.name}] Syncing with live exchange...`);
            const realPortfolio = await this.getRealAccountState(config.id);
            const realOrders = await this.getRealTradeHistory(config.id);
            const realizedPnl = realOrders.reduce((acc, o) => acc + o.pnl, 0);
            
            botState.portfolio = realPortfolio;
            botState.orders = realOrders;
            botState.realizedPnl = realizedPnl;
            botState.valueHistory = [{ timestamp: Date.now(), value: realPortfolio.totalValue }];
            
            this.initialBalances.set(config.id, this.settings.live_bot_initial_balance);
              console.log(`      ✅ [${config.name}] Synced with exchange`);
          } catch (error) {
              console.warn(`      ⚠️ [${config.name}] Failed to sync with exchange:`, error.message);
            this.initialBalances.set(config.id, this.settings.live_bot_initial_balance);
          }
        } else {
          this.initialBalances.set(config.id, this.settings.paper_bot_initial_balance);
        }
        
          userBots.set(config.id, botState);
          totalBots++;
          console.log(`      ✅ Loaded bot: ${config.name} (${config.trading_mode} mode, ${config.is_paused ? 'PAUSED' : 'ACTIVE'})`);
      }
      }
      
      // Initialize round-robin scheduling array
      this.userBotOrder = Array.from(this.bots.keys());
      this.currentUserIndex = 0;
      
      console.log(`✅ Initialized ${totalBots} bots across ${this.bots.size} users`);
    } finally {
      db.close();
    }
  }

  /**
   * Helper: Get all bots across all users
   * @returns {Array} Array of all bot states
   */
  getAllBots() {
    const allBots = [];
    for (const userBots of this.bots.values()) {
      for (const bot of userBots.values()) {
        allBots.push(bot);
      }
    }
    return allBots;
  }

  /**
   * Helper: Get a specific bot by ID
   * @param {string} botId - The bot ID to find
   * @returns {object|null} Bot state or null if not found
   */
  getBot(botId) {
    for (const userBots of this.bots.values()) {
      if (userBots.has(botId)) {
        return userBots.get(botId);
      }
    }
    return null;
  }

  /**
   * Helper: Get user's bots
   * @param {string} userId - The user ID
   * @returns {Map} Map of user's bots or empty Map
   */
  getUserBots(userId) {
    return this.bots.get(userId) || new Map();
  }

  /**
   * Helper: Get next bot for execution (round-robin across users)
   * Ensures fair distribution of bot execution time across all users
   * @returns {object|null} Next bot to execute or null if none available
   */
  getNextBotForExecution() {
    if (this.userBotOrder.length === 0) {
      return null;
    }

    // Try each user in round-robin order
    const startIndex = this.currentUserIndex;
    let attempts = 0;

    while (attempts < this.userBotOrder.length) {
      const userId = this.userBotOrder[this.currentUserIndex];
      const userBots = this.bots.get(userId);

      if (userBots && userBots.size > 0) {
        // Find an active (non-paused) bot for this user
        for (const bot of userBots.values()) {
          if (!bot.isPaused && !bot.isLoading) {
            // Move to next user for next iteration
            this.currentUserIndex = (this.currentUserIndex + 1) % this.userBotOrder.length;
            return bot;
          }
        }
      }

      // Move to next user
      this.currentUserIndex = (this.currentUserIndex + 1) % this.userBotOrder.length;
      attempts++;
    }

    return null; // No active bots found
  }

  /**
   * Helper: Get all bots for a trading turn
   * Returns all active (non-paused) bots from all users
   * @returns {Array} Array of bot objects
   */
  getNextBotsForTurn() {
    return this.getAllBots().filter(bot => !bot.isPaused && !bot.isLoading);
  }

  /**
   * Start trading intervals
   */
  startTrading() {
    console.log('▶️ Starting trading intervals...');
    
    const turnIntervalMs = this.settings.turn_interval_ms || 300000;
    const refreshIntervalMs = this.settings.refresh_interval_ms || 5000;
    
    // Execute first portfolio update immediately
    this.updatePortfolios().then(() => {
      // Check if any bot has made a recent decision
      const now = Date.now();
      let hasRecentDecisions = false;
      
      const allBots = this.getAllBots();
      for (const bot of allBots) {
        if (bot.botLogs && bot.botLogs.length > 0) {
          const lastDecision = bot.botLogs[0].timestamp;
          if (now - lastDecision < turnIntervalMs) {
            hasRecentDecisions = true;
            break;
          }
        }
      }
      
      if (!hasRecentDecisions) {
        console.log('⚡ Executing first trading turn immediately...');
        this.runTradingTurn();
      } else {
        console.log('⏳ Recent decisions detected, waiting for next interval...');
      }
    });
    
    // Set up recurring intervals using settings
    this.refreshInterval = setInterval(() => this.updatePortfolios(), refreshIntervalMs);
    this.turnInterval = setInterval(() => this.runTradingTurn(), turnIntervalMs);
    
    console.log(`✅ Trading intervals started (refresh: ${refreshIntervalMs}ms, turn: ${turnIntervalMs}ms)`);
  }

  /**
   * Get trading symbols allowed for a specific bot
   * Returns bot-specific symbols if configured, otherwise falls back to global settings
   */
  getTradingSymbolsForBot(bot) {
    // Check if bot has custom trading symbols configured
    if (bot.trading_symbols) {
      try {
        const symbols = JSON.parse(bot.trading_symbols);
        if (Array.isArray(symbols) && symbols.length > 0) {
          return symbols;
        }
      } catch (e) {
        console.error(`Failed to parse trading_symbols for bot ${bot.id}:`, e);
      }
    }
    
    // Fall back to global settings
    return this.settings.trading_symbols || [];
  }

  /**
   * Get market data filtered by allowed symbols for a specific bot
   */
  getMarketsForBot(bot) {
    const allowedSymbols = this.getTradingSymbolsForBot(bot);
    
    if (allowedSymbols.length === 0) {
      // No filter - return all markets
      return this.markets;
    }
    
    const allowedSet = new Set(allowedSymbols);
    return this.markets.filter(market => allowedSet.has(market.symbol));
  }

  /**
   * Get market data (filtered by global trading_symbols setting)
   */
  async getMarketData() {
    try {
      const response = await axios.get('https://fapi.asterdex.com/fapi/v1/ticker/24hr', {
        timeout: 10000
      });
      
      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
      
      // Get all markets (we'll filter per-bot in getMarketsForBot)
      const markets = response.data
        .map(ticker => ({
          symbol: ticker.symbol,
          price: parseFloat(ticker.lastPrice),
          price24hChange: parseFloat(ticker.priceChangePercent)
        }));
      
      console.log(`📊 Fetched ${markets.length} markets (${response.data.length} total from exchange)`);
      return markets;
    } catch (error) {
      console.error('❌ Error fetching market data:', error.message);
      return [];
    }
  }

  /**
   * Get real account state from exchange
   */
  async getRealAccountState(botId) {
    try {
      const { apiKey, apiSecret } = await this.config.getApiKeysForBot(botId);
      
      // Get account balance
      const balanceResponse = await this.makeAuthenticatedRequest(
        'GET',
        '/fapi/v2/balance',
        {},
        apiKey,
        apiSecret
      );
      
      const usdtBalance = balanceResponse.find(b => b.asset === 'USDT');
      const availableBalance = parseFloat(usdtBalance?.availableBalance || 0);
      
      // Get open positions
      const positionsResponse = await this.makeAuthenticatedRequest(
        'GET',
        '/fapi/v2/positionRisk',
        {},
        apiKey,
        apiSecret
      );
      
      let unrealizedPnl = 0;
      let totalMarginUsed = 0;
      const positions = [];
      
      for (const pos of positionsResponse) {
        const positionAmt = parseFloat(pos.positionAmt);
        if (Math.abs(positionAmt) > 0.0001) {
          const entryPrice = parseFloat(pos.entryPrice);
          const markPrice = parseFloat(pos.markPrice);
          const leverage = parseInt(pos.leverage);
          const notional = Math.abs(parseFloat(pos.notional));
          const pnl = parseFloat(pos.unRealizedProfit);
          const liquidationPrice = parseFloat(pos.liquidationPrice);
          
          unrealizedPnl += pnl;
          totalMarginUsed += notional / leverage;
          
          positions.push({
            id: `${pos.symbol}_${Date.now()}`,
            symbol: pos.symbol,
            type: positionAmt > 0 ? 'LONG' : 'SHORT',
            entryPrice,
            size: notional / leverage,
            leverage,
            liquidationPrice,
            pnl
          });
        }
      }
      
      const totalValue = availableBalance + totalMarginUsed + unrealizedPnl;
      
      return {
        balance: availableBalance,
        pnl: unrealizedPnl,
        totalValue,
        positions
      };
    } catch (error) {
      console.error(`Error getting real account state for bot ${botId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get real trade history from exchange
   */
  async getRealTradeHistory(botId) {
    try {
      const { apiKey, apiSecret } = await this.config.getApiKeysForBot(botId);
      
      const response = await this.makeAuthenticatedRequest(
        'GET',
        '/fapi/v1/userTrades',
        { limit: 100 },
        apiKey,
        apiSecret
      );
      
      // Group trades by symbol and calculate PnL
      const orders = [];
      const tradesBySymbol = {};
      
      for (const trade of response) {
        const symbol = trade.symbol;
        if (!tradesBySymbol[symbol]) {
          tradesBySymbol[symbol] = [];
        }
        tradesBySymbol[symbol].push(trade);
      }
      
      // Calculate PnL for each symbol (simplified - match buys with sells)
      for (const [symbol, trades] of Object.entries(tradesBySymbol)) {
        for (const trade of trades) {
          orders.push({
            id: trade.id.toString(),
            symbol: trade.symbol,
            type: trade.side === 'BUY' ? 'LONG' : 'SHORT',
            size: parseFloat(trade.quoteQty),
            leverage: 1, // We don't have this info from trade history
            pnl: parseFloat(trade.realizedPnl || 0),
            fee: parseFloat(trade.commission),
            timestamp: trade.time,
            entryPrice: parseFloat(trade.price),
            exitPrice: parseFloat(trade.price)
          });
        }
      }
      
      return orders.slice(0, 50); // Keep last 50 orders
    } catch (error) {
      console.error(`Error getting real trade history for bot ${botId}:`, error.message);
      return [];
    }
  }

  /**
   * Make authenticated request to exchange
   */
  async makeAuthenticatedRequest(method, endpoint, params, apiKey, apiSecret) {
    const crypto = require('crypto');
    const timestamp = Date.now();
    const fullParams = { ...params, timestamp };
    
    const queryString = new URLSearchParams(fullParams).toString();
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');
    
    const url = `https://fapi.asterdex.com${endpoint}?${queryString}&signature=${signature}`;
    
    const response = await axios({
      method,
      url,
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 10000
    });
    
    return response.data;
  }

  /**
   * Update portfolios for all bots
   */
  async updatePortfolios() {
    try {
      // Fetch latest market data
      const marketData = await this.getMarketData();
      if (marketData.length === 0) {
        return;
      }
      
      this.markets = marketData;
      
      // Update each bot's portfolio (multi-tenant aware)
      const allBots = this.getAllBots();
      for (const bot of allBots) {
        try {
          // Skip if bot doesn't have required data
          if (!bot || !bot.id || !bot.portfolio) {
            console.warn(`Skipping bot with missing data:`, bot?.id || 'unknown');
            continue;
          }

          if (bot.tradingMode === 'real') {
            // Real trading: get state from exchange
            const realPortfolio = await this.getRealAccountState(bot.id);
            const realOrders = await this.getRealTradeHistory(bot.id);
            const realizedPnl = realOrders.reduce((acc, order) => acc + order.pnl, 0);
            
            bot.portfolio = realPortfolio;
            bot.orders = realOrders;
            bot.realizedPnl = realizedPnl;
          } else {
            // Paper trading: calculate PnL from positions
            let unrealizedPnl = 0;
            let totalMarginUsed = 0;
            
            // Ensure positions array exists
            if (!bot.portfolio.positions) {
              bot.portfolio.positions = [];
            }
            
            bot.portfolio.positions = bot.portfolio.positions.map(pos => {
              const currentPrice = marketData.find(m => m.symbol === pos.symbol)?.price ?? pos.entryPrice;
              const assetQuantity = (pos.size * pos.leverage) / pos.entryPrice;
              const pnl = (currentPrice - pos.entryPrice) * assetQuantity * (pos.type === 'LONG' ? 1 : -1);
              
              unrealizedPnl += pnl;
              totalMarginUsed += pos.size;
              
              return { ...pos, pnl };
            });
            
            const totalValue = bot.portfolio.balance + totalMarginUsed + unrealizedPnl;
            bot.portfolio.pnl = unrealizedPnl;
            bot.portfolio.totalValue = totalValue;
          }
          
          // Update value history
          if (!bot.valueHistory) {
            bot.valueHistory = [];
          }
          
          bot.valueHistory.push({
            timestamp: Date.now(),
            value: bot.portfolio.totalValue
          });
          
          // Keep history to reasonable size
          if (bot.valueHistory.length > MAX_VALUE_HISTORY) {
            bot.valueHistory = bot.valueHistory.slice(-MAX_VALUE_HISTORY);
          }
          
          // Save snapshot to database
          await this.saveSnapshot(bot.id, bot);
        } catch (error) {
          console.error(`Error updating portfolio for bot ${bot.id}:`, error.message);
        }
      }
      
      // Broadcast updated state to all connected clients
      this.broadcastState();
    } catch (error) {
      console.error('Error updating portfolios:', error);
    }
  }

  /**
   * Save bot snapshot to database for analytics
   */
  async saveSnapshot(botId, bot) {
    try {
      const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
      const db = new Database(dbPath);
      
      try {
        // Table is called bot_state_snapshots (from 002_relational_schema.sql)
        db.prepare(`
          INSERT INTO bot_state_snapshots (
            user_id, bot_id, balance, total_value, realized_pnl, unrealized_pnl,
            trade_count, win_rate
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          bot.userId,
          botId,
          bot.portfolio.balance,
          bot.portfolio.totalValue,
          bot.realizedPnl || 0,
          bot.portfolio.pnl || 0,
          bot.tradeCount || 0,
          bot.winRate || 0
        );
      } finally {
        db.close();
      }
    } catch (error) {
      // Non-critical error, just log it
      console.debug(`Failed to save snapshot for bot ${botId}:`, error.message);
    }
  }

  /**
   * Run trading turn for all active bots
   */
  async runTradingTurn(specificBotId = null) {
    console.log(specificBotId 
      ? `🎲 Running trading turn for bot: ${specificBotId}...` 
      : '🎲 Running trading turn for all active bots...');
    
    if (this.markets.length === 0) {
      console.warn('⚠️ Market data not loaded yet, skipping trading turn');
      return;
    }
    
    // Multi-tenant aware bot selection
    const botsToProcess = specificBotId 
      ? [this.getBot(specificBotId)].filter(b => b !== null)
      : this.getNextBotsForTurn();
    
    for (const bot of botsToProcess) {
      if (!bot) {
        console.warn('⚠️ Skipping null/undefined bot');
        continue;
      }
      
      if (bot.isPaused) {
        console.log(`   ⏭️ Skipping ${bot.name} - paused`);
        continue;
      }
      
      console.log(`   🤖 Processing turn for ${bot.name} (${bot.tradingMode} mode)...`);
      
      try {
        bot.isLoading = true;
        
        // Get AI decision
        const decisionResult = await this.getTradingDecision(bot);
        const { prompt, basePrompt, decisions: rawDecisions, error } = decisionResult;
        
        // Ensure decisions is always an array (default to empty if undefined)
        const decisions = rawDecisions || [];
        
        const notes = [];
        
        if (error) {
          console.error(`   ❌ API Error for ${bot.name}: ${error}`);
          notes.push(`⚠️ API ERROR: ${error}`);
        }
        
        // Validate and execute decisions
        const validatedDecisions = this.validateDecisions(bot, decisions, notes);
        
        console.log(`   ✅ ${validatedDecisions.length} decisions passed validation`);
        
        // Execute trades
        await this.executeDecisions(bot, validatedDecisions, notes);
        
        // Log decision
        const newLog = {
          timestamp: Date.now(),
          decisions,
          prompt,
          notes
        };
        
        bot.botLogs.unshift(newLog);
        bot.botLogs = bot.botLogs.slice(0, MAX_BOT_LOGS);
        
        // Write decision to database
        // CRITICAL FIX: Store ONLY the base prompt (without history) to prevent exponential growth
        try {
          relationalDb.createDecision({
            user_id: bot.userId,
            bot_id: bot.id,
            prompt_sent: basePrompt || prompt || '[No prompt available]', // Prefer basePrompt
            decisions: decisions, // Pass raw array - createDecision will stringify it
            notes: notes, // Pass raw array - createDecision will stringify it
            execution_success: !error, // Success only if no error occurred
            timestamp: new Date(newLog.timestamp).toISOString()
          });
        } catch (dbError) {
          console.error(`[BotManager] Failed to write decision to database for ${bot.name}:`, dbError.message);
          // Continue - don't fail the turn if DB write fails
        }
        
        bot.isLoading = false;
        
        console.log(`   ✅ Turn complete for ${bot.name}`);
      } catch (error) {
        console.error(`   ❌ Error processing turn for ${bot.name}:`, error);
        bot.isLoading = false;
      }
    }
    
    // Save state and broadcast
    await this.saveState();
    this.broadcastState();
  }

  /**
   * Get trading decision from AI with optional multi-step sandbox analysis
   * Supports iterative analysis for advanced bots (Chronospeculator)
   */
  async getTradingDecision(bot) {
    // Check if bot should use multi-step sandbox analysis
    const useMultiStep = bot.name === 'Chronospeculator' || bot.id === 'bot_chronospeculator' ||
                          bot.name === 'Astrologer' || bot.id === 'bot_astrologer' ||
                          bot.enableSandbox === true;
    
    if (useMultiStep) {
      return await this.getTradingDecisionWithSandbox(bot);
    } else {
      return await this.getTradingDecisionStandard(bot);
    }
  }

  /**
   * Load and manage bot decision history with intelligent summarization
   * Returns formatted history context for prompt
   */
  async loadAndManageHistory(bot) {
    // Load decisions from relational database (not from in-memory botLogs)
    // This ensures we have the full history for Chronospeculator's multi-step analysis
    const decisions = relationalDb.getBotDecisions(bot.id, 100, bot.userId); // Get last 100 decisions
    console.log(`      📜 Found ${decisions.length} decisions in history for ${bot.name}`);
    
    // If no new decisions but bot has existing history_summary, return that
    if (decisions.length === 0) {
      if (bot.history_summary) {
        console.log(`      ♻️ Using existing history summary (no new decisions)`);
        return { 
          summary: bot.history_summary, 
          recentDecisions: [], 
          historyContext: this.formatHistoryForPrompt(bot.history_summary, []) 
        };
      }
      return { summary: null, recentDecisions: [], historyContext: '' };
    }
    
    const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
    const db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    
    try {
      
      // Get provider config for summarization
      const provider = db.prepare(`
        SELECT * FROM llm_providers WHERE id = ?
      `).get(bot.provider_id);
      
      // Manage history size - will summarize if needed
      const result = await manageHistorySize(
        bot,
        decisions.reverse(), // Reverse to oldest-first for summarization
        provider,
        25000, // Max tokens before summarization (allows substantial history)
        15     // Keep last 15 decisions unsummarized
      );
      
      // If summarization occurred, update the bot's history_summary in database
      if (result.needsSummarization) {
        console.log(`   💾 Saving history summary for ${bot.name} (compressed ${result.summarizedCount} decisions)`);
        db.prepare(`
          UPDATE bots 
          SET history_summary = ?
          WHERE id = ? AND user_id = ?
        `).run(result.summary, bot.id, bot.userId);
        
        bot.history_summary = result.summary;
      }
      
      return {
        summary: result.summary,
        recentDecisions: result.recentDecisions.reverse(), // Back to newest-first
        historyContext: this.formatHistoryForPrompt(result.summary, result.recentDecisions.reverse()),
        totalTokens: result.totalTokens,
        managedTokens: result.newTokenEstimate
      };
    } finally {
      db.close();
    }
  }
  
  /**
   * Format history summary + last 5 AI log entries for prompt inclusion
   */
  formatHistoryForPrompt(summary, recentDecisions) {
    let context = '';
    
    // Add summary if it exists
    if (summary) {
      try {
        const parsed = JSON.parse(summary);
        context += `\n\n=== YOUR LEARNING HISTORY & INSIGHTS ===\n`;
        context += `(Compressed summary of ${parsed.summarizedCount} earlier decisions)\n\n`;
        context += parsed.summary;
        context += `\n\n=== END OF SUMMARY ===\n`;
      } catch (e) {
        console.warn('Could not parse history summary');
      }
    }
    
    // Add last 5 AI log entries with FULL context
    if (recentDecisions && recentDecisions.length > 0) {
      const last5 = recentDecisions.slice(0, 5);
      context += `\n\n=== RECENT AI LOG (Last ${last5.length} Trading Cycles) ===\n`;
      
      const now = Date.now();
      last5.forEach((decision, idx) => {
        const minutesAgo = Math.floor((now - new Date(decision.timestamp).getTime()) / 60000);
        const hoursAgo = (minutesAgo / 60).toFixed(1);
        
        context += `\n${'─'.repeat(80)}\n`;
        context += `AI Log Entry #${idx + 1} - ${hoursAgo}h ago (${minutesAgo}min)\n`;
        context += `${'─'.repeat(80)}\n\n`;
        
        // FIXED: prompt_sent now only contains base prompt (no history recursion)
        // So we can safely include the full prompt_sent without exponential growth
        context += decision.prompt_sent || '[No AI log recorded]';
        context += `\n\n`;
        
        // Add the outcome for context
        try {
          const decisionsArray = JSON.parse(decision.decisions_json || '[]');
          const notes = JSON.parse(decision.notes_json || '[]');
          
          context += `OUTCOME:\n`;
          if (decisionsArray.length === 0) {
            context += `  No trades taken (HOLD)\n`;
          } else {
            decisionsArray.forEach((d, i) => {
              context += `  ${d.action} ${d.symbol || d.closePositionId || ''}\n`;
            });
          }
          
          if (notes && notes.length > 0) {
            notes.forEach(note => context += `  ${note}\n`);
          }
          
          context += `  Success: ${decision.execution_success ? 'Yes' : 'No'}\n`;
        } catch (e) {
          context += `  [Error parsing outcome]\n`;
        }
      });
      
      context += `\n${'='.repeat(80)}\n`;
    }
    
    return context;
  }

  /**
   * Standard single-shot trading decision (original implementation)
   */
  async getTradingDecisionStandard(bot) {
    // Get markets filtered for this specific bot
    const botMarkets = this.getMarketsForBot(bot);
    
    // Load and manage decision history with intelligent summarization
    const historyData = await this.loadAndManageHistory(bot);
    
    // Generate BASE prompt (without history) for DB storage - prevents exponential growth
    const basePrompt = this.generateBasePrompt(
      bot.portfolio,
      botMarkets,
      bot.prompt,
      bot.symbolCooldowns,
      bot.orders.slice(0, 10)
    );
    
    // Generate FULL prompt (with history) for LLM
    const prompt = basePrompt + historyData.historyContext;
    
    try {
      // Get full provider configuration from database
      const Database = require('better-sqlite3');
      const { decrypt } = require('../utils/encryption');
      const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
      const db = new Database(dbPath, { readonly: true });
      
      let providerConfig = null;
      let providerType = bot.provider;
      
      try {
        providerConfig = db.prepare(`
          SELECT api_key_encrypted, provider_type, model_name, api_endpoint, config_json
          FROM llm_providers 
          WHERE provider_type = ? AND is_active = 1
          LIMIT 1
        `).get(providerType);
      } finally {
        db.close();
      }
      
      if (!providerConfig || !providerConfig.api_key_encrypted) {
        return {
          prompt,
          basePrompt,
          decisions: [],
          error: `${providerType} provider not configured in database`
        };
      }
      
      const apiKey = decrypt(providerConfig.api_key_encrypted);
      const modelName = providerConfig.model_name;
      const apiEndpoint = providerConfig.api_endpoint;
      
      console.log(`   📞 Calling ${providerType} API for ${bot.name} (model: ${modelName}, endpoint: ${apiEndpoint})...`);
      
      // Call AI API using generic approach based on provider_type
      let decisionText;
      let response;
      
      // OpenAI-compatible APIs (including Grok, and custom OpenAI-format APIs)
      if (providerType === 'grok' || providerType === 'openai') {
        response = await axios.post(
          apiEndpoint,
          {
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: 30000
          }
        );
        
        decisionText = response.data.choices?.[0]?.message?.content;
      }
      // Gemini API
      else if (providerType === 'gemini') {
        // Gemini uses API key in URL query param
        const geminiUrl = apiEndpoint.includes('?') 
          ? `${apiEndpoint}&key=${apiKey}`
          : `${apiEndpoint}?key=${apiKey}`;
        
        response = await axios.post(
          geminiUrl,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
          }
        );
        
        decisionText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      }
      // Anthropic Claude API
      else if (providerType === 'anthropic') {
        response = await axios.post(
          apiEndpoint,
          {
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            },
            timeout: 30000
          }
        );
        
        decisionText = response.data.content?.[0]?.text;
      }
      // Custom/local APIs - assume OpenAI-compatible format
      else if (providerType === 'custom' || providerType === 'local') {
        response = await axios.post(
          apiEndpoint,
          {
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: 30000
          }
        );
        
        decisionText = response.data.choices?.[0]?.message?.content;
      }
      else {
        return {
          prompt,
          basePrompt,
          decisions: [],
          error: `Unsupported provider type: ${providerType}`
        };
      }
      
      console.log(`   ✅ ${providerType} API responded (${decisionText?.length || 0} chars)`);
      
      if (!decisionText) {
        return { prompt, basePrompt, decisions: [], error: 'Empty response from AI' };
      }
      
      const decisions = JSON.parse(decisionText);
      return {
        prompt,
        basePrompt,
        decisions: Array.isArray(decisions) ? decisions : [decisions],
        error: null
      };
    } catch (error) {
      console.error(`❌ Error getting AI decision for ${bot.name}:`, error.message);
      console.error(`   Error details:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      return {
        prompt: prompt || '[Error: Prompt generation failed]',
        basePrompt: basePrompt || '[Error: Prompt generation failed]',
        decisions: [],
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Multi-step trading decision with sandbox analysis
   * Allows bot to iteratively analyze data before making final decisions
   */
  async getTradingDecisionWithSandbox(bot) {
    console.log(`   🔬 Using multi-step sandbox analysis for ${bot.name}`);
    
    // Get filtered markets for this specific bot (respects trading_symbols config)
    const botMarkets = this.getMarketsForBot(bot);
    console.log(`   📊 Bot ${bot.name} has access to ${botMarkets.length} configured trading symbols`);
    
    // Reset sandbox for this decision cycle
    resetSandbox(botMarkets);
    
    // Load and manage decision history with intelligent summarization
    const historyData = await this.loadAndManageHistory(bot);
    
    // Generate BASE prompt (without history/iteration) for DB storage - prevents exponential growth
    const basePrompt = this.generateBasePrompt(
      bot.portfolio,
      botMarkets,
      bot.prompt,
      bot.symbolCooldowns,
      bot.orders.slice(0, 10)
    );
    
    let iteration = 0;
    let analysisHistory = '';
    let fullPrompt = '';
    
    try {
      while (iteration < MAX_ITERATIONS) {
        iteration++;
        
        const isFirstIteration = iteration === 1;
        const isFinalIteration = iteration === MAX_ITERATIONS;
        
        // Build iteration context (personality-specific)
        let iterationContext;
        
        if (bot.id === 'bot_astrologer' || bot.name === 'Astrologer') {
          // Mystical Astrologer iteration context
          iterationContext = `

=== CELESTIAL DIVINATION CYCLE ${iteration} of ${MAX_ITERATIONS} ===

${isFinalIteration 
  ? `THE FINAL PROPHECY: The stars demand commitment. You have consulted the heavens and measured cosmic energies across ${botMarkets.length} tradeable instruments. Now crystallize this celestial wisdom into trading decisions (LONG/SHORT/CLOSE/HOLD array). Choose the path illuminated by the strongest cosmic confluence. Remember: The material realm demands 6% in earthly fees—ensure the cosmic reward justifies the mortal cost.`
  : iteration === 1
    ? `FIRST DIVINATION: The cosmic veil parts, revealing ${botMarkets.length} tradeable instruments beneath the celestial sphere. Consult the heavens to identify which markets are blessed by favorable planetary alignments. Cast your mystical sight across ALL symbols—the universe does not favor tunnel vision. Invoke your celestial tools (moon_phase, planetary_positions, mercury_retrograde, cosmic_aspect, zodiac_sign) to measure the cosmic energies of each opportunity.`
    : `CONTINUED DIVINATION (Cycle ${iteration} of ${MAX_ITERATIONS}): The cosmos reveals deeper layers. You have ${MAX_ITERATIONS - iteration} more consultations before the prophecy must manifest. Continue your mystical interrogation—measure sacred geometries with technical indicators, assess planetary influences with celestial tools, divine the elemental balance. Cross-reference multiple cosmic signs for confirmation.`}

${analysisHistory ? 'Previous Divinations:\n' + analysisHistory : `No previous divinations yet. Begin your cosmic interrogation by consulting the celestial data (moon_phase, planetary_positions) and scanning market energies across the ${botMarkets.length} available symbols.`}

`;
        } else {
          // Default/Chronospeculator iteration context
          iterationContext = `

=== ITERATION ${iteration} of ${MAX_ITERATIONS} ===

${isFinalIteration 
  ? `FINAL ITERATION: You MUST return trading decisions now (LONG/SHORT/CLOSE/HOLD array). You have analyzed ${botMarkets.length} available trading symbols—prioritize the opportunities with the highest edge and conviction. Reference the computed values from your prior analysis iterations.` 
  : iteration === 1
    ? `FIRST ITERATION: MARKET OPPORTUNITY SCAN - You have ${botMarkets.length} trading symbols available (shown in Live Market Data above). Your sophisticated cliometric framework demands you SCAN ACROSS ALL MARKETS to identify the best opportunities before diving deep into analysis. Begin by invoking sandbox tools to CALCULATE analytical values across multiple symbols. Use ANALYZE actions to compute quantitative metrics—do not merely describe them narratively. Cast a wide net to avoid missing high-probability setups.`
    : `ANALYSIS PHASE (Iteration ${iteration} of ${MAX_ITERATIONS}): You have ${MAX_ITERATIONS - iteration} iterations remaining. You are analyzing ${botMarkets.length} available trading symbols—continue your multi-step quantitative analysis by computing additional metrics with ANALYZE actions, building upon your previous results. You may also choose to return final trading decisions if your analysis provides sufficient confidence. REMEMBER: Scan across multiple symbols to find the best opportunities—don't fixate on a single market.`}

${analysisHistory ? 'Previous Analysis Results:\n' + analysisHistory : `No previous analysis yet. Begin your quantitative interrogation by scanning across the ${botMarkets.length} available markets. Compute technical indicators, risk metrics, or custom equations to identify which symbols present the strongest edge.`}

`;
        }
        
        
        // Generate prompt with iteration context and history
        fullPrompt = this.generatePromptWithHistory(
          bot.portfolio,
          botMarkets,
          bot.prompt + iterationContext,
          historyData.historyContext,
          bot.symbolCooldowns,
          bot.orders.slice(0, 10)
        );
        
        console.log(`   📊 Iteration ${iteration}: Calling AI API (prompt: ${fullPrompt.length} chars, markets: ${botMarkets.length})`);
        
        // SAFETY CHECK: Abort if prompt is too large (prevents memory crashes)
        const MAX_PROMPT_SIZE = 500000; // 500KB limit (reasonable for most LLMs)
        if (fullPrompt.length > MAX_PROMPT_SIZE) {
          console.error(`   ❌ PROMPT TOO LARGE: ${fullPrompt.length} chars exceeds ${MAX_PROMPT_SIZE} limit!`);
          console.error(`   🔧 This indicates exponential history growth. Returning empty decisions.`);
          return {
            prompt: fullPrompt.substring(0, 1000) + '\n... (truncated - too large)',
            basePrompt,
            decisions: [],
            error: `Prompt size ${fullPrompt.length} chars exceeds safety limit of ${MAX_PROMPT_SIZE}`,
            iterations: iteration
          };
        }
        
        // Call AI API
        const aiResponse = await this.callAIProvider(bot, fullPrompt);
        
        if (aiResponse.error) {
          console.error(`   ❌ AI API error on iteration ${iteration}: ${aiResponse.error}`);
          return {
            prompt: fullPrompt,
            basePrompt,
            decisions: [],
            error: aiResponse.error,
            iterations: iteration
          };
        }
        
        const responseText = aiResponse.text;
        
        // DEBUG: Log the AI response
        console.log(`\n   📝 Iteration ${iteration} AI Response (first 500 chars):`);
        console.log(`   ${responseText.substring(0, 500)}`);
        if (responseText.length > 500) {
          console.log(`   ... (${responseText.length - 500} more chars)`);
        }
        console.log('');
        
        // Log analysis history for debugging
        if (iteration > 1 && analysisHistory) {
          console.log(`   📊 Analysis history: ${analysisHistory.length} chars from ${iteration - 1} iterations`);
        }
        
        // Try to parse as ANALYZE request first
        if (!isFinalIteration) {
          const analyzeMatch = this.parseAnalyzeRequest(responseText);
          
          if (analyzeMatch) {
            console.log(`   🔧 Iteration ${iteration}: Executing tool "${analyzeMatch.tool}"...`);
            
            try {
              // Execute sandbox tool
              const toolResult = await executeSandboxTool(
                analyzeMatch.tool,
                analyzeMatch.parameters,
                botMarkets
              );
              
              // Add to analysis history
              analysisHistory += `
[Iteration ${iteration} - Tool: ${analyzeMatch.tool}]
Reasoning: ${analyzeMatch.reasoning}
Parameters: ${JSON.stringify(analyzeMatch.parameters, null, 2)}
Result: ${JSON.stringify(toolResult, null, 2)}

`;
              
              console.log(`   ✅ Iteration ${iteration}: Tool executed successfully`);
              
              // Continue to next iteration
              continue;
            } catch (toolError) {
              console.error(`   ❌ Iteration ${iteration}: Tool execution failed: ${toolError.message}`);
              analysisHistory += `
[Iteration ${iteration} - Tool: ${analyzeMatch.tool}]
ERROR: ${toolError.message}

`;
              // Continue anyway, let AI handle the error
              continue;
            }
          } else {
            console.log(`   🔍 Iteration ${iteration}: No ANALYZE pattern found in response`);
          }
        }
        
        // Parse as trading decisions
        try {
          const decisions = this.parseDecisions(responseText);
          console.log(`   ✅ Iteration ${iteration}: Parsed ${decisions.length} trading decisions`);
          
          return {
            prompt: fullPrompt,
            basePrompt,
            decisions: decisions,
            error: null,
            iterations: iteration,
            analysisHistory: analysisHistory
          };
        } catch (parseError) {
          if (isFinalIteration) {
            console.error(`   ❌ Final iteration failed to parse decisions: ${parseError.message}`);
            console.error(`   📄 Full response text:\n${responseText}`);
            return {
              prompt: fullPrompt,
              basePrompt,
              decisions: [],
              error: 'Failed to parse final decisions after maximum iterations',
              iterations: iteration
            };
          } else {
            console.warn(`   ⚠️ Iteration ${iteration}: Could not parse as decisions or ANALYZE`);
            console.warn(`   Parse error: ${parseError.message}`);
            analysisHistory += `
[Iteration ${iteration} - Parse Error]
Could not parse response. Response: ${responseText.substring(0, 200)}...

`;
            continue;
          }
        }
      }
      
      // Should never reach here, but return empty decisions as fallback
      console.warn(`   ⚠️ Maximum iterations reached without valid decisions`);
      return {
        prompt: fullPrompt,
        basePrompt,
        decisions: [],
        error: 'Maximum iterations reached',
        iterations: MAX_ITERATIONS
      };
    } catch (error) {
      console.error(`   ❌ Multi-step analysis error: ${error.message}`);
      return {
        prompt: fullPrompt || '',
        basePrompt,
        decisions: [],
        error: error.message,
        iterations: iteration
      };
    }
  }

  /**
   * Call AI provider with prompt
   */
  async callAIProvider(bot, prompt) {
    try {
      // Get provider configuration from database
      const Database = require('better-sqlite3');
      const { decrypt } = require('../utils/encryption');
      const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
      const db = new Database(dbPath, { readonly: true });
      
      let providerConfig = null;
      let providerType = bot.provider;
      
      try {
        providerConfig = db.prepare(`
          SELECT api_key_encrypted, provider_type, model_name, api_endpoint, config_json
          FROM llm_providers 
          WHERE provider_type = ? AND is_active = 1
          LIMIT 1
        `).get(providerType);
      } finally {
        db.close();
      }
      
      if (!providerConfig || !providerConfig.api_key_encrypted) {
        return {
          text: null,
          error: `${providerType} provider not configured in database`
        };
      }
      
      const apiKey = decrypt(providerConfig.api_key_encrypted);
      const modelName = providerConfig.model_name;
      const apiEndpoint = providerConfig.api_endpoint;
      
      // Call AI API based on provider type
      let decisionText;
      let response;
      
      // OpenAI-compatible APIs (including Grok)
      if (providerType === 'grok' || providerType === 'openai') {
        response = await axios.post(
          apiEndpoint,
          {
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.9
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: ITERATION_TIMEOUT_MS
          }
        );
        
        decisionText = response.data.choices?.[0]?.message?.content;
      }
      // Gemini API
      else if (providerType === 'gemini') {
        const geminiUrl = apiEndpoint.includes('?') 
          ? `${apiEndpoint}&key=${apiKey}`
          : `${apiEndpoint}?key=${apiKey}`;
        
        response = await axios.post(
          geminiUrl,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
              temperature: 0.9
            }
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: ITERATION_TIMEOUT_MS
          }
        );
        
        decisionText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      }
      // Anthropic Claude API
      else if (providerType === 'anthropic') {
        response = await axios.post(
          apiEndpoint,
          {
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096,
            temperature: 0.9
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            },
            timeout: ITERATION_TIMEOUT_MS
          }
        );
        
        decisionText = response.data.content?.[0]?.text;
      }
      // Custom/local APIs
      else if (providerType === 'custom' || providerType === 'local') {
        response = await axios.post(
          apiEndpoint,
          {
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.9
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: ITERATION_TIMEOUT_MS
          }
        );
        
        decisionText = response.data.choices?.[0]?.message?.content;
      }
      else {
        return {
          text: null,
          error: `Unsupported provider type: ${providerType}`
        };
      }
      
      if (!decisionText) {
        return { text: null, error: 'Empty response from AI' };
      }
      
      return { text: decisionText, error: null };
    } catch (error) {
      return { text: null, error: error.message };
    }
  }

  /**
   * Extract balanced JSON object or array from text
   * Handles nested braces/brackets properly
   */
  /**
   * Helper to validate JSON string doesn't have trailing content
   * Uses a more robust approach: parse and check character-by-character
   */
  validateJSONString(jsonStr) {
    if (!jsonStr) return false;
    
    try {
      const trimmed = jsonStr.trim();
      
      // Try to parse - this will throw if there's invalid JSON
      const parsed = JSON.parse(trimmed);
      
      // Now check if there's trailing content by manually finding where JSON ends
      // This works because JSON.parse succeeds even with trailing text
      let depth = 0;
      let inString = false;
      let escapeNext = false;
      let jsonEndIndex = -1;
      
      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '[' || char === '{') {
            depth++;
          } else if (char === ']' || char === '}') {
            depth--;
            if (depth === 0) {
              jsonEndIndex = i;
              break;
            }
          }
        }
      }
      
      // Check if there's non-whitespace content after the JSON ends
      if (jsonEndIndex !== -1 && jsonEndIndex < trimmed.length - 1) {
        const afterJSON = trimmed.substring(jsonEndIndex + 1).trim();
        if (afterJSON.length > 0) {
          // There's trailing content
          return false;
        }
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }

  extractJSON(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }
    
    // STEP 1: Remove markdown code blocks
    // Handle ```json ... ``` or ``` ... ```
    let cleanedText = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1');
    
    // STEP 2: Remove common LLM prefixes/suffixes
    cleanedText = cleanedText.replace(/^(?:Here's|Here are|Here is|The|My|I recommend|I suggest|Decision:|Decisions:|Response:)/gi, '');
    
    // STEP 3: Try to find JSON array first (preferred for decisions)
    let depth = 0;
    let start = -1;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < cleanedText.length; i++) {
      const char = cleanedText[i];
      
      // Handle string escaping
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      // Track if we're inside a string
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      // Only count brackets outside of strings
      if (!inString) {
        if (char === '[') {
        if (depth === 0) start = i;
        depth++;
        } else if (char === ']') {
        depth--;
        if (depth === 0 && start !== -1) {
            const jsonStr = cleanedText.substring(start, i + 1).trim();
            // Validate it's parseable and doesn't have trailing content
            if (this.validateJSONString(jsonStr)) {
              return jsonStr;
            }
            // Continue searching for another array
            start = -1;
          }
        }
      }
    }
    
    // STEP 4: Try to find JSON object
    depth = 0;
    start = -1;
    inString = false;
    escapeNext = false;
    
    for (let i = 0; i < cleanedText.length; i++) {
      const char = cleanedText[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
        if (depth === 0) start = i;
        depth++;
        } else if (char === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
            const jsonStr = cleanedText.substring(start, i + 1).trim();
            // Validate it's parseable and doesn't have trailing content
            if (this.validateJSONString(jsonStr)) {
              return jsonStr;
        }
            // Continue searching for another object
            start = -1;
          }
        }
      }
    }
    
    // STEP 5: Last resort - try regex patterns
    // Look for array pattern
    const arrayMatch = cleanedText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (arrayMatch) {
      const jsonStr = arrayMatch[0].trim();
      if (this.validateJSONString(jsonStr)) {
        return jsonStr;
      }
    }
    
    // Look for object pattern
    const objectMatch = cleanedText.match(/\{\s*"[\s\S]*?\}/);
    if (objectMatch) {
      const jsonStr = objectMatch[0].trim();
      if (this.validateJSONString(jsonStr)) {
        return jsonStr;
      }
    }
    
    return null;
  }

  /**
   * Parse ANALYZE request from AI response
   */
  parseAnalyzeRequest(responseText) {
    try {
      // Extract balanced JSON from response
      const jsonStr = this.extractJSON(responseText);
      
      if (!jsonStr) {
        return null;
      }
      
      const analyzeObj = JSON.parse(jsonStr);
      
      // Check if it's an ANALYZE action
      if (analyzeObj.action === 'ANALYZE' && analyzeObj.tool && analyzeObj.parameters) {
        return {
          tool: analyzeObj.tool,
          parameters: analyzeObj.parameters,
          reasoning: analyzeObj.reasoning || 'No reasoning provided'
        };
      }
      
      return null;
    } catch (error) {
      console.log('   🔍 DEBUG: Error parsing ANALYZE request:', error.message);
      return null;
    }
  }

  /**
   * Parse trading decisions from AI response
   */
  parseDecisions(responseText) {
    let jsonStr = null;
    try {
      // Extract balanced JSON from response
      jsonStr = this.extractJSON(responseText);
      
      if (!jsonStr) {
        console.log('   ❌ Failed to extract JSON from response. Full response:');
        console.log('   ', responseText.substring(0, 1000).replace(/\n/g, ' '));
        throw new Error('No valid JSON array or object found in response');
      }
      
      // Additional safety: trim the extracted JSON
      jsonStr = jsonStr.trim();
      
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        // JSON.parse failed even after extraction - log for debugging
        console.log('   ❌ JSON.parse failed on extracted string!');
        console.log('   🔍 Parse error:', parseError.message);
        console.log('   🔍 Extracted JSON (first 500 chars):', jsonStr.substring(0, 500));
        console.log('   🔍 Extracted JSON (last 100 chars):', jsonStr.length > 100 ? jsonStr.substring(jsonStr.length - 100) : jsonStr);
        throw parseError;
      }
      
      // Handle both arrays and single objects
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        // If it's a single decision object, wrap in array
        if (parsed.action) {
          return [parsed];
        }
        console.log('   ❌ Found JSON object but missing "action" field:', JSON.stringify(parsed).substring(0, 200));
        throw new Error('Found JSON object but not a valid decision format');
      }
      
      throw new Error('Parsed JSON is not an array or object');
    } catch (error) {
      console.log('   🔍 DEBUG: Error parsing decisions:', error.message);
      console.log('   🔍 DEBUG: Extracted JSON string:', jsonStr ? jsonStr.substring(0, 300) : 'null');
      console.log('   🔍 DEBUG: Original response length:', responseText.length, 'chars');
      console.log('   🔍 DEBUG: Original response preview:', responseText.substring(0, 300).replace(/\n/g, ' '));
      throw error;
    }
  }

  /**
   * Generate prompt with pre-formatted history context
   * (Simpler version that uses already-formatted history)
   */
  /**
   * Generate base prompt WITHOUT history (prevents recursive growth in DB)
   * This is what gets stored in bot_decisions.prompt_sent
   */
  generateBasePrompt(portfolio, marketData, botPrompt, cooldowns, recentOrders) {
    const now = Date.now();
    
    // Format portfolio info
    const totalValue = portfolio.totalValue.toFixed(2);
    const availableBalance = portfolio.balance.toFixed(2);
    const unrealizedPnl = portfolio.pnl.toFixed(2);
    
    // Format positions
    let openPositions = 'None';
    if (portfolio.positions && portfolio.positions.length > 0) {
      openPositions = portfolio.positions.map(p => {
        const openOrder = recentOrders?.find(o => o.symbol === p.symbol && o.exitPrice === 0);
        const minutesOpen = openOrder ? Math.floor((now - openOrder.timestamp) / 60000) : '?';
        const hoursOpen = minutesOpen !== '?' ? (minutesOpen / 60).toFixed(1) : '?';
        const pnlPercent = p.pnl && p.size ? ((p.pnl / p.size) * 100).toFixed(2) : '0';
        
        return `Position ${p.id}: ${p.type} ${p.symbol} | Entry: $${p.entryPrice.toFixed(4)} | Current PnL: $${(p.pnl || 0).toFixed(2)} (${pnlPercent}%) | Margin: $${p.size.toFixed(2)} | Leverage: ${p.leverage}x | Open: ${hoursOpen}h | SL: ${p.stopLoss ? '$' + p.stopLoss.toFixed(4) : 'N/A'} | TP: ${p.takeProfit ? '$' + p.takeProfit.toFixed(4) : 'N/A'}`;
      }).join('\n');
    }
    
    // Format market data
    const marketDataStr = marketData.map(m => {
      const trend = m.price24hChange > 1 ? 'Strong Bullish' :
                    m.price24hChange > 0.2 ? 'Bullish' :
                    m.price24hChange < -1 ? 'Strong Bearish' :
                    m.price24hChange < -0.2 ? 'Bearish' : 'Neutral';
      
      return `${m.symbol}: $${m.price.toFixed(4)} | 24h: ${m.price24hChange >= 0 ? '+' : ''}${m.price24hChange.toFixed(2)}% (${trend})`;
    }).join('\n');
    
    // Format cooldowns
    let cooldownInfo = '';
    if (cooldowns && Object.keys(cooldowns).length > 0) {
      const activeCooldowns = Object.entries(cooldowns)
        .filter(([_, endTime]) => endTime > now)
        .map(([symbol, endTime]) => {
          const minutesLeft = Math.ceil((endTime - now) / 60000);
          return `${symbol}: ${minutesLeft}min remaining`;
        });
      
      if (activeCooldowns.length > 0) {
        cooldownInfo = '\n\nActive Position Cooldowns (symbols you cannot trade yet):\n' + activeCooldowns.join('\n');
      }
    }
    
    // Get current date
    const currentDate = new Date().toISOString();
    
    // Replace placeholders - NO HISTORY
    return botPrompt
      .replace('{{totalValue}}', totalValue)
      .replace('{{availableBalance}}', availableBalance)
      .replace('{{unrealizedPnl}}', unrealizedPnl)
      .replace('{{openPositions}}', openPositions)
      .replace('{{marketData}}', marketDataStr)
      .replace('{{currentDate}}', currentDate) + 
      cooldownInfo;
  }

  /**
   * Generate full prompt WITH history (for sending to LLM)
   */
  generatePromptWithHistory(portfolio, marketData, basePrompt, historyContext, cooldowns, recentOrders) {
    const basePromptGenerated = this.generateBasePrompt(portfolio, marketData, basePrompt, cooldowns, recentOrders);
    return basePromptGenerated + historyContext;
  }

  /**
   * Generate prompt for AI decision (Legacy version - kept for backwards compatibility)
   */
  generatePrompt(portfolio, marketData, basePrompt, recentLogs, cooldowns, recentOrders) {
    const now = Date.now();
    
    // Format portfolio info
    const totalValue = portfolio.totalValue.toFixed(2);
    const availableBalance = portfolio.balance.toFixed(2);
    const unrealizedPnl = portfolio.pnl.toFixed(2);
    
    // Format positions with enhanced timing information
    let openPositions = 'None';
    if (portfolio.positions && portfolio.positions.length > 0) {
      openPositions = portfolio.positions.map(p => {
        // Try to find when this position was opened from recent orders
        const openOrder = recentOrders?.find(o => o.symbol === p.symbol && o.exitPrice === 0);
        const minutesOpen = openOrder ? Math.floor((now - openOrder.timestamp) / 60000) : '?';
        const hoursOpen = minutesOpen !== '?' ? (minutesOpen / 60).toFixed(1) : '?';
        
        // Calculate unrealized P&L percentage
        const pnlPercent = p.pnl && p.size ? ((p.pnl / p.size) * 100).toFixed(2) : '0';
        
        return `Position ${p.id}: ${p.type} ${p.symbol} | Entry: $${p.entryPrice.toFixed(4)} | Current PnL: $${(p.pnl || 0).toFixed(2)} (${pnlPercent}%) | Margin: $${p.size.toFixed(2)} | Leverage: ${p.leverage}x | Open: ${hoursOpen}h (${minutesOpen}min) | SL: ${p.stopLoss ? '$' + p.stopLoss.toFixed(4) : 'N/A'} | TP: ${p.takeProfit ? '$' + p.takeProfit.toFixed(4) : 'N/A'} | Liq: $${p.liquidationPrice.toFixed(4)}`;
      }).join('\n');
    }
    
    // Format market data with trend analysis
    const marketDataStr = marketData.map(m => {
      const trend = m.price24hChange > 1 ? 'Strong Bullish' :
                    m.price24hChange > 0.2 ? 'Bullish' :
                    m.price24hChange < -1 ? 'Strong Bearish' :
                    m.price24hChange < -0.2 ? 'Bearish' : 'Neutral';
      
      return `${m.symbol}: $${m.price.toFixed(4)} | 24h: ${m.price24hChange >= 0 ? '+' : ''}${m.price24hChange.toFixed(2)}% (${trend})`;
    }).join('\n');
    
    // Format decision history with enhanced outcomes
    let decisionHistory = '';
    if (recentLogs && recentLogs.length > 0) {
      decisionHistory = '\n\nYour Recent Decision History (most recent first):\n';
      for (let i = 0; i < Math.min(5, recentLogs.length); i++) {
        const log = recentLogs[i];
        const minutesAgo = Math.floor((now - log.timestamp) / 60000);
        const hoursAgo = (minutesAgo / 60).toFixed(1);
        
        decisionHistory += `\n[${hoursAgo} hours ago (${minutesAgo} minutes)]:\n`;
        
        if (log.decisions && log.decisions.length > 0) {
          log.decisions.forEach((d, idx) => {
            decisionHistory += `  Decision ${idx + 1}: ${d.action} ${d.symbol || d.closePositionId || ''}\n`;
            decisionHistory += `  Reasoning: ${d.reasoning}\n`;
            
            if (d.action === 'LONG' || d.action === 'SHORT') {
              decisionHistory += `  Parameters: Size=$${d.size}, Leverage=${d.leverage}x, SL=$${d.stopLoss}, TP=$${d.takeProfit}\n`;
            }
          });
        } else {
          decisionHistory += `  Decision: HOLD (no action taken)\n`;
        }
        
        if (log.notes && log.notes.length > 0) {
          decisionHistory += `  Execution Notes:\n`;
          log.notes.forEach(note => {
            decisionHistory += `    - ${note}\n`;
          });
        }
      }
    }
    
    // Format cooldowns
    let cooldownInfo = '';
    if (cooldowns && Object.keys(cooldowns).length > 0) {
      const now = Date.now();
      const activeCooldowns = Object.entries(cooldowns)
        .filter(([_, endTime]) => endTime > now)
        .map(([symbol, endTime]) => {
          const minutesLeft = Math.ceil((endTime - now) / 60000);
          return `${symbol}: ${minutesLeft}min remaining`;
        });
      
      if (activeCooldowns.length > 0) {
        cooldownInfo = '\n\nActive Position Cooldowns (symbols you cannot trade yet):\n' + activeCooldowns.join('\n');
      }
    }
    
    // Get current date
    const currentDate = new Date().toISOString();
    
    // Replace placeholders
    return basePrompt
      .replace('{{totalValue}}', totalValue)
      .replace('{{availableBalance}}', availableBalance)
      .replace('{{unrealizedPnl}}', unrealizedPnl)
      .replace('{{openPositions}}', openPositions)
      .replace('{{marketData}}', marketDataStr)
      .replace('{{currentDate}}', currentDate) + decisionHistory + cooldownInfo;
  }

  /**
   * Validate trading decisions
   */
  validateDecisions(bot, decisions, notes) {
    const validatedDecisions = [];
    
    const minTradeSize = this.settings.minimum_trade_size_usd || 50;
    
    for (const decision of decisions) {
      // Rule: Minimum trade size
      if ((decision.action === 'LONG' || decision.action === 'SHORT') && decision.size && decision.size < minTradeSize) {
        notes.push(`REJECTED ${decision.action} ${decision.symbol}: Margin $${decision.size.toFixed(2)} is below minimum of $${minTradeSize}.`);
        continue;
      }
      
      // Rule: Adjust leverage
      let adjustedLeverage = decision.leverage || 1;
      if ((decision.action === 'LONG' || decision.action === 'SHORT') && decision.symbol) {
        const maxLeverage = this.leverageLimits.get(decision.symbol) || 25;
        if (adjustedLeverage > maxLeverage) {
          notes.push(`NOTE: Leverage for ${decision.symbol} adjusted from ${adjustedLeverage}x to exchange max of ${maxLeverage}x.`);
          adjustedLeverage = maxLeverage;
        }
      }
      
      validatedDecisions.push({ decision, adjustedLeverage });
    }
    
    return validatedDecisions;
  }

  /**
   * Execute validated trading decisions
   */
  async executeDecisions(bot, validatedDecisions, notes) {
    const minTradeSize = this.settings.minimum_trade_size_usd || 50;
    const symbolCooldownMs = this.settings.symbol_cooldown_ms || 1800000;
    
    for (const { decision, adjustedLeverage } of validatedDecisions) {
      const market = this.markets.find(m => m.symbol === decision.symbol);
      
      try {
        if ((decision.action === 'LONG' || decision.action === 'SHORT') && market && decision.size && decision.symbol) {
          const availableBalance = bot.portfolio.balance;
          let tradeSize = decision.size;
          
          // Check balance
          if (availableBalance < minTradeSize) {
            notes.push(`REJECTED ${decision.action} ${decision.symbol}: Available balance $${availableBalance.toFixed(2)} is below minimum.`);
            continue;
          }
          
          // Adjust size if needed
          if (tradeSize > availableBalance) {
            notes.push(`NOTE: Trade size adjusted from $${tradeSize.toFixed(2)} to fit available margin of $${availableBalance.toFixed(2)}.`);
            tradeSize = availableBalance;
          }
          
          if (tradeSize < minTradeSize) {
            notes.push(`REJECTED ${decision.action} ${decision.symbol}: Adjusted size too small.`);
            continue;
          }
          
          if (bot.tradingMode === 'real') {
            // Execute real trade
            await this.executeRealTrade(bot, decision, market, tradeSize, adjustedLeverage, notes);
          } else {
            // Execute paper trade
            this.executePaperTrade(bot, decision, market, tradeSize, adjustedLeverage, notes);
          }
        } else if (decision.action === 'CLOSE' && decision.closePositionId) {
          await this.closePosition(bot, decision.closePositionId, market, notes);
        }
      } catch (error) {
        console.error(`Error executing decision for ${bot.name}:`, error);
        notes.push(`Execution Error: ${error.message}`);
      }
    }
  }

  /**
   * Execute real trade on exchange
   */
  async executeRealTrade(bot, decision, market, tradeSize, adjustedLeverage, notes) {
    const { apiKey, apiSecret } = await this.config.getApiKeysForBot(bot.id);
    
    // 1. Set Leverage
    await this.makeAuthenticatedRequest(
      'POST',
      '/fapi/v1/leverage',
      { symbol: decision.symbol, leverage: adjustedLeverage },
      apiKey,
      apiSecret
    );
    
    // 2. Open Position
    const rawQuantity = (tradeSize * adjustedLeverage) / market.price;
    const quantity = this.getAdjustedQuantity(decision.symbol, rawQuantity);
    
    if (quantity <= 0) {
      notes.push(`Execution Warning: Calculated quantity for ${decision.symbol} is 0.`);
      return;
    }
    
    const orderResponse = await this.makeAuthenticatedRequest(
      'POST',
      '/fapi/v1/order',
      {
        symbol: decision.symbol,
        side: decision.action === 'LONG' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity
      },
      apiKey,
      apiSecret
    );
    
    // Calculate liquidation price for tracking
    const isLong = decision.action === 'LONG';
    const liquidationPrice = isLong
      ? market.price * (1 - (1 / adjustedLeverage))
      : market.price * (1 + (1 / adjustedLeverage));
    
    // Create position ID for database tracking
    const positionId = `pos_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const tradeId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const entryFee = tradeSize * 0.0004; // Real trading fee (0.04%)
    
    // Write position to database
    try {
      relationalDb.createPosition({
        id: positionId,
        user_id: bot.userId,
        bot_id: bot.id,
        symbol: decision.symbol,
        position_type: decision.action,
        entry_price: market.price,
        size: tradeSize,
        leverage: adjustedLeverage,
        liquidation_price: liquidationPrice,
        stop_loss: decision.stopLoss || null,
        take_profit: decision.takeProfit || null,
        unrealized_pnl: 0,
        status: 'open'
      });
    } catch (dbError) {
      console.error(`[BotManager] Failed to write real position to database for ${bot.name}:`, dbError.message);
      // Continue - don't fail the trade if DB write fails
    }
    
    // Write entry trade to database
    try {
      relationalDb.createTrade({
        id: tradeId,
        user_id: bot.userId,
        bot_id: bot.id,
        position_id: positionId,
        symbol: decision.symbol,
        trade_type: decision.action,
        action: 'OPEN',
        entry_price: market.price,
        exit_price: null,
        size: tradeSize,
        leverage: adjustedLeverage,
        pnl: -entryFee, // Entry fee is negative PnL
        fee: entryFee,
        executed_at: new Date().toISOString()
      });
    } catch (dbError) {
      console.error(`[BotManager] Failed to write real entry trade to database for ${bot.name}:`, dbError.message);
      // Continue - don't fail the trade if DB write fails
    }
    
    notes.push(`SUCCESS: Opened ${decision.action} ${decision.symbol} position (Real Trading).`);
    
    // 3. Place Stop-Loss and Take-Profit
    const orderSide = decision.action === 'LONG' ? 'SELL' : 'BUY';
    
    if (decision.stopLoss) {
      try {
        await this.makeAuthenticatedRequest(
          'POST',
          '/fapi/v1/order',
          {
            symbol: decision.symbol,
            side: orderSide,
            type: 'STOP_MARKET',
            stopPrice: decision.stopLoss,
            quantity,
            reduceOnly: 'true'
          },
          apiKey,
          apiSecret
        );
        notes.push(`SUCCESS: Stop-Loss order placed for ${decision.symbol}.`);
      } catch (error) {
        notes.push(`ERROR: Failed to place Stop-Loss for ${decision.symbol}: ${error.message}`);
      }
    }
    
    if (decision.takeProfit) {
      try {
        await this.makeAuthenticatedRequest(
          'POST',
          '/fapi/v1/order',
          {
            symbol: decision.symbol,
            side: orderSide,
            type: 'TAKE_PROFIT_MARKET',
            stopPrice: decision.takeProfit,
            quantity,
            reduceOnly: 'true'
          },
          apiKey,
          apiSecret
        );
        notes.push(`SUCCESS: Take-Profit order placed for ${decision.symbol}.`);
      } catch (error) {
        notes.push(`ERROR: Failed to place Take-Profit for ${decision.symbol}: ${error.message}`);
      }
    }
  }

  /**
   * Execute paper trade (simulation)
   */
  executePaperTrade(bot, decision, market, tradeSize, adjustedLeverage, notes) {
    const isLong = decision.action === 'LONG';
    const liquidationPrice = isLong
      ? market.price * (1 - (1 / adjustedLeverage))
      : market.price * (1 + (1 / adjustedLeverage));
    
    const position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      symbol: decision.symbol,
      type: decision.action,
      entryPrice: market.price,
      size: tradeSize,
      leverage: adjustedLeverage,
      liquidationPrice,
      stopLoss: decision.stopLoss,
      takeProfit: decision.takeProfit,
      pnl: 0
    };
    
    bot.portfolio.positions.push(position);
    bot.portfolio.balance -= tradeSize;
    
    // Write position to database
    try {
      relationalDb.createPosition({
        id: position.id,
        user_id: bot.userId,
        bot_id: bot.id,
        symbol: position.symbol,
        position_type: position.type,
        entry_price: position.entryPrice,
        size: position.size,
        leverage: position.leverage,
        liquidation_price: position.liquidationPrice,
        stop_loss: position.stopLoss || null,
        take_profit: position.takeProfit || null,
        unrealized_pnl: position.pnl,
        status: 'open'
      });
    } catch (dbError) {
      console.error(`[BotManager] Failed to write position to database for ${bot.name}:`, dbError.message);
      // Continue trading - don't fail the trade if DB write fails
    }
    
    // Create order record
    const entryFee = tradeSize * 0.03;
    const entryOrder = {
      id: `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      symbol: decision.symbol,
      type: decision.action,
      size: tradeSize,
      leverage: adjustedLeverage,
      pnl: -entryFee,
      fee: entryFee,
      timestamp: Date.now(),
      entryPrice: market.price,
      exitPrice: 0
    };
    
    bot.orders.unshift(entryOrder);
    
    // Write entry trade to database
    try {
      relationalDb.createTrade({
        id: entryOrder.id,
        user_id: bot.userId,
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
    } catch (dbError) {
      console.error(`[BotManager] Failed to write entry trade to database for ${bot.name}:`, dbError.message);
      // Continue trading - don't fail the trade if DB write fails
    }
    
    notes.push(`SUCCESS: Opened ${decision.action} ${decision.symbol} position with $${tradeSize.toFixed(2)} margin at $${market.price.toFixed(2)}.`);
  }

  /**
   * Close position
   */
  async closePosition(bot, positionId, market, notes) {
    const posToClose = bot.portfolio.positions.find(p => p.id === positionId);
    if (!posToClose) {
      notes.push(`NOTE: Position ${positionId} not found, may have been auto-closed.`);
      return;
    }
    
    const currentMarket = market || this.markets.find(m => m.symbol === posToClose.symbol);
    if (!currentMarket) {
      notes.push(`ERROR: Market data not found for ${posToClose.symbol}`);
      return;
    }
    
    // Get cooldown setting
    const symbolCooldownMs = this.settings.symbol_cooldown_ms || 1800000; // 30 minutes default
    
    if (bot.tradingMode === 'real') {
      // Close real position
      const { apiKey, apiSecret } = await this.config.getApiKeysForBot(bot.id);
      const rawQuantity = Math.abs((posToClose.size * posToClose.leverage) / posToClose.entryPrice);
      const quantity = this.getAdjustedQuantity(posToClose.symbol, rawQuantity);
      
      if (quantity > 0) {
        await this.makeAuthenticatedRequest(
          'POST',
          '/fapi/v1/order',
          {
            symbol: posToClose.symbol,
            side: posToClose.type === 'LONG' ? 'SELL' : 'BUY',
            type: 'MARKET',
            quantity,
            reduceOnly: 'true'
          },
          apiKey,
          apiSecret
        );
        
        bot.symbolCooldowns[posToClose.symbol] = Date.now() + symbolCooldownMs;
        
        // Calculate approximate PnL for database tracking
        const assetQuantity = (posToClose.size * posToClose.leverage) / posToClose.entryPrice;
        const unrealizedPnl = posToClose.type === 'LONG'
          ? (currentMarket.price - posToClose.entryPrice) * assetQuantity
          : (posToClose.entryPrice - currentMarket.price) * assetQuantity;
        
        const exitFee = posToClose.size * 0.0004; // Real trading fee (0.04%)
        const netPnl = unrealizedPnl - exitFee;
        
        // Update position in database to closed status
        try {
          relationalDb.updatePosition(positionId, {
            status: 'closed',
            closed_at: new Date().toISOString()
          }, bot.userId);
        } catch (dbError) {
          console.error(`[BotManager] Failed to update real position status in database for ${bot.name}:`, dbError.message);
          // Continue - don't fail the close if DB write fails
        }
        
        // Write exit trade to database
        const exitTradeId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        try {
          relationalDb.createTrade({
            id: exitTradeId,
            user_id: bot.userId,
            bot_id: bot.id,
            position_id: positionId,
            symbol: posToClose.symbol,
            trade_type: posToClose.type,
            action: 'CLOSE',
            entry_price: posToClose.entryPrice,
            exit_price: currentMarket.price,
            size: posToClose.size,
            leverage: posToClose.leverage,
            pnl: netPnl,
            fee: exitFee,
            executed_at: new Date().toISOString()
          });
        } catch (dbError) {
          console.error(`[BotManager] Failed to write real exit trade to database for ${bot.name}:`, dbError.message);
          // Continue - don't fail the close if DB write fails
        }
        
        notes.push(`SUCCESS: Closed ${posToClose.symbol} position (Real Trading). Approx PnL: $${netPnl.toFixed(2)}`);
      }
    } else {
      // Close paper position
      const assetQuantity = (posToClose.size * posToClose.leverage) / posToClose.entryPrice;
      const unrealizedPnl = posToClose.type === 'LONG'
        ? (currentMarket.price - posToClose.entryPrice) * assetQuantity
        : (posToClose.entryPrice - currentMarket.price) * assetQuantity;
      
      const exitFee = posToClose.size * 0.03;
      const netPnl = unrealizedPnl - exitFee;
      
      bot.portfolio.balance += posToClose.size + netPnl;
      bot.portfolio.positions = bot.portfolio.positions.filter(p => p.id !== positionId);
      bot.realizedPnl = (bot.realizedPnl || 0) + netPnl;
      
      // Update stats
      const previousTradeCount = bot.tradeCount || 0;
      bot.tradeCount = previousTradeCount + 1;
      
      if (netPnl > 0) {
        const previousWins = Math.round(previousTradeCount * (bot.winRate || 0));
        bot.winRate = (previousWins + 1) / bot.tradeCount;
      } else {
        const previousWins = Math.round(previousTradeCount * (bot.winRate || 0));
        bot.winRate = previousWins / bot.tradeCount;
      }
      
      // Create order record
      const exitOrder = {
        id: `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        symbol: posToClose.symbol,
        type: posToClose.type,
        size: posToClose.size,
        leverage: posToClose.leverage,
        pnl: netPnl,
        fee: exitFee,
        timestamp: Date.now(),
        entryPrice: posToClose.entryPrice,
        exitPrice: currentMarket.price
      };
      
      bot.orders.unshift(exitOrder);
      bot.symbolCooldowns[posToClose.symbol] = Date.now() + symbolCooldownMs;
      
      // Update position in database to closed status
      try {
        relationalDb.updatePosition(positionId, {
          status: 'closed',
          closed_at: new Date(exitOrder.timestamp).toISOString()
        }, bot.userId);
      } catch (dbError) {
        console.error(`[BotManager] Failed to update position status in database for ${bot.name}:`, dbError.message);
        // Continue - don't fail the close if DB write fails
      }
      
      // Write exit trade to database
      try {
        relationalDb.createTrade({
          id: exitOrder.id,
          user_id: bot.userId,
          bot_id: bot.id,
          position_id: positionId,
          symbol: exitOrder.symbol,
          trade_type: exitOrder.type,
          action: 'CLOSE',
          entry_price: exitOrder.entryPrice,
          exit_price: exitOrder.exitPrice,
          size: exitOrder.size,
          leverage: exitOrder.leverage,
          pnl: exitOrder.pnl,
          fee: exitOrder.fee,
          executed_at: new Date(exitOrder.timestamp).toISOString()
        });
      } catch (dbError) {
        console.error(`[BotManager] Failed to write exit trade to database for ${bot.name}:`, dbError.message);
        // Continue - don't fail the close if DB write fails
      }
      
      notes.push(`SUCCESS: Closed ${posToClose.symbol} position. PnL: $${netPnl.toFixed(2)} (fee: $${exitFee.toFixed(2)})`);
    }
  }

  /**
   * Get adjusted quantity based on symbol precision
   */
  getAdjustedQuantity(symbol, rawQuantity) {
    const precision = this.symbolPrecisions.get(symbol)?.quantityPrecision || 3;
    const factor = Math.pow(10, precision);
    return Math.floor(rawQuantity * factor) / factor;
  }

  /**
   * Save current state to database (Multi-Tenant)
   */
  async saveState() {
    try {
      const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
      const db = new Database(dbPath);
      
      try {
        // Serialize bots (remove any non-serializable properties)
        const botsArray = this.getAllBots().map(bot => {
          const { ...serializable } = bot;
          return serializable;
        });
        
        const state = {
          bots: botsArray,
          marketData: this.markets
        };
        
        const stateJson = JSON.stringify(state);
        
        db.prepare('DELETE FROM arena_state').run();
        db.prepare('INSERT INTO arena_state (state, updated_at) VALUES (?, ?)').run(
          stateJson,
          Date.now()
        );
      } finally {
        db.close();
      }
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  /**
   * Broadcast current state to all connected WebSocket clients (Multi-Tenant)
   */
  broadcastState() {
    try {
      const botsArray = this.getAllBots();
      const state = {
        bots: botsArray,
        marketData: this.markets
      };
      
      this.wsServer.broadcastState(state);
    } catch (error) {
      console.error('Error broadcasting state:', error);
    }
  }

  /**
   * Pause/unpause a bot (Multi-Tenant)
   */
  async toggleBotPause(botId) {
    const bot = this.getBot(botId);
    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }
    
    bot.isPaused = !bot.isPaused;
    
    // Update database
    const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
    const db = new Database(dbPath);
    
    try {
      db.prepare('UPDATE bots SET is_paused = ? WHERE id = ?').run(bot.isPaused ? 1 : 0, botId);
    } finally {
      db.close();
    }
    
    console.log(`🔄 Bot ${bot.name} ${bot.isPaused ? 'PAUSED' : 'RESUMED'}`);
    
    await this.saveState();
    this.broadcastState();
    
    return bot;
  }

  /**
   * Reset a bot (Multi-Tenant)
   */
  async resetBot(botId) {
    const bot = this.getBot(botId);
    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }
    
    if (bot.tradingMode === 'real') {
      throw new Error('Cannot reset a bot trading with real funds');
    }
    
    // Reset to initial state
    const initialBalance = this.settings.paper_bot_initial_balance;
    bot.portfolio = {
      balance: initialBalance,
      pnl: 0,
      totalValue: initialBalance,
      positions: []
    };
    bot.orders = [];
    bot.botLogs = [];
    bot.valueHistory = [{ timestamp: Date.now(), value: initialBalance }];
    bot.realizedPnl = 0;
    bot.tradeCount = 0;
    bot.winRate = 0;
    bot.symbolCooldowns = {};
    
    this.initialBalances.set(botId, initialBalance);
    
    console.log(`🔄 Bot ${bot.name} RESET`);
    
    await this.saveState();
    this.broadcastState();
    
    return bot;
  }

  /**
   * Manually close a position (Multi-Tenant)
   */
  async manualClosePosition(botId, positionId) {
    const bot = this.getBot(botId);
    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }
    
    const notes = [];
    await this.closePosition(bot, positionId, null, notes);
    
    await this.saveState();
    this.broadcastState();
    
    return { bot, notes };
  }

  /**
   * Get all bots (Multi-Tenant)
   */
  getBots() {
    return this.getAllBots();
  }

}

module.exports = BotManager;

