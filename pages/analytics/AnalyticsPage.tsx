// pages/analytics/AnalyticsPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useConfiguration } from '../../context/ConfigurationContext';
import { StatCard } from '../../components/analytics/StatCard';
import { TimeSeriesChart } from '../../components/charts/TimeSeriesChart';
import { BarChart } from '../../components/charts/BarChart';
import { PieChart } from '../../components/charts/PieChart';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface PerformanceMetrics {
  totalPnL: number;
  totalPnLPercent: number;
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

interface BotPerformance {
  botId: string;
  botName: string;
  totalPnL: number;
  tradeCount: number;
  winRate: number;
  currentValue: number;
}

export const AnalyticsPage: React.FC = () => {
  const { bots } = useConfiguration();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [botPerformances, setBotPerformances] = useState<BotPerformance[]>([]);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch overall performance metrics
      const metricsResponse = await axios.get(`${API_BASE_URL}/api/v2/analytics/performance`, {
        params: { timeRange }
      });

      // Fetch bot-specific performances
      const botPerformancesPromises = bots.map(async (bot) => {
        const response = await axios.get(`${API_BASE_URL}/api/v2/analytics/performance/${bot.id}`, {
          params: { timeRange }
        });
        return {
          botId: bot.id,
          botName: bot.name,
          ...response.data
        };
      });

      const botPerfs = await Promise.all(botPerformancesPromises);

      setMetrics(metricsResponse.data);
      setBotPerformances(botPerfs);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  if (!metrics || botPerformances.length === 0) {
    return (
      <div className="text-center py-12">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h2 className="text-xl font-semibold text-white mb-2">No Analytics Data Available</h2>
        <p className="text-gray-400 mb-6">Start trading with your bots to see performance analytics.</p>
        <Link 
          to="/dashboard" 
          className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Performance Analytics</h1>
          <p className="text-gray-400 mt-1">Historical performance and trading statistics</p>
        </div>
        <div className="flex gap-2">
          {(['24h', '7d', '30d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeRange === range
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total P&L"
          value={`$${metrics.totalPnL.toFixed(2)}`}
          change={metrics.totalPnLPercent}
          changeLabel="vs previous period"
          valueColor={metrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <StatCard
          title="Total Trades"
          value={metrics.totalTrades}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatCard
          title="Win Rate"
          value={`${metrics.winRate.toFixed(1)}%`}
          valueColor={metrics.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}
        />
        <StatCard
          title="Sharpe Ratio"
          value={metrics.sharpeRatio.toFixed(2)}
          valueColor={metrics.sharpeRatio >= 1 ? 'text-green-400' : metrics.sharpeRatio >= 0 ? 'text-yellow-400' : 'text-red-400'}
        />
      </div>

      {/* Bot Performance Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          title="Bot Performance (P&L)"
          data={botPerformances.map(bp => ({
            label: bp.botName,
            value: bp.totalPnL
          }))}
          valueFormatter={(val) => `$${val.toFixed(2)}`}
        />
        <PieChart
          title="Trade Distribution"
          data={botPerformances.map(bp => ({
            label: bp.botName,
            value: bp.tradeCount
          }))}
          valueFormatter={(val) => val.toString()}
        />
      </div>

      {/* Bot Cards with Quick Actions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Bot Performance Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {botPerformances.map((bp) => (
            <Link
              key={bp.botId}
              to={`/analytics/bot/${bp.botId}`}
              className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
            >
              <h3 className="font-semibold text-white mb-2">{bp.botName}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">P&L:</span>
                  <span className={bp.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                    ${bp.totalPnL.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Trades:</span>
                  <span className="text-white">{bp.tradeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Win Rate:</span>
                  <span className="text-white">{bp.winRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Value:</span>
                  <span className="text-white">${bp.currentValue.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-indigo-400 flex items-center gap-1">
                View Details
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/analytics/compare"
          className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors border border-gray-700"
        >
          <h3 className="font-semibold text-white mb-2">Compare Bots</h3>
          <p className="text-sm text-gray-400">Side-by-side performance comparison</p>
        </Link>
        <Link
          to="/analytics/market"
          className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors border border-gray-700"
        >
          <h3 className="font-semibold text-white mb-2">Market Analysis</h3>
          <p className="text-sm text-gray-400">Market trends and correlations</p>
        </Link>
        <button
          onClick={() => {/* TODO: Implement export */}}
          className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors border border-gray-700 text-left"
        >
          <h3 className="font-semibold text-white mb-2">Export Data</h3>
          <p className="text-sm text-gray-400">Download performance reports</p>
        </button>
      </div>
    </div>
  );
};

