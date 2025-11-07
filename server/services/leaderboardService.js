/**
 * Leaderboard Service
 * Handles bot performance rankings, calculations, and leaderboard updates
 */

const Database = require('better-sqlite3');
const path = require('path');

class LeaderboardService {
  constructor() {
    this.dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
  }

  /**
   * Calculate and update rankings for a specific period
   * @param {string} period - 'daily', 'weekly', 'monthly', 'all_time'
   */
  calculateRankings(period = 'all_time') {
    const db = new Database(this.dbPath);
    
    try {
      const now = Date.now();
      let tradesTimeFilter = '';
      let snapshotsTimeFilter = '';
      let cutoffTimestamp = '';
      
      // Calculate time boundaries for each period
      switch (period) {
        case 'daily':
          cutoffTimestamp = now - 24 * 60 * 60 * 1000;
          tradesTimeFilter = `AND strftime('%s', executed_at) * 1000 >= ${cutoffTimestamp}`;
          snapshotsTimeFilter = `AND strftime('%s', timestamp) * 1000 >= ${cutoffTimestamp}`;
          break;
        case 'weekly':
          cutoffTimestamp = now - 7 * 24 * 60 * 60 * 1000;
          tradesTimeFilter = `AND strftime('%s', executed_at) * 1000 >= ${cutoffTimestamp}`;
          snapshotsTimeFilter = `AND strftime('%s', timestamp) * 1000 >= ${cutoffTimestamp}`;
          break;
        case 'monthly':
          cutoffTimestamp = now - 30 * 24 * 60 * 60 * 1000;
          tradesTimeFilter = `AND strftime('%s', executed_at) * 1000 >= ${cutoffTimestamp}`;
          snapshotsTimeFilter = `AND strftime('%s', timestamp) * 1000 >= ${cutoffTimestamp}`;
          break;
        case 'all_time':
          tradesTimeFilter = '';
          snapshotsTimeFilter = '';
          break;
      }
      
      // Calculate statistics for each bot from trades table (accurate real-time data)
      // Use snapshots only for time-series metrics (drawdown, Sharpe)
      const stats = db.prepare(`
        SELECT 
          b.id as bot_id,
          b.user_id,
          b.name as bot_name,
          b.trading_mode,
          COALESCE(trade_stats.total_trades, 0) as total_trades,
          COALESCE(trade_stats.total_pnl, 0) as total_pnl,
          COALESCE(trade_stats.win_rate, 0) as win_rate,
          COALESCE(historical.peak_value, CASE WHEN b.trading_mode = 'real' THEN 100000 ELSE 10000 END) as peak_value,
          COALESCE(historical.lowest_value, CASE WHEN b.trading_mode = 'real' THEN 100000 ELSE 10000 END) as lowest_value,
          COALESCE(historical.avg_value, CASE WHEN b.trading_mode = 'real' THEN 100000 ELSE 10000 END) as avg_value
        FROM bots b
        LEFT JOIN (
          SELECT 
            bot_id,
            COUNT(*) as total_trades,
            SUM(pnl) as total_pnl,
            CAST(SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as win_rate
          FROM trades
          WHERE action = 'CLOSE' ${tradesTimeFilter}
            GROUP BY bot_id
        ) trade_stats ON b.id = trade_stats.bot_id
        LEFT JOIN (
          SELECT 
            bot_id,
            MAX(total_value) as peak_value,
            MIN(total_value) as lowest_value,
            AVG(total_value) as avg_value
          FROM bot_state_snapshots
          WHERE 1=1 ${snapshotsTimeFilter}
          GROUP BY bot_id
        ) historical ON b.id = historical.bot_id
        WHERE b.user_id IS NOT NULL 
          AND b.is_active = 1
          AND (COALESCE(trade_stats.total_trades, 0) > 0 OR COALESCE(trade_stats.total_pnl, 0) != 0)
        ORDER BY total_pnl DESC
      `).all();
      
      // Calculate advanced metrics
      const rankedBots = stats.map((bot, index) => {
        // Calculate max drawdown correctly
        // Max Drawdown = (Lowest - Peak) / Peak * 100
        // Will be negative if there was a drop from peak
        // If peak=lowest (no trading or no snapshots), drawdown = 0
        const initialBalance = bot.trading_mode === 'real' ? 100000 : 10000;
        const maxDrawdown = (bot.peak_value > initialBalance)
          ? ((bot.lowest_value - bot.peak_value) / bot.peak_value) * 100 
          : 0; // No meaningful drawdown if we haven't gone above initial balance
        
        // Simple Sharpe ratio approximation (returns / volatility)
        // In a real scenario, you'd calculate daily returns and their std dev
        const sharpeRatio = bot.avg_value > 0 
          ? (bot.total_pnl / bot.avg_value) * Math.sqrt(252) // Annualized
          : 0;
        
        return {
          ...bot,
          rank: index + 1,
          sharpe_ratio: sharpeRatio,
          max_drawdown: maxDrawdown
        };
      });
      
      // Update or insert leaderboard entries
      const upsert = db.prepare(`
        INSERT INTO leaderboard (
          user_id, bot_id, period, total_pnl, total_trades, 
          win_rate, sharpe_ratio, max_drawdown, rank, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(bot_id, period) 
        DO UPDATE SET
          total_pnl = excluded.total_pnl,
          total_trades = excluded.total_trades,
          win_rate = excluded.win_rate,
          sharpe_ratio = excluded.sharpe_ratio,
          max_drawdown = excluded.max_drawdown,
          rank = excluded.rank,
          updated_at = excluded.updated_at
      `);
      
      db.transaction(() => {
        for (const bot of rankedBots) {
          upsert.run(
            bot.user_id,
            bot.bot_id,
            period,
            bot.total_pnl,
            bot.total_trades,
            bot.win_rate,
            bot.sharpe_ratio,
            bot.max_drawdown,
            bot.rank,
            now
          );
        }
      })();
      
      console.log(`[Leaderboard] Updated for period: ${period} (${rankedBots.length} bots)`);
      
      return rankedBots;
    } finally {
      db.close();
    }
  }

