# Multi-Tenant Bot Arena Implementation Plan

## Executive Summary
Transform BONERBOTS from a single-user local application into a secure, multi-tenant SaaS platform where users can compete in automated trading bot arenas with full data isolation, secure credential management, and admin oversight.

## Current State Analysis
- **Architecture**: Single-user, locally deployed
- **Database**: SQLite with no user isolation
- **Auth**: Basic broadcast password only
- **Deployment**: Local development server
- **Scope**: Personal trading bot experimentation

## Target State
- **Architecture**: Multi-tenant SaaS with row-level security
- **Database**: User-scoped data with encryption for sensitive fields
- **Auth**: Full user registration, JWT-based sessions, RBAC
- **Deployment**: Cloud-hosted with HTTPS
- **Scope**: Public bot arena with leaderboards and competitions

---

## Phase 1: Authentication & User Management (Foundation)

### 1.1 Database Schema - User Tables
**File**: `server/migrations/004_multi_tenant_users.sql`

```sql
-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    recovery_phrase_hash TEXT NOT NULL, -- Hashed 12-word recovery phrase
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin', 'moderator')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active INTEGER DEFAULT 1
);

-- User sessions (for refresh tokens)
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User profiles (extended info)
CREATE TABLE user_profiles (
    user_id TEXT PRIMARY KEY,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    country TEXT,
    timezone TEXT,
    preferences TEXT, -- JSON for UI preferences
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit log for security
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
```

### 1.2 Migrate Existing Tables for Multi-Tenancy
**File**: `server/migrations/005_add_user_foreign_keys.sql`

```sql
-- Add user_id to all user-specific tables
ALTER TABLE bots ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE providers ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE wallets ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE bot_metrics ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE bot_decisions ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE trade_history ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_bots_user ON bots(user_id);
CREATE INDEX idx_providers_user ON providers(user_id);
CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_bot_metrics_user ON bot_metrics(user_id);
CREATE INDEX idx_bot_decisions_user ON bot_decisions(user_id);
CREATE INDEX idx_trade_history_user ON trade_history(user_id);

-- System settings remain global (no user_id)
-- Admin can configure global defaults
```

### 1.3 Backend Auth Service
**File**: `server/services/authService.js`

**Key Functions**:
- `hashPassword(password)` - bcrypt with salt rounds 12
- `verifyPassword(password, hash)` - constant-time comparison
- `generateRecoveryPhrase()` - Generate 12-word BIP39 mnemonic phrase
- `hashRecoveryPhrase(phrase)` - bcrypt hash of recovery phrase
- `verifyRecoveryPhrase(phrase, hash)` - constant-time comparison
- `generateTokens(userId)` - JWT access (15min) + refresh (7 days)
- `verifyAccessToken(token)` - validate and decode JWT
- `refreshAccessToken(refreshToken)` - rotate tokens
- `createUser(username, password)` - registration, returns recovery phrase
- `authenticateUser(username, password)` - login
- `recoverAccount(username, recoveryPhrase)` - account recovery
- `resetPassword(username, recoveryPhrase, newPassword)` - password reset
- `revokeSession(sessionId)` - logout

**Dependencies**: `jsonwebtoken`, `bcryptjs`, `bip39` (for recovery phrases)

### 1.4 Auth Middleware
**File**: `server/middleware/auth.js` (enhance existing)

```javascript
// Verify JWT and attach user to request
const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const payload = authService.verifyAccessToken(token);
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Require admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Verify resource ownership
const requireOwnership = (resourceType) => async (req, res, next) => {
  // Check if req.params.id belongs to req.user.id
  // Implementation varies by resource
};
```

### 1.5 Auth Routes
**File**: `server/routes/auth.js`

**Endpoints**:
- `POST /api/auth/register` - Create account (returns recovery phrase)
- `POST /api/auth/login` - Authenticate with username/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Revoke session
- `GET /api/auth/me` - Current user info
- `PUT /api/auth/me` - Update profile
- `POST /api/auth/recover` - Verify recovery phrase
- `POST /api/auth/reset-password` - Reset password using recovery phrase
- `PUT /api/auth/password` - Change password (requires current password)

### 1.6 Update All Routes with Auth
**Files**: `server/routes/*.js`

