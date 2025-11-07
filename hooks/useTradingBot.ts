// hooks/useTradingBot.ts
// REFACTORED: Frontend is now a passive viewer that displays server-managed state
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { SerializableBotState, Market, ArenaState } from '../types';
import { subscribeToStateChanges } from '../services/stateService';
import { getApiBaseUrl } from '../utils/apiConfig';
import { useToast } from '../context/ToastContext';

const API_BASE_URL = getApiBaseUrl();

const useTradingBots = (isGloballyPaused: boolean) => {
    const { showToast, confirm } = useToast();
    const [bots, setBots] = useState<SerializableBotState[]>([]);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const initialBalanceRef = useRef<Map<string, number>>(new Map());
    const unsubscribeRef = useRef<(() => void) | null>(null);
    
    // Subscribe to server state updates via WebSocket
    useEffect(() => {
        console.log('🔌 Subscribing to server state updates...');
        
        // Initial state fetch
        const fetchInitialState = async () => {
            try {
                const response = await axios.get<ArenaState>(`${API_BASE_URL}/api/state`);
                const { bots: serverBots, marketData } = response.data;
                
                console.log('📦 Loaded initial state from server:', {
                    bots: serverBots?.length || 0,
                    markets: marketData?.length || 0
                });
                
                if (serverBots && serverBots.length > 0) {
                    setBots(serverBots);
                    
                    // Set initial balances from server-provided values
                    serverBots.forEach(bot => {
                        initialBalanceRef.current.set(bot.id, bot.initialBalance);
                    });
                }
                
                if (marketData) {
                    setMarkets(marketData);
                }
                
                setIsLoading(false);
            } catch (error) {
                console.error('Failed to fetch initial state:', error);
                setIsLoading(false);
            }
        };
        
        fetchInitialState();
        
        // Subscribe to real-time updates
        const unsubscribe = subscribeToStateChanges((newState: ArenaState) => {
            console.log('📡 Received state update from server');
            
            if (newState.bots) {
                setBots(newState.bots);
                
                // Update initial balances for any new bots from server-provided values
                newState.bots.forEach(bot => {
                    if (!initialBalanceRef.current.has(bot.id)) {
                        initialBalanceRef.current.set(bot.id, bot.initialBalance);
                    }
                });
            }
            
            if (newState.marketData) {
                setMarkets(newState.marketData);
            }
        });
        
        unsubscribeRef.current = unsubscribe;
        
        return () => {
            console.log('🔌 Unsubscribing from server state updates');
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    /**
     * Toggle bot pause state (via server API)
     */
    const toggleBotPause = useCallback(async (botId: string) => {
        try {
            console.log(`🔄 Toggling pause for bot ${botId}`);
            await axios.post(`${API_BASE_URL}/api/bots/${botId}/pause`);
            // State update will come via WebSocket
        } catch (error) {
            console.error('Failed to toggle bot pause:', error);
            showToast('Failed to toggle bot pause. Please try again.', 'error');
        }
    }, [showToast]);

    /**
     * Manually close a position (via server API)
     */
    const manualClosePosition = useCallback(async (botId: string, positionId: string) => {
        try {
            console.log(`🖐️ Manually closing position ${positionId} for bot ${botId}`);
            
            const response = await axios.post(`${API_BASE_URL}/api/bots/${botId}/close-position`, {
                positionId
            });
            
            if (response.data.notes && response.data.notes.length > 0) {
                showToast(response.data.notes.join('\n'), 'info');
            } else {
                showToast('Position closed successfully', 'success');
            }
            
            // State update will come via WebSocket
        } catch (error: any) {
            console.error('Failed to close position:', error);
            const message = error.response?.data?.error || 'Failed to close position. Please try again.';
            showToast(message, 'error');
        }
    }, [showToast]);

    /**
     * Reset a bot (via server API)
     */
    const resetBot = useCallback(async (botId: string) => {
        console.log(`🔄 resetBot called for: ${botId}`);
        
        const botToReset = bots.find(b => b.id === botId);
        if (botToReset && botToReset.tradingMode === 'real') {
            console.log('❌ Cannot reset real trading bot');
            showToast("Cannot reset a bot that is trading with real funds.", 'error');
            return;
        }
        
        console.log('Showing confirmation dialog...');
        const confirmed = await confirm({
            title: 'Reset Bot',
            message: 'Are you sure you want to reset this bot? This will clear all positions, trades, and AI logs. Learning history will be preserved.',
            confirmText: 'Reset',
            cancelText: 'Cancel',
            type: 'warning',
        });

        if (!confirmed) {
            console.log('User cancelled reset');
            return;
        }
        
        // Ask if they also want to clear learning history
        const clearLearning = await confirm({
            title: 'Clear Learning History?',
            message: 'Do you also want to clear this bot\'s learning history? If you choose "Yes", the bot will start fresh with no accumulated knowledge. If you choose "No", it will retain its learnings.',
            confirmText: 'Yes, Clear Learning',
            cancelText: 'No, Keep Learning',
            type: 'warning',
        });
        
        console.log(`User confirmed reset, clearLearning=${clearLearning}`);
        
        try {
            // Call the backend API to reset the bot
            const token = localStorage.getItem('auth_token');
            const url = `${API_BASE_URL}/api/v2/bots/${botId}/reset${clearLearning ? '?clearLearning=true' : ''}`;
            console.log(`Calling API: ${url}`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
            });

            console.log('API response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API error:', errorData);
                throw new Error(errorData.error || 'Failed to reset bot');
            }

            const result = await response.json();
            console.log(`✅ Backend reset successful:`, result);

            const learningMsg = result.learning_cleared ? 'Learning history cleared.' : 'Learning history preserved.';
            showToast(`Bot reset successful! ${learningMsg} Reloading...`, 'success');

            // Force a full page reload to ensure clean state
            console.log('🔄 Reloading page to refresh bot state...');
            setTimeout(() => {
                window.location.reload();
            }, 500);
            
        } catch (error) {
            console.error('❌ Error resetting bot:', error);
            showToast(`Failed to reset bot: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }, [bots, showToast, confirm]);

    /**
     * Force bot to process a trading turn (via server API)
     */
    const forceProcessTurn = useCallback(async (botId?: string) => {
        try {
            console.log(`⚡ Forcing trading turn for bot ${botId || 'all'}`);
            
            if (botId) {
                await axios.post(`${API_BASE_URL}/api/bots/${botId}/force-turn`);
            } else {
                // Force turn for all bots (not currently implemented, could add if needed)
                console.warn('Force turn for all bots not yet implemented');
            }
            
            // State update will come via WebSocket
        } catch (error) {
            console.error('Failed to force trading turn:', error);
            showToast('Failed to force trading turn. Please try again.', 'error');
        }
    }, [showToast]);

    /**
     * Force generate learning history summary for a bot (via server API)
     */
    const forceSummarize = useCallback(async (botId: string) => {
        try {
            console.log(`📚 Force summarizing history for bot ${botId}`);
            showToast('Generating learning summary... This may take a minute.', 'info');
            
            const token = localStorage.getItem('auth_token');
            const response = await axios.post(
                `${API_BASE_URL}/api/v2/bots/${botId}/force-summarize`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (response.data.success) {
                showToast(response.data.message, 'success');
            } else {
                showToast(response.data.message || 'Summarization was not needed', 'info');
            }
        } catch (error: any) {
            console.error('Failed to force summarization:', error);
            const message = error.response?.data?.message || 'Failed to generate learning summary. Please try again.';
            showToast(message, 'error');
        }
    }, [showToast]);

    /**
     * Clear only the learning history (doesn't reset trades/positions)
     */
    const clearLearningHistory = useCallback(async (botId: string) => {
        console.log(`🧠 clearLearningHistory called for: ${botId}`);
        
        const bot = bots.find(b => b.id === botId);
        if (!bot) {
            console.log('❌ Bot not found');
            return;
        }
        
        console.log('Showing confirmation dialog...');
        const confirmed = await confirm({
            title: 'Clear Learning History',
            message: `Are you sure you want to clear ${bot.name}'s learning history? This will erase all accumulated knowledge and insights. Trades, positions, and balance will NOT be affected.`,
            confirmText: 'Clear Learning',
            cancelText: 'Cancel',
            type: 'warning',
        });

        if (!confirmed) {
            console.log('User cancelled learning clear');
            return;
        }
        
        console.log('User confirmed, clearing learning history...');
        
        try {
            const token = localStorage.getItem('auth_token');
            const url = `${API_BASE_URL}/api/v2/bots/${botId}/clear-learning`;
            console.log(`Calling API: ${url}`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
            });

            console.log('API response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API error:', errorData);
                throw new Error(errorData.error || 'Failed to clear learning history');
            }

            const result = await response.json();
            console.log(`✅ Learning history cleared:`, result);

            showToast('🧠 Learning history cleared! Bot will start learning fresh.', 'success');
            
        } catch (error) {
            console.error('❌ Error clearing learning history:', error);
            showToast(`Failed to clear learning history: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }, [bots, confirm, showToast]);

    return { 
        bots, 
        markets, 
        isLoading, 
        manualClosePosition, 
        resetBot, 
        toggleBotPause, 
        forceProcessTurn,
        forceSummarize, 
        clearLearningHistory, 
        initialBalanceRef 
    };
};

export default useTradingBots;
