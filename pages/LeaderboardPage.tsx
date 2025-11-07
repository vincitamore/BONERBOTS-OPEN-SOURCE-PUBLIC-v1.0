import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface LeaderboardEntry {
  id: number;
  user_id: string;
  bot_id: string;
  bot_name: string;
  username: string;
  avatar_image: string;
  period: string;
  total_pnl: number;
  total_trades: number;
  win_rate: number;
  sharpe_ratio: number;
  max_drawdown: number;
  rank: number;
  updated_at: number;
}

interface LeaderboardStats {
  total_bots: number;
  total_users: number;
  total_trades: number;
  total_pnl: number;
  avg_win_rate: number;
}

type Period = 'daily' | 'weekly' | 'monthly' | 'all_time';

const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { token, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('all_time');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloneModalBot, setCloneModalBot] = useState<LeaderboardEntry | null>(null);
  const [cloneFormData, setCloneFormData] = useState({ new_id: '', new_name: '' });
  const [cloning, setCloning] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
    fetchStats();
  }, [selectedPeriod]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/leaderboard/${selectedPeriod}?limit=100`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err: any) {
      console.error('Error fetching leaderboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/leaderboard/stats`);
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const formatPnL = (pnl: number): string => {
    const formatted = pnl.toFixed(2);
    return pnl >= 0 ? `+$${formatted}` : `-$${Math.abs(pnl).toFixed(2)}`;
  };

  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getPnLColor = (pnl: number): string => {
    return pnl >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const handleCloneClick = (entry: LeaderboardEntry) => {
    if (!token) {
      showToast('Please log in to clone bots', 'error');
      navigate('/login');
      return;
    }
    setCloneModalBot(entry);
    setCloneFormData({ 
      new_id: `bot_${entry.bot_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_clone`,
      new_name: `${entry.bot_name} (Clone)` 
    });
  };

  const handleCloneSubmit = async () => {
    if (!cloneModalBot || !token) return;

    if (!cloneFormData.new_id || !cloneFormData.new_name) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setCloning(true);
    try {
      const response = await fetch(`${API_URL}/api/v2/bots/${cloneModalBot.bot_id}/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(cloneFormData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to clone bot');
      }

      showToast('Bot cloned successfully!', 'success');
      setCloneModalBot(null);
      setCloneFormData({ new_id: '', new_name: '' });
      
      // Navigate to bot config after a short delay
      setTimeout(() => {
        navigate('/config/bots');
      }, 1000);
    } catch (err: any) {
      showToast(err.message || 'Failed to clone bot', 'error');
    } finally {
      setCloning(false);
    }
  };

  const getPeriodLabel = (period: Period): string => {
    const labels = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      all_time: 'All Time'
    };
    return labels[period];
  };

  const handleForceUpdate = async () => {
    if (!token || !isAdmin) {
      showToast('Admin access required', 'error');
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/leaderboard/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to update leaderboard');
      }

      const result = await response.json();
      showToast(`Leaderboard updated successfully! ${result.updated} periods refreshed`, 'success');
      
      // Refresh the leaderboard data
      await fetchLeaderboard();
      await fetchStats();
    } catch (err: any) {
      showToast(err.message || 'Failed to update leaderboard', 'error');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6" style={{ maxWidth: '1400px' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Trading Arena Leaderboard</h1>
        <p className="text-gray-400">Compete with the best AI trading bots</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{stats.total_bots}</div>
            <div className="text-sm text-gray-400">Active Bots</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{stats.total_users}</div>
            <div className="text-sm text-gray-400">Traders</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{stats.total_trades.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Total Trades</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className={`text-2xl font-bold ${getPnLColor(stats.total_pnl)}`}>
              {formatPnL(stats.total_pnl)}
            </div>
            <div className="text-sm text-gray-400">Total P&L</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{formatPercent(stats.avg_win_rate)}</div>
            <div className="text-sm text-gray-400">Avg Win Rate</div>
          </div>
        </div>
      )}

      {/* Period Tabs and Admin Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 flex-1">
        {(['daily', 'weekly', 'monthly', 'all_time'] as Period[]).map(period => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedPeriod === period
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {getPeriodLabel(period)}
          </button>
        ))}
        </div>
        
        {/* Admin Only: Force Update Button */}
        {isAdmin && (
          <button
            onClick={handleForceUpdate}
            disabled={updating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Force recalculate leaderboard rankings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {updating ? 'Updating...' : 'Force Update'}
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading leaderboard...</div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-400 mb-4">Error: {error}</p>
          <button
            onClick={fetchLeaderboard}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && leaderboard.length === 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
          <p className="text-gray-400 mb-2">No rankings available for this period yet.</p>
          <p className="text-gray-500 text-sm">Be the first to climb the leaderboard!</p>
        </div>
      )}

      {/* Leaderboard Table */}
      {!loading && !error && leaderboard.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Rank</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Bot</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Trader</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Total P&L</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Win Rate</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Trades</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Sharpe</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Drawdown</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {leaderboard.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-white font-semibold">#{entry.rank}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {entry.avatar_image ? (
                          <img 
                            src={entry.avatar_image} 
                            alt={entry.bot_name} 
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                            {entry.bot_name.charAt(0)}
                          </div>
                        )}
                        <span className="text-white font-medium">{entry.bot_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{entry.username}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${getPnLColor(entry.total_pnl)}`}>
                      {formatPnL(entry.total_pnl)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {formatPercent(entry.win_rate)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{entry.total_trades}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {entry.sharpe_ratio ? entry.sharpe_ratio.toFixed(2) : 'N/A'}
                    </td>
                    <td className={`px-4 py-3 text-right ${entry.max_drawdown < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {entry.max_drawdown !== 0 ? `${entry.max_drawdown.toFixed(2)}%` : '0.00%'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleCloneClick(entry)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
                        title="Clone this bot to your account"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Clone
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        Rankings update every hour. Keep trading to climb the leaderboard!
      </div>

      {/* Clone Bot Modal */}
      {cloneModalBot && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Clone Bot</h2>
              <button
                onClick={() => setCloneModalBot(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-300 mb-4">
                Clone <span className="font-semibold text-white">{cloneModalBot.bot_name}</span> by{' '}
                <span className="text-indigo-400">{cloneModalBot.username}</span> to your account.
              </p>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-400">P&L</div>
                    <div className={`font-semibold ${getPnLColor(cloneModalBot.total_pnl)}`}>
                      {formatPnL(cloneModalBot.total_pnl)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Win Rate</div>
                    <div className="text-white font-semibold">{formatPercent(cloneModalBot.win_rate)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Trades</div>
                    <div className="text-white font-semibold">{cloneModalBot.total_trades}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Sharpe Ratio</div>
                    <div className="text-white font-semibold">
                      {cloneModalBot.sharpe_ratio ? cloneModalBot.sharpe_ratio.toFixed(2) : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Bot ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={cloneFormData.new_id}
                  onChange={(e) => setCloneFormData({ ...cloneFormData, new_id: e.target.value })}
                  placeholder="bot_my_clone"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Unique identifier. Use lowercase, numbers, hyphens, and underscores only.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Bot Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={cloneFormData.new_name}
                  onChange={(e) => setCloneFormData({ ...cloneFormData, new_name: e.target.value })}
                  placeholder="My Awesome Bot"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-3 text-sm text-blue-300">
                <p className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Cloned bots will start in paper trading mode for safety. You can customize the prompt, strategy, and settings after cloning.
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCloneModalBot(null)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCloneSubmit}
                disabled={cloning}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cloning ? 'Cloning...' : 'Clone Bot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
