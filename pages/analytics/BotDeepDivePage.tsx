// pages/analytics/BotDeepDivePage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { StatCard } from '../../components/analytics/StatCard';
import { TimeSeriesChart } from '../../components/charts/TimeSeriesChart';
import { BarChart } from '../../components/charts/BarChart';
import axios from 'axios';
import { getApiBaseUrl } from '../../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

interface BotDetails {
  id: string;
  name: string;
  prompt: string;
  provider_name: string;
  trading_mode: string;
  is_active: boolean;
  is_paused: boolean;
}

interface Trade {
  id: number;
  symbol: string;
  type: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  pnl: number;
  timestamp: string;
  closed_at: string | null;
}

interface PerformanceData {
  totalPnL: number;
  totalPnLPercent: number;
  tradeCount: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
  avgTradeDuration: number; // in hours
  valueHistory: { time: number; value: number }[];
  drawdownHistory: { time: number; value: number }[];
}

export const BotDeepDivePage: React.FC = () => {
  const { botId } = useParams<{ botId: string }>();
  const [bot, setBot] = useState<BotDetails | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    if (botId) {
      fetchBotData();
    }
  }, [botId, timeRange]);

  const fetchBotData = async () => {
    try {
      setLoading(true);
      
      const [botResponse, performanceResponse, tradesResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v2/bots/${botId}`),
        axios.get(`${API_BASE_URL}/api/v2/analytics/performance/${botId}`, {
          params: { timeRange }
        }),
        axios.get(`${API_BASE_URL}/api/v2/analytics/trades/${botId}`, {
          params: { timeRange, limit: 50 }
        })
      ]);

      setBot(botResponse.data);
      setPerformance(performanceResponse.data);
      setTrades(tradesResponse.data);
    } catch (error) {
      console.error('Failed to fetch bot data:', error);
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

  if (!bot || !performance) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-white mb-2">Bot Not Found</h2>
        <p className="text-gray-400 mb-6">The requested bot could not be found.</p>
        <Link 
          to="/analytics" 
          className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
        >
          Back to Analytics
        </Link>
      </div>
    );
  }

  const winTrades = trades.filter(t => t.pnl > 0);
  const lossTrades = trades.filter(t => t.pnl < 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/analytics" className="text-gray-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-white">{bot.name}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              bot.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
            }`}>
              {bot.is_active ? (bot.is_paused ? 'Paused' : 'Active') : 'Inactive'}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              bot.trading_mode === 'real' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {bot.trading_mode === 'real' ? 'Live Trading' : 'Paper Trading'}
            </span>
          </div>
          <p className="text-gray-400">{bot.provider_name} · Detailed Performance Analysis</p>
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
              {range === '24h' ? '24h' : range === '7d' ? '7d' : range === '30d' ? '30d' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total P&L"
          value={`$${performance.totalPnL.toFixed(2)}`}
          change={performance.totalPnLPercent}
          valueColor={performance.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <StatCard
          title="Win Rate"
          value={`${performance.winRate.toFixed(1)}%`}
          valueColor={performance.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}
        />
        <StatCard
          title="Profit Factor"
          value={performance.profitFactor.toFixed(2)}
          valueColor={performance.profitFactor >= 1.5 ? 'text-green-400' : performance.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}
        />
        <StatCard
          title="Sharpe Ratio"
          value={performance.sharpeRatio.toFixed(2)}
          valueColor={performance.sharpeRatio >= 1 ? 'text-green-400' : performance.sharpeRatio >= 0 ? 'text-yellow-400' : 'text-red-400'}
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Trades"
          value={performance.tradeCount}
        />
        <StatCard
          title="Avg Win"
          value={`$${performance.avgWin.toFixed(2)}`}
          valueColor="text-green-400"
        />
        <StatCard
          title="Avg Loss"
          value={`$${performance.avgLoss.toFixed(2)}`}
          valueColor="text-red-400"
        />
        <StatCard
          title="Max Drawdown"
          value={`${performance.maxDrawdown.toFixed(2)}%`}
          valueColor="text-yellow-400"
        />
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 gap-6">
        <TimeSeriesChart
          title="Portfolio Value Over Time"
          series={[{
            name: 'Portfolio Value',
            data: performance.valueHistory,
            color: '#6366f1'
          }]}
          height={300}
          valueFormatter={(val) => `$${val.toFixed(2)}`}
        />
        <TimeSeriesChart
          title="Drawdown Over Time"
          series={[{
            name: 'Drawdown',
            data: performance.drawdownHistory,
            color: '#ef4444'
          }]}
          height={200}
          valueFormatter={(val) => `${val.toFixed(2)}%`}
        />
      </div>

      {/* Trade Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          title="Win/Loss Distribution"
          data={[
            { label: 'Winning Trades', value: winTrades.length, color: '#10b981' },
            { label: 'Losing Trades', value: lossTrades.length, color: '#ef4444' }
          ]}
          valueFormatter={(val) => val.toString()}
        />
        <BarChart
          title="Best/Worst Trades"
          data={[
            { label: 'Best Trade', value: performance.bestTrade, color: '#10b981' },
            { label: 'Worst Trade', value: performance.worstTrade, color: '#ef4444' }
          ]}
          valueFormatter={(val) => `$${val.toFixed(2)}`}
        />
      </div>

      {/* Trade History */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Trades</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                <th className="pb-3 font-medium">Symbol</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Entry</th>
                <th className="pb-3 font-medium">Exit</th>
                <th className="pb-3 font-medium">Quantity</th>
                <th className="pb-3 font-medium">P&L</th>
                <th className="pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No trades found for this time period
                  </td>
                </tr>
              ) : (
                trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="py-3 font-medium text-white">{trade.symbol}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.type === 'LONG' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-3 text-gray-300">${trade.entry_price.toFixed(2)}</td>
                    <td className="py-3 text-gray-300">
                      {trade.exit_price ? `$${trade.exit_price.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-3 text-gray-300">{trade.quantity}</td>
                    <td className={`py-3 font-medium ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${trade.pnl.toFixed(2)}
                    </td>
                    <td className="py-3 text-gray-400">
                      {new Date(trade.timestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bot Configuration */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Bot Configuration</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400">AI Provider:</span>
            <span className="text-white font-medium">{bot.provider_name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400">Trading Mode:</span>
            <span className="text-white font-medium capitalize">{bot.trading_mode}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-400">Status:</span>
            <span className="text-white font-medium">
              {bot.is_active ? (bot.is_paused ? 'Paused' : 'Active') : 'Inactive'}
            </span>
          </div>
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Trading Prompt:</h3>
          <div className="bg-gray-900 rounded p-4 text-sm text-gray-300 font-mono whitespace-pre-wrap">
            {bot.prompt}
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Link
            to={`/config/bots/${bot.id}`}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Edit Configuration
          </Link>
        </div>
      </div>
    </div>
  );
};

