-- Migration: 007_add_bot_trading_symbols.sql
-- Description: Add trading_symbols column to bots table for per-bot symbol configuration
-- Date: 2025-11-06

-- Add trading_symbols column to bots table
-- NULL means use global settings, otherwise use bot-specific symbols
ALTER TABLE bots ADD COLUMN trading_symbols TEXT DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_bots_trading_symbols ON bots(trading_symbols);

