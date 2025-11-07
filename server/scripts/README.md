# BONERBOTS Database Management Scripts

This directory contains comprehensive database management, inspection, testing, and maintenance tools for the BONERBOTS AI Trading Arena.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Core Tools](#core-tools)
- [Database Setup](#database-setup)
- [Maintenance](#maintenance)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Legacy Scripts](#legacy-scripts)

## 🚀 Quick Start

### Initial Database Setup

```powershell
# 1. Initialize the database schema
node initDatabase.js

# 2. Run all migrations
node run_migrations.js

# 3. Seed with default providers and settings
node seed_database.js

# 4. Create admin user
node create_admin_user.js

# 5. (Optional) Seed your bot configurations
node seed_current_bots.js
```

### Daily Operations

```powershell
# Check database status
node db-inspect.js --data

# Create backup
node db-manage.js backup

# Run tests
node db-test.js
```

## 🛠️ Core Tools

### 1. Database Inspector (`db-inspect.js`)

Comprehensive database analysis and reporting tool.

**Usage:**
```powershell
node db-inspect.js [options]
```

**Options:**
- `--full` - Complete inspection (default)
- `--schema` - Show schema and table structure
- `--data` - Show data statistics
- `--integrity` - Check data integrity
- `--performance` - Show performance metrics
- `--users` - Show user analysis
- `--bots` - Show bot analysis
- `--json` - Output as JSON
- `--export=<file>` - Export results to file

**Examples:**
```powershell
# Full inspection
node db-inspect.js

# Check only data statistics
node db-inspect.js --data

# Check integrity issues
node db-inspect.js --integrity

# Export results to JSON
node db-inspect.js --full --export=report.json

# Check bot status
node db-inspect.js --bots
```

**What it checks:**
- Database schema and structure
- Table row counts and relationships
- User and bot statistics
- Trading activity metrics
- Performance data (PnL, win rates)
- Storage usage
- Data integrity issues
- Foreign key constraints
- Orphaned records

### 2. Database Manager (`db-manage.js`)

Database management and maintenance utility.

**Usage:**
```powershell
node db-manage.js <command> [options]
```

**Commands:**

#### Backup Operations
```powershell
# Create backup
node db-manage.js backup

# List all backups
node db-manage.js list-backups

# Restore from backup
node db-manage.js restore arena_backup_2025-11-07.db
```

#### Database Optimization
```powershell
# Optimize database (VACUUM)
node db-manage.js vacuum

# Update query statistics
node db-manage.js analyze

# Check database integrity
node db-manage.js integrity-check
```

#### Bot Management
```powershell
# Reset a specific bot
node db-manage.js reset-bot bot_astrologer

# Reset all paper trading bots
node db-manage.js reset-all-bots

# Export bot data
node db-manage.js export-bot bot_degen my_export.json
```

#### Data Cleanup
```powershell
# Remove old data based on retention policy
node db-manage.js cleanup-old-data
```

**Configuration:**
- `DATABASE_PATH` - Database file path (default: `../../data/arena.db`)
- `BACKUP_PATH` - Backup directory (default: `../../data/backups`)
- `MAX_BACKUPS` - Max backup files to keep (default: 7)

### 3. Test Suite (`db-test.js`)

Comprehensive testing for database functionality.

**Usage:**
```powershell
node db-test.js [test-suite]
```

**Test Suites:**
- `all` - Run all tests (default)
- `auth` - Authentication flow tests
- `multi-tenant` - Multi-tenant isolation tests
- `consistency` - Data consistency tests
- `integrity` - Database integrity tests
- `performance` - Performance benchmarks

**Examples:**
```powershell
# Run all tests
node db-test.js

# Run only authentication tests
node db-test.js auth

# Run only consistency checks
node db-test.js consistency
```

**What it tests:**
- User registration and login
- Token management (access & refresh)
- Password recovery
- Multi-tenant data isolation
- Foreign key constraints
- Bot-Trade consistency
- Position-Trade consistency
- Database file integrity
- Query performance
- Cross-user data access prevention

## 🗄️ Database Setup

### Initial Setup

#### 1. Initialize Database (`initDatabase.js`)

Creates the database file and initializes the `arena_state` table.

```powershell
node initDatabase.js
```

**What it does:**
- Creates database file if it doesn't exist
- Initializes arena_state table
- Verifies database connection

#### 2. Run Migrations (`run_migrations.js`)

Applies all pending database migrations.

```powershell
node run_migrations.js
```

**Available Migrations:**
1. `001_initial_schema.sql` - Basic tables
2. `002_relational_schema.sql` - Relational tables
3. `003_add_bot_avatars.sql` - Avatar support
4. `004_multi_tenant_users.sql` - User system
5. `005_add_user_foreign_keys.sql` - Foreign keys
6. `006_leaderboard.sql` - Leaderboard tables
7. `007_add_bot_trading_symbols.sql` - Symbol configuration
8. `008_add_history_summary.sql` - Learning history

**Features:**
- Tracks applied migrations
- Skips already-applied migrations
- Handles migration errors gracefully
- Transaction-based (atomic)

#### 3. Seed Database (`seed_database.js`)

Seeds the database with default data.

```powershell
node seed_database.js
```

**Seeds:**
- Default LLM providers (Gemini, Grok, GPT-4, Claude, Ollama)
- System settings (trading parameters, intervals, limits)
- Default admin user (optional)

#### 4. Create Admin User (`create_admin_user.js`)

Creates the default admin user.

```powershell
node create_admin_user.js
```

**Default Credentials:**
- Username: `admin`
- Password: `admin123`
- Email: `admin@bonerbots.local`
- Role: `admin`

**⚠️ IMPORTANT:** Change the default password immediately after first login!

#### 5. Seed Bot Configurations (`seed_current_bots.js`)

Seeds your specific bot configurations.

```powershell
node seed_current_bots.js
```

**Seeds:**
- Bot configurations (DEGEN, Escaped Monkey, Astrologer, Chronospeculator)
- Full prompts
- LLM provider mappings
- Wallet configurations (if environment variables set)

## 🔧 Maintenance

### Backup Management (`backup.js`)

Automated backup service (typically run by the server).

**Module Usage:**
```javascript
const { start, stop, createBackup } = require('./backup.js');

// Start automated backups (daily at 2 AM)
start();

// Create manual backup
createBackup();

// Stop automated backups
stop();
```

**Configuration:**
- `DATABASE_PATH` - Database file path
- `BACKUP_PATH` - Backup directory
- `MAX_BACKUPS` - Maximum backups to retain (default: 7)

### Reset Operations

#### Reset Database (`resetDatabase.js`)

⚠️ **DESTRUCTIVE** - Deletes all data and recreates database.

```powershell
node resetDatabase.js
```

**Interactive prompt** - Requires confirmation

**What it does:**
- Deletes database file
- Reinitializes empty database
- Creates default state structure

#### Reset All Bots (`reset_all_bots.js`)

Resets all paper trading bots to fresh state.

```powershell
node reset_all_bots.js
```

**What it resets:**
- All trades
- All positions
- All decisions
- All snapshots
- Leaderboard entries
- Performance history

**What it preserves:**
- Bot configurations
- Learning history
- User accounts

**Note:** Requires server restart to take effect.

### Data Verification

#### Verify Data Consistency (`verify_data_consistency.js`)

Compares arena_state JSON with relational tables.

```powershell
node verify_data_consistency.js
```

**Checks:**
- Trade count consistency
- Position count consistency
- Decision count consistency
- Data sync between JSON and relational tables
- Detailed validation of recent trades

**Use case:** During dual-write period to ensure both persistence mechanisms are in sync.

#### Inspect Database State (`inspect_database_state.js`)

Pre-migration analysis tool (now superseded by `db-inspect.js`).

```powershell
node inspect_database_state.js
```

**Provides:**
- Arena state analysis
- Relational table status
- User ID foreign key status
- Sample data from populated tables

## 🧪 Testing

### Authentication Testing (`test_auth_flow.js`)

Comprehensive authentication flow testing.

```powershell
node test_auth_flow.js
```

**Prerequisites:**
- Server must be running
- API accessible at `http://localhost:3001`

**Tests:**
- User registration
- Login/logout
- Token refresh
- Protected resource access
- Account recovery
- Duplicate prevention
- Password validation

### Multi-Tenant Testing (`test_multi_tenant.js`)

Tests multi-tenant data isolation.

```powershell
node test_multi_tenant.js
```

**Prerequisites:**
- Server must be running
- API accessible at `http://localhost:3001`

**Tests:**
- User isolation
- Bot ownership
- Data visibility
- Cross-user access prevention
- Admin access privileges
- Analytics isolation

## 🔍 Troubleshooting

### Common Issues

#### 1. Database Locked

**Problem:** `database is locked` error

**Solutions:**
```powershell
# Stop the server
# Then try operation again

# Check for zombie processes
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# Kill zombie processes if found
Stop-Process -Name node -Force
```

#### 2. Migration Fails

**Problem:** Migration fails mid-way

**Solutions:**
```powershell
# Restore from backup
node db-manage.js restore <backup-file>

# Check migration status
node run_migrations.js

# Re-run specific migration manually
# Edit migration file and remove already-applied parts
```

#### 3. Data Inconsistency

**Problem:** Data doesn't match between tables

**Solutions:**
```powershell
# Check consistency
node verify_data_consistency.js

# Inspect detailed state
node db-inspect.js --integrity

# If severe, restore from backup
node db-manage.js restore <backup-file>
```

#### 4. Performance Issues

**Problem:** Slow queries

**Solutions:**
```powershell
# Run VACUUM to optimize
node db-manage.js vacuum

# Update query statistics
node db-manage.js analyze

# Check performance metrics
node db-inspect.js --performance

# Consider cleanup of old data
node db-manage.js cleanup-old-data
```

#### 5. Orphaned Data

**Problem:** Records without parent references

**Solutions:**
```powershell
# Check for orphans
node db-inspect.js --integrity

# Inspect specific issues
node db-test.js consistency

# Manual cleanup may be required
# Use db-manage.js or SQL directly
```

### Database Health Check

Run these commands periodically:

```powershell
# 1. Integrity check
node db-manage.js integrity-check

# 2. Consistency verification
node db-test.js consistency

# 3. Performance check
node db-inspect.js --performance

# 4. Create backup
node db-manage.js backup
```

### Emergency Recovery

If database is corrupted:

```powershell
# 1. Stop server
# 2. List available backups
node db-manage.js list-backups

# 3. Restore from most recent good backup
node db-manage.js restore arena_backup_<timestamp>.db

# 4. Verify restoration
node db-manage.js integrity-check

# 5. Restart server
```

## 📦 Legacy Scripts

These scripts are kept for reference but are superseded by the new tools:

- `extract_data_from_arena_state.js` - Historical: Extracted data from JSON to relational tables
- `migrate_to_relational.js` - Historical: Initial migration to relational schema
- `rollback_migration.js` - Use `db-manage.js restore` instead
- `verify_migration.js` - Use `db-test.js integrity` instead

These can be safely ignored for normal operations. They are preserved for historical reference and understanding the migration process.

## 🔐 Security Best Practices

1. **Backups**
   - Create daily backups (automated via `backup.js`)
   - Store backups securely
   - Test backup restoration regularly

2. **Admin Credentials**
   - Change default admin password immediately
   - Use strong passwords (12+ characters, mixed case, numbers, symbols)
   - Rotate credentials periodically

3. **Database Access**
   - Limit direct database access
   - Use application APIs when possible
   - Never expose database file publicly

4. **Data Retention**
   - Configure appropriate retention period in settings
   - Run cleanup regularly (`cleanup-old-data`)
   - Archive old data before deletion

5. **Testing**
   - Run test suite after major changes
   - Verify multi-tenant isolation
   - Check data consistency regularly

## 📊 Monitoring

### Daily Checks

```powershell
# Quick health check
node db-inspect.js --data

# Check for issues
node db-test.js consistency
```

### Weekly Maintenance

```powershell
# Create backup
node db-manage.js backup

# Optimize database
node db-manage.js vacuum

# Update statistics
node db-manage.js analyze

# Full inspection
node db-inspect.js --full --export=weekly_report.json
```

### Monthly Maintenance

```powershell
# Clean up old data
node db-manage.js cleanup-old-data

# Full test suite
node db-test.js all

# Performance analysis
node db-inspect.js --performance

# Review backup retention
node db-manage.js list-backups
```

## 📞 Support

For issues or questions:
1. Check this README
2. Review the `docs/` folder for architectural documentation
3. Inspect database state: `node db-inspect.js --full`
4. Run diagnostics: `node db-test.js all`

## 🎯 Best Practices

1. **Always create backups before:**
   - Running migrations
   - Resetting bots
   - Cleaning up data
   - Making schema changes

2. **Verify after:**
   - Migrations: `node db-test.js integrity`
   - Backups: `node db-manage.js integrity-check`
   - Resets: `node db-inspect.js --bots`

3. **Regular maintenance:**
   - Weekly backups
   - Monthly optimization (VACUUM)
   - Quarterly data cleanup

4. **Development workflow:**
   - Test locally first
   - Use separate test database
   - Run full test suite before deployment
   - Keep backups before major changes

---

**Version:** 1.0  
**Last Updated:** November 7, 2025  
**Maintainer:** BONERBOTS Team

