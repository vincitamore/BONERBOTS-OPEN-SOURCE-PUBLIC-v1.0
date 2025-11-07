/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const express = require('express');
const { body, query, param } = require('express-validator');
const { validateRequest } = require('../middleware/validation');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { createAuditLog } = require('../database/relational');
const db = require('../database/relational');

const router = express.Router();

/**
 * GET /api/bots - List all bots
 * Query params: active, trading_mode, provider_id
 * MULTI-TENANT: Returns only bots owned by authenticated user (unless admin)
 */
router.get('/',
  authenticateToken,
  query('active').optional().isBoolean().withMessage('Active must be a boolean'),
  query('trading_mode').optional().isIn(['paper', 'real']).withMessage('Invalid trading mode'),
  query('provider_id').optional().isInt().withMessage('Provider ID must be an integer'),
  validateRequest,
  (req, res) => {
    try {
      const filters = {};
      
      // CRITICAL: Filter by user_id unless admin
      if (req.user.role !== 'admin') {
        filters.user_id = req.user.userId;
      }
      
      if (req.query.active !== undefined) {
        filters.active = req.query.active === 'true';
      }
      
      if (req.query.trading_mode) {
        filters.trading_mode = req.query.trading_mode;
      }
      
      if (req.query.provider_id) {
        filters.provider_id = parseInt(req.query.provider_id);
      }
      
      const bots = db.getBots(filters);
      res.json(bots);
    } catch (error) {
      console.error('Error fetching bots:', error);
      res.status(500).json({ error: 'Failed to fetch bots', message: error.message });
    }
  }
);

/**
 * GET /api/bots/:id - Get specific bot details
 * MULTI-TENANT: Returns bot only if owned by authenticated user (unless admin)
 */
router.get('/:id',
  authenticateToken,
  param('id').notEmpty().withMessage('Bot ID is required'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const bot = db.getBot(req.params.id, userId);
      
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }
      
      // Get latest snapshot for current state
      const snapshots = db.getBotSnapshots(req.params.id, null, null, userId);
      const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
      
      // Get current positions
      const positions = db.getPositions(req.params.id, 'open', userId);
      
      // Get database statistics
      const stats = {
        totalTrades: db.db.prepare('SELECT COUNT(*) as count FROM trades WHERE bot_id = ? AND user_id = ?')
          .get(req.params.id, bot.user_id).count,
        totalPositions: db.db.prepare('SELECT COUNT(*) as count FROM positions WHERE bot_id = ? AND user_id = ?')
          .get(req.params.id, bot.user_id).count,
        openPositions: db.db.prepare('SELECT COUNT(*) as count FROM positions WHERE bot_id = ? AND user_id = ? AND status = ?')
          .get(req.params.id, bot.user_id, 'open').count,
        closedPositions: db.db.prepare('SELECT COUNT(*) as count FROM positions WHERE bot_id = ? AND user_id = ? AND status = ?')
          .get(req.params.id, bot.user_id, 'closed').count,
        totalDecisions: db.db.prepare('SELECT COUNT(*) as count FROM bot_decisions WHERE bot_id = ? AND user_id = ?')
          .get(req.params.id, bot.user_id).count,
        successfulDecisions: db.db.prepare('SELECT COUNT(*) as count FROM bot_decisions WHERE bot_id = ? AND user_id = ? AND execution_success = 1')
          .get(req.params.id, bot.user_id).count
      };
      
      res.json({
        ...bot,
        currentState: latestSnapshot,
        positions: positions,
        statistics: stats
      });
    } catch (error) {
      console.error('Error fetching bot:', error);
      res.status(500).json({ error: 'Failed to fetch bot', message: error.message });
    }
  }
);

/**
 * POST /api/bots - Create new bot
 */