Add `requireAuth` middleware to all routes:
```javascript
router.get('/api/bots', requireAuth, async (req, res) => {
  // Filter by req.user.id
  const bots = await db.all(
    'SELECT * FROM bots WHERE user_id = ?',
    [req.user.id]
  );
});
```

**Critical**: Every query must filter by `user_id` for tenant isolation.

---

## Phase 2: Frontend Authentication UI

### 2.1 Auth Context
**File**: `context/AuthContext.tsx`

```typescript
interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<string>; // Returns recovery phrase
  logout: () => Promise<void>;
  recoverAccount: (username: string, recoveryPhrase: string) => Promise<void>;
  resetPassword: (username: string, recoveryPhrase: string, newPassword: string) => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}
```

Store tokens in `localStorage`, handle token refresh automatically.

### 2.2 Login/Register Pages
**Files**:
- `pages/LoginPage.tsx` (enhance existing)
- `pages/RegisterPage.tsx` (new)
- `pages/RecoverAccountPage.tsx` (new)

**Register Flow**:
1. User enters username and password
2. On successful registration, **immediately display recovery phrase modal**
3. **Critical**: User MUST write down 12-word recovery phrase
4. Require user to confirm they've saved it (checkbox)
5. No way to recover account without this phrase

**Login UI**:
- Username/password fields
- Error handling
- "Forgot password?" link → Recovery page

**Recovery Page**:
- Username input
- 12-word recovery phrase input (textarea)
- Set new password
- Verify and login

### 2.3 Protected Routes
**File**: `App.tsx`

```typescript
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<Dashboard />} />
    <Route path="/bots" element={<BotsPage />} />
    <Route path="/account" element={<AccountSettingsPage />} />
    {/* ... other routes */}
  </Route>
  
  <Route element={<AdminRoute />}>
    <Route path="/admin" element={<AdminDashboard />} />
    <Route path="/admin/users" element={<UserManagement />} />
  </Route>
</Routes>
```

### 2.4 Account Settings Page
**File**: `pages/AccountSettingsPage.tsx`

**Tabs**:
1. **Profile** - Display name, bio, avatar, timezone
2. **Security** - Change password, 2FA (future), sessions
3. **Preferences** - UI theme, notifications, dashboard layout
4. **Danger Zone** - Delete account

---

## Phase 3: Admin Dashboard & Tools

### 3.1 Admin Routes
**File**: `server/routes/admin.js`

```javascript
router.get('/api/admin/users', requireAuth, requireAdmin, getUsers);
router.put('/api/admin/users/:id/role', requireAuth, requireAdmin, updateUserRole);
router.put('/api/admin/users/:id/status', requireAuth, requireAdmin, toggleUserStatus);
router.delete('/api/admin/users/:id', requireAuth, requireAdmin, deleteUser);
router.get('/api/admin/stats', requireAuth, requireAdmin, getSystemStats);
router.get('/api/admin/audit-log', requireAuth, requireAdmin, getAuditLog);
router.get('/api/admin/bots', requireAuth, requireAdmin, getAllBots);
router.put('/api/admin/system-settings', requireAuth, requireAdmin, updateSystemSettings);
```

### 3.2 Admin Dashboard
**File**: `pages/admin/AdminDashboard.tsx`

**Widgets**:
- Total users count
- Active bots count
- Total trades today
- System health metrics
- Recent registrations
- Top performing bots
- Error rate graphs

### 3.3 User Management Page
**File**: `pages/admin/UserManagementPage.tsx`

**Features**:
- User table (sortable, filterable)
- Search by email/username
- Role assignment (user/admin/moderator)
- Ban/suspend users
- View user's bots and activity
- Impersonate user (for support)

### 3.4 System Settings Page
**File**: `pages/admin/SystemSettingsPage.tsx`

Modify global `system_settings`:
- Default initial balances
- Trade intervals
- Symbol cooldowns
- Max bots per user
- Rate limits
- Feature flags

---

## Phase 4: Security Hardening

### 4.1 Credential Encryption
**File**: `server/utils/encryption.js` (enhance existing)

```javascript
// Encrypt sensitive fields before storing
const encryptCredential = (plaintext, userId) => {
  const key = deriveKey(process.env.MASTER_KEY, userId);
  return aes256.encrypt(plaintext, key);
};

// Decrypt when loading
const decryptCredential = (ciphertext, userId) => {
  const key = deriveKey(process.env.MASTER_KEY, userId);
  return aes256.decrypt(ciphertext, key);
};
```

**Apply to**:
- `providers.api_key` (LLM keys)
- `wallets.private_key` (exchange keys)
- All sensitive credentials

### 4.2 Rate Limiting
**File**: `server/middleware/rateLimit.js`

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per window
  skipSuccessfulRequests: true,
});
```

### 4.3 Input Validation Enhancement
**File**: `server/middleware/validation.js` (enhance)

Add schemas for all user inputs:
- Email validation (RFC 5322)
- Password strength requirements (min 12 chars, complexity)
- Username validation (alphanumeric + underscore)
- SQL injection prevention (already using parameterized queries)
- XSS prevention (sanitize all inputs)

### 4.4 Environment Variables
**File**: `.env.example`

```bash
# Authentication
JWT_SECRET=<generate-strong-secret>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Encryption
MASTER_ENCRYPTION_KEY=<generate-strong-key>

# Database
DATABASE_PATH=./data/arena.db

# Server
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=https://yourdomain.com

# Admin
INITIAL_ADMIN_EMAIL=admin@yourdomain.com
INITIAL_ADMIN_PASSWORD=<set-strong-password>
```

---

## Phase 5: BotManager Multi-Tenancy

### 5.1 Isolate Bot Instances by User
**File**: `server/services/BotManager.js`

**Changes**:
```javascript
class BotManager {
  constructor() {
    // Change from single bot map to user-scoped map
    this.botsByUser = new Map(); // userId -> Map<botId, botInstance>
  }

  async loadBotsForUser(userId) {
    const bots = await db.all('SELECT * FROM bots WHERE user_id = ?', [userId]);
    // Load user-specific providers, wallets, settings
  }

  startBotForUser(userId, botId) {
    // Ensure user owns bot
    // Start with user's credentials
  }

  getUserBotState(userId) {
    // Return only this user's bots
  }
}
```

### 5.2 Fair Scheduling
Ensure all users get fair execution time:
- Round-robin scheduling across users
- Prevent one user monopolizing CPU
- Resource quotas per user (max bots, max trades/day)

### 5.3 WebSocket User Channels
**File**: `server/websocket.js`

```javascript
// Authenticate WebSocket connection
wss.on('connection', async (ws, req) => {
  const token = extractTokenFromRequest(req);
  const user = await authService.verifyAccessToken(token);
  
  ws.userId = user.id;
  ws.role = user.role;
  
  // Subscribe to user-specific channel
  subscribeToUserChannel(ws, user.id);
});

// Broadcast only to specific user
const broadcastToUser = (userId, data) => {
  wss.clients.forEach(client => {
    if (client.userId === userId) {
      client.send(JSON.stringify(data));
    }
  });
};

// Admins can see all
const broadcastToAdmins = (data) => {
  wss.clients.forEach(client => {
    if (client.role === 'admin') {
      client.send(JSON.stringify(data));
    }
  });
};
```

---

## Phase 6: Arena & Leaderboard Features

### 6.1 Leaderboard Schema
**File**: `server/migrations/006_leaderboard.sql`

```sql
CREATE TABLE leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    bot_id TEXT NOT NULL,
    period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'
    total_pnl REAL DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    win_rate REAL DEFAULT 0,
    sharpe_ratio REAL,
    max_drawdown REAL,
    rank INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX idx_leaderboard_period_rank ON leaderboard(period, rank);
CREATE INDEX idx_leaderboard_user ON leaderboard(user_id);
```

### 6.2 Leaderboard Service
**File**: `server/services/leaderboardService.js`

**Functions**:
- `calculateRankings(period)` - Compute rankings for all active bots
- `getTopBots(period, limit)` - Get top N bots
- `getUserRank(userId, period)` - User's current rank
- `updateLeaderboard()` - Scheduled job (hourly/daily)

### 6.3 Leaderboard API Routes
**File**: `server/routes/leaderboard.js`

```javascript
router.get('/api/leaderboard/:period', getLeaderboard);
router.get('/api/leaderboard/user/:userId', getUserLeaderboardPosition);
router.get('/api/leaderboard/bot/:botId/history', getBotPerformanceHistory);
```

### 6.4 Leaderboard Page
**File**: `pages/LeaderboardPage.tsx`

**UI**:
- Tabbed interface (Daily/Weekly/Monthly/All-Time)
- Table with columns: Rank, User, Bot, P&L, Win Rate, Trades
- User's own position highlighted
- Bot comparison tool
- Performance charts

---

## Phase 7: Hosting & Deployment

### 7.1 Hosting Options Analysis

#### Option A: VPS (Recommended for MVP)
**Providers**: DigitalOcean, Linode, Vultr, Hetzner
- **Cost**: $6-12/month (2GB RAM, 1 CPU)
- **Pros**: Full control, cost-effective, simple
- **Cons**: Manual setup, you manage security/updates
- **Best for**: MVP, <100 users

#### Option B: Platform-as-a-Service
**Providers**: Railway, Render, Fly.io
- **Cost**: $5-20/month (hobby tier)
- **Pros**: Easy deployment, auto-scaling, SSL included
- **Cons**: Higher cost at scale, vendor lock-in
- **Best for**: Quick launch, 100-1000 users

#### Option C: Cloud (AWS/GCP/Azure)
- **Cost**: $20-50/month (EC2 t3.small or equivalent)
- **Pros**: Scalable, enterprise features, global CDN
- **Cons**: Complex, expensive, steep learning curve
- **Best for**: >1000 users, enterprise needs

**RECOMMENDATION**: Start with **Railway.app** or **Render.com** for MVP:
- Deploy in <30 minutes
- Automatic HTTPS
- GitHub integration for CI/CD
- SQLite works fine for <10,000 users
- Upgrade path to PostgreSQL when needed

### 7.2 Dockerfile (Production-Ready)
**File**: `Dockerfile` (enhance existing)

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
COPY server/package.json server/pnpm-lock.yaml ./server/
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Build frontend
COPY . .
RUN pnpm run build

# Production image
FROM node:18-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy server
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist

# Install production dependencies only
WORKDIR /app/server
RUN pnpm install --prod --frozen-lockfile

# Create data directory
RUN mkdir -p /app/server/data

EXPOSE 3001

CMD ["node", "server.js"]
```

### 7.3 Railway Deployment
**File**: `railway.json`

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

**Steps**:
1. Push code to GitHub
2. Connect Railway to repo
3. Set environment variables in Railway dashboard
4. Deploy (automatic from `main` branch)
5. Custom domain: `arena.yourdomain.com`

### 7.4 Database Migration Strategy
**File**: `server/scripts/migrate.js`

```javascript
// Run migrations on startup
const migrations = [
  '001_initial_schema.sql',
  '002_relational_schema.sql',
  '003_add_bot_avatars.sql',
  '004_multi_tenant_users.sql',
  '005_add_user_foreign_keys.sql',
  '006_leaderboard.sql'
];

async function runMigrations() {
  const appliedMigrations = await db.all('SELECT * FROM migrations');
  const applied = new Set(appliedMigrations.map(m => m.name));
  
  for (const migration of migrations) {
    if (!applied.has(migration)) {
      console.log(`Running migration: ${migration}`);
      const sql = fs.readFileSync(`./migrations/${migration}`, 'utf8');
      await db.exec(sql);
      await db.run('INSERT INTO migrations (name) VALUES (?)', [migration]);
    }
  }
}
```

### 7.5 Backup Strategy
**File**: `server/scripts/backup.js`

```javascript
// Daily automated backups
const cron = require('node-cron');

// Every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const backupPath = `./data/backups/arena_${timestamp}.db`;
  
  await fs.copyFile('./data/arena.db', backupPath);
  
  // Upload to S3/R2/Backblaze (optional)
  await uploadToCloud(backupPath);
  
  // Keep last 30 days only
  await cleanOldBackups(30);
});
```

---

## Phase 8: Migration Script for Existing Data

### 8.1 Create Default Admin User
**File**: `server/scripts/create_default_admin.js`

```javascript
// Run once to create first admin from existing setup
const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@localhost';
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe123!';
const adminUsername = 'admin';

const userId = generateUUID();
const passwordHash = await authService.hashPassword(adminPassword);

await db.run(`
  INSERT INTO users (id, email, username, password_hash, role, email_verified)
  VALUES (?, ?, ?, ?, 'admin', 1)
