# Database Scripts - Quick Reference

Quick command reference for common operations.

## 🚀 Getting Started

```powershell
# Initial setup (run once)
node initDatabase.js
node run_migrations.js
node seed_database.js
node create_admin_user.js
```

## 📊 Daily Operations

```powershell
# Check database status
node db-inspect.js --data

# Create backup
node db-manage.js backup

# Run quick tests
node db-test.js consistency
```

## 🔍 Inspection

```powershell
node db-inspect.js                    # Full inspection
node db-inspect.js --data             # Data statistics only
node db-inspect.js --bots             # Bot analysis
node db-inspect.js --integrity        # Check for issues
node db-inspect.js --performance      # Performance metrics
node db-inspect.js --export=report.json   # Export to file
```

## 🛠️ Management

```powershell
# Backups
node db-manage.js backup              # Create backup
node db-manage.js list-backups        # List backups
node db-manage.js restore <file>      # Restore backup

# Optimization
node db-manage.js vacuum              # Optimize database
node db-manage.js analyze             # Update statistics
node db-manage.js integrity-check     # Check integrity

# Bot Operations
node db-manage.js reset-bot <id>      # Reset specific bot
node db-manage.js reset-all-bots      # Reset all paper bots
node db-manage.js export-bot <id>     # Export bot data

# Cleanup
node db-manage.js cleanup-old-data    # Remove old data
```

## 🧪 Testing

```powershell
node db-test.js                       # Run all tests
node db-test.js auth                  # Auth tests only
node db-test.js multi-tenant          # Multi-tenant tests
node db-test.js consistency           # Consistency tests
node db-test.js integrity             # Integrity tests
node db-test.js performance           # Performance tests
```

## 🔧 Maintenance

```powershell
# Weekly
node db-manage.js backup
node db-manage.js vacuum
node db-inspect.js --full --export=weekly.json

# Monthly
node db-manage.js cleanup-old-data
node db-test.js all
node db-inspect.js --performance
```

## 🆘 Troubleshooting

```powershell
# Database issues
node db-manage.js integrity-check     # Check health
node db-test.js integrity             # Run integrity tests

# Performance issues
node db-manage.js vacuum              # Optimize
node db-inspect.js --performance      # Check metrics

# Data issues
node db-test.js consistency           # Check consistency
node db-inspect.js --integrity        # Find problems

# Emergency restore
node db-manage.js list-backups        # Find backup
node db-manage.js restore <file>      # Restore it
```

## 📁 Common File Paths

```
Database:      ../../data/arena.db
Backups:       ../../data/backups/
Migrations:    ../migrations/
```

## 🎯 One-Liners

```powershell
# Quick health check
node db-inspect.js --data && node db-test.js consistency

# Full diagnostics
node db-inspect.js --full --export=full_report.json

# Safe bot reset
node db-manage.js backup && node db-manage.js reset-all-bots

# Pre-deployment check
node db-manage.js backup && node db-test.js all && node db-manage.js integrity-check
```

## 🔐 Security

```powershell
# Change admin password (use UI)
# Username: admin
# Default password: admin123 (CHANGE THIS!)

# After changing password, verify:
node db-test.js auth
```

## 📈 Monitoring

```powershell
# Create monitoring reports
node db-inspect.js --full --export=daily_$(date +%Y%m%d).json

# Check trends
node db-inspect.js --performance --export=perf_$(date +%Y%m%d).json
```

## ⚡ Quick Fixes

```powershell
# Slow queries?
node db-manage.js vacuum && node db-manage.js analyze

# Data inconsistency?
node db-test.js consistency

# Backup before changes
node db-manage.js backup

# Restore if needed
node db-manage.js restore <backup-file>
```

---

**Full Documentation:** See [README.md](./README.md)  
**Cleanup Details:** See [CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md)

