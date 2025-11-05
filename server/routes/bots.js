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
 */
router.get('/',
  optionalAuth,
  query('active').optional().isBoolean().withMessage('Active must be a boolean'),
  query('trading_mode').optional().isIn(['paper', 'real']).withMessage('Invalid trading mode'),
  query('provider_id').optional().isInt().withMessage('Provider ID must be an integer'),
  validateRequest,
  (req, res) => {
    try {
      const filters = {};
      
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
 */
router.get('/:id',
  optionalAuth,
  param('id').notEmpty().withMessage('Bot ID is required'),
  validateRequest,
  (req, res) => {
    try {
      const bot = db.getBot(req.params.id);
      
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      // Get latest snapshot for current state
      const snapshots = db.getBotSnapshots(req.params.id);
      const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
      
      // Get current positions
      const positions = db.getPositions(req.params.id, 'open');
      
      res.json({
        ...bot,
        currentState: latestSnapshot,
        positions: positions
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
      // Check if bot ID already exists
      const existing = db.getBot(req.body.id);
      if (existing) {
        return res.status(409).json({ error: 'Bot with this ID already exists' });
      }
      
      // Check if provider exists
      const provider = db.getProvider(req.body.provider_id);
      if (!provider) {
        return res.status(400).json({ error: 'Provider not found' });
      }
      
      const bot = db.createBot({
        id: req.body.id,
        name: req.body.name,
        prompt: req.body.prompt,
        provider_id: req.body.provider_id,
        trading_mode: req.body.trading_mode,
        is_active: req.body.is_active !== undefined ? req.body.is_active : true,
        is_paused: req.body.is_paused !== undefined ? req.body.is_paused : false
      });
      
      // Create audit log
      createAuditLog({
        event_type: 'bot_created',
        entity_type: 'bot',
        entity_id: bot.id,
        user_id: req.user?.userId,
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
      const bot = db.getBot(req.params.id);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      // If changing provider, check it exists
      if (req.body.provider_id) {
        const provider = db.getProvider(req.body.provider_id);
        if (!provider) {
          return res.status(400).json({ error: 'Provider not found' });
        }
      }
      
      const updatedBot = db.updateBot(req.params.id, req.body);
      
      // Create audit log
      createAuditLog({
        event_type: 'bot_updated',
        entity_type: 'bot',
        entity_id: req.params.id,
        user_id: req.user?.userId,
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
      const bot = db.getBot(req.params.id);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      db.deleteBot(req.params.id);
      
      // Create audit log
      createAuditLog({
        event_type: 'bot_deleted',
        entity_type: 'bot',
        entity_id: req.params.id,
        user_id: req.user?.userId,
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
      const bot = db.getBot(req.params.id);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      db.toggleBotPause(req.params.id, req.body.paused);
      
      // Create audit log
      createAuditLog({
        event_type: req.body.paused ? 'bot_paused' : 'bot_resumed',
        entity_type: 'bot',
        entity_id: req.params.id,
        user_id: req.user?.userId,
        details: { paused: req.body.paused },
        ip_address: req.ip
      });
      
      const updatedBot = db.getBot(req.params.id);
      res.json(updatedBot);
    } catch (error) {
      console.error('Error pausing/unpausing bot:', error);
      res.status(500).json({ error: 'Failed to update bot pause state', message: error.message });
    }
  }
);

/**
 * POST /api/bots/:id/reset - Reset bot state
 * NOTE: Only works for paper trading bots
 */
router.post('/:id/reset',
  optionalAuth, // Allow without auth for local instances
  param('id').notEmpty().withMessage('Bot ID is required'),
  validateRequest,
  async (req, res) => {
    try {
      const bot = db.getBot(req.params.id);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      if (bot.trading_mode === 'real') {
        return res.status(400).json({ error: 'Cannot reset a bot that is trading with real funds' });
      }
      
      // Delete all bot data
      console.log(`Resetting bot ${req.params.id} - clearing all data...`);
      
      // 1. Delete all positions (open and closed)
      db.db.prepare('DELETE FROM positions WHERE bot_id = ?').run(req.params.id);
      
      // 2. Delete all trades
      db.db.prepare('DELETE FROM trades WHERE bot_id = ?').run(req.params.id);
      
      // 3. Delete all bot decisions (AI logs)
      db.db.prepare('DELETE FROM bot_decisions WHERE bot_id = ?').run(req.params.id);
      
      // 4. Delete all old state snapshots
      db.db.prepare('DELETE FROM bot_state_snapshots WHERE bot_id = ?').run(req.params.id);
      
      // 5. Create fresh initial snapshot with reset balance
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
      
      // 6. Clear the ENTIRE arena_state so all bots reload fresh from database
      try {
        db.db.prepare('DELETE FROM arena_state').run();
        console.log('Cleared entire arena_state - all bots will reload fresh from database');
      } catch (err) {
        console.log('Note: Could not clear arena_state:', err.message);
      }
      
      // 7. Reset the bot in BotManager's in-memory state
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
        details: { initial_balance: initialBalance },
        ip_address: req.ip
      });
      
      console.log(`✅ Bot ${req.params.id} reset successfully (database + memory)`);
      res.json({ success: true, message: 'Bot reset successfully', initial_balance: initialBalance });
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

