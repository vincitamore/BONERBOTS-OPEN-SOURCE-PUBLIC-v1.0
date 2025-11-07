// components/BotCard.tsx
import React from 'react';
import { SerializableBotState, AppMode, ModalContentType } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import RefreshIcon from './icons/RefreshIcon';
import ResetIcon from './icons/ResetIcon';
import Tooltip from './Tooltip';

interface BotCardProps {
  bot: SerializableBotState;
  rank: number;
  mode: AppMode;
  initialBalance?: number;
  onOpenModal: (content: ModalContentType) => void;
  // Admin functions - only passed in broadcast mode
  onTogglePause?: () => void;
  onForceTurn?: () => void;
  onReset?: () => void;
  onForceSummarize?: () => void;
  onClearLearning?: () => void;
}

const botColorMap: { [key: string]: string } = {
    'Escaped Monkey': 'border-indigo-400',
    'Mastermind': 'border-red-400',
    'DEGEN LIVE': 'border-yellow-400',
    'Astrologer': 'border-purple-400',
    'Elon Musk': 'border-sky-400',
    'Ani': 'border-orange-400',
    'Mika': 'border-violet-400',
};

const getPnlColor = (value: number) => {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-gray-400';
};

const BotCard: React.FC<BotCardProps> = ({ bot, rank, mode, initialBalance = 10000, onOpenModal, onTogglePause, onForceTurn, onReset, onForceSummarize, onClearLearning }) => {
    const { portfolio, realizedPnl, winRate, tradeCount, isPaused, tradingMode, avatarUrl } = bot;
    const { totalValue, balance, pnl: unrealizedPnl } = portfolio;
    const isLive = tradingMode === 'real';

    const totalPnl = realizedPnl + unrealizedPnl;
    const totalPnlPercent = initialBalance > 0 ? ((totalValue - initialBalance) / initialBalance) * 100 : 0;
    
    // Use database avatar if available, otherwise generate from bot ID
    const avatarSrc = avatarUrl || `https://robohash.org/${bot.id}.png?set=set1&size=200x200`;
    
    return (
        <div className={`bg-gray-800/50 rounded-xl shadow-2xl border-2 ${isPaused ? 'border-yellow-500' : (isLive ? 'border-red-500' : botColorMap[bot.name] || 'border-gray-700')} p-4 space-y-3 flex flex-col`}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                    <img src={avatarSrc} alt={bot.name} className="w-12 h-12 rounded-full border-2 border-gray-600 object-cover" />
                    <div>
                        <h2 className="text-lg font-bold text-white">{bot.name}</h2>
                        <div className="flex items-center space-x-2">
                             <p className="text-xs text-gray-400">LLM: <span className="font-semibold">{bot.providerName || bot.provider.toUpperCase()}</span></p>
                             {isLive && <span className="bg-red-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md animate-pulse">LIVE TRADING</span>}
                        </div>
                    </div>
                </div>
                 <div className="text-right">
                    <p className="text-2xl font-bold text-white">#{rank}</p>
                    <p className={`text-xl font-bold ${getPnlColor(totalPnl)}`}>{totalPnlPercent.toFixed(2)}%</p>
                </div>
            </div>

             {mode === 'broadcast' && (
                <div className="flex items-center justify-center space-x-3 bg-gray-900/50 p-2 rounded-md">
                    <Tooltip content={isPaused ? "Resume Bot" : "Pause Bot"} position="top">
                        <button onClick={onTogglePause} className="text-gray-400 hover:text-white transition-colors">
                        {isPaused ? <PlayIcon className="h-6 w-6 text-green-400" /> : <PauseIcon className="h-6 w-6 text-yellow-400" />}
                    </button>
                    </Tooltip>
                    
                    <Tooltip content="Force Trading Turn" position="top">
                        <button onClick={onForceTurn} className="text-gray-400 hover:text-white transition-colors">
                        <RefreshIcon className="h-6 w-6" />
                    </button>
                    </Tooltip>
                    
                    <Tooltip content="Generate Learning Summary" position="top">
                        <button onClick={onForceSummarize} className="text-gray-400 hover:text-indigo-400 transition-colors">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </button>
                    </Tooltip>
                    
                    <Tooltip content="Clear Learning History (keeps trades/positions)" position="top">
                        <button onClick={onClearLearning} className="text-gray-400 hover:text-purple-400 transition-colors">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </Tooltip>
                    
                    <Tooltip content={isLive ? "Cannot reset a live bot" : "Reset Bot (clears everything)"} position="top">
                        <button onClick={onReset} disabled={isLive} className="text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <ResetIcon className="h-6 w-6 text-red-400" />
                    </button>
                    </Tooltip>
                </div>
            )}

            {/* Portfolio Summary */}
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700 space-y-2 text-sm">
                <div className="flex justify-between items-baseline">
                    <span className="text-gray-400">TOTAL VALUE</span>
                    <span className="font-bold text-lg text-white">${(totalValue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-gray-400">AVAILABLE BALANCE</span>
                    <span className="text-white font-medium">${(balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">UNREALIZED PNL</span>
                    <span className={`font-medium ${getPnlColor(unrealizedPnl)}`}>${(unrealizedPnl ?? 0).toFixed(2)}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-gray-400">REALIZED PNL (Fee Incl.)</span>
                    <span className={`font-medium ${getPnlColor(realizedPnl)}`}>${(realizedPnl ?? 0).toFixed(2)}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-gray-400">WIN RATE</span>
                    <span className="text-white font-medium">{(winRate * 100).toFixed(1)}% ({tradeCount} trades)</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-5 gap-2 text-xs pt-2 border-t border-gray-700">
                <Tooltip content="View open positions" position="top">
                    <button onClick={() => onOpenModal('positions')} className="bg-gray-700/50 hover:bg-gray-700/80 text-gray-300 py-2 rounded-md transition-colors">
                        Positions ({bot.portfolio.positions.length})
                    </button>
                </Tooltip>
                <Tooltip content="View trade history" position="top">
                    <button onClick={() => onOpenModal('history')} className="bg-gray-700/50 hover:bg-gray-700/80 text-gray-300 py-2 rounded-md transition-colors">
                        History ({bot.orders.length})
                    </button>
                </Tooltip>
                <Tooltip content="View AI decision logs" position="top">
                    <button onClick={() => onOpenModal('log')} className="bg-gray-700/50 hover:bg-gray-700/80 text-gray-300 py-2 rounded-md transition-colors">
                        AI Log
                    </button>
                </Tooltip>
                <Tooltip content="View learning history summary" position="top">
                    <button onClick={() => onOpenModal('learning')} className="bg-indigo-700/50 hover:bg-indigo-700/80 text-indigo-200 py-2 rounded-md transition-colors">
                        Learning
                    </button>
                </Tooltip>
                <Tooltip content="View bot info" position="top">
                    <button onClick={() => onOpenModal('info')} className="bg-gray-700/50 hover:bg-gray-700/80 text-gray-300 py-2 rounded-md transition-colors">
                        Info
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};

export default BotCard;