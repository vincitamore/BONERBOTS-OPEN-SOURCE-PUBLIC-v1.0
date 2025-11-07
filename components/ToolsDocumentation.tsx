import React, { useState } from 'react';
import { TOOL_CATEGORIES } from '../utils/botTemplates';

interface ToolsDocumentationProps {
  onClose?: () => void;
  mode?: 'modal' | 'inline';
}

const ToolsDocumentation: React.FC<ToolsDocumentationProps> = ({ onClose, mode = 'modal' }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(TOOL_CATEGORIES[0].name);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = TOOL_CATEGORIES.map(category => ({
    ...category,
    tools: category.tools.filter(tool =>
      searchQuery === '' ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.tools.length > 0);

  const selectedCategoryData = filteredCategories.find(c => c.name === selectedCategory) || filteredCategories[0];

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-700 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Bot Context & Available Tools</h2>
            <p className="text-gray-400">
              Automatic context provided to your bot every trading cycle, plus analytical tools for market analysis
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full px-4 py-2 pl-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Categories */}
        <div className="w-64 border-r border-gray-700 overflow-y-auto bg-gray-800/50">
          <div className="p-4 space-y-1">
            {filteredCategories.map((category) => (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(category.name)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  selectedCategory === category.name
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <div className="font-medium">{category.name}</div>
                <div className="text-sm opacity-75">{category.tools.length} tools</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content - Tools */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedCategoryData ? (
            <div className="space-y-4">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{selectedCategoryData.name}</h3>
                <p className="text-gray-400">
                  {selectedCategoryData.name === 'Automatic Context (Provided Every Turn)' &&
                    'These variables are automatically provided to your bot at the start of every trading cycle. You do NOT need to call any functions to access this data - it\'s already included in your prompt context.'}
                  {selectedCategoryData.name === 'Basic Market Data' &&
                    'Essential market data functions for price information and changes.'}
                  {selectedCategoryData.name === 'Statistical Analysis' &&
                    'Mathematical functions for analyzing data distributions and relationships.'}
                  {selectedCategoryData.name === 'Technical Indicators' &&
                    'Classic technical analysis indicators for trend, momentum, and volatility.'}
                  {selectedCategoryData.name === 'Advanced Analysis' &&
                    'Sophisticated analytical tools for pattern recognition and trend quantification.'}
                  {selectedCategoryData.name === 'Celestial/Astrological Data' &&
                    'Astronomical and astrological data for cosmic market analysis. Moon phases, planetary positions, zodiac signs, and more. Powered by local astronomical calculations (no API required).'}
                  {selectedCategoryData.name === 'Risk Management' &&
                    'Tools for calculating optimal position sizes and risk-reward ratios.'}
                  {selectedCategoryData.name === 'Advanced Computational Tools' &&
                    'Powerful custom calculation and simulation capabilities for complex strategies.'}
                </p>
              </div>

              {selectedCategoryData.tools.map((tool, index) => (
                <div
                  key={index}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-5 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-white mb-2 font-mono">{tool.name}()</h4>
                      <p className="text-gray-300 mb-3">{tool.description}</p>
                      <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2">
                        <span className="text-gray-400 text-sm">Parameters: </span>
                        <span className="text-indigo-300 text-sm font-mono">{tool.params}</span>
                      </div>
                      
                      {/* Example Usage */}
                      {tool.name === 'custom_equation' && (
                        <div className="mt-3 bg-gray-900 border border-gray-700 rounded p-3">
                          <div className="text-xs text-gray-400 mb-2">Example Usage:</div>
                          <code className="text-xs text-green-400 block">
                            {`{\n  "action": "ANALYZE",\n  "tool": "custom_equation",\n  "parameters": {\n    "expression": "(rsi - 50) * 2",\n    "variables": {"rsi": 65.3}\n  }\n}`}
                          </code>
                        </div>
                      )}
                      
                      {tool.name === 'kelly' && (
                        <div className="mt-3 bg-gray-900 border border-gray-700 rounded p-3">
                          <div className="text-xs text-gray-400 mb-2">Example Usage:</div>
                          <code className="text-xs text-green-400 block">
                            {`{\n  "action": "ANALYZE",\n  "tool": "kelly",\n  "parameters": {\n    "winRate": 0.55,\n    "avgWin": 100,\n    "avgLoss": 60\n  }\n}`}
                          </code>
                        </div>
                      )}
                      
                      {tool.name === 'rsi' && (
                        <div className="mt-3 bg-gray-900 border border-gray-700 rounded p-3">
                          <div className="text-xs text-gray-400 mb-2">Example Usage:</div>
                          <code className="text-xs text-green-400 block">
                            {`{\n  "action": "ANALYZE",\n  "tool": "rsi",\n  "parameters": {\n    "symbol": "BTCUSDT",\n    "period": 14\n  }\n}`}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">
              No tools found matching "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-700 p-6 bg-gray-800/50">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-gray-300">
            <p className="font-medium mb-1">Using Tools in Your Bot Prompt:</p>
            <p className="text-gray-400">
              Reference these tools in your bot's decision-making logic. For multi-step analysis (advanced bots), 
              use the ANALYZE action in iterations 1-4, then return final trading decisions in iteration 5.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (mode === 'inline') {
    return <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">{content}</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-6xl w-full h-[85vh] overflow-hidden flex flex-col">
        {content}
      </div>
    </div>
  );
};

export default ToolsDocumentation;

