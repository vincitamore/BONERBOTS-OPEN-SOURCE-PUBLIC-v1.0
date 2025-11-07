/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const express = require('express');
const { query, param } = require('express-validator');
const { validateRequest } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/relational');

const router = express.Router();

// All analytics routes require authentication
router.use(authenticateToken);

/**
 * GET /api/analytics/performance - Get overall performance metrics across all user's bots
 */
router.get('/performance',
  query('timeRange').optional().isIn(['24h', '7d', '30d', 'all']).withMessage('Invalid time range'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.userId;
      const bots = db.getBots(userId);
      
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
      
      // Aggregate metrics across all bots - calculate from trades table
      let totalPnL = 0;
      let totalTrades = 0;
      let totalWins = 0;
      let allWins = [];
      let allLosses = [];
      
      for (const bot of bots) {
        // Get all CLOSED trades (action = 'CLOSE') which have realized PnL
        const closedTrades = db.getTrades(bot.id, {
          action: 'CLOSE',
          start_date: startDate ? startDate.toISOString() : undefined,
          user_id: userId
        });
        
        // Calculate metrics from actual trades
        for (const trade of closedTrades) {
          totalTrades++;
          const tradePnl = trade.pnl || 0;
          totalPnL += tradePnl;
          
          if (tradePnl > 0) {
            totalWins++;
            allWins.push(tradePnl);
          } else if (tradePnl < 0) {
            allLosses.push(Math.abs(tradePnl));
          }
        }
      }
      
      const winRate = totalTrades > 0 ? (totalWins / totalTrades * 100) : 0;
      const avgWin = allWins.length > 0 ? allWins.reduce((sum, w) => sum + w, 0) / allWins.length : 0;
      const avgLoss = allLosses.length > 0 ? allLosses.reduce((sum, l) => sum + l, 0) / allLosses.length : 0;
      
      // Calculate percent change (assume $10k initial balance per bot)
      const initialBalance = bots.length * 10000;
      const totalPnLPercent = initialBalance > 0 ? (totalPnL / initialBalance * 100) : 0;
      
      // Calculate Sharpe ratio and max drawdown from snapshots
      let sharpeRatio = 0;
      let maxDrawdown = 0;
      
      // Get all snapshots across all bots for time series analysis
      const allSnapshots = [];
      for (const bot of bots) {
        const snapshots = db.getBotSnapshots(
          bot.id, 
          startDate ? startDate.toISOString() : null,
          null, // endDate
          userId
        );
        allSnapshots.push(...snapshots);
      }
      
      if (allSnapshots.length > 1) {
        // Sort by timestamp
        allSnapshots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Calculate returns between consecutive snapshots
        const returns = [];
        for (let i = 1; i < allSnapshots.length; i++) {
          const prevValue = allSnapshots[i - 1].total_value;
          const currValue = allSnapshots[i].total_value;
          if (prevValue > 0) {
            const returnPct = ((currValue - prevValue) / prevValue) * 100;
            returns.push(returnPct);
          }
        }
        
        if (returns.length > 0) {
          // Calculate average return and standard deviation
          const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
          const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
          const stdDev = Math.sqrt(variance);
          
          // Sharpe ratio (assuming risk-free rate of 0 for simplicity)
          sharpeRatio = stdDev !== 0 ? avgReturn / stdDev : 0;
        }
        
        // Calculate max drawdown
        let peak = allSnapshots[0].total_value;
        for (const snapshot of allSnapshots) {
          if (snapshot.total_value > peak) {
            peak = snapshot.total_value;
          }
          if (peak > 0) {
            const drawdown = ((peak - snapshot.total_value) / peak) * 100;
            if (drawdown > maxDrawdown) {
              maxDrawdown = drawdown;
            }
          }
        }
      }
      
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
  param('botId').notEmpty().withMessage('Bot ID is required'),
  query('timeRange').optional().isIn(['24h', '7d', '30d', 'all']).withMessage('Invalid time range'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.userId;
      const bot = db.getBot(req.params.botId, userId);
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
      
      // Get closed trades to calculate realized metrics
      const closedTrades = db.getTrades(req.params.botId, {
        action: 'CLOSE',
        start_date: startDate ? startDate.toISOString() : undefined,
        user_id: userId
      });
      
      // Calculate metrics from trades
      let totalPnL = 0;
      let wins = 0;
      
      for (const trade of closedTrades) {
        const tradePnl = trade.pnl || 0;
        totalPnL += tradePnl;
        if (tradePnl > 0) wins++;
      }
      
      const tradeCount = closedTrades.length;
      const winRate = tradeCount > 0 ? (wins / tradeCount * 100) : 0;
      
      // Calculate current value: initial balance + realized PnL + unrealized PnL from open positions
      const initialBalance = bot.trading_mode === 'real' ? 100000 : 10000; // Real bots start with 100k
      
      // Get unrealized PnL from open positions
      const openPositions = db.getPositions(req.params.botId, 'open', userId);
      let unrealizedPnL = 0;
      for (const pos of openPositions) {
        unrealizedPnL += (pos.unrealized_pnl || 0);
      }
      
      const currentValue = initialBalance + totalPnL + unrealizedPnL;
      
      res.json({
        totalPnL: parseFloat(totalPnL.toFixed(2)),
        tradeCount: tradeCount,
        winRate: parseFloat(winRate.toFixed(2)),
        currentValue: parseFloat(currentValue.toFixed(2))
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
  param('botId').notEmpty().withMessage('Bot ID is required'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  query('interval').optional().isIn(['1m', '5m', '15m', '1h', '4h', '1d']).withMessage('Invalid interval'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.userId;
      const bot = db.getBot(req.params.botId, userId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      const snapshots = db.getBotSnapshots(
        req.params.botId,
        req.query.start_date,
        req.query.end_date,
        userId
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
  param('botId').notEmpty().withMessage('Bot ID is required'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  query('symbol').optional().trim().notEmpty().withMessage('Symbol cannot be empty'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.userId;
      const bot = db.getBot(req.params.botId, userId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        symbol: req.query.symbol,
        limit: req.query.limit ? parseInt(req.query.limit) : 100,
        offset: req.query.offset ? parseInt(req.query.offset) : 0,
        user_id: userId
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
  param('botId').notEmpty().withMessage('Bot ID is required'),
  query('status').optional().isIn(['open', 'closed']).withMessage('Status must be open or closed'),
  query('symbol').optional().trim().notEmpty().withMessage('Symbol cannot be empty'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.userId;
      const bot = db.getBot(req.params.botId, userId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      const status = req.query.status || 'open';
      let positions = db.getPositions(req.params.botId, status, userId);
      
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
      
      const userId = req.user.userId;
      
      const comparison = botIds.map(botId => {
        const bot = db.getBot(botId, userId);
        if (!bot) {
          return { bot_id: botId, error: 'Bot not found' };
        }
        
        const snapshots = db.getBotSnapshots(
          botId,
          req.query.start_date,
          req.query.end_date,
          userId
        );
        
        const trades = db.getTrades(botId, {
          start_date: req.query.start_date,
          end_date: req.query.end_date,
          user_id: userId
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
  query('bot_id').notEmpty().withMessage('Bot ID is required'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.userId;
      const bot = db.getBot(req.query.bot_id, userId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      const snapshots = db.getBotSnapshots(
        req.query.bot_id,
        req.query.start_date,
        req.query.end_date,
        userId
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

/**
 * GET /api/analytics/aggregate/best-worst - Get best and worst performing trades
 */
router.get('/aggregate/best-worst',
  query('bot_id').optional().trim().notEmpty().withMessage('Bot ID cannot be empty'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.userId;
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      
      let trades = [];
      if (req.query.bot_id) {
        // Get trades for specific bot
        const bot = db.getBot(req.query.bot_id, userId);
        if (!bot) {
          return res.status(404).json({ error: 'Bot not found' });
        }
        trades = db.getTrades(req.query.bot_id, { user_id: userId });
      } else {
        // Get trades for all user's bots
        const bots = db.getBots(userId);
        for (const bot of bots) {
          const botTrades = db.getTrades(bot.id, { user_id: userId });
          trades.push(...botTrades);
        }
      }
      
      // Filter to only trades with PnL
      const tradesWithPnl = trades.filter(t => t.pnl !== 0);
      
      // Sort and get best/worst
      const sorted = [...tradesWithPnl].sort((a, b) => b.pnl - a.pnl);
      const best = sorted.slice(0, limit);
      const worst = sorted.slice(-limit).reverse();
      
      res.json({
        best_trades: best.map(t => ({
          id: t.id,
          bot_id: t.bot_id,
          symbol: t.symbol,
          action: t.action,
          pnl: parseFloat(t.pnl.toFixed(2)),
          executed_at: t.executed_at
        })),
        worst_trades: worst.map(t => ({
          id: t.id,
          bot_id: t.bot_id,
          symbol: t.symbol,
          action: t.action,
          pnl: parseFloat(t.pnl.toFixed(2)),
          executed_at: t.executed_at
        }))
      });
    } catch (error) {
      console.error('Error fetching best/worst trades:', error);
      res.status(500).json({ error: 'Failed to fetch best/worst trades', message: error.message });
    }
  }
);

/**
 * GET /api/analytics/aggregate/by-symbol - Get performance aggregated by symbol
 */
router.get('/aggregate/by-symbol',
  query('bot_id').optional().trim().notEmpty().withMessage('Bot ID cannot be empty'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.userId;
      
      let trades = [];
      if (req.query.bot_id) {
        // Get trades for specific bot
        const bot = db.getBot(req.query.bot_id, userId);
        if (!bot) {
          return res.status(404).json({ error: 'Bot not found' });
        }
        trades = db.getTrades(req.query.bot_id, {
          user_id: userId,
          start_date: req.query.start_date,
          end_date: req.query.end_date
        });
      } else {
        // Get trades for all user's bots
        const bots = db.getBots(userId);
        for (const bot of bots) {
          const botTrades = db.getTrades(bot.id, {
            user_id: userId,
            start_date: req.query.start_date,
            end_date: req.query.end_date
          });
          trades.push(...botTrades);
        }
      }
      
      // Aggregate by symbol
      const symbolStats = {};
      for (const trade of trades) {
        if (!symbolStats[trade.symbol]) {
          symbolStats[trade.symbol] = {
            symbol: trade.symbol,
            trade_count: 0,
            total_pnl: 0,
            total_fees: 0,
            winning_trades: 0,
            losing_trades: 0
          };
        }
        
        const stats = symbolStats[trade.symbol];
        stats.trade_count++;
        stats.total_pnl += trade.pnl;
        stats.total_fees += trade.fee;
        
        if (trade.pnl > 0) {
          stats.winning_trades++;
        } else if (trade.pnl < 0) {
          stats.losing_trades++;
        }
      }
      
      // Calculate derived metrics and sort
      const symbolArray = Object.values(symbolStats).map(stats => ({
        ...stats,
        win_rate: stats.trade_count > 0 
          ? parseFloat((stats.winning_trades / stats.trade_count * 100).toFixed(2))
          : 0,
        avg_pnl: stats.trade_count > 0
          ? parseFloat((stats.total_pnl / stats.trade_count).toFixed(2))
          : 0,
        total_pnl: parseFloat(stats.total_pnl.toFixed(2)),
        total_fees: parseFloat(stats.total_fees.toFixed(2))
      }));
      
      // Sort by total PnL descending
      symbolArray.sort((a, b) => b.total_pnl - a.total_pnl);
      
      res.json({
        symbols: symbolArray,
        total_symbols: symbolArray.length
      });
    } catch (error) {
      console.error('Error fetching symbol analytics:', error);
      res.status(500).json({ error: 'Failed to fetch symbol analytics', message: error.message });
    }
  }
);

/**
 * GET /api/analytics/aggregate/summary - Get overall trading summary
 */
router.get('/aggregate/summary',
  query('bot_id').optional().trim().notEmpty().withMessage('Bot ID cannot be empty'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.userId;
      
      let bots = [];
      if (req.query.bot_id) {
        const bot = db.getBot(req.query.bot_id, userId);
        if (!bot) {
          return res.status(404).json({ error: 'Bot not found' });
        }
        bots = [bot];
      } else {
        bots = db.getBots(userId);
      }
      
      let allTrades = [];
      let allPositions = [];
      
      for (const bot of bots) {
        const trades = db.getTrades(bot.id, {
          user_id: userId,
          start_date: req.query.start_date,
          end_date: req.query.end_date
        });
        const positions = db.getPositions(bot.id, 'all', userId);
        allTrades.push(...trades);
        allPositions.push(...positions);
      }
      
      // Calculate comprehensive summary
      const totalPnl = allTrades.reduce((sum, t) => sum + t.pnl, 0);
      const totalFees = allTrades.reduce((sum, t) => sum + t.fee, 0);
      const winningTrades = allTrades.filter(t => t.pnl > 0);
      const losingTrades = allTrades.filter(t => t.pnl < 0);
      
      const avgWin = winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
        : 0;
      
      const avgLoss = losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losingTrades.length
        : 0;
      
      const profitFactor = (avgLoss > 0 && winningTrades.length > 0)
        ? (winningTrades.reduce((sum, t) => sum + t.pnl, 0) / Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0)))
        : 0;
      
      const openPositions = allPositions.filter(p => p.status === 'open');
      const closedPositions = allPositions.filter(p => p.status === 'closed');
      
      res.json({
        summary: {
          total_bots: bots.length,
          total_trades: allTrades.length,
          total_pnl: parseFloat(totalPnl.toFixed(2)),
          net_pnl: parseFloat((totalPnl - totalFees).toFixed(2)),
          total_fees: parseFloat(totalFees.toFixed(2)),
          winning_trades: winningTrades.length,
          losing_trades: losingTrades.length,
          win_rate: allTrades.length > 0 
            ? parseFloat((winningTrades.length / allTrades.length * 100).toFixed(2))
            : 0,
          avg_win: parseFloat(avgWin.toFixed(2)),
          avg_loss: parseFloat(avgLoss.toFixed(2)),
          profit_factor: parseFloat(profitFactor.toFixed(2)),
          total_positions: allPositions.length,
          open_positions: openPositions.length,
          closed_positions: closedPositions.length
        }
      });
    } catch (error) {
      console.error('Error fetching trading summary:', error);
      res.status(500).json({ error: 'Failed to fetch trading summary', message: error.message });
    }
  }
);

module.exports = router;

