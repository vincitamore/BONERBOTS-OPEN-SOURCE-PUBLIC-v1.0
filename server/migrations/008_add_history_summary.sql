-- Migration: Add history_summary field to bots table
-- This stores compressed summaries of older trading decisions to prevent token bloat

ALTER TABLE bots ADD COLUMN history_summary TEXT;

-- Add index for bots that have summaries (for potential analytics)
CREATE INDEX IF NOT EXISTS idx_bots_has_summary ON bots(history_summary) WHERE history_summary IS NOT NULL;

