# BONERBOTS Multi-Tenant Arena - Deployment Guide

This guide covers deploying the BONERBOTS trading bot arena to production environments. The application is a full-stack Node.js/React app with WebSocket support and SQLite database.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Railway Deployment](#railway-deployment)
4. [Render Deployment](#render-deployment)
5. [VPS/Self-Hosted Deployment](#vpsself-hosted-deployment)
6. [Database Management](#database-management)
7. [Post-Deployment Setup](#post-deployment-setup)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts
- **Binance Account** (for trading API access)
- **LLM Provider Account** (OpenAI, Anthropic, or Groq)
- **Deployment Platform** (Railway, Render, or VPS)

### Local Requirements
- Node.js 18+ and pnpm
- Git

---

## Environment Variables

Create a `.env` file in the `server/` directory with the following variables:

```bash
# ============================================================================
# SECURITY (CRITICAL - Generate unique values for production!)
# ============================================================================
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
MASTER_ENCRYPTION_KEY=your-32-byte-hex-encryption-key-change-this

# ============================================================================
# DATABASE
# ============================================================================
DATABASE_PATH=../data/arena.db

# ============================================================================
# SERVER
# ============================================================================
PORT=3001
NODE_ENV=production

# ============================================================================
# JWT CONFIGURATION
# ============================================================================
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# ============================================================================
# RATE LIMITING
# ============================================================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=5

# ============================================================================
# OPTIONAL: CORS Configuration
# ============================================================================
# CORS_ORIGIN=https://yourdomain.com
```

### Generating Secure Keys

```bash
# Generate JWT_SECRET (64 random characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate MASTER_ENCRYPTION_KEY (32 bytes as hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**⚠️ CRITICAL**: Never commit `.env` files to git. Always use platform-specific environment variable management in production.

---

## Railway Deployment

Railway is the recommended platform for easy deployment with automatic builds and SSL.

### Step 1: Prepare Your Repository

1. Ensure your code is pushed to GitHub:
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

2. Verify `railway.json` exists in the root:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Step 2: Create Railway Project

1. Go to [Railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will auto-detect the configuration

### Step 3: Configure Environment Variables

In the Railway dashboard:

1. Navigate to your project → **Variables** tab
2. Add all environment variables from the `.env` template above
3. **Critical variables to set:**
   - `JWT_SECRET` - Generate using the command above
   - `MASTER_ENCRYPTION_KEY` - Generate using the command above
   - `NODE_ENV=production`
   - `PORT=3001`
   - `DATABASE_PATH=/app/data/arena.db`

### Step 4: Configure Persistent Storage

SQLite requires persistent storage for the database:

1. Go to **Settings** → **Volumes**
2. Click **"Add Volume"**
3. Configure:
   - **Mount Path**: `/app/data`
   - **Size**: 1GB (or more depending on needs)

### Step 5: Deploy

1. Railway will automatically build and deploy
2. Monitor the **Deployments** tab for build logs
3. Once deployed, you'll get a URL like `https://your-app.railway.app`

### Step 6: Run Migrations

After first deployment, run migrations via Railway CLI or web terminal:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run node server/scripts/run_migrations.js
```

---

## Render Deployment

Render is another great option with free tier support.

### Step 1: Create Render Account

1. Go to [Render.com](https://render.com) and sign up
2. Connect your GitHub account

### Step 2: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your repository
3. Configure:
   - **Name**: `bonerbots-arena`
   - **Environment**: `Node`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `cd server && node server.js`
   - **Plan**: Select appropriate plan (Starter or higher)

### Step 3: Environment Variables

Add all variables from the environment template:

1. Scroll to **Environment Variables**
2. Add each variable individually
3. Use **Secret File** for sensitive values

### Step 4: Add Disk Storage

SQLite requires persistent disk:

1. Scroll to **Disk**
2. Click **"Add Disk"**
3. Configure:
   - **Name**: `data`
   - **Mount Path**: `/opt/render/project/src/data`
   - **Size**: 1GB

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will build and deploy automatically
3. Access via the provided URL

### Step 6: Run Migrations

Use Render Shell to run migrations:

1. Go to your service → **Shell** tab
2. Run:
```bash
cd server
node scripts/run_migrations.js
```

---

## VPS/Self-Hosted Deployment

For maximum control, deploy to your own VPS (DigitalOcean, Linode, AWS EC2, etc.).

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2 for process management
npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Clone and Build

```bash
# Create app directory
sudo mkdir -p /var/www/bonerbots
sudo chown $USER:$USER /var/www/bonerbots
cd /var/www/bonerbots

# Clone repository
git clone https://github.com/yourusername/bonerbots.git .

# Install dependencies
pnpm install

# Build frontend
pnpm run build

# Create data directory
mkdir -p data/backups

# Set up environment
cp server/.env.example server/.env
nano server/.env  # Edit with your values
```

### Step 3: Run Migrations

```bash
cd server
node scripts/run_migrations.js
```

### Step 4: Configure PM2

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'bonerbots',
    cwd: '/var/www/bonerbots/server',
    script: 'server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/www/bonerbots/logs/error.log',
    out_file: '/var/www/bonerbots/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

Start the application:

```bash
# Create logs directory
mkdir -p /var/www/bonerbots/logs

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

### Step 5: Configure Nginx

Create `/etc/nginx/sites-available/bonerbots`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend static files
    root /var/www/bonerbots/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # Single Page Application routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/bonerbots /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Set Up SSL

```bash
sudo certbot --nginx -d yourdomain.com
sudo systemctl restart nginx
```

### Step 7: Set Up Automatic Updates

Create deployment script `/var/www/bonerbots/deploy.sh`:

```bash
#!/bin/bash
cd /var/www/bonerbots

# Pull latest changes
git pull origin main

# Install dependencies
pnpm install

# Build frontend
pnpm run build

# Run migrations
cd server
node scripts/run_migrations.js

# Restart application
pm2 restart bonerbots

echo "Deployment complete!"
```

Make it executable:

```bash
chmod +x /var/www/bonerbots/deploy.sh
```

---

## Database Management

### Backups

The application includes automatic daily backups (see `server/scripts/backup.js`). Backups are stored in `data/backups/`.

**Manual backup:**

```bash
# Local
cp data/arena.db data/arena-backup-$(date +%Y%m%d).db

# VPS
sudo -u www-data cp /var/www/bonerbots/data/arena.db \
  /var/www/bonerbots/data/backups/arena-$(date +%Y%m%d).db
```

### Migrations

To run migrations after updates:

```bash
node server/scripts/run_migrations.js
```

### Database Inspection

```bash
# Install sqlite3
npm install -g sqlite3

# Open database
sqlite3 data/arena.db

# Useful commands
.tables                 # List all tables
.schema users          # Show table schema
SELECT * FROM users;   # Query data
.quit                  # Exit
```

---

## Post-Deployment Setup

### 1. Create Admin Account

Visit your deployed URL and register the first account:

1. Go to `/register`
2. Create an account (first user is automatically admin)
3. **SAVE YOUR RECOVERY PHRASE** - critical for account recovery

### 2. Configure System Settings

1. Log in as admin
2. Navigate to **Admin** → **System Settings**
3. Configure:
   - **Trading Symbols**: Select which trading pairs to enable
   - **Paper Bot Initial Balance**: Default balance for new bots
   - **Risk Management**: Max leverage, position size limits
   - **Turn Interval**: How often bots make decisions

### 3. Add LLM Provider

1. Go to **Configuration** → **Providers**
2. Add your LLM provider (OpenAI, Anthropic, or Groq)
3. Enter API key and configure settings

### 4. Add Binance Wallet

1. Go to **Configuration** → **Wallets**
2. Add Binance wallet with:
   - API Key
   - API Secret
   - Enable testnet for paper trading

### 5. Create First Bot

1. Go to **Configuration** → **Bots**
2. Create a bot with:
   - Unique name
   - Select LLM provider
   - Trading mode (paper/real)
   - Risk tolerance
   - Trading symbols (optional per-bot override)

---

## Monitoring & Maintenance

### Application Logs

**Railway/Render:**
- Check platform dashboard logs

**VPS:**
```bash
# View PM2 logs
pm2 logs bonerbots

# View error logs only
pm2 logs bonerbots --err

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Health Checks

The application exposes a health endpoint:

```bash
curl https://yourdomain.com/api/v2/health
```

### Database Size Monitoring

```bash
# Check database size
du -h data/arena.db

# Check number of snapshots (should be limited by cleanup job)
sqlite3 data/arena.db "SELECT COUNT(*) FROM bot_state_snapshots;"
```

### PM2 Monitoring (VPS only)

```bash
# View application status
pm2 status

# View detailed metrics
pm2 monit

# Restart if needed
pm2 restart bonerbots

# View logs
pm2 logs bonerbots
```

---

## Troubleshooting

### Issue: WebSocket connection fails

**Solution:**
- Ensure WebSocket upgrade headers are configured in proxy
- Check firewall allows WebSocket connections
- Verify CORS settings if cross-domain

### Issue: Database locked errors

**Solution:**
- Ensure only one instance is running
- Check disk space
- Restart application

### Issue: Authentication tokens invalid

**Solution:**
- Verify `JWT_SECRET` hasn't changed
- Check token expiration settings
- Clear browser localStorage and re-login

### Issue: Bots not executing trades

**Solution:**
- Check bot is not paused
- Verify LLM provider API key is valid
- Check Binance wallet credentials
- Review bot logs in database

### Issue: High memory usage

**Solution:**
- Check for memory leaks in logs
- Restart application
- Consider upgrading instance size
- Review snapshot cleanup settings

### Issue: Migrations fail

**Solution:**
```bash
# Check which migrations have run
sqlite3 data/arena.db "SELECT * FROM _migrations;"

# Manually run specific migration
sqlite3 data/arena.db < server/migrations/XXX_migration_name.sql
```

---

## Security Best Practices

1. **Always use HTTPS** in production (Railway/Render provide this automatically)
2. **Rotate secrets regularly** (JWT_SECRET, MASTER_ENCRYPTION_KEY)
3. **Keep dependencies updated**: `pnpm update`
4. **Monitor audit logs** regularly via Admin dashboard
5. **Enable rate limiting** (configured by default)
6. **Backup database regularly** (automatic backups included)
7. **Use strong passwords** for all accounts
8. **Store recovery phrases securely** (password manager)

---

## Updating the Application

### Railway/Render (Automatic)

Simply push to your main branch:
```bash
git push origin main
```

The platform will automatically rebuild and deploy.

### VPS (Manual)

Use the deployment script:
```bash
/var/www/bonerbots/deploy.sh
```

Or manually:
```bash
cd /var/www/bonerbots
git pull origin main
pnpm install
pnpm run build
cd server
node scripts/run_migrations.js
pm2 restart bonerbots
```

---

## Support & Resources

- **Documentation**: `/docs` directory in repository
- **Migrations**: `server/migrations/` directory
- **Scripts**: `server/scripts/` directory
- **Environment Template**: `server/.env.example`

---

## Quick Reference Commands

```bash
# Check application status (PM2)
pm2 status

# View logs
pm2 logs bonerbots

# Restart application
pm2 restart bonerbots

# Run migrations
node server/scripts/run_migrations.js

# Backup database
cp data/arena.db data/arena-backup-$(date +%Y%m%d).db

# Check health endpoint
curl https://yourdomain.com/api/v2/health
```

---

**Deployment complete! 🚀**

For additional help, review the implementation plan in `docs/MULTI_TENANT_ARENA_IMPLEMENTATION_PLAN.md`.

