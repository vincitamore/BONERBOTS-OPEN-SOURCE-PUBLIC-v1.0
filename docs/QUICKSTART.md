# BONERBOTS AI Arena - Quick Start Guide

**Version:** 2.0 (Configuration System)  
**Status:** Production Ready  
**Date:** 2025-11-04

---

## 🎉 Congratulations!

Your BONERBOTS AI Arena has been successfully upgraded with a **complete configuration system**. You can now manage everything through a beautiful web interface—no code changes required!

---

## 🚀 Getting Started (5 Minutes)

### Step 1: Start the Application

Open **two terminal windows**:

**Terminal 1 - Backend Server:**
```bash
cd server
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### Step 2: Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

You'll see a modern dashboard with navigation for:
- **Dashboard** - Live trading view
- **Analytics** - Performance metrics and historical analysis
- **Bots** - Manage your trading bots
- **AI Providers** - Configure AI models
- **API Keys** - Manage exchange credentials
- **Settings** - Global configuration

### Step 3: Login

Default credentials:
```
Username: admin
Password: admin123
```

⚠️ **IMPORTANT**: Change this password immediately after first login!

---

## 📝 Create Your First Bot (2 Minutes)

### 1. Configure an AI Provider (If Needed)

Navigate to **AI Providers** → Click **"Add Provider"**

Example configuration:
```
Name: My Gemini Provider
Type: gemini
API Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
API Key: [your-gemini-api-key]
```

Click **"Test"** to verify, then **"Save"**.

### 2. Create a Bot

Navigate to **Bots** → Click **"Create New Bot"**

Fill in the form:
```
Bot ID: aggressive_trader
Bot Name: Aggressive Day Trader
Trading Mode: Paper Trading (recommended for testing)
AI Provider: My Gemini Provider
```

### 3. Write Your Trading Prompt

In the Monaco editor, write a prompt like:
```
You are an aggressive day trader focused on capturing short-term momentum.

Trading Philosophy:
- Look for strong directional moves (>2% in 15 minutes)
- Take quick profits (1-2% targets)
- Use tight stop losses (0.5-1%)
- Maximum 3x leverage

Decision Making:
- Enter LONG when: Strong upward momentum, RSI crossing above 50, increasing volume
- Enter SHORT when: Strong downward momentum, RSI crossing below 50, volume spike
- Exit when: Target hit OR stop loss triggered OR momentum reverses

Risk Management:
- Never risk more than 5% of capital on a single trade
- Maximum 3 open positions at once
- Close all positions if total PnL drops below -10%
```

Click **"Create Bot"** → Your bot is now active!

---

## 🔑 Add Exchange Credentials (Optional - For Live Trading)

**⚠️ Only for live trading with real funds**

Navigate to **API Keys** → Click **"Add Credentials"**

```
Bot: [Select your bot]
Exchange: asterdex (or your exchange)
API Key: [your-exchange-api-key]
API Secret: [your-exchange-api-secret]
```

All credentials are encrypted with AES-256-GCM before storage.

---

## ⚙️ Adjust Global Settings

Navigate to **Settings** to configure:

- **Initial Balances** - Starting funds for paper/live bots
- **Turn Interval** - How often bots make decisions (default: 5 minutes)
- **Trading Symbols** - Which crypto pairs to trade
- **Position Limits** - Max positions per bot
- **Trading Size** - Minimum trade size

---

## 📊 Monitor Your Bots

### Dashboard View

The main dashboard shows:
- Live market data
- Active bot positions

### Analytics Dashboard 

Navigate to **Analytics** to see:
- **Performance Overview** - Total P&L, win rate, Sharpe ratio
- **Bot Comparison** - Side-by-side performance charts
- **Trade Distribution** - Visual breakdown by bot
- **Time Range Filters** - View 24h, 7d, 30d, or all time

Click on any bot card to view detailed analytics:
- Portfolio value over time
- Drawdown chart
- Full trade history
- Win/loss distribution
- Best/worst trades
- Risk metrics
- Real-time PnL tracking
- Recent trades and decisions

### Bot Management

From the **Bots** page you can:
- ✅ **Pause/Resume** - Stop/start trading without deleting the bot
- 🔄 **Reset** - Reset paper trading bots to initial balance
- ✏️ **Edit** - Modify bot configuration, prompt, or AI provider
- 🗑️ **Delete** - Permanently remove a bot

---

## 🎯 What You Get

### Zero-Code Configuration
- Create unlimited bots through UI
- No more editing code files
- Real-time validation and error messages
- Professional Monaco code editor for prompts

### Secure Credential Management
- All API keys encrypted at rest
- Test provider connections before saving
- Per-bot wallet management
- Secure password input with show/hide

### Flexible AI Integration
- Support for multiple providers simultaneously
- Easily switch providers per bot
- Test connections with one click
- Configure custom endpoints

### Professional Experience
- Modern, dark-themed interface
- Responsive design
- Loading states and error handling
- Confirmation dialogs for destructive actions

---

## 🗄️ Database Structure

Your data is now stored in a **professional relational database** with:

- **11 tables** for normalized data
- **27 indexes** for fast queries
- **Foreign key constraints** for data integrity
- **Automatic backups** before migrations
- **Full audit trail** of all changes

Database location: `data/arena.db`  
Backups: `data/backups/`

---

## 🔧 Configuration Files

### Backend Configuration

Edit `server/.env`:
```env
# Required for production
ENCRYPTION_KEY=your-32+-character-random-string
JWT_SECRET=your-jwt-secret-random-string