router.post('/',
  authenticateToken,
  requireRole('user'),
  body('id').trim().notEmpty().withMessage('Bot ID is required')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Bot ID must be alphanumeric with underscores or hyphens'),
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('prompt').trim().isLength({ min: 10, max: 10000 }).withMessage('Prompt must be 10-10000 characters'),
  body('provider_id').isInt({ min: 1 }).withMessage('Valid provider required'),
  body('trading_mode').isIn(['paper', 'real']).withMessage('Trading mode must be paper or real'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  body('is_paused').optional().isBoolean().withMessage('is_paused must be boolean'),
  body('avatar_image').optional().isString().withMessage('avatar_image must be a string'),
  validateRequest,
  (req, res) => {
    try {
      // Check if bot ID already exists for this user
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const existing = db.getBot(req.body.id, userId);
      if (existing) {
        return res.status(409).json({ error: 'Bot with this ID already exists' });
      }
      
      // Check if provider exists and user owns it
      const provider = db.getProvider(req.body.provider_id, userId);
      if (!provider) {
        return res.status(400).json({ error: 'Provider not found or access denied' });
      }
      
      const bot = db.createBot({
        id: req.body.id,
        user_id: req.user.userId, // CRITICAL: Set user_id from authenticated user
        name: req.body.name,
        prompt: req.body.prompt,
        provider_id: req.body.provider_id,
        trading_mode: req.body.trading_mode,
        is_active: req.body.is_active !== undefined ? req.body.is_active : true,
        is_paused: req.body.is_paused !== undefined ? req.body.is_paused : false,
        avatar_image: req.body.avatar_image || null
      });
      
      // Create audit log
      createAuditLog({
        event_type: 'bot_created',
        entity_type: 'bot',
        entity_id: bot.id,
        user_id: req.user.userId,
        details: { bot_id: bot.id, name: bot.name },
        ip_address: req.ip
      });
      
      res.status(201).json(bot);
    } catch (error) {
      console.error('Error creating bot:', error);
      res.status(500).json({ error: 'Failed to create bot', message: error.message });
    }
  }
);

/**
 * PUT /api/bots/:id - Update bot
 */
router.put('/:id',
  authenticateToken,
  requireRole('user'),
  param('id').notEmpty().withMessage('Bot ID is required'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('prompt').optional().trim().isLength({ min: 10, max: 10000 }).withMessage('Prompt must be 10-10000 characters'),
  body('provider_id').optional().isInt({ min: 1 }).withMessage('Valid provider required'),
  body('trading_mode').optional().isIn(['paper', 'real']).withMessage('Trading mode must be paper or real'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  body('is_paused').optional().isBoolean().withMessage('is_paused must be boolean'),
  body('avatar_image').optional().isString().withMessage('avatar_image must be a string'),
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const bot = db.getBot(req.params.id, userId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }
      
      // If changing provider, check it exists and user owns it
      if (req.body.provider_id) {
        const provider = db.getProvider(req.body.provider_id, userId);
        if (!provider) {
          return res.status(400).json({ error: 'Provider not found or access denied' });
        }
      }
      
      const updatedBot = db.updateBot(req.params.id, req.body, userId);
      
      // Create audit log
      createAuditLog({
        event_type: 'bot_updated',
        entity_type: 'bot',
        entity_id: req.params.id,
        user_id: req.user.userId,
        details: { updates: req.body },
        ip_address: req.ip
      });
      
      // Reload bot configuration in BotManager (hot reload)
      if (req.app.locals.botManager) {
        try {
          await req.app.locals.botManager.reloadBotConfig(req.params.id);
          console.log(`✅ Hot-reloaded bot configuration for ${req.params.id}`);
        } catch (reloadError) {
          console.warn(`⚠️ Failed to hot-reload bot config:`, reloadError.message);
          // Don't fail the request - database was updated successfully
        }
      }
      
      res.json(updatedBot);
    } catch (error) {
      console.error('Error updating bot:', error);
      res.status(500).json({ error: 'Failed to update bot', message: error.message });
    }
  }
);

/**
 * DELETE /api/bots/:id - Delete (soft delete) bot
 */
router.delete('/:id',
  authenticateToken,
  requireRole('user'),
  param('id').notEmpty().withMessage('Bot ID is required'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const bot = db.getBot(req.params.id, userId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }
      
      db.deleteBot(req.params.id, userId);
      
      // Create audit log
      createAuditLog({
        event_type: 'bot_deleted',
        entity_type: 'bot',
        entity_id: req.params.id,
        user_id: req.user.userId,
        details: { bot_name: bot.name },
        ip_address: req.ip
      });
      
      res.json({ success: true, message: 'Bot deleted successfully' });
    } catch (error) {
      console.error('Error deleting bot:', error);
      res.status(500).json({ error: 'Failed to delete bot', message: error.message });
    }
  }
);

