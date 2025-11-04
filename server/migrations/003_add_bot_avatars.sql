-- ============================================================================
-- Add avatar image support to bots table
-- Migration: 003_add_bot_avatars.sql
-- ============================================================================

-- Add avatar_image column to store base64 encoded images
ALTER TABLE bots ADD COLUMN avatar_image TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_bots_name ON bots(name);

