/**
 * Admin Routes
 * 
 * Administrative endpoints for user management, system monitoring, and audit logs.
 * All routes require admin role.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const Database = require('better-sqlite3');
const path = require('path');

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'arena.db');

/**
 * GET /api/admin/users
 * Get all users with pagination and search
 */
router.get('/users', (req, res) => {
  const db = new Database(DB_PATH);
  
  try {
    const { search = '', page = 1, limit = 50, role = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, username, email, role, is_active, created_at, last_login FROM users WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (username LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (status !== '') {
      query += ' AND is_active = ?';
      params.push(status === 'active' ? 1 : 0);
    }

    // Get total count
    const countQuery = query.replace('SELECT id, username, email, role, is_active, created_at, last_login', 'SELECT COUNT(*) as count');
    const { count } = db.prepare(countQuery).get(...params);

    // Get paginated results
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const users = db.prepare(query).all(...params);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  } finally {
    db.close();
  }
});

/**
 * GET /api/admin/stats
 * Get system-wide statistics
 */
router.get('/stats', (req, res) => {
  const db = new Database(DB_PATH);
  
  try {
    const stats = {};

    // User statistics
    const userStats = db.prepare(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users,
        SUM(CASE WHEN DATE(created_at) = DATE('now') THEN 1 ELSE 0 END) as new_today
      FROM users
    `).get();
    stats.users = userStats;

    // Bot statistics
    const botStats = db.prepare(`
      SELECT 
        COUNT(*) as total_bots,
        SUM(CASE WHEN is_paused = 0 THEN 1 ELSE 0 END) as active_bots,
        COUNT(DISTINCT user_id) as users_with_bots
      FROM bots
    `).get();
    stats.bots = botStats;

    // Trade statistics (last 24 hours)
    const tradeStats = db.prepare(`
      SELECT 
        COUNT(*) as total_trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as profitable_trades,
        SUM(pnl) as total_pnl
      FROM trades
      WHERE executed_at >= datetime('now', '-1 day')
    `).get();
    stats.trades_24h = tradeStats;

    // Provider statistics
    const providerStats = db.prepare(`
      SELECT 
        COUNT(*) as total_providers,
        COUNT(DISTINCT provider_type) as unique_types
      FROM llm_providers
    `).get();
    stats.providers = providerStats;

    // Recent activity (last 10 audit log entries)
    const recentActivity = db.prepare(`
      SELECT user_id, action, details, created_at
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT 10
    `).all();
    stats.recent_activity = recentActivity;

    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch system statistics' });
  } finally {
    db.close();
  }
});

/**
 * GET /api/admin/audit-log
 * Get audit log with pagination and filtering
 */
router.get('/audit-log', (req, res) => {
  const db = new Database(DB_PATH);
  
  try {
    const { 
      user_id = '', 
      action = '', 
      page = 1, 
      limit = 100,
      start_date = '',
      end_date = ''
    } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];

    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const { count } = db.prepare(countQuery).get(...params);

    // Get paginated results
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = db.prepare(query).all(...params);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  } finally {
    db.close();
  }
});

/**
 * GET /api/admin/bots
 * Get all bots across all users
 */
router.get('/bots', (req, res) => {
  const db = new Database(DB_PATH);
  
  try {
    const { user_id = '', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        b.*,
        u.username as owner_username
      FROM bots b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ' AND b.user_id = ?';
      params.push(user_id);
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/s, 'SELECT COUNT(*) as count FROM');
    const { count } = db.prepare(countQuery).get(...params);

    // Get paginated results
    query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const bots = db.prepare(query).all(...params);

    res.json({
      bots,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching bots:', error);
    res.status(500).json({ error: 'Failed to fetch bots' });
  } finally {
    db.close();
  }
});

/**
 * PUT /api/admin/users/:id/role
 * Update user role
 */
router.put('/users/:id/role', (req, res) => {
  const db = new Database(DB_PATH);
  
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent demoting yourself
    if (id === req.user.userId && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const result = db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(role, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log the action
    db.prepare(`
      INSERT INTO audit_log (user_id, action, details)
      VALUES (?, ?, ?)
    `).run(req.user.userId, 'user.role_changed', JSON.stringify({ target_user: id, new_role: role }));

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  } finally {
    db.close();
  }
});

/**
 * PUT /api/admin/users/:id/status
 * Update user status (active/inactive)
 */
router.put('/users/:id/status', (req, res) => {
  const db = new Database(DB_PATH);
  
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Prevent deactivating yourself
    if (id === req.user.userId && !is_active) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const result = db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(is_active ? 1 : 0, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log the action
    db.prepare(`
      INSERT INTO audit_log (user_id, action, details)
      VALUES (?, ?, ?)
    `).run(req.user.userId, 'user.status_changed', JSON.stringify({ 
      target_user: id, 
      is_active 
    }));

    // Revoke all sessions if deactivating
    if (!is_active) {
      db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(id);
    }

    res.json({ message: 'User status updated successfully' });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  } finally {
    db.close();
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user (WARNING: Cascades to all user data)
 */
router.delete('/users/:id', (req, res) => {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON'); // CRITICAL: Enable foreign key constraints
  
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Begin transaction
    db.exec('BEGIN TRANSACTION');

    // Delete all user data (manual deletes to ensure complete cleanup)
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM leaderboard WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM bot_performance_history WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM bots WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM llm_providers WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM wallets WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM bot_state_snapshots WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM bot_decisions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM trades WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM positions WHERE user_id = ?').run(id);
    
    // Log the action before deleting the user
    db.prepare(`
      INSERT INTO audit_log (user_id, action, details)
      VALUES (?, ?, ?)
    `).run(req.user.userId, 'user.deleted', JSON.stringify({ target_user: id }));

    // Finally delete the user
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);

    if (result.changes === 0) {
      db.exec('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    db.exec('COMMIT');

    res.json({ message: 'User and all associated data deleted successfully' });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    db.close();
  }
});

/**
 * GET /api/admin/orphaned-bots
 * Get all bots with no user_id (orphaned bots)
 */
router.get('/orphaned-bots', (req, res) => {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  
  try {
    const bots = db.prepare(`
      SELECT 
        b.id,
        b.name,
        b.trading_mode,
        b.is_active,
        b.created_at,
        lp.name as provider_name
      FROM bots b
      LEFT JOIN llm_providers lp ON b.provider_id = lp.id
      WHERE b.user_id IS NULL
      ORDER BY b.created_at DESC
    `).all();

    res.json({ bots, count: bots.length });
  } catch (error) {
    console.error('Error fetching orphaned bots:', error);
    res.status(500).json({ error: 'Failed to fetch orphaned bots' });
  } finally {
    db.close();
  }
});

/**
 * DELETE /api/admin/orphaned-bots
 * Delete all orphaned bots and their associated data
 */
router.delete('/orphaned-bots', (req, res) => {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  
  try {
    // Get list of orphaned bot IDs first
    const orphanedBots = db.prepare('SELECT id FROM bots WHERE user_id IS NULL').all();
    
    if (orphanedBots.length === 0) {
      return res.json({ message: 'No orphaned bots found', deletedCount: 0 });
    }

    const botIds = orphanedBots.map(b => b.id);

    // Begin transaction
    db.exec('BEGIN TRANSACTION');

    // Delete all data associated with orphaned bots
    for (const botId of botIds) {
      db.prepare('DELETE FROM leaderboard WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM bot_performance_history WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM wallets WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM bot_state_snapshots WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM bot_decisions WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM trades WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM positions WHERE bot_id = ?').run(botId);
    }

    // Delete the orphaned bots themselves
    db.prepare('DELETE FROM bots WHERE user_id IS NULL').run();

    // Log the action
    db.prepare(`
      INSERT INTO audit_log (user_id, action, details)
      VALUES (?, ?, ?)
    `).run(req.user.userId, 'orphaned_bots.cleanup', JSON.stringify({ 
      deleted_count: botIds.length,
      bot_ids: botIds 
    }));

    db.exec('COMMIT');

    res.json({ 
      message: `Successfully deleted ${botIds.length} orphaned bot(s) and their data`,
      deletedCount: botIds.length,
      deletedBotIds: botIds
    });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Error deleting orphaned bots:', error);
    res.status(500).json({ error: 'Failed to delete orphaned bots' });
  } finally {
    db.close();
  }
});

module.exports = router;

