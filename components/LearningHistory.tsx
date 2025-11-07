import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../utils/apiConfig';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = getApiBaseUrl();

interface LearningHistoryProps {
  botId: string;
  botName: string;
}

interface HistorySummary {
  summary: string;
  summarizedCount: number;
  summarizedFrom: string;
  summarizedTo: string;
  generatedAt: number;
  tokenCount?: number;
}

const LearningHistory: React.FC<LearningHistoryProps> = ({ botId, botName }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<HistorySummary | null>(null);
  const [hasSummary, setHasSummary] = useState(false);

  useEffect(() => {
    fetchHistorySummary();
  }, [botId]);

  const fetchHistorySummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/bots/${botId}/history-summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch learning history');
      }

      const data = await response.json();
      setHasSummary(data.hasSummary);
      
      if (data.summary) {
        setSummaryData(data.summary);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load learning history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading learning history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchHistorySummary}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!hasSummary || !summaryData) {
    return (
      <div className="text-center py-12">
        <div className="mb-4">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Learning History Yet</h3>
        <p className="text-gray-400 mb-4">
          {botName} hasn't traded enough to generate a learning summary yet.
        </p>
        <p className="text-sm text-gray-500">
          After accumulating substantial trading history (~25,000 tokens), the bot will automatically
          generate a comprehensive reflection on its performance, patterns, and learnings.
        </p>
      </div>
    );
  }

  const formattedDate = (timestamp: number) => new Date(timestamp).toLocaleString();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">{botName}'s Learning Journal</h3>
            <p className="text-sm text-gray-300">
              Compressed insights from {summaryData.summarizedCount} historical trading decisions
            </p>
          </div>
          {summaryData.tokenCount && (
            <div className="text-right">
              <div className="text-xs text-gray-400">Summary Size</div>
              <div className="text-lg font-semibold text-indigo-300">
                {summaryData.tokenCount.toLocaleString()} tokens
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-3 flex gap-4 text-xs text-gray-400">
          <div>
            <span className="font-medium">Period: </span>
            {new Date(summaryData.summarizedFrom).toLocaleDateString()} - {new Date(summaryData.summarizedTo).toLocaleDateString()}
          </div>
          <div>
            <span className="font-medium">Generated: </span>
            {formattedDate(summaryData.generatedAt)}
          </div>
        </div>
      </div>

      {/* Summary Content */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="prose prose-invert max-w-none">
          <div className="text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
            {summaryData.summary}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">About Learning History</p>
            <p className="text-blue-200/80">
              This is an AI-generated reflection by {botName} on past trading performance. The summary
              preserves the bot's personality while analyzing patterns, mistakes, successes, and actionable
              improvements. This learning context is automatically included in future trading decisions to
              help the bot continuously improve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningHistory;

