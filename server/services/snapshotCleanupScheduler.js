/**
 * Snapshot Cleanup Scheduler
 * 
 * Runs the snapshot cleanup service on a daily schedule
 */

const cron = require('node-cron');
const snapshotCleanupService = require('./snapshotCleanupService');

let cleanupJob = null;

/**
 * Start the cleanup scheduler
 */
function start() {
  if (cleanupJob) {
    console.log('[Snapshot Cleanup Scheduler] Already running');
    return;
  }
  
  // Run cleanup every day at 3 AM
  cleanupJob = cron.schedule('0 3 * * *', async () => {
    try {
      console.log('[Snapshot Cleanup Scheduler] Running scheduled cleanup...');
      const result = await snapshotCleanupService.cleanupSnapshots();
      console.log(`[Snapshot Cleanup Scheduler] Deleted ${result.deleted.total} snapshots, ${result.remaining} remaining`);
    } catch (error) {
      console.error('[Snapshot Cleanup Scheduler] Error:', error);
    }
  });
  
  console.log('[Snapshot Cleanup Scheduler] Started (runs daily at 3 AM)');
  
  // Run an initial cleanup on startup (but wait 60 seconds to let the server fully start)
  setTimeout(async () => {
    try {
      console.log('[Snapshot Cleanup Scheduler] Running initial cleanup...');
      const result = await snapshotCleanupService.cleanupSnapshots();
      console.log(`[Snapshot Cleanup Scheduler] Initial cleanup complete: deleted ${result.deleted.total} snapshots`);
    } catch (error) {
      console.error('[Snapshot Cleanup Scheduler] Error during initial cleanup:', error);
    }
  }, 60000); // 60 seconds
}

/**
 * Stop the cleanup scheduler
 */
function stop() {
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
    console.log('[Snapshot Cleanup Scheduler] Stopped');
  }
}

module.exports = {
  start,
  stop
};

