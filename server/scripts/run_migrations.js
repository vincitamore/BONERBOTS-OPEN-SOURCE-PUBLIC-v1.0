/**
 * Migration Runner
 * 
 * Runs all pending database migrations in order.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'arena.db');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// List of all migrations in order
const MIGRATIONS = [
  '001_initial_schema.sql',
  '002_relational_schema.sql',
  '003_add_bot_avatars.sql',
  '004_multi_tenant_users.sql',
  '005_add_user_foreign_keys.sql',
  '006_leaderboard.sql',
  '007_add_bot_trading_symbols.sql',
  '008_add_history_summary.sql'
];

function log(message, isError = false) {
  const prefix = isError ? '❌' : '✓';
  console.log(`${prefix} ${message}`);
}

function initMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getAppliedMigrations(db) {
  try {
    const rows = db.prepare('SELECT name FROM migrations ORDER BY id').all();
    return rows.map(row => row.name);
  } catch (error) {
    return [];
  }
}

function runMigrations() {
  console.log('🔄 Running database migrations...\n');
  
  const db = new Database(DB_PATH);
  
  try {
    // Ensure migrations table exists
    initMigrationsTable(db);
    
    // Get list of already applied migrations
    const appliedMigrations = getAppliedMigrations(db);
    log(`Found ${appliedMigrations.length} previously applied migrations`);
    
    // Run pending migrations
    let migrationsRun = 0;
    
    for (const migrationFile of MIGRATIONS) {
      if (appliedMigrations.includes(migrationFile)) {
        console.log(`⏭️  Skipping ${migrationFile} (already applied)`);
        continue;
      }
      
      const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);
      
      if (!fs.existsSync(migrationPath)) {
        log(`Migration file not found: ${migrationFile}`, true);
        continue;
      }
      
      console.log(`\n📝 Running migration: ${migrationFile}`);
      
      try {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Special handling for migration 005 - disable foreign keys temporarily
        const isMigration005 = migrationFile.includes('005_add_user_foreign_keys');
        
        if (isMigration005) {
          db.pragma('foreign_keys = OFF');
        }
        
        // Run migration in a transaction
        db.exec('BEGIN TRANSACTION');
        
        // Remove PRAGMA statements from SQL (we handle them separately)
        const cleanSql = sql.replace(/PRAGMA\s+foreign_keys\s*=\s*(ON|OFF);?/gi, '');
        db.exec(cleanSql);
        
        // Record migration as applied
        db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationFile);
        
        db.exec('COMMIT');
        
        // Re-enable foreign keys if we disabled them
        if (isMigration005) {
          db.pragma('foreign_keys = ON');
        }
        
        log(`Successfully applied ${migrationFile}`);
        migrationsRun++;
      } catch (error) {
        db.exec('ROLLBACK');
        log(`Failed to apply ${migrationFile}: ${error.message}`, true);
        throw error;
      }
    }
    
    if (migrationsRun === 0) {
      console.log('\n✅ All migrations already applied - database is up to date!');
    } else {
      console.log(`\n✅ Successfully applied ${migrationsRun} migration(s)!`);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };

