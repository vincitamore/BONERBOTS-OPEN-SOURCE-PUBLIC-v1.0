/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

require('dotenv').config();

/**
 * Configuration validation and loading
 */

// Required environment variables
const REQUIRED_VARS = [
  'GEMINI_API_KEY',
  'XAI_API_KEY',
  'DEGEN_LIVE_API_KEY',
  'DEGEN_LIVE_SECRET',
  'ESCAPED_MONKEY_API_KEY',
  'ESCAPED_MONKEY_SECRET',
  'ASTROLOGER_API_KEY',
  'ASTROLOGER_SECRET'
];

/**
 * Validate that all required environment variables are set
 */
function validateConfig() {
  const missing = [];
  
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    console.error('\n❌ ERROR: Missing required environment variables:');
    console.error(missing.map(v => `  - ${v}`).join('\n'));
    console.error('\nPlease copy server/.env.example to server/.env and fill in all required values.\n');
    return false;
  }
  
  return true;
}

/**
 * Get API keys for a specific bot
 * @param {string} botId - The bot identifier (e.g., 'bot_degen')
 * @returns {{apiKey: string, apiSecret: string}}
 */
function getApiKeysForBot(botId) {
  let apiKey, apiSecret;
  
  switch (botId) {
    case 'bot_degen':
      apiKey = process.env.DEGEN_LIVE_API_KEY;
      apiSecret = process.env.DEGEN_LIVE_SECRET;
      break;
    case 'bot_monkey':
      apiKey = process.env.ESCAPED_MONKEY_API_KEY;
      apiSecret = process.env.ESCAPED_MONKEY_SECRET;
      break;
    case 'bot_astrologer':
      apiKey = process.env.ASTROLOGER_API_KEY;
      apiSecret = process.env.ASTROLOGER_SECRET;
      break;
    default:
      throw new Error(`No API key configuration found for botId: ${botId}`);
  }
  
  if (!apiKey || !apiSecret) {
    throw new Error(`API Key or Secret is missing for botId: ${botId}`);
  }
  
  return { apiKey, apiSecret };
}

// Configuration object
const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  wsPort: parseInt(process.env.WS_PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || './data/arena.db',
  
  // API Keys (only accessed through getApiKeysForBot for multi-wallet)
  geminiApiKey: process.env.GEMINI_API_KEY,
  xaiApiKey: process.env.XAI_API_KEY,
  
  // Helper function
  getApiKeysForBot,
  validateConfig
};

module.exports = config;
