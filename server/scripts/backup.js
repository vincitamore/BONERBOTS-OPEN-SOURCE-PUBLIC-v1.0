/**
 * Database Backup Script
 * 
 * Creates and manages backups of the arena database
 */

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/arena.db');
const BACKUP_DIR = process.env.BACKUP_PATH || path.join(__dirname, '../../data/backups');
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '7', 10);

let backupJob = null;

/**
 * Create a backup of the database
 */
function createBackup() {
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `arena-backup-${timestamp}.db`);

    // Copy the database file
    fs.copyFileSync(DB_PATH, backupPath);

    console.log(`[Backup] Created backup: ${backupPath}`);

    // Clean up old backups
    cleanupOldBackups();

    return backupPath;
  } catch (error) {
    console.error('[Backup] Error creating backup:', error);
    throw error;
  }
}

/**
 * Remove old backups, keeping only MAX_BACKUPS most recent
 */
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('arena-backup-') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort by time, newest first

    // Keep only MAX_BACKUPS most recent
    if (files.length > MAX_BACKUPS) {
      const filesToDelete = files.slice(MAX_BACKUPS);
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`[Backup] Deleted old backup: ${file.name}`);
      });
    }

    console.log(`[Backup] Keeping ${Math.min(files.length, MAX_BACKUPS)} backup(s)`);
  } catch (error) {
    console.error('[Backup] Error cleaning up old backups:', error);
  }
}

/**
 * List all available backups
 */
function listBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return [];
    }

    return fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('arena-backup-') && file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          created: stats.mtime
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  } catch (error) {
    console.error('[Backup] Error listing backups:', error);
    return [];
  }
}

/**
 * Restore database from a backup
 */
function restoreBackup(backupName) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupName);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupName}`);
    }

    // Create a backup of the current database before restoring
    const currentBackupPath = path.join(BACKUP_DIR, `arena-before-restore-${Date.now()}.db`);
    fs.copyFileSync(DB_PATH, currentBackupPath);
    console.log(`[Backup] Created safety backup: ${currentBackupPath}`);

    // Restore the backup
    fs.copyFileSync(backupPath, DB_PATH);
    console.log(`[Backup] Restored backup: ${backupName}`);

    return true;
  } catch (error) {
    console.error('[Backup] Error restoring backup:', error);
    throw error;
  }
}

/**
 * Start the backup scheduler
 */
function start() {
  if (backupJob) {
    console.log('[Backup] Scheduler already running');
    return;
  }

  // Run backup every day at 2 AM
  backupJob = cron.schedule('0 2 * * *', () => {
    try {
      console.log('[Backup] Running scheduled backup...');
      createBackup();
    } catch (error) {
      console.error('[Backup] Scheduled backup failed:', error);
    }
  });

  console.log('[Backup] Scheduler started (runs daily at 2 AM)');

  // Create an initial backup on startup (after 30 seconds)
  setTimeout(() => {
    try {
      console.log('[Backup] Creating initial backup...');
      createBackup();
    } catch (error) {
      console.error('[Backup] Initial backup failed:', error);
    }
  }, 30000); // 30 seconds
}

/**
 * Stop the backup scheduler
 */
function stop() {
  if (backupJob) {
    backupJob.stop();
    backupJob = null;
    console.log('[Backup] Scheduler stopped');
  }
}

// If run directly
if (require.main === module) {
  console.log('Creating manual backup...');
  createBackup();
  console.log('Done!');
}

module.exports = {
  createBackup,
  cleanupOldBackups,
  listBackups,
  restoreBackup,
  start,
  stop
};

