/**
 * Bot Management Dashboard
 * 
 * Lists all trading bots with actions to create, edit, pause, and delete
 */

import React, { useState } from 'react';
import { useConfiguration } from '../../context/ConfigurationContext';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';

export const BotsPage: React.FC = () => {
  const { bots, loading, pauseBot, deleteBot, resetBot } = useConfiguration();
  const { showToast, confirm } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const handlePauseToggle = async (botId: string, currentlyPaused: boolean) => {
    try {
      setActionLoading(botId);
      await pauseBot(botId, !currentlyPaused);
    } catch (error) {
      console.error('Failed to pause/unpause bot:', error);
      showToast('Failed to pause/unpause bot. Please try again.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReset = async (botId: string, botName: string) => {
    const confirmed = await confirm({
      title: 'Reset Bot',
      message: `Are you sure you want to reset "${botName}"? This will close all positions and reset the balance to the initial amount. This action cannot be undone.`,
      confirmText: 'Reset',
      cancelText: 'Cancel',
      type: 'warning',
    });
    
    if (!confirmed) return;

    try {
      setActionLoading(botId);
      await resetBot(botId);
      showToast(`Bot "${botName}" has been reset successfully.`, 'success');
    } catch (error) {
      console.error('Failed to reset bot:', error);
      showToast('Failed to reset bot. Please try again.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (botId: string, botName: string) => {
    const confirmed = await confirm({
      title: 'Delete Bot',
      message: `Are you sure you want to delete "${botName}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
    });
    
    if (!confirmed) return;

    try {
      setActionLoading(botId);
      await deleteBot(botId);
      showToast(`Bot "${botName}" deleted successfully.`, 'success');
    } catch (error) {
      console.error('Failed to delete bot:', error);
      showToast('Failed to delete bot. Please try again.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const activeBots = bots.filter(b => b.is_active);
  const paperBots = activeBots.filter(b => b.trading_mode === 'paper');
  const liveBots = activeBots.filter(b => b.trading_mode === 'real');

  if (loading && bots.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading bots...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6" style={{ maxWidth: '1400px' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100">Trading Bots</h1>
          <p className="text-gray-400 mt-1 text-sm sm:text-base">
            Manage your AI trading bots, configure their strategies, and monitor their performance
          </p>
        </div>
        <button
          onClick={() => navigate('/config/bots/new')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Create New Bot</span>
          <span className="sm:hidden">Create Bot</span>
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700/50 backdrop-blur-sm">
          <div className="text-gray-400 text-sm font-medium">Total Bots</div>
          <div className="text-3xl font-bold text-gray-100 mt-2">{activeBots.length}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700/50 backdrop-blur-sm">
          <div className="text-gray-400 text-sm font-medium">Paper Trading</div>
          <div className="text-3xl font-bold text-blue-400 mt-2">{paperBots.length}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700/50 backdrop-blur-sm">
          <div className="text-gray-400 text-sm font-medium">Live Trading</div>
          <div className="text-3xl font-bold text-emerald-400 mt-2">{liveBots.length}</div>
        </div>
      </div>

      {/* Bots List */}
      {activeBots.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-12 text-center border border-gray-700/50 backdrop-blur-sm">
          <svg
            className="w-16 h-16 text-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No Bots Yet</h3>
          <p className="text-gray-500 mb-6">
            Get started by creating your first trading bot
          </p>
          <button
            onClick={() => navigate('/config/bots/new')}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-lg"
          >
            Create Your First Bot
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {activeBots.map((bot) => (
            <div
              key={bot.id}
              className="bg-gray-800/50 rounded-lg p-5 border border-gray-700/50 hover:border-gray-600/50 transition-all hover:shadow-lg backdrop-blur-sm"
            >
              <div className="flex flex-col gap-4">
                {/* Bot Header */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-100">{bot.name}</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                        bot.trading_mode === 'paper'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {bot.trading_mode === 'paper' ? 'Paper' : 'Live'}
                    </span>
                    {bot.is_paused && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2 leading-relaxed">{bot.prompt}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                      <span className="font-medium">{bot.provider_name || 'Unknown'}</span>
                    </span>
                    <span className="text-gray-600">•</span>
                    <span>
                      {new Date(bot.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700/50">
                  <button
                    onClick={() => navigate(`/config/bots/${bot.id}`)}
                    className="flex-1 min-w-[100px] px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-100 rounded-lg text-sm font-medium transition-colors border border-gray-600/30"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handlePauseToggle(bot.id, bot.is_paused)}
                    disabled={actionLoading === bot.id}
                    className={`flex-1 min-w-[100px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      bot.is_paused
                        ? 'bg-emerald-600/80 hover:bg-emerald-600 text-white border border-emerald-500/30'
                        : 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-100 border border-gray-600/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {actionLoading === bot.id ? '...' : bot.is_paused ? 'Resume' : 'Pause'}
                  </button>
                  {bot.trading_mode === 'paper' && (
                    <button
                      onClick={() => handleReset(bot.id, bot.name)}
                      disabled={actionLoading === bot.id}
                      className="flex-1 min-w-[100px] px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-500/30"
                    >
                      {actionLoading === bot.id ? '...' : 'Reset'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(bot.id, bot.name)}
                    disabled={actionLoading === bot.id}
                    className="flex-1 min-w-[100px] px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30"
                  >
                    {actionLoading === bot.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