/**
 * POST /api/bots/:id/clone - Clone a bot
 * Creates a copy of an existing bot for the current user
 */
router.post('/:id/clone',
  authenticateToken,
  requireRole('user'),
  param('id').notEmpty().withMessage('Bot ID is required'),
  body('new_id').notEmpty().withMessage('New bot ID is required'),
  body('new_name').notEmpty().withMessage('New bot name is required'),
  validateRequest,
  (req, res) => {
    try {
      const { new_id, new_name } = req.body;
      const sourceBotId = req.params.id;
      
      // Get the source bot (anyone can clone any bot - no user restriction)
      const sourceBot = db.getBot(sourceBotId, null);
      if (!sourceBot) {
        return res.status(404).json({ error: 'Source bot not found' });
      }
      
      // Check if new_id is already taken
      const existing = db.getBot(new_id, null);
      if (existing) {
        return res.status(409).json({ error: 'Bot ID already exists. Please choose a different ID.' });
      }
      
      // Create the cloned bot for the current user
      const clonedBotData = {
        id: new_id,
        name: new_name,
        prompt: sourceBot.prompt,
        provider_id: sourceBot.provider_id,
        trading_mode: 'paper', // Always start as paper for safety
        avatar_image: sourceBot.avatar_image,
        trading_symbols: sourceBot.trading_symbols || null,
        user_id: req.user.userId,
      };
      
      const clonedBot = db.createBot(clonedBotData);
      
      // Create audit log
      createAuditLog({
        event_type: 'bot_cloned',
        entity_type: 'bot',
        entity_id: new_id,
        user_id: req.user.userId,
        details: { 
          source_bot_id: sourceBotId,
          source_bot_name: sourceBot.name,
          new_bot_name: new_name
        },
        ip_address: req.ip
      });
      
      res.status(201).json({ 
        success: true, 
        message: 'Bot cloned successfully',
        bot: clonedBot
      });
    } catch (error) {
      console.error('Error cloning bot:', error);
      res.status(500).json({ error: 'Failed to clone bot', message: error.message });
    }
  }
);

/**
 * GET /api/bots/:id/history-summary - Get bot's learning history summary
 */
router.get('/:id/history-summary',
  authenticateToken,
  requireRole('user'),
  param('id').notEmpty().withMessage('Bot ID is required'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const bot = db.getBot(req.params.id, userId);
      
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }
      
      // Parse the history summary if it exists
      let summary = null;
      if (bot.history_summary) {
        try {
          summary = JSON.parse(bot.history_summary);
        } catch (e) {
          console.error('Error parsing history summary:', e);
          summary = { summary: bot.history_summary }; // Fallback to raw text
        }
      }
      
      res.json({
        botId: bot.id,
        botName: bot.name,
        hasSummary: !!bot.history_summary,
        summary: summary
      });
    } catch (error) {
      console.error('Error fetching history summary:', error);
      res.status(500).json({ error: 'Failed to fetch history summary', message: error.message });
    }
  }
);

/**
 * GET /api/bots/:id/trades - Get bot's trade history
 * Query params:
 *   - limit: number of trades to return (default: 50, max: 500)
 *   - offset: pagination offset (default: 0)
 *   - symbol: filter by trading symbol (optional)
 *   - action: filter by OPEN or CLOSE (optional)
 *   - startDate: filter trades after this date (ISO string, optional)
 *   - endDate: filter trades before this date (ISO string, optional)
 */
