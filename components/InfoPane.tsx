// components/InfoPane.tsx
import React, { useState } from 'react';
import { BotState } from '../types';

interface InfoPaneProps {
  bot: BotState;
}

const InfoPane: React.FC<InfoPaneProps> = ({ bot }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Wallet address would be fetched from /api/v2/wallets API if needed for live trading

  const toggleExpansion = () => setIsExpanded(!isExpanded);

  const formattedPrompt = bot.prompt
    ? bot.prompt
        .replace(/\{\{.*?\}\}/g, (match) => `<span class="text-yellow-400">${match}</span>`)
        .replace(/\n/g, '<br />')
    : 'Prompt not available.';

  return (
    <div className="bg-gray-800/50 rounded-lg shadow-lg border border-gray-700 p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-300">AI Strategy & Data</h2>
      </div>
      
      <h3 className="text-md font-semibold text-gray-300 mb-2 flex-shrink-0">Base Prompt</h3>
      <div className={`overflow-y-auto flex-grow text-xs text-gray-400 font-mono pr-2 space-y-2 ${isExpanded ? '' : 'max-h-24'}`}>
        <div dangerouslySetInnerHTML={{ __html: formattedPrompt }} />
      </div>
       <div className="pt-2 border-t border-gray-700 mt-2">
            <button onClick={toggleExpansion} className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold">
                {isExpanded ? 'Show Less' : 'Show Full Prompt...'}
            </button>
       </div>
    </div>
  );
};

export default InfoPane;
