## Local SQLite Refactor Plan

### Summary
- Replace the current Supabase + Cloudflare Worker stack with a local-first architecture built around a Node.js service layer, SQLite persistence, and WebSocket-driven realtime updates.
- Centralize all configuration (bots, prompts, leverage limits, credentials, UI assets) inside the database with management APIs and UI forms—no hardcoded operational data in the frontend.
- Preserve existing broadcast/spectator flows, real-trading integrations, and AI decision pipelines while enabling fully offline/local execution and easier testing.

### Current Architecture Assessment
- **Frontend (Vite + React + Tailwind)**: Supports broadcast (admin) and spectator modes, relies on Supabase for configuration gating and realtime state sync. Sensitive values live in `config.ts`, `leverageLimits.ts`, `walletAddresses.ts`, and `hooks/useTradingBot.ts`.
- **State & Realtime**: Supabase Postgres stores an `arena_state` JSON blob. Broadcast clients mutate state and publish realtime events through Supabase channels; spectators subscribe with public credentials.
- **Serverless Worker**: Cloudflare Worker proxies Gemini, Grok, and Asterdex APIs, signs Binance-compatible requests, and multiplexes requests based on `botId`. Worker secrets hold API keys per bot.
- **Local Server**: Minimal Express server in `/server` only serves static assets; no API or orchestration logic runs locally.
- **Configuration Footprint**: Numerous hardcoded maps, constants, and prompts in the frontend violate the “no hardcoded config” requirement and hinder scalability of bot/device management.

### Observed Gachas & Risks
- **Hardcoded Bot Definitions**: `botConfigs`, `botImageMap`, `walletAddresses`, `leverageLimits`, and prompt imports must move to runtime data sources with admin tooling.
- **Supabase Assumptions**: React hooks make optimistic assumptions about Supabase availability (`isAppConfigured`, `supabase.channel`), and spectator mode depends on Supabase’s presence. Removing it requires careful fallback logic and UI messaging.
- **Realtime Semantics**: Replacing Supabase broadcast with WebSockets requires rethinking subscription lifecycles, reconnection logic, and how to sanitize bot objects before broadcast.
- **State Loading**: `useTradingBot` directly queries Supabase (`from('arena_state').select()`); the replacement needs consistent state hydration plus rollback if the local orchestrator fails.
- **API Proxying**: All third-party calls currently flow through the worker. A local server must replicate signing, rate limiting, error handling, and bot-specific credential selection without re-exposing secrets to the browser.
- **Sensitive Defaults**: `BROADCAST_PASSWORD`, minimum trade sizes, and other guardrails are embedded in code; they need to become configurable policies stored centrally.
- **Type Coupling**: Shared types (`BotState`, `ArenaState`) live in the frontend. For a cohesive local app we need a shared package or generated typings from the backend schema to avoid drift.
- **Build Tooling**: Scripts use npm; mandate is pnpm. Converting requires workspace adjustments (possibly root + server workspace) and lockfile regeneration.
- **Environment Management**: Current `.env` handling is minimal. A richer configuration story (local, staging, prod) is required once Supabase/Cloudflare are removed.
- **Testing Debt**: No automated tests cover trading flows or realtime channels. Refactor introduces opportunities for regression; test strategy must be planned up front.

### Target Architecture Overview
- **Backend Service (Node.js + Fastify/Express)**
  - Hosts REST + WebSocket APIs.
  - Contains orchestration workers that run trading turns, synchronize market data, and persist state to SQLite.
  - Provides secure credential vaulting (env-backed secrets encrypted at rest in SQLite when stored).
- **SQLite Persistence Layer**
  - Stores bots, prompts, leverage policies, wallet metadata, arena state snapshots, order history, audit logs, and app settings.
  - Exposes migration files and seeding scripts managed by pnpm tasks.
- **Frontend (React)**
  - Communicates exclusively with the local backend via typed SDK (REST/WebSocket).
  - Offers admin UI to manage configuration entities and monitor orchestrator health.
  - Spectator mode consumes WebSocket feeds with reconnect/resync logic.
