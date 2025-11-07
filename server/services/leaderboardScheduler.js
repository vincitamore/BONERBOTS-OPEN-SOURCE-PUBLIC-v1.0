/**
 * Leaderboard Scheduler
 * Periodic updates for bot rankings using node-cron
 */

const cron = require('node-cron');
const leaderboardService = require('./leaderboardService');

class LeaderboardScheduler {
  constructor() {
    this.dailyJob = null;
    this.hourlyJob = null;
  }

  /**
   * Start the leaderboard update scheduler
   */
  start() {
    console.log('[Leaderboard] Starting scheduler...');

    // Update all leaderboards every hour
    this.hourlyJob = cron.schedule('0 * * * *', () => {
      console.log('[Leaderboard] Running hourly update...');
      try {
        leaderboardService.updateAllLeaderboards();
      } catch (error) {
        console.error('[Leaderboard] Error in hourly update:', error);
      }
    });

    // Update daily rankings at 2 AM every day
    this.dailyJob = cron.schedule('0 2 * * *', () => {
      console.log('[Leaderboard] Running daily cleanup...');
      try {
        leaderboardService.calculateRankings('daily');
        console.log('[Leaderboard] Daily update complete');
      } catch (error) {
        console.error('[Leaderboard] Error in daily update:', error);
      }
    });

    // Run initial update on startup
    setTimeout(() => {
      console.log('[Leaderboard] Running initial update...');
      try {
        leaderboardService.updateAllLeaderboards();
      } catch (error) {
        console.error('[Leaderboard] Error in initial update:', error);
      }
    }, 5000); // Wait 5 seconds after server start

    console.log('[Leaderboard] Scheduler started');
    console.log('[Leaderboard]   - Hourly updates: Every hour at :00');
    console.log('[Leaderboard]   - Daily updates: Every day at 2:00 AM');
  }

  /**
   * Stop the leaderboard scheduler
   */
  stop() {
    if (this.hourlyJob) {
      this.hourlyJob.stop();
      console.log('[Leaderboard] Hourly updates stopped');
    }

    if (this.dailyJob) {
      this.dailyJob.stop();
      console.log('[Leaderboard] Daily updates stopped');
    }
  }

  /**
   * Manually trigger an update (useful for debugging)
   */
  triggerUpdate() {
    console.log('[Leaderboard] Manual update triggered');
    return leaderboardService.updateAllLeaderboards();
  }
}

module.exports = new LeaderboardScheduler();

