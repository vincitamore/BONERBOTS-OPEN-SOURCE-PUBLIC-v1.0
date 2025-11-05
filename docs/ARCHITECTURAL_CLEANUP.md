# Architectural Cleanup Plan - November 5, 2025

## 🎯 **Goal: Database-Driven Architecture**

Remove all hardcoded configuration from frontend and use database as single source of truth.

## 📊 **Current Architecture Issues**

### **Problem: Duplicate Configuration**

The application has **duplicate configuration** in multiple places:

1. **Frontend Files** (hardcoded)
   - `constants.ts` - Bot balances, intervals, trading symbols
   - `walletAddresses.ts` - Wallet addresses
   - `assets.ts` - Bot avatar images
   - `leverageLimits.ts` - Exchange leverage limits

2. **Database Tables** (authoritative)
   - `system_settings` - Application configuration
   - `wallets` - Wallet data
   - `bots` - Bot configuration including avatars

3. **Server** (uses database)
   - `BotManager.js` loads settings from database
   - All trading logic uses database values

### **The Problem**

- Frontend uses **hardcoded values** that can drift from database
- Changing configuration requires updating multiple files
- Risk of inconsistency between frontend display and server behavior
- Not professionally architected

## ✅ **Solution: Single Source of Truth**

### **Architectural Principle**
> **Database is the ONLY source of configuration truth**  
> Frontend is a **passive viewer** that displays server-provided state

### **Data Flow**
```
Database → Server (BotManager) → WebSocket → Frontend (Display)
```

## 🗑️ **Files to Delete**

### **1. `leverageLimits.ts`** ❌
- **Status**: NOT USED anywhere in codebase
- **Reason**: Server handles exchange limits internally
- **Action**: DELETE

### **2. `walletAddresses.ts`** ❌  
- **Current**: Hardcoded map of bot names → wallet addresses
- **Used in**: `InfoPane.tsx` (1 file)
- **Database**: `wallets` table stores wallet_address per bot
- **Action**: DELETE + Update InfoPane to use database data

### **3. `constants.ts`** ❌
- **Current**: Hardcoded balances, intervals, symbols
- **Used in**: `useTradingBot.ts`, `Dashboard.tsx`, `SpectatorDashboard.tsx` (3 files)
- **Database**: `system_settings` table stores all these values
- **Action**: DELETE + Update components to use server-provided values

### **4. `assets.ts`** ❌
- **Current**: Hardcoded map of bot names → robot image URLs
- **Used in**: `BotCard.tsx` (1 file) - already has fallback to `avatarUrl` from database
- **Database**: `bots.avatar_image` field
- **Action**: DELETE + Update BotCard (already mostly done)

## ✅ **Files to Keep**

### **`config.ts`** ✅
- **Purpose**: Environment-specific API/WebSocket URLs
- **Reason**: Frontend needs to know WHERE to connect (not business logic)
- **Valid Use**: Configuration for deployment environments

## 🔧 **Refactoring Required**

### **1. Server: Add Initial Balance to Bot State**

**File**: `server/services/BotManager.js`

Bot state should include `initialBalance` so frontend can calculate PnL%:

```javascript
botState = {
  id: config.id,
  name: config.name,
  // ... other fields
  initialBalance: config.trading_mode === 'real' 
    ? this.settings.live_bot_initial_balance 
    : this.settings.paper_bot_initial_balance
};
```

### **2. Frontend: Remove Constants Usage**

**Files to Update**:
- `hooks/useTradingBot.ts` - Use bot.initialBalance from server
- `components/Dashboard.tsx` - Remove constants import
- `components/SpectatorDashboard.tsx` - Remove constants import
- `components/BotCard.tsx` - Remove assets import (use avatarUrl)
- `components/InfoPane.tsx` - Remove walletAddresses (fetch from server)

### **3. Add Wallet API Endpoint** (if showing wallet addresses)

**File**: `server/routes/wallets.js` (already exists)

Endpoint should allow fetching wallet address for a bot:
```
GET /api/v2/wallets?bot_id=bot_degen
```

## 📝 **Implementation Steps**

### **Phase 1: Server Enhancements**
1. ✅ Add `initialBalance` to bot state in BotManager
2. ✅ Ensure wallet API endpoint is accessible (already exists)

### **Phase 2: Frontend Refactor**
1. Update `useTradingBot.ts` to use `bot.initialBalance`
2. Update `BotCard.tsx` to remove `assets.ts` dependency
3. Update `InfoPane.tsx` to fetch wallet from API or hide if not live trading
4. Update `Dashboard.tsx` to remove constants
5. Update `SpectatorDashboard.tsx` to remove constants

### **Phase 3: Cleanup**
1. Delete `leverageLimits.ts`
2. Delete `walletAddresses.ts`
3. Delete `constants.ts`
4. Delete `assets.ts`
5. Update documentation

## 🎯 **Expected Result**

### **Before**
```
Frontend: Hardcoded configs in 4 files
Database: Authoritative configs
Problem: Potential drift, manual sync required
```

### **After**
```
Frontend: Pure display layer, uses server data
Database: Single source of truth
Server: Loads from database, sends to frontend
Result: Consistent, maintainable, professional
```

## 🏗️ **Architecture Best Practices**

### **✅ What Frontend Should Do**
- Display data provided by server
- Handle user interactions
- Send commands to server API
- Connect to WebSocket for real-time updates

### **❌ What Frontend Should NOT Do**
- Store business configuration
- Duplicate database values
- Make trading decisions
- Calculate complex business logic

### **✅ What Server Should Do**
- Load configuration from database
- Execute trading logic
- Manage bot state
- Broadcast updates to frontend

### **✅ What Database Should Do**
- Store ALL configuration
- Store ALL business data
- Be the single source of truth

## 📊 **Configuration Management**

### **For Developers**
- Edit configuration via web UI: `/config/settings`
- Configuration changes hot-reload automatically
- No code changes required for config updates

### **For Deployment**
- Only environment variables needed: `VITE_API_URL`, `VITE_WS_URL`
- All business config in database
- Database can be backed up/restored
- Easy to manage multiple environments

## 🎉 **Benefits**

1. **Single Source of Truth** - Database is authoritative
2. **No Configuration Drift** - Frontend always shows current values
3. **Hot Configuration** - Change settings without code deploy
4. **Professional Architecture** - Clean separation of concerns
5. **Easier Maintenance** - One place to update configuration
6. **Better Testing** - Can test with different configs easily
7. **Multi-Environment** - Same code, different databases

---

*Next Step: Execute Phase 1 - Server enhancements*

