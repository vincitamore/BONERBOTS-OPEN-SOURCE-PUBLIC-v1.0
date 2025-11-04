/**
 * Bot Management Dashboard
 * 
 * Lists all trading bots with actions to create, edit, pause, and delete
 */

import React, { useState } from 'react';
import { useConfiguration } from '../../context/ConfigurationContext';
import { useNavigate } from 'react-router-dom';

export const BotsPage: React.FC = () => {
  const { bots, loading, pauseBot, deleteBot, resetBot } = useConfiguration();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const handlePauseToggle = async (botId: string, currentlyPaused: boolean) => {
    try {
      setActionLoading(botId);
      await pauseBot(botId, !currentlyPaused);
    } catch (error) {
      console.error('Failed to pause/unpause bot:', error);
      alert('Failed to pause/unpause bot. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReset = async (botId: string, botName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to reset "${botName}"? This will close all positions and reset the balance to the initial amount. This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      setActionLoading(botId);
      await resetBot(botId);
      alert(`Bot "${botName}" has been reset successfully.`);
    } catch (error) {
      console.error('Failed to reset bot:', error);
      alert('Failed to reset bot. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (botId: string, botName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${botName}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      setActionLoading(botId);
      await deleteBot(botId);
    } catch (error) {
      console.error('Failed to delete bot:', error);
      alert('Failed to delete bot. Please try again.');
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
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
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
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
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Total Bots</div>
          <div className="text-2xl font-bold text-gray-100 mt-1">{activeBots.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Paper Trading</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">{paperBots.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Live Trading</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{liveBots.length}</div>
        </div>
      </div>

      {/* Bots List */}
      {activeBots.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
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
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Create Your First Bot
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {activeBots.map((bot) => (
            <div
              key={bot.id}
              className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-100">{bot.name}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                        bot.trading_mode === 'paper'
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-green-900/50 text-green-300'
                      }`}
                    >
                      {bot.trading_mode === 'paper' ? 'Paper Trading' : 'Live Trading'}
                    </span>
                    {bot.is_paused && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-orange-900/50 text-orange-300 shrink-0">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">{bot.prompt}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
                    <span>
                      <span className="font-medium">Provider:</span> {bot.provider_name || 'Unknown'}
                    </span>
                    <span>
                      <span className="font-medium">Created:</span>{' '}
                      {new Date(bot.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex flex-row lg:flex-col gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/config/bots/${bot.id}`)}
                    className="flex-1 lg:flex-initial px-3 sm:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handlePauseToggle(bot.id, bot.is_paused)}
                    disabled={actionLoading === bot.id}
                    className={`flex-1 lg:flex-initial px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      bot.is_paused
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {actionLoading === bot.id ? '...' : bot.is_paused ? 'Resume' : 'Pause'}
                  </button>
                  {bot.trading_mode === 'paper' && (
                    <button
                      onClick={() => handleReset(bot.id, bot.name)}
                      disabled={actionLoading === bot.id}
                      className="flex-1 lg:flex-initial px-3 sm:px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === bot.id ? '...' : 'Reset'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(bot.id, bot.name)}
                    disabled={actionLoading === bot.id}
                    className="flex-1 lg:flex-initial px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