router.get('/:id/trades',
  authenticateToken,
  requireRole('user'),
  param('id').notEmpty().withMessage('Bot ID is required'),
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const bot = db.getBot(req.params.id, userId);
      
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }

      // Parse query parameters
      const limit = Math.min(parseInt(req.query.limit) || 50, 500);
      const offset = parseInt(req.query.offset) || 0;
      const symbol = req.query.symbol;
      const action = req.query.action;
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      // Build query with filters
      let query = 'SELECT * FROM trades WHERE bot_id = ? AND user_id = ?';
      const params = [req.params.id, bot.user_id];

      if (symbol) {
        query += ' AND symbol = ?';
        params.push(symbol);
      }

      if (action) {
        query += ' AND action = ?';
        params.push(action);
      }

      if (startDate) {
        query += ' AND executed_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND executed_at <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY executed_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const trades = db.db.prepare(query).all(...params);

      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) as total FROM trades WHERE bot_id = ? AND user_id = ?';
      const countParams = [req.params.id, bot.user_id];

      if (symbol) {
        countQuery += ' AND symbol = ?';
        countParams.push(symbol);
      }

      if (action) {
        countQuery += ' AND action = ?';
        countParams.push(action);
      }

      if (startDate) {
        countQuery += ' AND executed_at >= ?';
        countParams.push(startDate);
      }

      if (endDate) {
        countQuery += ' AND executed_at <= ?';
        countParams.push(endDate);
      }

      const { total } = db.db.prepare(countQuery).get(...countParams);

      res.json({
        trades,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + trades.length < total
        },
        filters: {
          symbol,
          action,
          startDate,
          endDate
        }
      });
    } catch (error) {
      console.error('Error fetching trades:', error);
      res.status(500).json({ error: 'Failed to fetch trades', message: error.message });
    }
  }
);

/**
 * GET /api/bots/:id/positions - Get bot's position history
 * Query params:
 *   - status: filter by open/closed/all (default: all)
 *   - limit: number of positions to return (default: 50, max: 500)
 *   - offset: pagination offset (default: 0)
 *   - symbol: filter by trading symbol (optional)
 */
router.get('/:id/positions',
  authenticateToken,
  requireRole('user'),
  param('id').notEmpty().withMessage('Bot ID is required'),
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const bot = db.getBot(req.params.id, userId);
      
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }

      // Parse query parameters
      const status = req.query.status || 'all';
      const limit = Math.min(parseInt(req.query.limit) || 50, 500);
      const offset = parseInt(req.query.offset) || 0;
      const symbol = req.query.symbol;

      // Build query with filters
      let query = 'SELECT * FROM positions WHERE bot_id = ? AND user_id = ?';
      const params = [req.params.id, bot.user_id];

      if (status !== 'all') {
        query += ' AND status = ?';
        params.push(status);
      }

      if (symbol) {
        query += ' AND symbol = ?';
        params.push(symbol);
      }

      query += ' ORDER BY opened_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const positions = db.db.prepare(query).all(...params);

      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) as total FROM positions WHERE bot_id = ? AND user_id = ?';
      const countParams = [req.params.id, bot.user_id];

      if (status !== 'all') {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }

      if (symbol) {
        countQuery += ' AND symbol = ?';
        countParams.push(symbol);
      }

      const { total } = db.db.prepare(countQuery).get(...countParams);

      res.json({
        positions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + positions.length < total
        },
        filters: {
          status,
          symbol
        }
      });
    } catch (error) {
      console.error('Error fetching positions:', error);
      res.status(500).json({ error: 'Failed to fetch positions', message: error.message });
    }
  }
);

/**
 * GET /api/bots/:id/decisions - Get bot's AI decision history
 * Query params:
 *   - limit: number of decisions to return (default: 50, max: 500)
 *   - offset: pagination offset (default: 0)
 *   - success_only: filter by execution_success (optional)
 */
