/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const express = require('express');
const { query, param } = require('express-validator');
const { validateRequest } = require('../middleware/validation');
const { optionalAuth } = require('../middleware/auth');
const db = require('../database/relational');

const router = express.Router();

/**
 * GET /api/analytics/performance - Get overall performance metrics across all bots
 */
router.get('/performance',
  optionalAuth,
  query('timeRange').optional().isIn(['24h', '7d', '30d', 'all']).withMessage('Invalid time range'),
  validateRequest,
  (req, res) => {
    try {
      const bots = db.getBots();
      
      if (bots.length === 0) {
        return res.json({
          totalPnL: 0,
          totalPnLPercent: 0,
          totalTrades: 0,
          winRate: 0,
          avgWin: 0,
          avgLoss: 0,
          sharpeRatio: 0,
          maxDrawdown: 0
        });
      }
      
      // Calculate date range
      const now = new Date();
      let startDate = null;
      if (req.query.timeRange === '24h') {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (req.query.timeRange === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (req.query.timeRange === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      // Aggregate metrics across all bots
      let totalPnL = 0;
      let totalTrades = 0;
      let totalWins = 0;
      let allWins = [];
      let allLosses = [];
      let initialValue = 0;
      let currentValue = 0;
      
      for (const bot of bots) {
        const snapshots = db.getBotSnapshots(
          bot.id,
          startDate ? startDate.toISOString() : undefined,
          undefined
        );
        
        const trades = db.getTrades(bot.id, {
          start_date: startDate ? startDate.toISOString() : undefined
        });
        
        if (snapshots.length > 0) {
          const latestSnapshot = snapshots[snapshots.length - 1];
          totalPnL += latestSnapshot.realized_pnl || 0;
          totalTrades += latestSnapshot.trade_count || 0;
          totalWins += Math.round((latestSnapshot.trade_count || 0) * (latestSnapshot.win_rate || 0));
          currentValue += latestSnapshot.total_value || 0;
          initialValue += latestSnapshot.balance || 10000; // Fallback to default
        }
        
        // Collect individual wins and losses
        for (const trade of trades) {
          if (trade.pnl > 0) {
            allWins.push(trade.pnl);
          } else if (trade.pnl < 0) {
            allLosses.push(Math.abs(trade.pnl));
          }
        }
      }
      
      const winRate = totalTrades > 0 ? (totalWins / totalTrades * 100) : 0;
      const avgWin = allWins.length > 0 ? allWins.reduce((sum, w) => sum + w, 0) / allWins.length : 0;
      const avgLoss = allLosses.length > 0 ? allLosses.reduce((sum, l) => sum + l, 0) / allLosses.length : 0;
      const totalPnLPercent = initialValue > 0 ? (totalPnL / initialValue * 100) : 0;
      
      // Calculate Sharpe and max drawdown (simplified)
      const sharpeRatio = 0; // TODO: Proper calculation requires time series
      const maxDrawdown = 0; // TODO: Proper calculation requires time series
      
      res.json({
        totalPnL: parseFloat(totalPnL.toFixed(2)),
        totalPnLPercent: parseFloat(totalPnLPercent.toFixed(2)),
        totalTrades: totalTrades,
        winRate: parseFloat(winRate.toFixed(2)),
        avgWin: parseFloat(avgWin.toFixed(2)),
        avgLoss: parseFloat(avgLoss.toFixed(2)),
        sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2))
      });
    } catch (error) {
      console.error('Error fetching overall performance:', error);
      res.status(500).json({ error: 'Failed to fetch performance', message: error.message });
    }
  }
);

/**
 * GET /api/analytics/performance/:botId - Get performance metrics for specific bot
 */
router.get('/performance/:botId',
  optionalAuth,
  param('botId').notEmpty().withMessage('Bot ID is required'),
  query('timeRange').optional().isIn(['24h', '7d', '30d', 'all']).withMessage('Invalid time range'),
  validateRequest,
  (req, res) => {
    try {
      const bot = db.getBot(req.params.botId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      // Calculate date range
      const now = new Date();
      let startDate = null;
      if (req.query.timeRange === '24h') {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (req.query.timeRange === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (req.query.timeRange === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      const snapshots = db.getBotSnapshots(
        req.params.botId,
        startDate ? startDate.toISOString() : undefined,
        undefined
      );
      
      if (snapshots.length === 0) {
        return res.json({
          totalPnL: 0,
          tradeCount: 0,
          winRate: 0,
          currentValue: 0
        });
      }
      
      const latestSnapshot = snapshots[snapshots.length - 1];
      
      res.json({
        totalPnL: parseFloat((latestSnapshot.realized_pnl || 0).toFixed(2)),
        tradeCount: latestSnapshot.trade_count || 0,
        winRate: parseFloat(((latestSnapshot.win_rate || 0) * 100).toFixed(2)),
        currentValue: parseFloat((latestSnapshot.total_value || 0).toFixed(2))
      });
    } catch (error) {
      console.error('Error fetching bot performance:', error);
      res.status(500).json({ error: 'Failed to fetch bot performance', message: error.message });
    }
  }
);

/**
 * GET /api/analytics/bot/:botId/performance - Get performance metrics for bot
 */
router.get('/bot/:botId/performance',
  optionalAuth,
  param('botId').notEmpty().withMessage('Bot ID is required'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  query('interval').optional().isIn(['1m', '5m', '15m', '1h', '4h', '1d']).withMessage('Invalid interval'),
  validateRequest,
  (req, res) => {
    try {
      const bot = db.getBot(req.params.botId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      const snapshots = db.getBotSnapshots(
        req.params.botId,
        req.query.start_date,
        req.query.end_date
      );
      
      // Calculate metrics
      const metrics = {
        bot_id: req.params.botId,
        bot_name: bot.name,
        trading_mode: bot.trading_mode,
        snapshots: snapshots,
        summary: {
          total_trades: snapshots.length > 0 ? snapshots[snapshots.length - 1].trade_count : 0,
          win_rate: snapshots.length > 0 ? snapshots[snapshots.length - 1].win_rate : 0,
          total_pnl: snapshots.length > 0 ? snapshots[snapshots.length - 1].realized_pnl : 0,
          current_value: snapshots.length > 0 ? snapshots[snapshots.length - 1].total_value : 0
        }
      };
      
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching bot performance:', error);
      res.status(500).json({ error: 'Failed to fetch performance', message: error.message });
    }
  }
);

/**
 * GET /api/analytics/bot/:botId/trades - Get trade history
 */
router.get('/bot/:botId/trades',
  optionalAuth,
  param('botId').notEmpty().withMessage('Bot ID is required'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  query('symbol').optional().trim().notEmpty().withMessage('Symbol cannot be empty'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater'),
  validateRequest,
  (req, res) => {
    try {
      const bot = db.getBot(req.params.botId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        symbol: req.query.symbol,
        limit: req.query.limit ? parseInt(req.query.limit) : 100,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };
      
      const trades = db.getTrades(req.params.botId, filters);
      
      // Calculate totals
      const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
      const totalFees = trades.reduce((sum, trade) => sum + trade.fee, 0);
      const winningTrades = trades.filter(t => t.pnl > 0).length;
      
      res.json({
        bot_id: req.params.botId,
        trades: trades,
        summary: {
          total_count: trades.length,
          total_pnl: totalPnl,
          total_fees: totalFees,
          winning_trades: winningTrades,
          win_rate: trades.length > 0 ? (winningTrades / trades.length * 100).toFixed(2) : 0
        }
      });
    } catch (error) {
      console.error('Error fetching trades:', error);
      res.status(500).json({ error: 'Failed to fetch trades', message: error.message });
    }
  }
);

/**
 * GET /api/analytics/bot/:botId/positions - Get position history
 */
router.get('/bot/:botId/positions',
  optionalAuth,
  param('botId').notEmpty().withMessage('Bot ID is required'),
  query('status').optional().isIn(['open', 'closed']).withMessage('Status must be open or closed'),
  query('symbol').optional().trim().notEmpty().withMessage('Symbol cannot be empty'),
  validateRequest,
  (req, res) => {
    try {
      const bot = db.getBot(req.params.botId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      const status = req.query.status || 'open';
      let positions = db.getPositions(req.params.botId, status);
      
      if (req.query.symbol) {
        positions = positions.filter(p => p.symbol === req.query.symbol);
      }
      
      res.json({
        bot_id: req.params.botId,
        status: status,
        positions: positions,
        count: positions.length
      });
    } catch (error) {
      console.error('Error fetching positions:', error);
      res.status(500).json({ error: 'Failed to fetch positions', message: error.message });
    }
  }
);

/**
 * GET /api/analytics/comparison - Compare multiple bots
 */
router.get('/comparison',
  optionalAuth,
  query('bot_ids').notEmpty().withMessage('Bot IDs are required'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  validateRequest,
  (req, res) => {
    try {
      // Parse bot IDs (comma-separated)
      const botIds = req.query.bot_ids.split(',').map(id => id.trim());
      
      if (botIds.length < 2) {
        return res.status(400).json({ error: 'At least 2 bot IDs required for comparison' });
      }
      
      const comparison = botIds.map(botId => {
        const bot = db.getBot(botId);
        if (!bot) {
          return { bot_id: botId, error: 'Bot not found' };
        }
        
        const snapshots = db.getBotSnapshots(
          botId,
          req.query.start_date,
          req.query.end_date
        );
        
        const trades = db.getTrades(botId, {
          start_date: req.query.start_date,
          end_date: req.query.end_date
        });
        
        const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
        
        return {
          bot_id: botId,
          bot_name: bot.name,
          trading_mode: bot.trading_mode,
          metrics: {
            total_value: latestSnapshot?.total_value || 0,
            realized_pnl: latestSnapshot?.realized_pnl || 0,
            trade_count: latestSnapshot?.trade_count || 0,
            win_rate: latestSnapshot?.win_rate || 0,
            total_fees: trades.reduce((sum, t) => sum + t.fee, 0)
          }
        };
      });
      
      res.json({
        comparison: comparison,
        bot_count: botIds.length
      });
    } catch (error) {
      console.error('Error comparing bots:', error);
      res.status(500).json({ error: 'Failed to compare bots', message: error.message });
    }
  }
);

/**
 * GET /api/analytics/risk-metrics - Calculate risk metrics
 */
router.get('/risk-metrics',
  optionalAuth,
  query('bot_id').notEmpty().withMessage('Bot ID is required'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  validateRequest,
  (req, res) => {
    try {
      const bot = db.getBot(req.query.bot_id);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      const snapshots = db.getBotSnapshots(
        req.query.bot_id,
        req.query.start_date,
        req.query.end_date
      );
      
      if (snapshots.length < 2) {
        return res.json({
          bot_id: req.query.bot_id,
          message: 'Not enough data for risk metrics',
          metrics: {}
        });
      }
      
      // Calculate returns
      const returns = [];
      for (let i = 1; i < snapshots.length; i++) {
        const prevValue = snapshots[i - 1].total_value;
        const currValue = snapshots[i].total_value;
        const returnPct = ((currValue - prevValue) / prevValue) * 100;
        returns.push(returnPct);
      }
      
      // Calculate max drawdown
      let maxDrawdown = 0;
      let peak = snapshots[0].total_value;
      
      for (const snapshot of snapshots) {
        if (snapshot.total_value > peak) {
          peak = snapshot.total_value;
        }
        const drawdown = ((peak - snapshot.total_value) / peak) * 100;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
      
      // Calculate average return and standard deviation
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      
      // Sharpe ratio (assuming risk-free rate of 0 for simplicity)
      const sharpeRatio = stdDev !== 0 ? avgReturn / stdDev : 0;
      
      // Sortino ratio (only considers downside deviation)
      const downsideReturns = returns.filter(r => r < 0);
      const downsideVariance = downsideReturns.length > 0
        ? downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length
        : 0;
      const downsideStdDev = Math.sqrt(downsideVariance);
      const sortinoRatio = downsideStdDev !== 0 ? avgReturn / downsideStdDev : 0;
      
      res.json({
        bot_id: req.query.bot_id,
        bot_name: bot.name,
        metrics: {
          sharpe_ratio: parseFloat(sharpeRatio.toFixed(2)),
          sortino_ratio: parseFloat(sortinoRatio.toFixed(2)),
          max_drawdown: parseFloat(maxDrawdown.toFixed(2)),
          volatility: parseFloat(stdDev.toFixed(2)),
          average_return: parseFloat(avgReturn.toFixed(2))
        }
      });
    } catch (error) {
      console.error('Error calculating risk metrics:', error);
      res.status(500).json({ error: 'Failed to calculate risk metrics', message: error.message });
    }
  }
);

module.exports = router;

