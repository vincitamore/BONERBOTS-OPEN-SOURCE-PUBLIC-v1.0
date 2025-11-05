/**
 * API Configuration Utility
 * Dynamically constructs API and WebSocket URLs based on current protocol
 * to support both local development (HTTP) and production deployment (HTTPS)
 */

/**
 * Get the base API URL, automatically detecting protocol
 */
export const getApiBaseUrl = (): string => {
  // Check for environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Dynamically construct based on current location
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // Production: use same protocol as frontend with port 3001
  return `${protocol}//${hostname}:3001`;
};

/**
 * Get the WebSocket URL, automatically detecting protocol
 */
export const getWsUrl = (): string => {
  // Check for environment variable first
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  
  // Dynamically construct based on current location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname;
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'ws://localhost:3002';
  }
  
  // Production: use wss:// for HTTPS, ws:// for HTTP
  return `${protocol}//${hostname}:3002`;
};

// Export singleton instances
export const API_URL = getApiBaseUrl();
export const WS_URL = getWsUrl();
export const isAppConfigured = Boolean(API_URL && WS_URL);