  /**
   * Get top N bots for a specific period
   * @param {string} period - 'daily', 'weekly', 'monthly', 'all_time'
   * @param {number} limit - Number of bots to return
   */
  getTopBots(period = 'all_time', limit = 100) {
    const db = new Database(this.dbPath);
    
    try {
      const leaderboard = db.prepare(`
        SELECT 
          l.*,
          b.name as bot_name,
          b.avatar_image,
          u.username
        FROM leaderboard l
        JOIN bots b ON l.bot_id = b.id
        JOIN users u ON l.user_id = u.id
        WHERE l.period = ?
        ORDER BY l.rank ASC
        LIMIT ?
      `).all(period, limit);
      
      return leaderboard;
    } finally {
      db.close();
    }
  }

  /**
   * Get a user's current rank and position for all periods
   * @param {string} userId - User ID
   */
  getUserRank(userId) {
    const db = new Database(this.dbPath);
    
    try {
      const rankings = db.prepare(`
        SELECT 
          l.period,
          l.rank,
          l.total_pnl,
          l.win_rate,
          l.total_trades,
          b.name as bot_name,
          (SELECT COUNT(*) FROM leaderboard WHERE period = l.period) as total_bots
        FROM leaderboard l
        JOIN bots b ON l.bot_id = b.id
        WHERE l.user_id = ?
        ORDER BY l.period, l.rank
      `).all(userId);
      
      return rankings;
    } finally {
      db.close();
    }
  }

  /**
   * Get bot performance history
   * @param {string} botId - Bot ID
   * @param {number} days - Number of days of history (default 30)
   */
  getBotPerformanceHistory(botId, days = 30) {
    const db = new Database(this.dbPath);
    
    try {
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      const history = db.prepare(`
        SELECT 
          timestamp,
          balance,
          total_value,
          realized_pnl,
          unrealized_pnl,
          total_pnl,
          trade_count,
          win_rate
        FROM bot_performance_history
        WHERE bot_id = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `).all(botId, cutoffTime);
      
      // If no history exists, get from snapshots
      if (history.length === 0) {
        return db.prepare(`
          SELECT 
            created_at as timestamp,
            balance,
            total_value,
            realized_pnl,
            unrealized_pnl,
            (realized_pnl + unrealized_pnl) as total_pnl,
            trade_count,
            win_rate
          FROM bot_state_snapshots
          WHERE bot_id = ? AND created_at >= ?
          ORDER BY created_at ASC
        `).all(botId, cutoffTime);
      }
      
      return history;
    } finally {
      db.close();
    }
  }

  /**
   * Record bot performance snapshot for history tracking
   * @param {string} botId - Bot ID
   * @param {string} userId - User ID
   * @param {object} performance - Performance metrics
   */
  recordPerformance(botId, userId, performance) {
    const db = new Database(this.dbPath);
    
    try {
      db.prepare(`
        INSERT INTO bot_performance_history (
          bot_id, user_id, timestamp, balance, total_value,
          realized_pnl, unrealized_pnl, total_pnl, trade_count, win_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        botId,
        userId,
        Date.now(),
        performance.balance,
        performance.totalValue,
        performance.realizedPnl || 0,
        performance.unrealizedPnl || 0,
        (performance.realizedPnl || 0) + (performance.unrealizedPnl || 0),
        performance.tradeCount || 0,
        performance.winRate || 0
      );
    } finally {
      db.close();
    }
  }

  /**
   * Update all leaderboard periods
   * Called by scheduled job
   */
  updateAllLeaderboards() {
    console.log('[Leaderboard] Updating all periods...');
    
    const periods = ['daily', 'weekly', 'monthly', 'all_time'];
    const results = {};
    
    for (const period of periods) {
      try {
        const rankings = this.calculateRankings(period);
        results[period] = {
          success: true,
          count: rankings.length
        };
      } catch (error) {
        console.error(`[Leaderboard] Error updating ${period}:`, error);
        results[period] = {
          success: false,
          error: error.message
        };
      }
    }
    
    console.log('[Leaderboard] Update complete:', results);
    return results;
  }

  /**
   * Get leaderboard statistics
   */
  getStats() {
    const db = new Database(this.dbPath);
    
    try {
      const stats = {
        total_bots: db.prepare('SELECT COUNT(DISTINCT bot_id) as count FROM leaderboard WHERE period = ?').get('all_time')?.count || 0,
        total_users: db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM leaderboard WHERE period = ?').get('all_time')?.count || 0,
        total_trades: db.prepare('SELECT SUM(total_trades) as sum FROM leaderboard WHERE period = ?').get('all_time')?.sum || 0,
        total_pnl: db.prepare('SELECT SUM(total_pnl) as sum FROM leaderboard WHERE period = ?').get('all_time')?.sum || 0,
        avg_win_rate: db.prepare('SELECT AVG(win_rate) as avg FROM leaderboard WHERE period = ? AND total_trades > 0').get('all_time')?.avg || 0
      };
      
      return stats;
    } finally {
      db.close();
    }
  }
}

module.exports = new LeaderboardService();