- **Shared Types & Utilities**
  - Move shared DTOs, enums, and validation rules into a shared package consumed by both frontend and backend to ensure contract parity.

### Proposed SQLite Schema (Initial Draft)
```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  model_identifier TEXT NOT NULL,
  base_prompt TEXT NOT NULL,
  metadata_json TEXT DEFAULT '{}'
);

CREATE TABLE bots (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  provider_id INTEGER NOT NULL REFERENCES ai_providers(id),
  trading_mode TEXT CHECK(trading_mode IN ('paper','real')) NOT NULL,
  avatar_url TEXT,
  wallet_address TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE leverage_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  max_leverage INTEGER NOT NULL,
  UNIQUE(symbol)
);

CREATE TABLE bot_prompts (
  bot_id TEXT NOT NULL REFERENCES bots(id),
  version INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bot_id, version)
);

CREATE TABLE credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id TEXT REFERENCES bots(id),
  provider TEXT NOT NULL,
  credential_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE arena_state_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  state_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bot_positions (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price REAL NOT NULL,
  size REAL NOT NULL,
  leverage REAL NOT NULL,
  stop_loss REAL,
  take_profit REAL,
  opened_at DATETIME NOT NULL,
  closed_at DATETIME
);

CREATE TABLE bot_orders (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id),
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  size REAL NOT NULL,
  leverage REAL NOT NULL,
  pnl REAL,
  fee REAL,
  executed_at DATETIME NOT NULL,
  raw_payload_json TEXT
);

CREATE TABLE bot_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id TEXT NOT NULL REFERENCES bots(id),
  message TEXT NOT NULL,
  metadata_json TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

_Schema to be iterated during implementation; capture additional tables for market data caching, scheduler heartbeats, and access control as needed._

### Backend Workstreams
- [ ] Establish a `pnpm` workspace structure (root frontend + backend package) and update scripts, Dockerfile, and README accordingly.
- [ ] Scaffold backend service (Fastify/Express + TypeScript) with ESLint, tsconfig, and nodemon/tsx dev workflow.
- [ ] Integrate SQLite via a migration-friendly ORM (Prisma, Drizzle, Kysely, or better-sqlite3) and commit initial migration files reflecting the proposed schema.
- [ ] Implement configuration CRUD endpoints (bots, prompts, leverage policies, wallet metadata, passwords) with full validation and audit logging.
- [ ] Build credential vaulting: encrypt secrets before persistence (libsodium/Node crypto) and load them into memory for runtime use; expose admin UI endpoints for rotation.
- [ ] Port Cloudflare Worker logic into the backend: Gemini/Grok/Asterdex proxy routes with per-bot credential resolution, HMAC signing, robust error normalization, and rate limiting.
- [ ] Implement orchestration scheduler: turn processor honoring `TURN_INTERVAL_MS`, cooldown logic, and minimum order rules while persisting intermediate state transactionally.
- [ ] Expose WebSocket channels for arena state and bot telemetry; handle authentication, replay of latest state, and heartbeat timeouts.
- [ ] Record arena state snapshots and maintain a pruning job to prevent unbounded growth.
- [ ] Provide health endpoints and structured logging (pino/winston) for monitoring.

### Frontend Workstreams
- [ ] Remove Supabase dependencies and replace with a backend SDK (REST + WebSocket client) generated from shared OpenAPI/TypeScript contracts.
- [ ] Refactor `useTradingBot` to consume backend APIs for initialization, trading turns, and state updates; eliminate direct fetches to third-party services.
- [ ] Replace `stateService` with WebSocket subscription manager that handles reconnects, exponential backoff, and stale data detection.
- [ ] Build configuration UI (form-driven) for bots, prompts, leverage policies, wallet metadata, and operational settings; ensure all lists use data from APIs.
- [ ] Externalize broadcast authentication: replace hardcoded password with backend-managed policy (supports hashed secrets and future role-based access).
- [ ] Update assets management so avatar URLs and presentation details load from the database with sensible defaults.
- [ ] Provide feedback when backend is unreachable and guide users through initial configuration seeding.
- [ ] Review spectator/broadcast flows to ensure sanitized payloads match backend contract and sensitive fields never leak to spectators.

### Configuration & Secrets Management
- [ ] Define `.env` structure for backend (local development vs. production) covering encryption keys, API base URLs, scheduler toggles, and logging.
- [ ] Implement secret storage strategy (environment variable master key + encrypted SQLite blobs) and document rotation procedures.
- [ ] Replace `config.ts` with runtime configuration service: frontend fetches bootstrap config from backend on load, blocking until application is ready.
- [ ] Introduce access control model (local auth, optional password/passkey) for broadcast/admin endpoints and WebSocket channels.

### Observability, Tooling, and Ops
- [ ] Add structured logging with correlation IDs spanning REST and WebSocket events.
- [ ] Create metrics hooks (Prometheus endpoint or lightweight dashboard) for bot turn duration, API latency, and error rates.
- [ ] Implement graceful shutdown handling for orchestrator and WebSocket clients to avoid state corruption.
- [ ] Provide CLI utilities (`pnpm backend seed`, `pnpm backend migrate`) for environment bootstrap and recovery.

### Testing Strategy
- [ ] Establish unit tests for trading rules, leverage policies, and API credential resolution.
- [ ] Add integration tests simulating full trading turns (AI decision fetch → trade execution → state persistence) using an in-memory SQLite database.
- [ ] Implement contract tests for REST & WebSocket interfaces using shared schemas to verify frontend-backend compatibility.
- [ ] Provide mocked providers for Gemini/Grok/Asterdex to enable deterministic local testing.
- [ ] Automate end-to-end smoke test that boots backend + frontend together, runs sample trading loop, and verifies spectator view updates.

### Migration & Rollout Plan
1. **Foundation**: pnpm migration, backend scaffolding, schema definition, and shared types package.
2. **Data Layer**: Implement migrations, seed scripts, and admin API endpoints for configuration entities.
3. **Orchestrator Port**: Move trading loop logic from frontend hook into backend worker, adapting to database-driven config.
4. **API Proxy Port**: Recreate Cloudflare Worker routes in backend with local credential vaulting and test external integrations.
5. **Realtime Layer**: Introduce WebSocket service, update spectator and broadcast flows, and deprecate Supabase code paths.
6. **Frontend Refactor**: Swap services to new SDK, add configuration UI, and remove hardcoded constants/maps.
7. **QA & Hardening**: Execute automated test suites, run manual failover scenarios, verify data integrity, and finalize documentation.
8. **Deployment Packaging**: Update Dockerfile(s) to bundle backend + frontend, ensure sqlite file persistence strategy is documented, and publish runbooks.

Each stage should complete with code review, migration scripts, and updated tests before progressing.

### Documentation Deliverables
- [ ] Update `README.md` with new architecture overview, setup steps, and pnpm commands.
- [ ] Create backend API reference (OpenAPI spec) and include generated client usage examples.
- [ ] Add operational playbooks covering backup/restore of SQLite, credential rotation, and troubleshooting real-time sync.
- [ ] Document configuration UI workflows and permission model.

### Open Questions & Follow-Ups
- What level of authentication/authorization is required beyond password gating (e.g., multi-user roles, OAuth, API tokens)?
- Are live trading credentials expected to be stored locally, or should we integrate with external secret managers (e.g., 1Password CLI, AWS Secrets Manager)?
- Should the orchestrator support plug-in strategies beyond prompt-based LLMs (necessitating additional schema for strategy modules)?
- Do we need offline simulation mode without any external API calls (requiring mock market data generators)?
- How should configuration changes propagate to running bot sessions (immediate reload vs. scheduled maintenance windows)?

Clarifying these items early will de-risk later implementation stages and ensure the refactor aligns with long-term product goals.