router.get('/:id/decisions',
  authenticateToken,
  requireRole('user'),
  param('id').notEmpty().withMessage('Bot ID is required'),
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const bot = db.getBot(req.params.id, userId);
      
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }

      // Parse query parameters
      const limit = Math.min(parseInt(req.query.limit) || 50, 500);
      const offset = parseInt(req.query.offset) || 0;
      const successOnly = req.query.success_only === 'true';

      // Build query with filters
      let query = 'SELECT * FROM bot_decisions WHERE bot_id = ? AND user_id = ?';
      const params = [req.params.id, bot.user_id];

      if (successOnly) {
        query += ' AND execution_success = 1';
      }

      query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const decisions = db.db.prepare(query).all(...params);

      // Parse JSON fields
      const parsedDecisions = decisions.map(d => ({
        ...d,
        decisions_json: JSON.parse(d.decisions_json),
        notes_json: JSON.parse(d.notes_json)
      }));

      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) as total FROM bot_decisions WHERE bot_id = ? AND user_id = ?';
      const countParams = [req.params.id, bot.user_id];

      if (successOnly) {
        countQuery += ' AND execution_success = 1';
      }

      const { total } = db.db.prepare(countQuery).get(...countParams);

      res.json({
        decisions: parsedDecisions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + decisions.length < total
        },
        filters: {
          success_only: successOnly
        }
      });
    } catch (error) {
      console.error('Error fetching decisions:', error);
      res.status(500).json({ error: 'Failed to fetch decisions', message: error.message });
    }
  }
);

/**
 * POST /api/bots/:id/force-summarize - Force generate learning history summary
 */
router.post('/:id/force-summarize',
  authenticateToken,
  requireRole('user'),
  param('id').notEmpty().withMessage('Bot ID is required'),
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const bot = db.getBot(req.params.id, userId);
      
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }
      
      // Get bot manager to use its loadAndManageHistory method
      const botManager = req.app.locals.botManager;
      if (!botManager) {
        return res.status(503).json({ error: 'Bot manager not available' });
      }
      
      console.log(`🔄 Force summarizing history for ${bot.name}...`);
      
      // Load bot's full state to pass to history manager
      const botState = botManager.getBot(bot.id);
      if (!botState) {
        return res.status(404).json({ error: 'Bot not active in trading engine' });
      }
      
      // Force summarization by temporarily setting a low threshold
      const Database = require('better-sqlite3');
      const dbPath = require('path').join(__dirname, '..', '..', 'data', 'arena.db');
      const database = new Database(dbPath);
      database.pragma('foreign_keys = ON');
      
      try {
        // Get all decisions
        // Handle both user_id being set or NULL (for legacy data)
        const decisions = database.prepare(`
          SELECT id, bot_id, prompt_sent, decisions_json, notes_json, execution_success, timestamp
          FROM bot_decisions
          WHERE bot_id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))
          ORDER BY timestamp DESC
          LIMIT 100
        `).all(bot.id, bot.user_id, bot.user_id);
        
        if (decisions.length < 5) {
          return res.status(400).json({ 
            error: 'Not enough trading history', 
            message: 'Bot needs at least 5 trading decisions before summarization can be performed' 
          });
        }
        
        // Get provider config
        const provider = database.prepare(`
          SELECT * FROM llm_providers WHERE id = ?
        `).get(bot.provider_id);
        
        if (!provider) {
          return res.status(500).json({ error: 'Bot provider not found' });
        }
        
        // Import summarizer
        const { manageHistorySize } = require('../services/historySummarizer');
        
        // Force summarization with threshold of 0 to always trigger
        const result = await manageHistorySize(
          bot,
          decisions.reverse(), // Oldest first
          provider,
          0, // Force summarization regardless of token count
          5, // Keep last 5 decisions (ignored when forceAll = true)
          true // forceAll: summarize ALL decisions, not just some
        );
        
        if (result.needsSummarization && result.summary) {
          // Save to database
          database.prepare(`
            UPDATE bots 
            SET history_summary = ?
            WHERE id = ? AND user_id = ?
          `).run(result.summary, bot.id, bot.user_id);
          
          console.log(`✅ Generated summary for ${bot.name}: ${result.summarizedCount} decisions compressed`);
          
          res.json({
            success: true,
            message: `Successfully generated learning summary from ${result.summarizedCount} decisions`,
            summary: JSON.parse(result.summary)
          });
        } else {
          res.json({
            success: false,
            message: 'Summarization was not needed or failed'
          });
        }
      } finally {
        database.close();
      }
    } catch (error) {
      console.error('Error forcing summarization:', error);
      res.status(500).json({ error: 'Failed to generate summary', message: error.message });
    }
  }
);