`, [userId, adminEmail, adminUsername, passwordHash]);

console.log(`✅ Admin user created: ${adminEmail}`);
console.log(`⚠️  Change password immediately after first login!`);
```

### 8.2 Assign Existing Data to Admin
**File**: `server/scripts/assign_to_admin.js`

```javascript
// Assign all existing bots, wallets, providers to admin user
const adminUser = await db.get('SELECT id FROM users WHERE role = "admin" LIMIT 1');

await db.run('UPDATE bots SET user_id = ?', [adminUser.id]);
await db.run('UPDATE providers SET user_id = ?', [adminUser.id]);
await db.run('UPDATE wallets SET user_id = ?', [adminUser.id]);
await db.run('UPDATE bot_metrics SET user_id = ?', [adminUser.id]);
await db.run('UPDATE bot_decisions SET user_id = ?', [adminUser.id]);
await db.run('UPDATE trade_history SET user_id = ?', [adminUser.id]);

console.log('✅ All existing data assigned to admin user');
```

---

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Database migrations (004, 005)
- [ ] Auth service and middleware
- [ ] Auth routes (register, login, logout, refresh)
- [ ] Update all existing routes with auth
- [ ] Create default admin script

### Week 3: Frontend Auth
- [ ] Auth context and token management
- [ ] Login/Register pages
- [ ] Protected routes
- [ ] Account settings page

### Week 4: Multi-Tenancy
- [ ] BotManager user isolation
- [ ] WebSocket user channels
- [ ] Test data isolation thoroughly
- [ ] Credential encryption

### Week 5: Admin Tools
- [ ] Admin routes
- [ ] Admin dashboard
- [ ] User management page
- [ ] System settings page

### Week 6: Leaderboard
- [ ] Leaderboard schema (006)
- [ ] Leaderboard service
- [ ] Leaderboard API
- [ ] Leaderboard page UI

### Week 7: Security & Polish
- [ ] Rate limiting
- [ ] Input validation enhancement
- [ ] Security audit
- [ ] Error handling and logging

### Week 8: Deployment
- [ ] Production Dockerfile
- [ ] Railway/Render setup
- [ ] Environment configuration
- [ ] Backup automation
- [ ] Monitoring setup

---

## Security Checklist

### Critical Requirements
- [ ] All passwords hashed with bcrypt (salt rounds ≥12)
- [ ] All recovery phrases hashed with bcrypt (never stored plain)
- [ ] All sensitive credentials encrypted at rest
- [ ] JWT secrets stored in environment variables (not committed)
- [ ] HTTPS enforced in production
- [ ] Rate limiting on all endpoints (strict on auth endpoints)
- [ ] SQL injection prevention (parameterized queries everywhere)
- [ ] XSS prevention (sanitize all user inputs)
- [ ] CORS properly configured
- [ ] Session expiration and refresh tokens
- [ ] Audit logging for sensitive operations
- [ ] Row-level security (every query filters by user_id)
- [ ] Admin actions logged
- [ ] Recovery phrase shown ONCE on registration with confirmation
- [ ] Account lockout after failed logins (5 attempts)
- [ ] Rate limit recovery attempts (prevent brute force)
- [ ] 2FA support (future enhancement)

---

## Cost Estimation

### MVP (0-100 users)
- **Hosting**: Railway/Render - $5-10/month
- **Domain**: $12/year (optional)
- **Backups**: Backblaze B2 - $0.005/GB/month
- **Total**: ~$10/month

### Growth (100-1000 users)
- **Hosting**: Railway/Render Pro - $20-30/month
- **Database**: Upgrade to PostgreSQL (included)
- **CDN**: Cloudflare Free tier
- **Monitoring**: Sentry free tier
- **Total**: ~$30-40/month

### Scale (1000+ users)
- **Hosting**: AWS/GCP with auto-scaling - $100-500/month
- **Database**: Managed PostgreSQL - $30-100/month
- **CDN**: Cloudflare Pro - $20/month
- **Monitoring**: Datadog - $15/month
- **Total**: ~$200-700/month

---

## Testing Strategy

