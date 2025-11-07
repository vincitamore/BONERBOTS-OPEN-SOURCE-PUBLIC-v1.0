-- Migration: 006_leaderboard.sql
-- Description: Create leaderboard tables for tracking bot performance rankings
-- Date: 2025-11-05

-- Create leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    bot_id TEXT NOT NULL,
    period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'
    total_pnl REAL DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    win_rate REAL DEFAULT 0,
    sharpe_ratio REAL DEFAULT 0,
    max_drawdown REAL DEFAULT 0,
    rank INTEGER,
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    UNIQUE(bot_id, period)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_period_rank ON leaderboard(period, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user ON leaderboard(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_bot ON leaderboard(bot_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period_pnl ON leaderboard(period, total_pnl DESC);

-- Create bot performance history table for tracking over time
CREATE TABLE IF NOT EXISTS bot_performance_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    balance REAL NOT NULL,
    total_value REAL NOT NULL,
    realized_pnl REAL DEFAULT 0,
    unrealized_pnl REAL DEFAULT 0,
    total_pnl REAL DEFAULT 0,
    trade_count INTEGER DEFAULT 0,
    win_rate REAL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_performance_bot_time ON bot_performance_history(bot_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_user ON bot_performance_history(user_id);

-- Seed initial leaderboard data from existing bot_state_snapshots
INSERT INTO leaderboard (user_id, bot_id, period, total_pnl, total_trades, win_rate, rank)
SELECT 
    b.user_id,
    b.id as bot_id,
    'all_time' as period,
    COALESCE(MAX(s.realized_pnl), 0) as total_pnl,
    COALESCE(MAX(s.trade_count), 0) as total_trades,
    COALESCE(MAX(s.win_rate), 0) as win_rate,
    0 as rank
FROM bots b
LEFT JOIN bot_state_snapshots s ON b.id = s.bot_id
WHERE b.user_id IS NOT NULL
GROUP BY b.id, b.user_id
ON CONFLICT(bot_id, period) DO NOTHING;

