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

// Constants for non-configurable values
const MAX_VALUE_HISTORY = 300; // Keep last 300 data points
const MAX_BOT_LOGS = 50; // Keep last 50 decision logs
const MAX_ITERATIONS = 5; // Maximum iterations for multi-step analysis
const ITERATION_TIMEOUT_MS = 10000; // Timeout per iteration

class BotManager {
  constructor(config, websocketServer) {
    this.config = config;
    this.wsServer = websocketServer;
    this.bots = new Map(); // botId -> botState
    this.markets = [];
    this.symbolPrecisions = new Map();
    this.initialBalances = new Map();
    this.isRunning = false;
    this.turnInterval = null;
    this.refreshInterval = null;
    this.leverageLimits = this.loadLeverageLimits();
    
    // Load dynamic settings from database
    this.settings = null;
    
    console.log('🤖 BotManager initialized');
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
      
      // Find existing bot in memory
      const existingBotIndex = this.bots.findIndex(b => b.id === botId);
      
      if (existingBotIndex === -1) {
        console.warn(`⚠️ Bot ${botId} not found in active bots`);
        return { success: false, message: 'Bot not in active memory' };
      }
      
      const existingBot = this.bots[existingBotIndex];
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
      
      this.bots[existingBotIndex] = updatedBot;
      
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
   * Load bot configurations from database
   */
  async loadBots() {
    console.log('🤖 Loading bot configurations from database...');
    
    const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
    const db = new Database(dbPath, { readonly: true });
    
    try {
      // Fetch active bots and their providers
      const botsQuery = db.prepare(`
        SELECT 
          b.id, b.name, b.prompt, b.trading_mode, 
          b.is_paused, b.avatar_image,
          p.id as provider_id, p.name as provider_name, p.provider_type
        FROM bots b
        JOIN llm_providers p ON b.provider_id = p.id
        WHERE b.is_active = 1
      `);
      
      const botConfigs = botsQuery.all();
      console.log(`📝 Found ${botConfigs.length} active bots`);
      
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
      
      // Initialize bots
      for (const config of botConfigs) {
        const provider = (config.provider_type === 'gemini' || config.provider_type === 'grok') 
          ? config.provider_type 
          : 'gemini';
        
        // Check if we have saved state for this bot
        const savedBot = savedState?.bots?.find(b => b.id === config.id);
        
        let botState;
        // Determine initial balance based on trading mode
        const initialBalance = config.trading_mode === 'real' 
          ? this.settings.live_bot_initial_balance 
          : this.settings.paper_bot_initial_balance;
        
        if (savedBot) {
          console.log(`   Resuming ${config.name} from saved state`);
          botState = {
            ...savedBot,
            tradingMode: config.trading_mode,
            isPaused: config.is_paused,
            providerName: config.provider_name,
            provider,
            prompt: config.prompt,
            name: config.name,
            avatarUrl: config.avatar_image,
            isLoading: false,
            initialBalance, // Include for frontend PnL% calculation
            symbolCooldowns: savedBot.symbolCooldowns || {}
          };
        } else {
          console.log(`   Creating fresh state for ${config.name}`);
          
          botState = {
            id: config.id,
            name: config.name,
            prompt: config.prompt,
            provider,
            providerName: config.provider_name,
            avatarUrl: config.avatar_image,
            tradingMode: config.trading_mode,
            initialBalance, // Include for frontend PnL% calculation
            portfolio: {
              balance: initialBalance,
              pnl: 0,
              totalValue: initialBalance,
              positions: []
            },
            orders: [],
            botLogs: [],
            valueHistory: [{ timestamp: Date.now(), value: initialBalance }],
            isLoading: false,
            isPaused: config.is_paused,
            realizedPnl: 0,
            tradeCount: 0,
            winRate: 0,
            symbolCooldowns: {}
          };
        }
        
        // For live trading bots, sync with exchange
        if (config.trading_mode === 'real') {
          try {
            console.log(`   [${config.name}] Syncing with live exchange...`);
            const realPortfolio = await this.getRealAccountState(config.id);
            const realOrders = await this.getRealTradeHistory(config.id);
            const realizedPnl = realOrders.reduce((acc, o) => acc + o.pnl, 0);
            
            botState.portfolio = realPortfolio;
            botState.orders = realOrders;
            botState.realizedPnl = realizedPnl;
            botState.valueHistory = [{ timestamp: Date.now(), value: realPortfolio.totalValue }];
            
            this.initialBalances.set(config.id, this.settings.live_bot_initial_balance);
            console.log(`   ✅ [${config.name}] Synced with exchange`);
          } catch (error) {
            console.warn(`   ⚠️ [${config.name}] Failed to sync with exchange:`, error.message);
            this.initialBalances.set(config.id, this.settings.live_bot_initial_balance);
          }
        } else {
          this.initialBalances.set(config.id, this.settings.paper_bot_initial_balance);
        }
        
        this.bots.set(config.id, botState);
        console.log(`   ✅ Loaded bot: ${config.name} (${config.trading_mode} mode, ${config.is_paused ? 'PAUSED' : 'ACTIVE'})`);
      }
      
      console.log(`✅ Initialized ${this.bots.size} bots`);
    } finally {
      db.close();
    }
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
      
      for (const bot of this.bots.values()) {
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
   * Get market data (filtered by trading_symbols setting)
   */
  async getMarketData() {
    try {
      const response = await axios.get('https://fapi.asterdex.com/fapi/v1/ticker/24hr', {
        timeout: 10000
      });
      
      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
      
      // Filter by allowed trading symbols from settings
      const allowedSymbols = this.settings.trading_symbols || [];
      const allowedSet = new Set(allowedSymbols);
      
      const markets = response.data
        .filter(ticker => allowedSymbols.length === 0 || allowedSet.has(ticker.symbol))
        .map(ticker => ({
          symbol: ticker.symbol,
          price: parseFloat(ticker.lastPrice),
          price24hChange: parseFloat(ticker.priceChangePercent)
        }));
      
      console.log(`📊 Fetched ${markets.length} markets (filtered from ${response.data.length} total)`);
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
      
      // Update each bot's portfolio
      for (const [botId, bot] of this.bots.entries()) {
        try {
          if (bot.tradingMode === 'real') {
            // Real trading: get state from exchange
            const realPortfolio = await this.getRealAccountState(botId);
            const realOrders = await this.getRealTradeHistory(botId);
            const realizedPnl = realOrders.reduce((acc, order) => acc + order.pnl, 0);
            
            bot.portfolio = realPortfolio;
            bot.orders = realOrders;
            bot.realizedPnl = realizedPnl;
          } else {
            // Paper trading: calculate PnL from positions
            let unrealizedPnl = 0;
            let totalMarginUsed = 0;
            
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
          bot.valueHistory.push({
            timestamp: Date.now(),
            value: bot.portfolio.totalValue
          });
          
          // Keep history to reasonable size
          if (bot.valueHistory.length > MAX_VALUE_HISTORY) {
            bot.valueHistory = bot.valueHistory.slice(-MAX_VALUE_HISTORY);
          }
          
          // Save snapshot to database
          await this.saveSnapshot(botId, bot);
        } catch (error) {
          console.error(`Error updating portfolio for bot ${botId}:`, error.message);
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
            bot_id, balance, total_value, realized_pnl, unrealized_pnl,
            trade_count, win_rate
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
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
    
    const botsToProcess = specificBotId 
      ? [[specificBotId, this.bots.get(specificBotId)]]
      : Array.from(this.bots.entries());
    
    for (const [botId, bot] of botsToProcess) {
      if (!bot) continue;
      
      if (bot.isPaused) {
        console.log(`   ⏭️ Skipping ${bot.name} - paused`);
        continue;
      }
      
      console.log(`   🤖 Processing turn for ${bot.name} (${bot.tradingMode} mode)...`);
      
      try {
        bot.isLoading = true;
        
        // Get AI decision
        const decisionResult = await this.getTradingDecision(bot);
        const { prompt, decisions, error } = decisionResult;
        
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
    const useMultiStep = bot.name === 'Chronospeculator' || bot.id === 'bot_chronospeculator' || bot.enableSandbox === true;
    
    if (useMultiStep) {
      return await this.getTradingDecisionWithSandbox(bot);
    } else {
      return await this.getTradingDecisionStandard(bot);
    }
  }

  /**
   * Standard single-shot trading decision (original implementation)
   */
  async getTradingDecisionStandard(bot) {
    // Generate prompt
    const prompt = this.generatePrompt(
      bot.portfolio,
      this.markets,
      bot.prompt,
      bot.botLogs.slice(0, 5),
      bot.symbolCooldowns,
      bot.orders.slice(0, 10)
    );
    
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
          decisions: [],
          error: `Unsupported provider type: ${providerType}`
        };
      }
      
      console.log(`   ✅ ${providerType} API responded (${decisionText?.length || 0} chars)`);
      
      if (!decisionText) {
        return { prompt, decisions: [], error: 'Empty response from AI' };
      }
      
      const decisions = JSON.parse(decisionText);
      return {
        prompt,
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
        prompt,
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
    
    // Reset sandbox for this decision cycle
    resetSandbox(this.markets);
    
    let iteration = 0;
    let analysisHistory = '';
    let fullPrompt = '';
    
    try {
      while (iteration < MAX_ITERATIONS) {
        iteration++;
        
        const isFirstIteration = iteration === 1;
        const isFinalIteration = iteration === MAX_ITERATIONS;
        
        // Build iteration context
        const iterationContext = `

=== ITERATION ${iteration} of ${MAX_ITERATIONS} ===

${isFinalIteration 
  ? 'FINAL ITERATION: You MUST return trading decisions now (LONG/SHORT/CLOSE/HOLD array). Reference the computed values from your prior analysis iterations.' 
  : iteration === 1
    ? 'FIRST ITERATION: Your sophisticated cliometric framework demands empirical verification through computation. Begin by invoking sandbox tools to CALCULATE the analytical values that will inform your capital allocation decisions. Use ANALYZE actions to compute quantitative metrics—do not merely describe them narratively.'
    : 'ANALYSIS PHASE: Continue using ANALYZE actions to compute additional metrics, or return final trading decisions if your quantitative analysis is complete and confidence threshold achieved.'}

${analysisHistory ? 'Previous Analysis Results:\n' + analysisHistory : 'No previous analysis yet. Begin your quantitative interrogation by computing technical indicators, risk metrics, or custom equations.'}

`;
        
        // Generate prompt with iteration context
        fullPrompt = this.generatePrompt(
          bot.portfolio,
          this.markets,
          bot.prompt + iterationContext,
          bot.botLogs.slice(0, 5),
          bot.symbolCooldowns,
          bot.orders.slice(0, 10)
        );
        
        console.log(`   📊 Iteration ${iteration}: Calling AI API...`);
        
        // Call AI API
        const aiResponse = await this.callAIProvider(bot, fullPrompt);
        
        if (aiResponse.error) {
          console.error(`   ❌ AI API error on iteration ${iteration}: ${aiResponse.error}`);
          return {
            prompt: fullPrompt,
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
                this.markets
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
        decisions: [],
        error: 'Maximum iterations reached',
        iterations: MAX_ITERATIONS
      };
    } catch (error) {
      console.error(`   ❌ Multi-step analysis error: ${error.message}`);
      return {
        prompt: fullPrompt || '',
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
  extractJSON(text) {
    // Try to find JSON array first
    let depth = 0;
    let start = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '[') {
        if (depth === 0) start = i;
        depth++;
      } else if (text[i] === ']') {
        depth--;
        if (depth === 0 && start !== -1) {
          return text.substring(start, i + 1);
        }
      }
    }
    
    // Try to find JSON object
    depth = 0;
    start = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (text[i] === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          return text.substring(start, i + 1);
        }
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
    try {
      // Extract balanced JSON from response
      const jsonStr = this.extractJSON(responseText);
      
      if (!jsonStr) {
        throw new Error('No valid JSON array or object found in response');
      }
      
      const parsed = JSON.parse(jsonStr);
      
      // Handle both arrays and single objects
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        // If it's a single decision object, wrap in array
        if (parsed.action) {
          return [parsed];
        }
        throw new Error('Found JSON object but not a valid decision format');
      }
      
      throw new Error('Parsed JSON is not an array or object');
    } catch (error) {
      console.log('   🔍 DEBUG: Error parsing decisions:', error.message);
      throw error;
    }
  }

  /**
   * Generate prompt for AI decision
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
    
    await this.makeAuthenticatedRequest(
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
    
    notes.push(`SUCCESS: Opened ${decision.action} ${decision.symbol} position.`);
    
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
        notes.push(`SUCCESS: Closed ${posToClose.symbol} position.`);
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
   * Save current state to database
   */
  async saveState() {
    try {
      const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
      const db = new Database(dbPath);
      
      try {
        // Serialize bots (remove any non-serializable properties)
        const botsArray = Array.from(this.bots.values()).map(bot => {
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
   * Broadcast current state to all connected WebSocket clients
   */
  broadcastState() {
    try {
      const botsArray = Array.from(this.bots.values());
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
   * Pause/unpause a bot
   */
  async toggleBotPause(botId) {
    const bot = this.bots.get(botId);
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
   * Reset a bot
   */
  async resetBot(botId) {
    const bot = this.bots.get(botId);
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
   * Manually close a position
   */
  async manualClosePosition(botId, positionId) {
    const bot = this.bots.get(botId);
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
   * Get all bots
   */
  getBots() {
    return Array.from(this.bots.values());
  }

  /**
   * Get specific bot
   */
  getBot(botId) {
    return this.bots.get(botId);
  }
}

module.exports = BotManager;

