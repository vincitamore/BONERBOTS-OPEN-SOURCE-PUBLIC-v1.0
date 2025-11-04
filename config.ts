// config.ts
/**
 * Configuration for the BONERBOTS AI Arena (Local Edition)
 * 
 * This application runs on a local Express server with SQLite database.
 * The configuration is simple and straightforward.
 */

/**
 * The URL for the local Express API server.
 * This can be overridden with the VITE_API_URL environment variable.
 * Default: http://localhost:3001
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * The URL for the local WebSocket server (for real-time state updates).
 * This can be overridden with the VITE_WS_URL environment variable.
 * Default: ws://localhost:3002
 */
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

/**
 * A flag that checks if the application is configured.
 * For the local edition, this checks if the server URLs are set.
 */
export const isAppConfigured = Boolean(API_URL && WS_URL);
