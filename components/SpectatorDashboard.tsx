// components/SpectatorDashboard.tsx
import React, { useState, useEffect } from 'react';
import { ArenaState, SerializableBotState, ModalContentType, Market } from '../types';
import { subscribeToStateChanges } from '../services/stateService';
import MarketPrices from './MarketPrices';
import PerformanceChart from './PerformanceChart';
import BotThoughtsTicker from './BotThoughtsTicker';
import BotCard from './BotCard';
import Modal from './Modal';
import PositionsTable from './PositionsTable';
import OrderHistory from './OrderHistory';
import BotStatus from './BotStatus';
import InfoPane from './InfoPane';

interface SpectatorDisplayState {
  bots: SerializableBotState[];
  marketData: Market[];
}

const SpectatorDashboard: React.FC = () => {
  const [arenaState, setArenaState] = useState<SpectatorDisplayState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBot, setSelectedBot] = useState<SerializableBotState | null>(null);
  const [modalContent, setModalContent] = useState<ModalContentType | null>(null);

  useEffect(() => {
    const handleStateChange = (newState: ArenaState) => {
      const displayState: SpectatorDisplayState = {
        bots: (newState.bots || []).map((bot) => ({
          ...bot,
          symbolCooldowns: bot.symbolCooldowns || {},
        })),
        marketData: newState.marketData || [],
      };
      setArenaState(displayState);
    };

    // Subscribe to WebSocket state changes
    const unsubscribe = subscribeToStateChanges(handleStateChange);

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  const handleOpenModal = (bot: SerializableBotState, content: ModalContentType) => {
    setSelectedBot(bot);
    setModalContent(content);
    setIsModalOpen(true);
  };

  const renderModalContent = () => {
    if (!selectedBot || !modalContent) return null;
    switch (modalContent) {
        // FIX: Added the required 'mode' prop to the PositionsTable component. In the SpectatorDashboard, the mode is always 'spectator'.
        case 'positions': return <PositionsTable positions={selectedBot.portfolio.positions} markets={arenaState!.marketData} mode="spectator" />;
        case 'history': return <OrderHistory orders={selectedBot.orders} />;
        case 'log': return <BotStatus botLogs={selectedBot.botLogs} isLoading={false} />; // Spectators don't see loading state
        // Fix: Passed the entire 'bot' object to InfoPane instead of just the 'prompt'.
        case 'info': return <InfoPane bot={selectedBot} />;
        default: return null;
    }
  };

  if (!arenaState || arenaState.bots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-400 mb-4"></div>
        <h2 className="text-2xl font-semibold text-white">Connecting to the Arena...</h2>
        <p className="text-gray-400 mt-2">Waiting for the broadcast to start. Please stand by.</p>
      </div>
    );
  }

  const sortedBots = [...arenaState.bots].sort((a, b) => b.portfolio.totalValue - a.portfolio.totalValue);

  return (
    <div className="space-y-6">
      <MarketPrices markets={arenaState.marketData} />
      <BotThoughtsTicker bots={arenaState.bots} />
      <PerformanceChart series={arenaState.bots.map(b => ({ name: b.name, data: b.valueHistory }))} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedBots.map((bot, index) => (
          <BotCard 
            key={bot.id}
            mode="spectator"
            bot={bot} 
            rank={index + 1}
            initialBalance={bot.initialBalance}
            onOpenModal={(content) => handleOpenModal(bot, content)}
          />
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="p-1 sm:p-4">
          {renderModalContent()}
        </div>
      </Modal>
    </div>
  );
};

export default SpectatorDashboard;