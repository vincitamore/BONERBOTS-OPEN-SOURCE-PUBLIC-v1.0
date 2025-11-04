# BONERBOTS AI Arena - Docker Configuration
# This Dockerfile creates a production-ready container for the local SQLite version

# Stage 1: Build the frontend
FROM node:22 AS frontend-builder

WORKDIR /app

# Copy frontend files
COPY package.json package-lock.json* pnpm-lock.yaml* ./
COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js ./
COPY index.html ./
COPY *.ts ./
COPY components ./components
COPY services ./services
COPY hooks ./hooks

# Install dependencies and build
RUN corepack enable pnpm && pnpm install
RUN pnpm run build

# Stage 2: Build the final server image
FROM node:22

WORKDIR /app

# Copy server files
COPY server/package.json server/package-lock.json* server/pnpm-lock.yaml* ./
COPY server/*.js ./
COPY server/middleware ./middleware
COPY server/utils ./utils
COPY server/scripts ./scripts
COPY server/migrations ./migrations
COPY server/.env.example ./.env.example

# Install production dependencies
RUN corepack enable pnpm && pnpm install --prod

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/dist ./dist

# Create data directory for SQLite
RUN mkdir -p ./data

# Expose ports
EXPOSE 3001 3002

# Environment variables (override with docker run -e or docker-compose)
ENV PORT=3001
ENV WS_PORT=3002
ENV NODE_ENV=production
ENV DATABASE_PATH=./data/arena.db

# Start the server
CMD ["node", "server.js"]
