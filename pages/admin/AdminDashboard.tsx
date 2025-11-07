import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { Link } from 'react-router-dom';

const API_BASE_URL = getApiBaseUrl();

interface SystemStats {
  users: {
    total_users: number;
    active_users: number;
    admin_users: number;
    new_today: number;
  };
  bots: {
    total_bots: number;
    active_bots: number;
    users_with_bots: number;
  };
  trades_24h: {
    total_trades: number;
    profitable_trades: number;
    total_pnl: number;
  };
  providers: {
    total_providers: number;
    unique_types: number;
  };
  recent_activity: Array<{
    user_id: string;
    action: string;
    details: string;
    created_at: string;
  }>;
}

interface OrphanedBot {
  id: string;
  name: string;
  trading_mode: string;
  is_active: number;
  created_at: string;
  provider_name: string;
}

const AdminDashboard: React.FC = () => {
  const { token } = useAuth();
  const { showToast, confirm } = useToast();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [orphanedBots, setOrphanedBots] = useState<OrphanedBot[]>([]);
  const [showOrphanedBots, setShowOrphanedBots] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data = await response.json();
      setStats(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrphanedBots = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/orphaned-bots`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orphaned bots');
      }

      const data = await response.json();
      setOrphanedBots(data.bots);
      setShowOrphanedBots(true);
    } catch (err: any) {
      showToast(`Error fetching orphaned bots: ${err.message}`, 'error');
    }
  };

  const deleteOrphanedBots = async () => {
    const confirmed = await confirm({
      title: 'Delete Orphaned Bots',
      message: `Are you sure you want to delete ${orphanedBots.length} orphaned bot(s) and all their data? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/orphaned-bots`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete orphaned bots');
      }

      const data = await response.json();
      showToast(data.message, 'success');
      setOrphanedBots([]);
      setShowOrphanedBots(false);
      fetchStats(); // Refresh stats
    } catch (err: any) {
      showToast(`Error deleting orphaned bots: ${err.message}`, 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto px-3 sm:px-6 py-4 sm:py-6" style={{ maxWidth: '1400px' }}>
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6" style={{ maxWidth: '1400px' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400">System overview and statistics</p>
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Users Stats */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Total Users</h3>
          <div className="text-3xl font-bold text-white mb-3">{stats.users.total_users}</div>
          <div className="space-y-1 text-sm">
            <div className="text-gray-400">
              <span className="text-green-400">{stats.users.active_users}</span> Active
            </div>
            <div className="text-gray-400">
              <span className="text-blue-400">{stats.users.admin_users}</span> Admins
            </div>
            <div className="text-gray-400">
              <span className="text-yellow-400">{stats.users.new_today}</span> New Today
            </div>
          </div>
        </div>

        {/* Bots Stats */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Trading Bots</h3>
          <div className="text-3xl font-bold text-white mb-3">{stats.bots.total_bots}</div>
          <div className="space-y-1 text-sm">
            <div className="text-gray-400">
              <span className="text-green-400">{stats.bots.active_bots}</span> Active
            </div>
            <div className="text-gray-400">
              <span className="text-blue-400">{stats.bots.users_with_bots}</span> Users with Bots
            </div>
          </div>
        </div>

        {/* Trades Stats (24h) */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Trades (24h)</h3>
          <div className="text-3xl font-bold text-white mb-3">{stats.trades_24h.total_trades}</div>
          <div className="space-y-1 text-sm">
            <div className="text-gray-400">
              <span className="text-green-400">{stats.trades_24h.profitable_trades}</span> Profitable
            </div>
            <div className={`${stats.trades_24h.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${Math.abs(stats.trades_24h.total_pnl || 0).toFixed(2)} PnL
            </div>
          </div>
        </div>

        {/* Providers Stats */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">AI Providers</h3>
          <div className="text-3xl font-bold text-white mb-3">{stats.providers.total_providers}</div>
          <div className="space-y-1 text-sm">
            <div className="text-gray-400">
              <span className="text-blue-400">{stats.providers.unique_types}</span> Unique Types
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
        <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
          {stats.recent_activity.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No recent activity</div>
          ) : (
            stats.recent_activity.map((activity, index) => (
              <div key={index} className="p-4 hover:bg-gray-750 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="text-white font-medium">{activity.action}</div>
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  User: {activity.user_id ? activity.user_id.substring(0, 8) + '...' : 'System'} • {new Date(activity.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Link
            to="/admin/users"
            className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:bg-gray-700 transition-colors text-center"
          >
            <div className="text-white font-medium">Manage Users</div>
          </Link>
          <Link
            to="/admin/settings"
            className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:bg-gray-700 transition-colors text-center"
          >
            <div className="text-white font-medium">System Settings</div>
          </Link>
          <Link
            to="/analytics"
            className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:bg-gray-700 transition-colors text-center"
          >
            <div className="text-white font-medium">View Analytics</div>
          </Link>
        </div>
      </div>

      {/* Orphaned Bots Management */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Orphaned Bots</h2>
          <button
            onClick={fetchOrphanedBots}
            className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Check for Orphaned Bots
          </button>
        </div>
        
        {showOrphanedBots && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            {orphanedBots.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No orphaned bots found!
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-yellow-400">
                    Found {orphanedBots.length} orphaned bot(s) with no user
                  </p>
                  <button
                    onClick={deleteOrphanedBots}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Delete All Orphaned Bots
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-700">
                      <tr>
                        <th className="text-left py-2 px-4 text-gray-400 font-medium">Bot ID</th>
                        <th className="text-left py-2 px-4 text-gray-400 font-medium">Name</th>
                        <th className="text-left py-2 px-4 text-gray-400 font-medium">Provider</th>
                        <th className="text-left py-2 px-4 text-gray-400 font-medium">Mode</th>
                        <th className="text-left py-2 px-4 text-gray-400 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {orphanedBots.map((bot) => (
                        <tr key={bot.id} className="hover:bg-gray-750">
                          <td className="py-2 px-4 text-gray-300 font-mono text-sm">{bot.id}</td>
                          <td className="py-2 px-4 text-white">{bot.name}</td>
                          <td className="py-2 px-4 text-gray-400">{bot.provider_name || 'N/A'}</td>
                          <td className="py-2 px-4">
                            <span className={`px-2 py-1 rounded text-xs ${bot.trading_mode === 'paper' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                              {bot.trading_mode}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-gray-400 text-sm">{new Date(bot.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
