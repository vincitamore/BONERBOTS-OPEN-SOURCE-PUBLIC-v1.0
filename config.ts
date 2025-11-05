// config.ts
/**
 * Configuration for the BONERBOTS AI Arena
 * 
 * This application runs on an Express server with SQLite database.
 * The configuration automatically adapts to HTTP (local) or HTTPS (production).
 */

// Re-export from centralized API config utility
export { API_URL, WS_URL, isAppConfigured } from './utils/apiConfig';
