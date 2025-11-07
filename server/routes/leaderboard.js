/**
 * Leaderboard API Routes
 * Public endpoints for viewing bot rankings and performance
 */

const express = require('express');
const router = express.Router();
const leaderboardService = require('../services/leaderboardService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * POST /api/leaderboard/update
 * Force recalculate leaderboard rankings (Admin only)
 */
router.post('/update', authenticateToken, requireAdmin, (req, res) => {
  try {
    console.log(`[Leaderboard] Manual update triggered by admin user: ${req.user.userId}`);
    
    const results = leaderboardService.updateAllLeaderboards();
    
    const updatedCount = Object.values(results).filter(r => r.success).length;
    
    res.json({ 
      success: true,
      message: 'Leaderboard updated successfully',
      updated: updatedCount,
      results
    });
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    res.status(500).json({ error: 'Failed to update leaderboard' });
  }
});

/**
 * GET /api/leaderboard/stats
 * Get overall leaderboard statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = leaderboardService.getStats();
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching leaderboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard statistics' });
  }
});

/**
 * GET /api/leaderboard/:period
 * Get leaderboard for a specific period
 * Query params: limit (default 100)
 */
router.get('/:period', (req, res) => {
  try {
    const { period } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    // Validate period
    const validPeriods = ['daily', 'weekly', 'monthly', 'all_time'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ 
        error: 'Invalid period. Must be: daily, weekly, monthly, or all_time' 
      });
    }
    
    // Validate limit
    if (limit < 1 || limit > 1000) {
      return res.status(400).json({ 
        error: 'Limit must be between 1 and 1000' 
      });
    }
    
    const leaderboard = leaderboardService.getTopBots(period, limit);
    
    res.json({
      period,
      count: leaderboard.length,
      leaderboard
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/leaderboard/user/:userId
 * Get a specific user's leaderboard positions across all periods
 */
router.get('/user/:userId', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;
    
    // Users can only view their own rankings unless they're admin
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. You can only view your own rankings.' 
      });
    }
    
    const rankings = leaderboardService.getUserRank(userId);
    
    res.json({
      userId,
      rankings
    });
  } catch (error) {
    console.error('Error fetching user rankings:', error);
    res.status(500).json({ error: 'Failed to fetch user rankings' });
  }
});

/**
 * GET /api/leaderboard/bot/:botId/history
 * Get bot performance history
 * Query params: days (default 30)
 */
router.get('/bot/:botId/history', (req, res) => {
  try {
    const { botId } = req.params;
    const days = parseInt(req.query.days) || 30;
    
    // Validate days
    if (days < 1 || days > 365) {
      return res.status(400).json({ 
        error: 'Days must be between 1 and 365' 
      });
    }
    
    const history = leaderboardService.getBotPerformanceHistory(botId, days);
    
    res.json({
      botId,
      days,
      count: history.length,
      history
    });
  } catch (error) {
    console.error('Error fetching bot history:', error);
    res.status(500).json({ error: 'Failed to fetch bot performance history' });
  }
});

/**
 * POST /api/leaderboard/update (Admin only)
 * Manually trigger leaderboard update
 */
router.post('/update', authenticateToken, (req, res) => {
  try {
    // Admin only
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const results = leaderboardService.updateAllLeaderboards();
    
    res.json({
      message: 'Leaderboard update triggered',
      results
    });
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    res.status(500).json({ error: 'Failed to update leaderboard' });
  }
});

module.exports = router;