# API Keys (if not managing through UI)
GEMINI_API_KEY=your-key
XAI_API_KEY=your-key
ASTERDEX_API_KEY_BOT1=your-key
```

### System Settings

All configurable through UI at `/config/settings`:
- Trading parameters
- Timing intervals
- Limits and constraints
- Security settings

---

## 🆘 Troubleshooting

### Bot Not Trading

1. **Check bot is not paused** - Look for "Paused" badge on Bots page
2. **Verify AI provider is active** - Test connection in AI Providers page
3. **Check turn interval** - May need to wait for next decision cycle
4. **Review trading mode** - Paper trading doesn't require exchange credentials

### Database Issues

```bash
# Verify migration status
cd server
node scripts/verify_migration.js

# Rollback if needed (restore from backup)
node scripts/rollback_migration.js
```

### API Connection Issues

1. **Test provider connection** - Use "Test" button in AI Providers page
2. **Check API keys** - Ensure keys are valid and have proper permissions
3. **Review network** - Check firewall/proxy settings

---

## 📖 Next Steps

### Phase 4: Analytics (Coming Soon)

Future updates will include:
- Historical performance dashboards
- Bot comparison tools
- Advanced charting
- Risk metrics visualization
- Data export (CSV, JSON, PDF)

### Phase 5: Security & Polish

- Full authentication system
- Role-based access control
- Enhanced error handling
- Performance optimizations
- Comprehensive testing

---

## 💡 Tips & Best Practices

### For Testing
1. **Start with paper trading** - Test strategies without risk
2. **Small position sizes** - Start conservative
3. **Monitor closely** - Watch your bots for the first few hours
4. **Test prompts** - Iterate on your trading strategies

### For Production
1. **Use strong encryption keys** - Set ENCRYPTION_KEY in .env
2. **Backup regularly** - Database backups are automatic but external backups are good
3. **Monitor performance** - Track bot metrics and adjust
4. **Start with one bot** - Scale up gradually

### Security
1. **Keep API keys secure** - Never commit them to version control
2. **Use read-only keys** - When possible, for monitoring bots
3. **Enable 2FA** - On exchange accounts
4. **Regular audits** - Review audit logs in database

---

## 📞 Need Help?

### Resources
- **Implementation Roadmap**: `IMPLEMENTATION_ROADMAP.md`
- **Phase 3 Summary**: `PHASE_3_COMPLETE.md`
- **Setup Guide**: `SETUP.md`

### Common Issues
- Database path issues → All scripts now use correct `data/arena.db` path
- Missing dependencies → Run `npm install` in both root and server directories
- Port conflicts → Ensure ports 3000 (backend) and 5173 (frontend) are available

---

## 🎊 Enjoy Your Trading Platform!

You now have a **professional, production-ready trading platform** with:
- ✅ Zero-code bot configuration
- ✅ Secure credential management
- ✅ Multiple AI provider support
- ✅ Real-time monitoring
- ✅ Professional UI/UX

**Happy Trading!** 🚀📈

