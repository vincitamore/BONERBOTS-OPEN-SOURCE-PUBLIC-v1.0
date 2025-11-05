# BONERBOTS Arena Documentation

This directory contains all project documentation, implementation summaries, and development guides.

## 📚 **Documentation Structure**

### **Setup & Getting Started**
- **[QUICKSTART.md](./QUICKSTART.md)** - Quick setup guide to get running fast
- **[SETUP.md](./SETUP.md)** - Detailed setup instructions
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development workflows and best practices

### **Architecture & Implementation**
- **[ARCHITECTURAL_CLEANUP.md](./ARCHITECTURAL_CLEANUP.md)** ⭐ - Database-driven architecture guide (Nov 2025)
- **[IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)** - Planned features and roadmap
- **[REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md)** - Major refactoring changes
- **[AUTONOMOUS_TRADING_REFACTOR_SUMMARY.md](./AUTONOMOUS_TRADING_REFACTOR_SUMMARY.md)** - Server-side autonomous trading implementation

### **Feature Implementation Summaries**
- **[AVATAR_CONFIGURATION_SUMMARY.md](./AVATAR_CONFIGURATION_SUMMARY.md)** - Bot avatar system
- **[DECISION_HISTORY_FIX_SUMMARY.md](./DECISION_HISTORY_FIX_SUMMARY.md)** - Decision history improvements
- **[CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md)** - Previous cleanup operations

### **Chronospeculator Bot Documentation**
The Chronospeculator is our most advanced bot with multi-step analysis and mathematical sandbox capabilities:

- **[CHRONOSPECULATOR_ENHANCEMENT_PLAN.md](./CHRONOSPECULATOR_ENHANCEMENT_PLAN.md)** - Detailed enhancement specification (2,136 lines)
- **[CHRONOSPECULATOR_IMPLEMENTATION_SUMMARY.md](./CHRONOSPECULATOR_IMPLEMENTATION_SUMMARY.md)** - Implementation details
- **[CHRONOSPECULATOR_QUICK_REFERENCE.md](./CHRONOSPECULATOR_QUICK_REFERENCE.md)** - Quick reference guide
- **[CHRONOSPECULATOR_PERSONALITY.md](./CHRONOSPECULATOR_PERSONALITY.md)** - Character and narrative design
- **[TIME_TRAVELER_IMPLEMENTATION_SUMMARY.md](./TIME_TRAVELER_IMPLEMENTATION_SUMMARY.md)** - Original Time Traveler implementation

### **Examples & Guides**
- **[EXAMPLE_BOT_PROMPT_WITH_CONTEXT.md](./EXAMPLE_BOT_PROMPT_WITH_CONTEXT.md)** - Example of enhanced bot prompts with context

## 🔑 **Key Technical Decisions**

### **Architecture** ⭐ (Refactored Nov 2025)
- **Database-Driven**: SQLite is the **single source of truth** for all configuration
- **Server**: Node.js/Express - loads config from database, manages bots, broadcasts state
- **Frontend**: React + TypeScript + Tailwind CSS - **pure display layer**, no hardcoded config
- **Real-time**: WebSocket for live updates
- **AI Providers**: Grok (xAI) and Gemini (Google) support
- **Trading**: Paper trading (simulated) and live trading modes
- **Configuration**: All settings stored in database, editable via UI, hot-reloadable

### **Bot Prompts**
- **Location**: Bot prompts are stored in the database (`bots` table, `prompt` column)
- **Seeding**: Initial bot configurations are seeded via `server/scripts/seed_current_bots.js`
- **Editing**: Bots can be edited via the web UI at `/config/bots`
- **Legacy**: The old `prompts.ts` file has been removed (Nov 2025) - all prompts are now database-driven

### **Configuration Management** ⭐
- **System Settings**: `system_settings` table stores all application config
  - Bot initial balances (paper/live)
  - Turn intervals, refresh intervals
  - Trading symbols
- **No Hardcoded Values**: All legacy config files removed (Nov 2025)
  - ❌ `constants.ts` → Database `system_settings`
  - ❌ `walletAddresses.ts` → Database `wallets` table
  - ❌ `assets.ts` → Database `bots.avatar_image`
  - ❌ `leverageLimits.ts` → Server-side exchange handling
- **Frontend**: Receives all config from server via WebSocket

### **Chronospeculator Features**
- **Multi-step Analysis**: Up to 5 iterations per decision cycle
- **Mathematical Sandbox**: 18+ quantitative tools including RSI, MACD, Bollinger Bands, Kelly Criterion
- **Custom Equations**: Safe evaluation of arbitrary mathematical expressions
- **Simulation Framework**: Multi-equation models for advanced analysis
- **Hot Reload**: Configuration changes apply immediately without restart

## 🛠️ **Development**

For development instructions, see [DEVELOPMENT.md](./DEVELOPMENT.md).

For quick setup, see [QUICKSTART.md](./QUICKSTART.md).

## 📝 **Contributing**

When adding new features or making significant changes:
1. Update relevant documentation in this directory
2. Create an implementation summary if the change is substantial
3. Keep the main README.md updated with key features

---

*Last Updated: November 2025*

