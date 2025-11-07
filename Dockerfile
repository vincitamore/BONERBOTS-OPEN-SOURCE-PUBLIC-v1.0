# BONERBOTS AI Arena - Multi-Tenant Production Docker Configuration
# This Dockerfile creates a production-ready container for the multi-tenant SaaS version

# Stage 1: Build the frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Copy frontend source files
COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js ./
COPY index.html ./
COPY *.ts ./
COPY components ./components
COPY pages ./pages
COPY services ./services
COPY hooks ./hooks
COPY context ./context
COPY types ./types
COPY styles ./styles
COPY config.ts ./

# Build frontend
RUN pnpm run build

# Stage 2: Build the final server image
FROM node:18-alpine

WORKDIR /app

# Copy server package files
COPY server/package.json server/pnpm-lock.yaml* ./

# Install pnpm and production dependencies
RUN corepack enable pnpm && pnpm install --prod --frozen-lockfile

# Copy server source files
COPY server/*.js ./
COPY server/database ./database
COPY server/middleware ./middleware
COPY server/routes ./routes
COPY server/services ./services
COPY server/utils ./utils
COPY server/scripts ./scripts
COPY server/migrations ./migrations
COPY server/.env.example ./.env.example

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/dist ./dist

# Create data directory for SQLite and backups
RUN mkdir -p ./data ./data/backups

# Expose ports (HTTP API and WebSocket)
EXPOSE 3001 3002

# Environment variables (override with docker run -e or docker-compose)
ENV PORT=3001
ENV WS_PORT=3002
ENV NODE_ENV=production
ENV DATABASE_PATH=./data/arena.db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Run migrations on startup and then start the server
CMD ["sh", "-c", "node scripts/run_migrations.js && node server.js"]