/**
 * POST /api/bots/:id/pause - Pause/unpause bot
 */
router.post('/:id/pause',
  authenticateToken,
  requireRole('user'),
  param('id').notEmpty().withMessage('Bot ID is required'),
  body('paused').isBoolean().withMessage('Paused must be boolean'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const bot = db.getBot(req.params.id, userId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }
      
      db.toggleBotPause(req.params.id, req.body.paused, userId);
      
      // Create audit log
      createAuditLog({
        event_type: req.body.paused ? 'bot_paused' : 'bot_resumed',
        entity_type: 'bot',
        entity_id: req.params.id,
        user_id: req.user.userId,
        details: { paused: req.body.paused },
        ip_address: req.ip
      });
      
      const updatedBot = db.getBot(req.params.id, userId);
      res.json(updatedBot);
    } catch (error) {
      console.error('Error pausing/unpausing bot:', error);
      res.status(500).json({ error: 'Failed to update bot pause state', message: error.message });
    }
  }
);

/**
 * POST /api/bots/:id/clear-learning - Clear only the learning history
 * Does NOT reset trades, positions, or balance - only wipes the history_summary
 * NOTE: Works for both paper and real trading bots
 */
router.post('/:id/clear-learning',
  authenticateToken,
  param('id').notEmpty().withMessage('Bot ID is required'),
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      
      const bot = db.getBot(req.params.id, userId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }
      
      console.log(`🧠 Clearing learning history for bot ${req.params.id} (${bot.name})`);
      
      // Clear the learning history summary
      db.db.prepare('UPDATE bots SET history_summary = NULL WHERE id = ?').run(req.params.id);
      
      // Create audit log
      createAuditLog({
        event_type: 'bot_learning_cleared',
        entity_type: 'bot',
        entity_id: req.params.id,
        user_id: req.user?.userId,
        details: { bot_name: bot.name },
        ip_address: req.ip
      });
      
      console.log(`✅ Learning history cleared for ${bot.name}`);
      res.json({ 
        success: true, 
        message: 'Learning history cleared successfully. Bot will start learning fresh from next turn.'
      });
    } catch (error) {
      console.error('Error clearing learning history:', error);
      res.status(500).json({ error: 'Failed to clear learning history', message: error.message });
    }
  }
);

/**
 * POST /api/bots/:id/reset - Reset bot state
 * Query params:
 *   - clearLearning=true: Also clear the bot's learning history summary (optional)
 * NOTE: Only works for paper trading bots
 */