### Unit Tests
- Auth service (password hashing, JWT generation)
- Encryption utilities
- Database queries (user isolation)

### Integration Tests
- Full auth flow (register, login, refresh, logout)
- Protected routes return 401 without token
- Users can only access their own data
- Admin can access all data

### Security Tests
- SQL injection attempts
- XSS attempts
- CSRF attempts
- Rate limiting enforcement
- Token expiration and refresh

### Load Tests
- 100 concurrent users
- Bot execution fairness
- WebSocket connection limits

---

## Rollout Strategy

### Phase 1: Private Beta (Week 1-4)
- Admin-only access
- Manual user creation
- Test all features thoroughly
- Fix critical bugs

### Phase 2: Invite-Only Beta (Week 5-8)
- Open registration with invite codes
- Monitor performance and errors
- Gather user feedback
- Refine UI/UX

### Phase 3: Public Launch (Week 9+)
- Open registration
- Marketing push
- Leaderboard competitions
- Community building

---

## Open Questions & Decisions Needed

1. **Database Migration**: When to move from SQLite to PostgreSQL?
   - SQLite: Good for <10k users with proper indexing
   - PostgreSQL: Better for >10k users, better concurrency
   - Recommendation: Start with SQLite, migrate when needed

2. **Payment**: Will you charge users?
   - If yes: Stripe integration needed
   - If no: How to monetize and cover costs?

3. **Bot Limits**: Max bots per user?
   - Free tier: 3 bots
   - Paid tier: Unlimited
   - Recommendation: Start with 5 bots/user, no payment

4. **Arena Competitions**: Prize pools or just bragging rights?
   - Real money prizes require legal compliance
   - Virtual prizes (badges, titles) easier to implement

5. **Data Retention**: How long to keep inactive accounts?
   - GDPR compliance: Allow user data deletion
   - Recommendation: 90 days inactivity warning, 120 days deletion
   
6. **HTTPS Support**: Backend needs HTTPS for production deployment
   - Current: HTTP-only Express server
   - Options: Reverse proxy (nginx/caddy), native HTTPS in Express, or platform-provided SSL
   - Recommendation: Use Railway/Render which provides automatic HTTPS

---

## Next Steps

1. **Review this plan** and confirm approach
2. **Set up development environment** with new branches
3. **Start Phase 1** - Database migrations and auth backend
4. **Create test users** and verify isolation
5. **Build auth UI** in parallel with backend
6. **Deploy to staging** for testing
7. **Security audit** before public launch

---

## Files to Create

### Backend (15 files)
- `server/migrations/004_multi_tenant_users.sql`
- `server/migrations/005_add_user_foreign_keys.sql`
- `server/migrations/006_leaderboard.sql`
- `server/services/authService.js`
- `server/routes/auth.js`
- `server/routes/admin.js`
- `server/routes/leaderboard.js`
- `server/services/leaderboardService.js`
- `server/middleware/rateLimit.js`
- `server/scripts/migrate.js`
- `server/scripts/create_default_admin.js`
- `server/scripts/assign_to_admin.js`
- `server/scripts/backup.js`
- `.env.example`
- `railway.json`

### Frontend (10 files)
- `context/AuthContext.tsx`
- `pages/RegisterPage.tsx`
- `pages/AccountSettingsPage.tsx`
- `pages/admin/AdminDashboard.tsx`
- `pages/admin/UserManagementPage.tsx`
- `pages/admin/SystemSettingsPage.tsx`
- `pages/LeaderboardPage.tsx`
- `components/ProtectedRoute.tsx`
- `components/AdminRoute.tsx`
- `hooks/useAuth.ts`

### Documentation (2 files)
- `docs/API_AUTHENTICATION.md`
- `docs/DEPLOYMENT_GUIDE.md`

**Total**: 27 new files + modifications to 20+ existing files

---

## Success Metrics

- [ ] Users can register and login securely
- [ ] Zero data leakage between users
- [ ] All credentials encrypted at rest
- [ ] Admin can manage users and system
- [ ] Leaderboard updates in real-time
- [ ] Deployment completes in <10 minutes
- [ ] 99.9% uptime
- [ ] Sub-second API response times
- [ ] All security tests pass

Ready to begin implementation! 🚀

