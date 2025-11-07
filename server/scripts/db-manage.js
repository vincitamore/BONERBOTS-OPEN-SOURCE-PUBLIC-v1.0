#!/usr/bin/env node
/**
 * Database Management Utility
 * 
 * Comprehensive database management tool for common operations.
 * 
 * Usage:
 *   node db-manage.js <command> [options]
 * 
 * Commands:
 *   backup              Create a database backup
 *   restore <file>      Restore from a backup file
 *   list-backups        List all available backups
 *   vacuum              Optimize database (VACUUM)
 *   analyze             Update query planner statistics
 *   integrity-check     Check database integrity
 *   reset-bot <id>      Reset a specific bot's data
 *   reset-all-bots      Reset all bots' trading data
 *   cleanup-old-data    Remove old data based on retention policy
 *   export-bot <id>     Export a bot's complete data
 *   import-bot <file>   Import a bot from export file
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'arena.db');
const BACKUP_DIR = process.env.BACKUP_PATH || path.join(__dirname, '..', '..', 'data', 'backups');

class DatabaseManager {
  constructor(dbPath, backupDir) {
    this.dbPath = dbPath;
    this.backupDir = backupDir;
    this.db = null;
  }

  connect(readonly = false) {
    try {
      this.db = new Database(this.dbPath, { readonly });
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect to database: ${error.message}`);
      return false;
    }
  }

  disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ==================== Backup Operations ====================
  
  createBackup() {
    console.log('🔄 Creating database backup...\n');

    try {
      // Ensure backup directory exists
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '_').split('.')[0];
      const backupPath = path.join(this.backupDir, `arena_backup_${timestamp}.db`);

      // Copy the database file
      fs.copyFileSync(this.dbPath, backupPath);

      // Get file size
      const stats = fs.statSync(backupPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      console.log(`✅ Backup created successfully!`);
      console.log(`   File: ${backupPath}`);
      console.log(`   Size: ${sizeMB} MB`);
      console.log(`   Time: ${new Date().toISOString()}\n`);

      // Clean up old backups
      this.cleanupOldBackups();

      return backupPath;
    } catch (error) {
      console.error(`❌ Backup failed: ${error.message}`);
      throw error;
    }
  }

  cleanupOldBackups() {
    const maxBackups = parseInt(process.env.MAX_BACKUPS || '7', 10);
    
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('arena_backup_') && file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Sort by time, newest first

      if (files.length > maxBackups) {
        const filesToDelete = files.slice(maxBackups);
        console.log(`🗑️  Cleaning up ${filesToDelete.length} old backup(s)...`);
        
        filesToDelete.forEach(file => {
          fs.unlinkSync(file.path);
          console.log(`   Deleted: ${file.name}`);
        });
        console.log('');
      }
    } catch (error) {
      console.error(`⚠️  Cleanup failed: ${error.message}`);
    }
  }

  listBackups() {
    console.log('📦 Available Backups\n');

    try {
      if (!fs.existsSync(this.backupDir)) {
        console.log('No backups found.\n');
        return [];
      }

      const backups = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('arena_backup_') && file.endsWith('.db'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.mtime
          };
        })
        .sort((a, b) => b.created.getTime() - a.created.getTime());

      if (backups.length === 0) {
        console.log('No backups found.\n');
        return [];
      }

      backups.forEach((backup, index) => {
        const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
        const date = backup.created.toISOString();
        console.log(`${index + 1}. ${backup.name}`);
        console.log(`   Size: ${sizeMB} MB`);
        console.log(`   Date: ${date}\n`);
      });

      return backups;
    } catch (error) {
      console.error(`❌ Failed to list backups: ${error.message}`);
      return [];
    }
  }

  async restoreBackup(backupFile) {
    console.log(`🔄 Restoring database from backup...\n`);

    const backupPath = path.isAbsolute(backupFile) 
      ? backupFile 
      : path.join(this.backupDir, backupFile);

    if (!fs.existsSync(backupPath)) {
      console.error(`❌ Backup file not found: ${backupPath}`);
      return false;
    }

    console.log(`⚠️  WARNING: This will overwrite the current database!`);
    console.log(`   Current: ${this.dbPath}`);
    console.log(`   Backup:  ${backupPath}\n`);

    const confirmed = await this.confirm('Are you sure you want to continue? (yes/no): ');
    
    if (!confirmed) {
      console.log('Restore cancelled.\n');
      return false;
    }

    try {
      // Create a safety backup of current database
      const safetyBackup = path.join(
        this.backupDir,
        `pre_restore_${Date.now()}.db`
      );
      fs.copyFileSync(this.dbPath, safetyBackup);
      console.log(`✅ Safety backup created: ${path.basename(safetyBackup)}`);

      // Restore the backup
      fs.copyFileSync(backupPath, this.dbPath);
      console.log(`✅ Database restored successfully!\n`);

      return true;
    } catch (error) {
      console.error(`❌ Restore failed: ${error.message}`);
      return false;
    }
  }

  // ==================== Database Optimization ====================
  
  vacuum() {
    console.log('🔧 Optimizing database (VACUUM)...\n');

    if (!this.connect()) {
      return false;
    }

    try {
      const sizeBefore = fs.statSync(this.dbPath).size;

      console.log('   Running VACUUM...');
      this.db.exec('VACUUM;');

      const sizeAfter = fs.statSync(this.dbPath).size;
      const saved = sizeBefore - sizeAfter;
      const savedMB = (saved / 1024 / 1024).toFixed(2);
      const percentSaved = ((saved / sizeBefore) * 100).toFixed(2);

      console.log(`✅ VACUUM complete!`);
      console.log(`   Before: ${(sizeBefore / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   After:  ${(sizeAfter / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Saved:  ${savedMB} MB (${percentSaved}%)\n`);

      return true;
    } catch (error) {
      console.error(`❌ VACUUM failed: ${error.message}`);
      return false;
    } finally {
      this.disconnect();
    }
  }

  analyze() {
    console.log('📊 Updating query planner statistics (ANALYZE)...\n');

    if (!this.connect()) {
      return false;
    }

    try {
      console.log('   Running ANALYZE...');
      this.db.exec('ANALYZE;');

      console.log(`✅ ANALYZE complete!\n`);
      console.log('   Query planner statistics have been updated.');
      console.log('   This may improve query performance.\n');

      return true;
    } catch (error) {
      console.error(`❌ ANALYZE failed: ${error.message}`);
      return false;
    } finally {
      this.disconnect();
    }
  }

  integrityCheck() {
    console.log('🔍 Checking database integrity...\n');

    if (!this.connect(true)) {
      return false;
    }

    try {
      console.log('   Running PRAGMA integrity_check...');
      const result = this.db.pragma('integrity_check');

      if (result.length === 1 && result[0].integrity_check === 'ok') {
        console.log(`✅ Integrity check passed!`);
        console.log(`   Database is healthy.\n`);
        return true;
      } else {
        console.error(`❌ Integrity check failed!`);
        result.forEach(r => {
          console.error(`   ${r.integrity_check}`);
        });
        console.log('');
        return false;
      }
    } catch (error) {
      console.error(`❌ Integrity check failed: ${error.message}`);
      return false;
    } finally {
      this.disconnect();
    }
  }

  // ==================== Bot Management ====================
  
  async resetBot(botId) {
    console.log(`🔄 Resetting bot: ${botId}\n`);

    if (!this.connect()) {
      return false;
    }

    try {
      // Check if bot exists
      const bot = this.db.prepare('SELECT id, name, trading_mode FROM bots WHERE id = ?').get(botId);
      
      if (!bot) {
        console.error(`❌ Bot not found: ${botId}`);
        return false;
      }

      console.log(`   Bot: ${bot.name}`);
      console.log(`   Mode: ${bot.trading_mode}\n`);
      console.log(`⚠️  This will delete:`);
      console.log(`   - All trades`);
      console.log(`   - All positions`);
      console.log(`   - All decisions`);
      console.log(`   - All snapshots`);
      console.log(`   - Performance history\n`);

      const confirmed = await this.confirm('Continue? (yes/no): ');
      
      if (!confirmed) {
        console.log('Reset cancelled.\n');
        return false;
      }

      // Get initial balance from settings
      const setting = this.db.prepare(
        "SELECT value FROM system_settings WHERE key = ?"
      ).get(bot.trading_mode === 'paper' ? 'paper_bot_initial_balance' : 'live_bot_initial_balance');
      
      const initialBalance = setting ? parseFloat(setting.value) : 10000;

      // Delete data
      const posResult = this.db.prepare('DELETE FROM positions WHERE bot_id = ?').run(botId);
      const tradeResult = this.db.prepare('DELETE FROM trades WHERE bot_id = ?').run(botId);
      const decResult = this.db.prepare('DELETE FROM bot_decisions WHERE bot_id = ?').run(botId);
      const snapResult = this.db.prepare('DELETE FROM bot_state_snapshots WHERE bot_id = ?').run(botId);
      const perfResult = this.db.prepare('DELETE FROM bot_performance_history WHERE bot_id = ?').run(botId);

      console.log(`\n✅ Deleted:`);
      console.log(`   Positions: ${posResult.changes}`);
      console.log(`   Trades: ${tradeResult.changes}`);
      console.log(`   Decisions: ${decResult.changes}`);
      console.log(`   Snapshots: ${snapResult.changes}`);
      console.log(`   Performance history: ${perfResult.changes}`);

      // Create fresh snapshot
      const userId = this.db.prepare('SELECT user_id FROM bots WHERE id = ?').get(botId).user_id;
      this.db.prepare(`
        INSERT INTO bot_state_snapshots (
          user_id, bot_id, balance, total_value, realized_pnl,
          unrealized_pnl, trade_count, win_rate, timestamp
        ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, datetime('now'))
      `).run(userId, botId, initialBalance, initialBalance);

      console.log(`\n✅ Bot reset complete!`);
      console.log(`   Initial balance: $${initialBalance}\n`);

      return true;
    } catch (error) {
      console.error(`❌ Reset failed: ${error.message}`);
      return false;
    } finally {
      this.disconnect();
    }
  }

  async resetAllBots() {
    console.log(`🔄 Resetting ALL paper trading bots\n`);

    if (!this.connect()) {
      return false;
    }

    try {
      const bots = this.db.prepare(`
        SELECT id, name FROM bots WHERE trading_mode = 'paper' AND is_active = 1
      `).all();

      if (bots.length === 0) {
        console.log('No paper trading bots found.\n');
        return true;
      }

      console.log(`Found ${bots.length} paper trading bot(s):`);
      bots.forEach(bot => console.log(`   - ${bot.name}`));
      console.log('');
      console.log(`⚠️  This will reset all their trading data!`);

      const confirmed = await this.confirm('Continue? (yes/no): ');
      
      if (!confirmed) {
        console.log('Reset cancelled.\n');
        return false;
      }

      // Get initial balance
      const setting = this.db.prepare(
        "SELECT value FROM system_settings WHERE key = 'paper_bot_initial_balance'"
      ).get();
      const initialBalance = setting ? parseFloat(setting.value) : 10000;

      for (const bot of bots) {
        console.log(`\nResetting ${bot.name}...`);
        
        const posResult = this.db.prepare('DELETE FROM positions WHERE bot_id = ?').run(bot.id);
        const tradeResult = this.db.prepare('DELETE FROM trades WHERE bot_id = ?').run(bot.id);
        const decResult = this.db.prepare('DELETE FROM bot_decisions WHERE bot_id = ?').run(bot.id);
        const snapResult = this.db.prepare('DELETE FROM bot_state_snapshots WHERE bot_id = ?').run(bot.id);
        const perfResult = this.db.prepare('DELETE FROM bot_performance_history WHERE bot_id = ?').run(bot.id);

        console.log(`   Deleted: ${posResult.changes} positions, ${tradeResult.changes} trades, ${decResult.changes} decisions`);

        // Create fresh snapshot
        const userId = this.db.prepare('SELECT user_id FROM bots WHERE id = ?').get(bot.id).user_id;
        this.db.prepare(`
          INSERT INTO bot_state_snapshots (
            user_id, bot_id, balance, total_value, realized_pnl,
            unrealized_pnl, trade_count, win_rate, timestamp
          ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, datetime('now'))
        `).run(userId, bot.id, initialBalance, initialBalance);

        console.log(`   ✅ Reset complete`);
      }

      console.log(`\n✅ All bots reset successfully!\n`);

      return true;
    } catch (error) {
      console.error(`❌ Reset failed: ${error.message}`);
      return false;
    } finally {
      this.disconnect();
    }
  }

  // ==================== Data Cleanup ====================
  
  async cleanupOldData() {
    console.log('🧹 Cleaning up old data...\n');

    if (!this.connect()) {
      return false;
    }

    try {
      // Get retention period from settings
      const setting = this.db.prepare(
        "SELECT value FROM system_settings WHERE key = 'data_retention_days'"
      ).get();
      const retentionDays = setting ? parseInt(setting.value) : 90;

      console.log(`   Retention period: ${retentionDays} days`);
      console.log(`   Cutoff date: ${new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()}\n`);

      // Count old records
      const oldTrades = this.db.prepare(`
        SELECT COUNT(*) as count FROM trades 
        WHERE executed_at < datetime('now', '-${retentionDays} days')
      `).get().count;

      const oldDecisions = this.db.prepare(`
        SELECT COUNT(*) as count FROM bot_decisions 
        WHERE timestamp < datetime('now', '-${retentionDays} days')
      `).get().count;

      const oldSnapshots = this.db.prepare(`
        SELECT COUNT(*) as count FROM bot_state_snapshots 
        WHERE timestamp < datetime('now', '-${retentionDays} days')
      `).get().count;

      if (oldTrades === 0 && oldDecisions === 0 && oldSnapshots === 0) {
        console.log('✅ No old data to clean up.\n');
        return true;
      }

      console.log(`Found old records:`);
      console.log(`   Trades: ${oldTrades}`);
      console.log(`   Decisions: ${oldDecisions}`);
      console.log(`   Snapshots: ${oldSnapshots}\n`);

      const confirmed = await this.confirm('Delete this data? (yes/no): ');
      
      if (!confirmed) {
        console.log('Cleanup cancelled.\n');
        return false;
      }

      // Delete old records
      const tradeResult = this.db.prepare(`
        DELETE FROM trades WHERE executed_at < datetime('now', '-${retentionDays} days')
      `).run();

      const decisionResult = this.db.prepare(`
        DELETE FROM bot_decisions WHERE timestamp < datetime('now', '-${retentionDays} days')
      `).run();

      const snapshotResult = this.db.prepare(`
        DELETE FROM bot_state_snapshots WHERE timestamp < datetime('now', '-${retentionDays} days')
      `).run();

      console.log(`\n✅ Cleanup complete!`);
      console.log(`   Deleted ${tradeResult.changes} trades`);
      console.log(`   Deleted ${decisionResult.changes} decisions`);
      console.log(`   Deleted ${snapshotResult.changes} snapshots\n`);

      return true;
    } catch (error) {
      console.error(`❌ Cleanup failed: ${error.message}`);
      return false;
    } finally {
      this.disconnect();
    }
  }

  // ==================== Bot Export/Import ====================
  
  exportBot(botId, outputFile) {
    console.log(`📤 Exporting bot: ${botId}\n`);

    if (!this.connect(true)) {
      return false;
    }

    try {
      // Get bot data
      const bot = this.db.prepare('SELECT * FROM bots WHERE id = ?').get(botId);
      
      if (!bot) {
        console.error(`❌ Bot not found: ${botId}`);
        return false;
      }

      console.log(`   Bot: ${bot.name}`);

      // Get related data
      const trades = this.db.prepare('SELECT * FROM trades WHERE bot_id = ? ORDER BY executed_at').all(botId);
      const positions = this.db.prepare('SELECT * FROM positions WHERE bot_id = ? ORDER BY opened_at').all(botId);
      const decisions = this.db.prepare('SELECT * FROM bot_decisions WHERE bot_id = ? ORDER BY timestamp').all(botId);
      const snapshots = this.db.prepare('SELECT * FROM bot_state_snapshots WHERE bot_id = ? ORDER BY timestamp').all(botId);

      const exportData = {
        exportVersion: '1.0',
        exportDate: new Date().toISOString(),
        bot,
        trades,
        positions,
        decisions,
        snapshots
      };

      console.log(`   Trades: ${trades.length}`);
      console.log(`   Positions: ${positions.length}`);
      console.log(`   Decisions: ${decisions.length}`);
      console.log(`   Snapshots: ${snapshots.length}\n`);

      // Write to file
      const output = outputFile || `bot_export_${botId}_${Date.now()}.json`;
      fs.writeFileSync(output, JSON.stringify(exportData, null, 2));

      const fileSize = fs.statSync(output).size;
      const fileSizeKB = (fileSize / 1024).toFixed(2);

      console.log(`✅ Export complete!`);
      console.log(`   File: ${output}`);
      console.log(`   Size: ${fileSizeKB} KB\n`);

      return true;
    } catch (error) {
      console.error(`❌ Export failed: ${error.message}`);
      return false;
    } finally {
      this.disconnect();
    }
  }

  // ==================== Utility Methods ====================
  
  confirm(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve => {
      rl.question(question, answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      });
    });
  }
}

// ==================== CLI ====================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const manager = new DatabaseManager(DB_PATH, BACKUP_DIR);

  console.log('\n' + '═'.repeat(70));
  console.log('BONERBOTS DATABASE MANAGER');
  console.log('═'.repeat(70));
  console.log(`\n📂 Database: ${DB_PATH}\n`);

  try {
    switch (command) {
      case 'backup':
        manager.createBackup();
        break;

      case 'restore':
        if (!args[1]) {
          console.error('❌ Please specify a backup file to restore');
          console.log('Usage: node db-manage.js restore <backup-file>\n');
          process.exit(1);
        }
        await manager.restoreBackup(args[1]);
        break;

      case 'list-backups':
        manager.listBackups();
        break;

      case 'vacuum':
        manager.vacuum();
        break;

      case 'analyze':
        manager.analyze();
        break;

      case 'integrity-check':
        manager.integrityCheck();
        break;

      case 'reset-bot':
        if (!args[1]) {
          console.error('❌ Please specify a bot ID');
          console.log('Usage: node db-manage.js reset-bot <bot-id>\n');
          process.exit(1);
        }
        await manager.resetBot(args[1]);
        break;

      case 'reset-all-bots':
        await manager.resetAllBots();
        break;

      case 'cleanup-old-data':
        await manager.cleanupOldData();
        break;

      case 'export-bot':
        if (!args[1]) {
          console.error('❌ Please specify a bot ID');
          console.log('Usage: node db-manage.js export-bot <bot-id> [output-file]\n');
          process.exit(1);
        }
        manager.exportBot(args[1], args[2]);
        break;

      default:
        console.log('Available Commands:');
        console.log('');
        console.log('  backup              - Create a database backup');
        console.log('  restore <file>      - Restore from a backup file');
        console.log('  list-backups        - List all available backups');
        console.log('  vacuum              - Optimize database (VACUUM)');
        console.log('  analyze             - Update query planner statistics');
        console.log('  integrity-check     - Check database integrity');
        console.log('  reset-bot <id>      - Reset a specific bot\'s data');
        console.log('  reset-all-bots      - Reset all bots\' trading data');
        console.log('  cleanup-old-data    - Remove old data based on retention policy');
        console.log('  export-bot <id>     - Export a bot\'s complete data');
        console.log('');
        console.log('Examples:');
        console.log('  node db-manage.js backup');
        console.log('  node db-manage.js restore arena_backup_2025-11-07.db');
        console.log('  node db-manage.js reset-bot bot_astrologer');
        console.log('  node db-manage.js export-bot bot_degen my_export.json');
        console.log('');
    }
  } catch (error) {
    console.error(`\n❌ Command failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DatabaseManager };