router.post('/:id/reset',
  authenticateToken, // CRITICAL: Require auth for multi-tenant
  param('id').notEmpty().withMessage('Bot ID is required'),
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const clearLearning = req.query.clearLearning === 'true';
      
      const bot = db.getBot(req.params.id, userId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }
      
      if (bot.trading_mode === 'real') {
        return res.status(400).json({ error: 'Cannot reset a bot that is trading with real funds' });
      }
      
      // Delete all bot data
      console.log(`Resetting bot ${req.params.id} - clearing all data${clearLearning ? ' (including learning history)' : ''}...`);
      
      // 1. Delete all positions (open and closed)
      db.db.prepare('DELETE FROM positions WHERE bot_id = ?').run(req.params.id);
      
      // 2. Delete all trades
      db.db.prepare('DELETE FROM trades WHERE bot_id = ?').run(req.params.id);
      
      // 3. Delete all bot decisions (AI logs)
      db.db.prepare('DELETE FROM bot_decisions WHERE bot_id = ?').run(req.params.id);
      
      // 4. Delete all old state snapshots
      db.db.prepare('DELETE FROM bot_state_snapshots WHERE bot_id = ?').run(req.params.id);
      
      // 5. Clear learning history if requested
      if (clearLearning) {
        console.log(`   🧠 Clearing learning history (history_summary) for bot ${req.params.id}`);
        db.db.prepare('UPDATE bots SET history_summary = NULL WHERE id = ?').run(req.params.id);
      } else {
        console.log(`   🧠 Preserving learning history (history_summary) - bot will retain its learnings`);
      }
      
      // 6. Create fresh initial snapshot with reset balance
      const settings = db.getSettings();
      const initialBalance = settings.paper_bot_initial_balance || 10000;
      
      db.createSnapshot({
        bot_id: req.params.id,
        balance: initialBalance,
        unrealized_pnl: 0,
        realized_pnl: 0,
        total_value: initialBalance,
        trade_count: 0,
        win_rate: 0,
        timestamp: new Date().toISOString()
      });
      
      // 7. Clear the ENTIRE arena_state so all bots reload fresh from database
      try {
        db.db.prepare('DELETE FROM arena_state').run();
        console.log('Cleared entire arena_state - all bots will reload fresh from database');
      } catch (err) {
        console.log('Note: Could not clear arena_state:', err.message);
      }
      
      // 8. Reset the bot in BotManager's in-memory state
      try {
        const botManager = req.app.locals.botManager;
        if (botManager) {
          await botManager.resetBot(req.params.id);
          console.log('✅ Reset bot in BotManager memory');
        } else {
          console.warn('⚠️ BotManager not available, bot state may be stale until server restart');
        }
      } catch (err) {
        console.warn('⚠️ Failed to reset bot in BotManager:', err.message);
      }
      
      // Create audit log
      createAuditLog({
        event_type: 'bot_reset',
        entity_type: 'bot',
        entity_id: req.params.id,
        user_id: req.user?.userId,
        details: { 
          initial_balance: initialBalance,
          learning_cleared: clearLearning
        },
        ip_address: req.ip
      });
      
      const learningMsg = clearLearning ? ' (learning history cleared)' : ' (learning history preserved)';
      console.log(`✅ Bot ${req.params.id} reset successfully (database + memory)${learningMsg}`);
      res.json({ 
        success: true, 
        message: `Bot reset successfully${learningMsg}`, 
        initial_balance: initialBalance,
        learning_cleared: clearLearning
      });
    } catch (error) {
      console.error('Error resetting bot:', error);
      res.status(500).json({ error: 'Failed to reset bot', message: error.message });
    }
  }
);

/**
 * POST /api/bots/:id/snapshot - Save bot state snapshot
 * Body: { balance, total_value, realized_pnl, unrealized_pnl, position_count, trade_count, win_rate }
 */
router.post('/:id/snapshot',
  optionalAuth, // Allow without auth for local instances
  param('id').notEmpty().withMessage('Bot ID is required'),
  body('balance').isFloat().withMessage('Balance must be a number'),
  body('total_value').isFloat().withMessage('Total value must be a number'),
  body('realized_pnl').optional().isFloat().withMessage('Realized PnL must be a number'),
  body('unrealized_pnl').optional().isFloat().withMessage('Unrealized PnL must be a number'),
  body('position_count').optional().isInt().withMessage('Position count must be an integer'),
  body('trade_count').optional().isInt().withMessage('Trade count must be an integer'),
  body('win_rate').optional().isFloat({ min: 0, max: 1 }).withMessage('Win rate must be between 0 and 1'),
  validateRequest,
  (req, res) => {
    try {
      const bot = db.getBot(req.params.id);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      const snapshotData = {
        bot_id: req.params.id,
        balance: req.body.balance,
        total_value: req.body.total_value,
        realized_pnl: req.body.realized_pnl || 0,
        unrealized_pnl: req.body.unrealized_pnl || 0,
        position_count: req.body.position_count || 0,
        trade_count: req.body.trade_count || 0,
        win_rate: req.body.win_rate || 0
      };
      
      const snapshot = db.createSnapshot(snapshotData);
      res.json({ success: true, snapshot });
    } catch (error) {
      console.error('Error creating snapshot:', error);
      res.status(500).json({ error: 'Failed to create snapshot', message: error.message });
    }
  }
);

module.exports = router;

