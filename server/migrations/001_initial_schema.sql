-- Initial schema for BONERBOTS AI Arena
-- This creates a single-row table to hold the entire arena state as JSON

-- Create the arena_state table
CREATE TABLE IF NOT EXISTS arena_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial empty state if the table is empty
INSERT OR IGNORE INTO arena_state (id, state, updated_at)
VALUES (1, '{"bots": [], "marketData": []}', CURRENT_TIMESTAMP);
