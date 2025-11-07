#!/usr/bin/env node
/**
 * Database Inspection Tool
 * 
 * Comprehensive database analysis and reporting tool for the BONERBOTS Arena.
 * Provides detailed insights into database structure, data integrity, and statistics.
 * 
 * Usage:
 *   node db-inspect.js [options]
 * 
 * Options:
 *   --full             Full inspection (all sections)
 *   --schema           Show schema and table structure
 *   --data             Show data statistics
 *   --integrity        Check data integrity
 *   --performance      Show performance metrics
 *   --users            Show user analysis
 *   --bots             Show bot analysis
 *   --json             Output as JSON
 *   --export=<file>    Export results to file
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'arena.db');

class DatabaseInspector {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.results = {};
  }

  connect() {
    try {
      this.db = new Database(this.dbPath, { readonly: true });
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

  // ==================== Schema Analysis ====================
  
  inspectSchema() {
    console.log('\n' + '═'.repeat(70));
    console.log('DATABASE SCHEMA');
    console.log('═'.repeat(70) + '\n');

    const tables = this.db.prepare(`
      SELECT name, sql 
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    this.results.schema = { tables: [], indexes: [], totalTables: tables.length };

    console.log(`📊 Total Tables: ${tables.length}\n`);

    for (const table of tables) {
      const columns = this.db.prepare(`PRAGMA table_info(${table.name})`).all();
      const rowCount = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
      
      console.log(`📋 ${table.name.toUpperCase()}`);
      console.log(`   Rows: ${rowCount.toLocaleString()}`);
      console.log(`   Columns: ${columns.length}`);
      
      this.results.schema.tables.push({
        name: table.name,
        rowCount,
        columns: columns.map(c => ({
          name: c.name,
          type: c.type,
          notNull: c.notnull === 1,
          defaultValue: c.dflt_value,
          primaryKey: c.pk === 1
        }))
      });

      // Show primary keys
      const primaryKeys = columns.filter(c => c.pk === 1);
      if (primaryKeys.length > 0) {
        console.log(`   Primary Key: ${primaryKeys.map(pk => pk.name).join(', ')}`);
      }

      // Show indexes for this table
      const indexes = this.db.prepare(`
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type='index' AND tbl_name=? AND sql IS NOT NULL
      `).all(table.name);
      
      if (indexes.length > 0) {
        console.log(`   Indexes: ${indexes.length}`);
        indexes.forEach(idx => {
          console.log(`     - ${idx.name}`);
        });
      }

      console.log('');
    }

    // Check foreign keys
    const fkEnabled = this.db.pragma('foreign_keys')[0].foreign_keys;
    console.log(`🔗 Foreign Keys: ${fkEnabled ? 'ENABLED' : 'DISABLED'}\n`);
    this.results.schema.foreignKeysEnabled = fkEnabled === 1;

    return this.results.schema;
  }

  // ==================== Data Statistics ====================
  
  inspectData() {
    console.log('\n' + '═'.repeat(70));
    console.log('DATA STATISTICS');
    console.log('═'.repeat(70) + '\n');

    const stats = {
      users: this.getUserStats(),
      bots: this.getBotStats(),
      trading: this.getTradingStats(),
      performance: this.getPerformanceStats(),
      storage: this.getStorageStats()
    };

    this.results.data = stats;

    // Users
    console.log('👥 USERS');
    console.log(`   Total: ${stats.users.total}`);
    console.log(`   Active: ${stats.users.active}`);
    console.log(`   Admins: ${stats.users.admins}`);
    console.log(`   Regular: ${stats.users.regular}`);
    console.log('');

    // Bots
    console.log('🤖 BOTS');
    console.log(`   Total: ${stats.bots.total}`);
    console.log(`   Active: ${stats.bots.active}`);
    console.log(`   Paused: ${stats.bots.paused}`);
    console.log(`   Paper Trading: ${stats.bots.paper}`);
    console.log(`   Live Trading: ${stats.bots.live}`);
    console.log('');

    // Trading Activity
    console.log('📈 TRADING ACTIVITY');
    console.log(`   Total Trades: ${stats.trading.totalTrades.toLocaleString()}`);
    console.log(`   Open Positions: ${stats.trading.openPositions.toLocaleString()}`);
    console.log(`   Closed Positions: ${stats.trading.closedPositions.toLocaleString()}`);
    console.log(`   Total Decisions: ${stats.trading.totalDecisions.toLocaleString()}`);
    console.log(`   Snapshots: ${stats.trading.totalSnapshots.toLocaleString()}`);
    console.log('');

    // Performance
    console.log('💰 PERFORMANCE');
    console.log(`   Total PnL: $${stats.performance.totalPnL.toFixed(2)}`);
    console.log(`   Winning Trades: ${stats.performance.winningTrades}`);
    console.log(`   Losing Trades: ${stats.performance.losingTrades}`);
    console.log(`   Win Rate: ${stats.performance.winRate.toFixed(2)}%`);
    console.log('');

    // Storage
    console.log('💾 STORAGE');
    console.log(`   Database Size: ${stats.storage.sizeFormatted}`);
    console.log(`   Page Size: ${stats.storage.pageSize} bytes`);
    console.log(`   Total Pages: ${stats.storage.pageCount.toLocaleString()}`);
    console.log(`   Arena State Size: ${stats.storage.arenaStateSize}`);
    console.log('');

    return stats;
  }

  // ==================== Integrity Checks ====================
  
  inspectIntegrity() {
    console.log('\n' + '═'.repeat(70));
    console.log('DATA INTEGRITY CHECKS');
    console.log('═'.repeat(70) + '\n');

    const issues = [];

    // Check 1: Orphaned records
    console.log('🔍 Checking for orphaned records...\n');
    
    const orphanChecks = [
      {
        name: 'Bots without users',
        query: `SELECT COUNT(*) as count FROM bots WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)`
      },
      {
        name: 'Trades without bots',
        query: `SELECT COUNT(*) as count FROM trades WHERE bot_id NOT IN (SELECT id FROM bots)`
      },
      {
        name: 'Positions without bots',
        query: `SELECT COUNT(*) as count FROM positions WHERE bot_id NOT IN (SELECT id FROM bots)`
      },
      {
        name: 'Decisions without bots',
        query: `SELECT COUNT(*) as count FROM bot_decisions WHERE bot_id NOT IN (SELECT id FROM bots)`
      },
      {
        name: 'Snapshots without bots',
        query: `SELECT COUNT(*) as count FROM bot_state_snapshots WHERE bot_id NOT IN (SELECT id FROM bots)`
      },
      {
        name: 'Bots with invalid providers',
        query: `SELECT COUNT(*) as count FROM bots WHERE provider_id NOT IN (SELECT id FROM llm_providers)`
      }
    ];

    for (const check of orphanChecks) {
      try {
        const result = this.db.prepare(check.query).get();
        if (result.count > 0) {
          console.log(`   ❌ ${check.name}: ${result.count}`);
          issues.push({ type: 'orphaned', check: check.name, count: result.count });
        } else {
          console.log(`   ✅ ${check.name}: OK`);
        }
      } catch (error) {
        console.log(`   ⚠️  ${check.name}: Could not check - ${error.message}`);
      }
    }

    // Check 2: NULL values in required fields
    console.log('\n🔍 Checking for NULL values in critical fields...\n');
    
    const nullChecks = [
      { table: 'bots', field: 'name', required: true },
      { table: 'bots', field: 'user_id', required: false },
      { table: 'trades', field: 'bot_id', required: true },
      { table: 'trades', field: 'user_id', required: false },
      { table: 'positions', field: 'bot_id', required: true },
      { table: 'bot_decisions', field: 'bot_id', required: true }
    ];

    for (const check of nullChecks) {
      try {
        const result = this.db.prepare(
          `SELECT COUNT(*) as count FROM ${check.table} WHERE ${check.field} IS NULL`
        ).get();
        
        if (result.count > 0) {
          const status = check.required ? '❌' : '⚠️';
          console.log(`   ${status} ${check.table}.${check.field}: ${result.count} NULL values`);
          if (check.required) {
            issues.push({ type: 'null', table: check.table, field: check.field, count: result.count });
          }
        } else {
          console.log(`   ✅ ${check.table}.${check.field}: No NULL values`);
        }
      } catch (error) {
        console.log(`   ⚠️  ${check.table}.${check.field}: Could not check`);
      }
    }

    // Check 3: Data consistency
    console.log('\n🔍 Checking data consistency...\n');
    
    const bots = this.db.prepare('SELECT id, name FROM bots WHERE is_active = 1').all();
    
    for (const bot of bots) {
      const dbTrades = this.db.prepare('SELECT COUNT(*) as count FROM trades WHERE bot_id = ?').get(bot.id).count;
      const dbPositions = this.db.prepare('SELECT COUNT(*) as count FROM positions WHERE bot_id = ?').get(bot.id).count;
      const dbDecisions = this.db.prepare('SELECT COUNT(*) as count FROM bot_decisions WHERE bot_id = ?').get(bot.id).count;

      // Check arena_state consistency
      const arenaState = this.db.prepare('SELECT state_json FROM arena_state LIMIT 1').get();
      if (arenaState) {
        try {
          const state = JSON.parse(arenaState.state_json);
          const botState = Array.isArray(state.bots) 
            ? state.bots.find(b => b.id === bot.id)
            : state.bots?.[bot.id];

          if (botState) {
            const stateTrades = botState.orders?.length || 0;
            const statePositions = botState.portfolio?.positions?.length || 0;
            const stateDecisions = botState.botLogs?.length || 0;

            if (Math.abs(dbTrades - stateTrades) > 5) {
              console.log(`   ⚠️  ${bot.name}: Trade count mismatch (DB: ${dbTrades}, State: ${stateTrades})`);
              issues.push({ type: 'consistency', bot: bot.name, field: 'trades', dbCount: dbTrades, stateCount: stateTrades });
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }

    if (bots.length > 0 && issues.filter(i => i.type === 'consistency').length === 0) {
      console.log(`   ✅ All bots consistent between DB and arena_state`);
    }

    // Summary
    console.log('\n' + '─'.repeat(70));
    if (issues.length === 0) {
      console.log('✅ No integrity issues found!\n');
    } else {
      console.log(`❌ Found ${issues.length} integrity issue(s)\n`);
    }

    this.results.integrity = { issues, passed: issues.length === 0 };
    return this.results.integrity;
  }

  // ==================== Performance Metrics ====================
  
  inspectPerformance() {
    console.log('\n' + '═'.repeat(70));
    console.log('PERFORMANCE METRICS');
    console.log('═'.repeat(70) + '\n');

    const metrics = {
      queryStats: [],
      indexUsage: [],
      recommendations: []
    };

    // Check index usage
    console.log('📊 Index Analysis\n');
    
    const indexes = this.db.prepare(`
      SELECT name, tbl_name 
      FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `).all();

    console.log(`   Total Indexes: ${indexes.length}`);
    indexes.forEach(idx => {
      console.log(`   - ${idx.name} on ${idx.tbl_name}`);
    });

    // Table size analysis
    console.log('\n💾 Table Size Analysis\n');
    
    const tables = this.db.prepare(`
      SELECT name 
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();

    for (const table of tables) {
      const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
      const info = this.db.prepare(`PRAGMA table_info(${table.name})`).all();
      
      // Estimate row size (rough approximation)
      const estimatedRowSize = info.length * 50; // Very rough estimate
      const estimatedSize = count * estimatedRowSize;
      const sizeKB = (estimatedSize / 1024).toFixed(2);
      
      console.log(`   ${table.name.padEnd(25)} ${count.toString().padStart(8)} rows  ~${sizeKB} KB`);
      
      metrics.queryStats.push({
        table: table.name,
        rows: count,
        estimatedSizeKB: parseFloat(sizeKB)
      });
    }

    // Recommendations
    console.log('\n💡 Performance Recommendations\n');
    
    const largestTables = metrics.queryStats
      .filter(t => t.rows > 10000)
      .sort((a, b) => b.rows - a.rows);

    if (largestTables.length === 0) {
      console.log('   ✅ All tables have reasonable sizes');
    } else {
      console.log(`   📈 Large tables detected (consider archiving old data):`);
      largestTables.forEach(t => {
        console.log(`      - ${t.table}: ${t.rows.toLocaleString()} rows`);
        metrics.recommendations.push(`Consider archiving old data from ${t.table}`);
      });
    }

    // Check for missing indexes
    const highVolumeTablesWithoutBotIndex = ['trades', 'positions', 'bot_decisions', 'bot_state_snapshots'];
    for (const table of highVolumeTablesWithoutBotIndex) {
      const hasIndex = indexes.some(idx => idx.tbl_name === table && idx.name.includes('bot_id'));
      if (!hasIndex) {
        console.log(`   ⚠️  Missing bot_id index on ${table}`);
        metrics.recommendations.push(`Add index on ${table}(bot_id)`);
      }
    }

    console.log('');

    this.results.performance = metrics;
    return metrics;
  }

  // ==================== User Analysis ====================
  
  inspectUsers() {
    console.log('\n' + '═'.repeat(70));
    console.log('USER ANALYSIS');
    console.log('═'.repeat(70) + '\n');

    const users = this.db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.role,
        u.is_active,
        u.created_at,
        u.last_login,
        COUNT(DISTINCT b.id) as bot_count,
        COUNT(DISTINCT lp.id) as provider_count
      FROM users u
      LEFT JOIN bots b ON b.user_id = u.id
      LEFT JOIN llm_providers lp ON lp.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();

    console.log(`👥 Total Users: ${users.length}\n`);

    for (const user of users) {
      const statusIcon = user.is_active ? '✅' : '❌';
      const roleIcon = user.role === 'admin' ? '👑' : '👤';
      
      console.log(`${roleIcon} ${statusIcon} ${user.username} (${user.role})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Bots: ${user.bot_count}`);
      console.log(`   Providers: ${user.provider_count}`);
      console.log(`   Created: ${user.created_at || 'N/A'}`);
      console.log(`   Last Login: ${user.last_login || 'Never'}`);
      
      // Get user's trading stats
      const stats = this.db.prepare(`
        SELECT 
          COUNT(DISTINCT t.id) as total_trades,
          COUNT(DISTINCT p.id) as total_positions,
          COALESCE(SUM(t.pnl), 0) as total_pnl
        FROM bots b
        LEFT JOIN trades t ON t.bot_id = b.id
        LEFT JOIN positions p ON p.bot_id = b.id
        WHERE b.user_id = ?
      `).get(user.id);

      if (stats.total_trades > 0) {
        console.log(`   Trading Stats:`);
        console.log(`     - Trades: ${stats.total_trades}`);
        console.log(`     - Positions: ${stats.total_positions}`);
        console.log(`     - Total PnL: $${stats.total_pnl.toFixed(2)}`);
      }
      
      console.log('');
    }

    this.results.users = users;
    return users;
  }

  // ==================== Bot Analysis ====================
  
  inspectBots() {
    console.log('\n' + '═'.repeat(70));
    console.log('BOT ANALYSIS');
    console.log('═'.repeat(70) + '\n');

    const bots = this.db.prepare(`
      SELECT 
        b.id,
        b.name,
        b.user_id,
        b.trading_mode,
        b.is_active,
        b.is_paused,
        b.created_at,
        lp.name as provider_name,
        lp.model_name,
        u.username
      FROM bots b
      LEFT JOIN llm_providers lp ON b.provider_id = lp.id
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
    `).all();

    console.log(`🤖 Total Bots: ${bots.length}\n`);

    for (const bot of bots) {
      const activeIcon = bot.is_active ? '✅' : '❌';
      const pausedIcon = bot.is_paused ? '⏸️' : '▶️';
      const modeIcon = bot.trading_mode === 'live' ? '🔴' : '📝';
      
      console.log(`${activeIcon} ${pausedIcon} ${modeIcon} ${bot.name}`);
      console.log(`   ID: ${bot.id}`);
      console.log(`   Owner: ${bot.username || 'No owner'}`);
      console.log(`   Mode: ${bot.trading_mode}`);
      console.log(`   Provider: ${bot.provider_name} (${bot.model_name})`);
      console.log(`   Created: ${bot.created_at || 'N/A'}`);
      
      // Get bot's stats
      const stats = this.db.prepare(`
        SELECT 
          COUNT(DISTINCT t.id) as total_trades,
          COUNT(DISTINCT CASE WHEN p.status = 'open' THEN p.id END) as open_positions,
          COUNT(DISTINCT d.id) as total_decisions,
          COALESCE(SUM(t.pnl), 0) as total_pnl,
          COALESCE(AVG(t.pnl), 0) as avg_pnl
        FROM bots b
        LEFT JOIN trades t ON t.bot_id = b.id
        LEFT JOIN positions p ON p.bot_id = b.id
        LEFT JOIN bot_decisions d ON d.bot_id = b.id
        WHERE b.id = ?
      `).get(bot.id);

      console.log(`   Statistics:`);
      console.log(`     - Trades: ${stats.total_trades}`);
      console.log(`     - Open Positions: ${stats.open_positions}`);
      console.log(`     - Decisions: ${stats.total_decisions}`);
      
      if (stats.total_trades > 0) {
        console.log(`     - Total PnL: $${stats.total_pnl.toFixed(2)}`);
        console.log(`     - Avg PnL/Trade: $${stats.avg_pnl.toFixed(2)}`);
      }
      
      // Get latest snapshot
      const snapshot = this.db.prepare(`
        SELECT balance, total_value, trade_count, win_rate, timestamp
        FROM bot_state_snapshots
        WHERE bot_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `).get(bot.id);

      if (snapshot) {
        console.log(`   Latest Snapshot (${snapshot.timestamp}):`);
        console.log(`     - Balance: $${snapshot.balance.toFixed(2)}`);
        console.log(`     - Total Value: $${snapshot.total_value.toFixed(2)}`);
        console.log(`     - Win Rate: ${(snapshot.win_rate * 100).toFixed(2)}%`);
      }
      
      console.log('');
    }

    this.results.bots = bots;
    return bots;
  }

  // ==================== Helper Methods ====================
  
  getUserStats() {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const active = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
    const admins = this.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
    const regular = this.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get().count;

    return { total, active, admins, regular };
  }

  getBotStats() {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM bots').get().count;
    const active = this.db.prepare('SELECT COUNT(*) as count FROM bots WHERE is_active = 1').get().count;
    const paused = this.db.prepare('SELECT COUNT(*) as count FROM bots WHERE is_paused = 1').get().count;
    const paper = this.db.prepare("SELECT COUNT(*) as count FROM bots WHERE trading_mode = 'paper'").get().count;
    const live = this.db.prepare("SELECT COUNT(*) as count FROM bots WHERE trading_mode = 'live'").get().count;

    return { total, active, paused, paper, live };
  }

  getTradingStats() {
    const totalTrades = this.db.prepare('SELECT COUNT(*) as count FROM trades').get().count;
    const openPositions = this.db.prepare("SELECT COUNT(*) as count FROM positions WHERE status = 'open'").get().count;
    const closedPositions = this.db.prepare("SELECT COUNT(*) as count FROM positions WHERE status = 'closed'").get().count;
    const totalDecisions = this.db.prepare('SELECT COUNT(*) as count FROM bot_decisions').get().count;
    const totalSnapshots = this.db.prepare('SELECT COUNT(*) as count FROM bot_state_snapshots').get().count;

    return { totalTrades, openPositions, closedPositions, totalDecisions, totalSnapshots };
  }

  getPerformanceStats() {
    const pnlQuery = this.db.prepare('SELECT COALESCE(SUM(pnl), 0) as total FROM trades').get();
    const winningTrades = this.db.prepare('SELECT COUNT(*) as count FROM trades WHERE pnl > 0').get().count;
    const losingTrades = this.db.prepare('SELECT COUNT(*) as count FROM trades WHERE pnl < 0').get().count;
    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
      totalPnL: pnlQuery.total,
      winningTrades,
      losingTrades,
      winRate
    };
  }

  getStorageStats() {
    const fileStats = fs.statSync(this.dbPath);
    const sizeBytes = fileStats.size;
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    const sizeFormatted = `${sizeMB} MB`;

    const pageSize = this.db.pragma('page_size')[0].page_size;
    const pageCount = this.db.pragma('page_count')[0].page_count;

    // Check arena_state size
    const arenaState = this.db.prepare('SELECT state_json FROM arena_state LIMIT 1').get();
    let arenaStateSize = 'N/A';
    if (arenaState && arenaState.state_json) {
      const sizeKB = (Buffer.byteLength(arenaState.state_json, 'utf8') / 1024).toFixed(2);
      arenaStateSize = `${sizeKB} KB`;
    }

    return {
      sizeBytes,
      sizeMB: parseFloat(sizeMB),
      sizeFormatted,
      pageSize,
      pageCount,
      arenaStateSize
    };
  }

  // ==================== Export ====================
  
  exportResults(filename) {
    try {
      fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
      console.log(`\n✅ Results exported to: ${filename}\n`);
      return true;
    } catch (error) {
      console.error(`\n❌ Failed to export results: ${error.message}\n`);
      return false;
    }
  }
}

// ==================== CLI ====================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    full: args.includes('--full'),
    schema: args.includes('--schema'),
    data: args.includes('--data'),
    integrity: args.includes('--integrity'),
    performance: args.includes('--performance'),
    users: args.includes('--users'),
    bots: args.includes('--bots'),
    json: args.includes('--json'),
    export: null
  };

  // Check for export file
  const exportArg = args.find(arg => arg.startsWith('--export='));
  if (exportArg) {
    options.export = exportArg.split('=')[1];
  }

  // If no specific options, show all
  if (!options.full && !options.schema && !options.data && !options.integrity && 
      !options.performance && !options.users && !options.bots) {
    options.full = true;
  }

  return options;
}

function main() {
  const options = parseArgs();
  const inspector = new DatabaseInspector(DB_PATH);

  console.log('\n' + '═'.repeat(70));
  console.log('BONERBOTS DATABASE INSPECTOR');
  console.log('═'.repeat(70));
  console.log(`\n📂 Database: ${DB_PATH}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);

  if (!inspector.connect()) {
    process.exit(1);
  }

  try {
    if (options.full || options.schema) {
      inspector.inspectSchema();
    }

    if (options.full || options.data) {
      inspector.inspectData();
    }

    if (options.full || options.users) {
      inspector.inspectUsers();
    }

    if (options.full || options.bots) {
      inspector.inspectBots();
    }

    if (options.full || options.integrity) {
      inspector.inspectIntegrity();
    }

    if (options.full || options.performance) {
      inspector.inspectPerformance();
    }

    // JSON output
    if (options.json) {
      console.log('\n' + '═'.repeat(70));
      console.log('JSON OUTPUT');
      console.log('═'.repeat(70) + '\n');
      console.log(JSON.stringify(inspector.results, null, 2));
    }

    // Export to file
    if (options.export) {
      inspector.exportResults(options.export);
    }

    console.log('═'.repeat(70));
    console.log('✅ Inspection Complete');
    console.log('═'.repeat(70) + '\n');

  } catch (error) {
    console.error(`\n❌ Inspection failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    inspector.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { DatabaseInspector };

