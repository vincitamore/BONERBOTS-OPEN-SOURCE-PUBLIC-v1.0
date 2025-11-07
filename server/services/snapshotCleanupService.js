/**
 * Snapshot Cleanup Service
 * 
 * Manages bot_state_snapshots retention to prevent database bloat.
 * 
 * Retention Policy:
 * - Last 7 days: Keep all snapshots (full frequency)
 * - 7-30 days: Keep 1 per hour per bot
 * - 30-90 days: Keep 1 per day per bot  
 * - 90+ days: Delete all
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/arena.db');

/**
 * Clean up old snapshots based on retention policy
 */
function cleanupSnapshots() {
  const db = new Database(DB_PATH);
  
  try {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneHourMs = 60 * 60 * 1000;
    
    const sevenDaysAgo = now - (7 * oneDayMs);
    const thirtyDaysAgo = now - (30 * oneDayMs);
    const ninetyDaysAgo = now - (90 * oneDayMs);
    
    console.log('[Snapshot Cleanup] Starting cleanup...');
    
    // Delete snapshots older than 90 days
    const deleteOld = db.prepare(`
      DELETE FROM bot_state_snapshots 
      WHERE strftime('%s', timestamp) * 1000 < ?
    `);
    const deletedOld = deleteOld.run(ninetyDaysAgo);
    console.log(`[Snapshot Cleanup] Deleted ${deletedOld.changes} snapshots older than 90 days`);
    
    // For 30-90 days old: Keep only 1 per day per bot
    // Delete all except the first snapshot of each day for each bot
    const deleteDailyDuplicates = db.prepare(`
      DELETE FROM bot_state_snapshots 
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM bot_state_snapshots
        WHERE strftime('%s', timestamp) * 1000 >= ?
          AND strftime('%s', timestamp) * 1000 < ?
        GROUP BY bot_id, DATE(timestamp)
      )
      AND strftime('%s', timestamp) * 1000 >= ?
      AND strftime('%s', timestamp) * 1000 < ?
    `);
    const deletedDaily = deleteDailyDuplicates.run(
      ninetyDaysAgo, 
      thirtyDaysAgo,
      ninetyDaysAgo,
      thirtyDaysAgo
    );
    console.log(`[Snapshot Cleanup] Deleted ${deletedDaily.changes} duplicate daily snapshots (30-90 days old)`);
    
    // For 7-30 days old: Keep only 1 per hour per bot
    // Delete all except the first snapshot of each hour for each bot
    const deleteHourlyDuplicates = db.prepare(`
      DELETE FROM bot_state_snapshots 
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM bot_state_snapshots
        WHERE strftime('%s', timestamp) * 1000 >= ?
          AND strftime('%s', timestamp) * 1000 < ?
        GROUP BY bot_id, strftime('%Y-%m-%d %H', timestamp)
      )
      AND strftime('%s', timestamp) * 1000 >= ?
      AND strftime('%s', timestamp) * 1000 < ?
    `);
    const deletedHourly = deleteHourlyDuplicates.run(
      thirtyDaysAgo,
      sevenDaysAgo,
      thirtyDaysAgo,
      sevenDaysAgo
    );
    console.log(`[Snapshot Cleanup] Deleted ${deletedHourly.changes} duplicate hourly snapshots (7-30 days old)`);
    
    // Get stats after cleanup
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_snapshots,
        COUNT(DISTINCT bot_id) as total_bots,
        MIN(timestamp) as oldest_snapshot,
        MAX(timestamp) as newest_snapshot
      FROM bot_state_snapshots
    `).get();
    
    console.log('[Snapshot Cleanup] Stats after cleanup:');
    console.log(`  Total snapshots: ${stats.total_snapshots}`);
    console.log(`  Total bots: ${stats.total_bots}`);
    console.log(`  Oldest snapshot: ${stats.oldest_snapshot}`);
    console.log(`  Newest snapshot: ${stats.newest_snapshot}`);
    
    // Run VACUUM to reclaim disk space
    console.log('[Snapshot Cleanup] Running VACUUM to reclaim disk space...');
    db.prepare('VACUUM').run();
    console.log('[Snapshot Cleanup] VACUUM complete');
    
    return {
      success: true,
      deleted: {
        old: deletedOld.changes,
        daily: deletedDaily.changes,
        hourly: deletedHourly.changes,
        total: deletedOld.changes + deletedDaily.changes + deletedHourly.changes
      },
      remaining: stats.total_snapshots
    };
  } catch (error) {
    console.error('[Snapshot Cleanup] Error during cleanup:', error);
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Get snapshot statistics
 */
function getStats() {
  const db = new Database(DB_PATH);
  
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_snapshots,
        COUNT(DISTINCT bot_id) as total_bots,
        MIN(timestamp) as oldest_snapshot,
        MAX(timestamp) as newest_snapshot,
        ROUND(AVG(cnt), 2) as avg_snapshots_per_bot
      FROM bot_state_snapshots
      LEFT JOIN (
        SELECT bot_id, COUNT(*) as cnt
        FROM bot_state_snapshots
        GROUP BY bot_id
      ) counts ON bot_state_snapshots.bot_id = counts.bot_id
    `).get();
    
    return stats;
  } finally {
    db.close();
  }
}

module.exports = {
  cleanupSnapshots,
  getStats
};

