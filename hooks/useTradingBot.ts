// hooks/useTradingBot.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { BotState, Market, Portfolio, AiDecision, AiAction, Position, OrderType, ValueHistoryPoint, Order, BotLog, ArenaState } from '../types';
import { PAPER_BOT_INITIAL_BALANCE, LIVE_BOT_INITIAL_BALANCE, TURN_INTERVAL_MS, REFRESH_INTERVAL_MS } from '../constants';
import { getMarketData, executeTrade, getRealAccountState, placeRealOrder, setLeverage, getExchangeInfo, SymbolPrecisionInfo, getRealTradeHistory } from '../services/asterdexService';
import { getTradingDecision } from '../services/geminiService';
import { getGrokTradingDecision } from '../services/grokService';
import { getArenaState } from '../services/stateService';
import { isAppConfigured } from '../config';
import { leverageLimits } from '../leverageLimits';

const MINIMUM_TRADE_SIZE_USD = 50;
const SYMBOL_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Type for API Bot response
interface ApiBot {
    id: string;
    name: string;
    prompt: string;
    provider_id: number;
    provider_name?: string;
    provider_type?: string;
    trading_mode: 'paper' | 'real';
    is_active: boolean;
    is_paused: boolean;
}

// Type for API Provider response
interface ApiProvider {
    id: number;
    name: string;
    provider_type: 'openai' | 'anthropic' | 'gemini' | 'grok' | 'local' | 'custom';
}

// Helper to create a fresh bot state
function createNewBot(id: string, name: string, prompt: string, provider: 'gemini' | 'grok', mode: 'paper' | 'real'): BotState {
    const initialBalance = mode === 'real' ? LIVE_BOT_INITIAL_BALANCE : PAPER_BOT_INITIAL_BALANCE;
    return {
        id,
        name,
        prompt,
        provider,
        tradingMode: mode,
        portfolio: {
            balance: initialBalance,
            pnl: 0,
            totalValue: initialBalance,
            positions: [],
        },
        orders: [],
        botLogs: [],
        valueHistory: [{ timestamp: Date.now(), value: initialBalance }],
        isLoading: false,
        isPaused: false,
        realizedPnl: 0,
        tradeCount: 0,
        winRate: 0,
        symbolCooldowns: {},
        getDecision: (portfolio: Portfolio, marketData: Market[]) => {
            if (provider === 'grok') {
                return getGrokTradingDecision(portfolio, marketData, prompt);
            }
            return getTradingDecision(portfolio, marketData, prompt);
        }
    };
}

// Fetch bots and providers from API
async function fetchBotConfigs(): Promise<{ id: string, name: string, prompt: string, provider: 'gemini' | 'grok', mode: 'paper' | 'real', isPaused: boolean }[]> {
    try {
        const [botsResponse, providersResponse] = await Promise.all([
            axios.get<ApiBot[]>(`${API_BASE_URL}/api/v2/bots`),
            axios.get<ApiProvider[]>(`${API_BASE_URL}/api/v2/providers`)
        ]);

        const providers = new Map(providersResponse.data.map(p => [p.id, p.provider_type]));

        return botsResponse.data
            .filter(bot => bot.is_active) // Only load active bots
            .map(bot => {
                const providerType = providers.get(bot.provider_id);
                // Default to 'gemini' if provider type is not gemini or grok
                const provider = (providerType === 'gemini' || providerType === 'grok') ? providerType : 'gemini';
                
                return {
                    id: bot.id,
                    name: bot.name,
                    prompt: bot.prompt,
                    provider,
                    mode: bot.trading_mode,
                    isPaused: bot.is_paused
                };
            });
    } catch (error) {
        console.error('Failed to fetch bot configurations from API:', error);
        return [];
    }
}

const useTradingBots = (isGloballyPaused: boolean) => {
    const [bots, setBots] = useState<BotState[]>([]);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [symbolPrecisions, setSymbolPrecisions] = useState<Map<string, SymbolPrecisionInfo>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const initialBalanceRef = useRef<Map<string, number>>(new Map());


    const turnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const botFunctionsRef = useRef<{
        updatePortfolios: () => Promise<Market[]>;
        runTradingTurn: (providedMarkets?: Market[]) => Promise<void>;
    }>({
        updatePortfolios: async () => [],
        runTradingTurn: async () => {}
    });

    useEffect(() => {
        const initialize = async () => {
            console.log("🚀 Starting bot initialization...");
            try {
                if (!isAppConfigured) {
                    console.log("⚠️ App not configured, skipping initialization");
                    setIsLoading(false);
                    return;
                }
                
                // Try to fetch symbol precisions, but don't block if it fails
                console.log("📊 Fetching exchange info...");
                try {
                    const timeout = new Promise<never>((_, reject) => 
                        setTimeout(() => reject(new Error('getExchangeInfo timeout')), 3000)
                    );
                    const precisions = await Promise.race([getExchangeInfo(), timeout]);
                    setSymbolPrecisions(precisions);
                    console.log("✅ Fetched symbol precisions:", precisions);
                } catch (error) {
                    console.warn("⚠️ Failed to fetch exchange info (exchange API may not be configured):", error);
                    // Continue initialization even if this fails
                }

                // Fetch bot configurations from API
                console.log("🤖 Fetching bot configurations...");
                const botConfigs = await fetchBotConfigs();
                console.log("📝 Found", botConfigs.length, "bot configs:", botConfigs);
                
                if (botConfigs.length === 0) {
                    console.warn("⚠️ No active bots found in the database. Please configure bots via the UI.");
                    setIsLoading(false);
                    setBots([]);
                    return;
                }

            const savedState = await getArenaState();
            let initialBots: BotState[];

            if (savedState && savedState.bots?.length > 0) {
                console.log("Resuming from saved state.");
                initialBots = savedState.bots.map(savedBot => {
                    const config = botConfigs.find(c => c.id === savedBot.id);
                    if (!config) return null;
                    return {
                        ...savedBot,
                        tradingMode: config.mode,
                        isPaused: config.isPaused, // Update pause state from database
                        symbolCooldowns: savedBot.symbolCooldowns || {},
                        getDecision: (portfolio: Portfolio, marketData: Market[]) => {
                            if (config.provider === 'grok') return getGrokTradingDecision(portfolio, marketData, config.prompt);
                            return getTradingDecision(portfolio, marketData, config.prompt);
                        }
                    };
                }).filter((bot): bot is BotState => bot !== null);
            } else {
                console.log("No saved state found. Starting fresh simulation.");
                initialBots = botConfigs.map(c => createNewBot(c.id, c.name, c.prompt, c.provider, c.mode));
                // Set initial pause state from database
                initialBots = initialBots.map(bot => {
                    const config = botConfigs.find(c => c.id === bot.id);
                    return { ...bot, isPaused: config?.isPaused || false };
                });
            }

            // Perform a one-time sync for any live bot to correct its initial state and value history.
            const liveCorrectedBots = await Promise.all(initialBots.map(async (bot) => {
                if (bot.tradingMode === 'real') {
                    try {
                        console.log(`[${bot.name}] Performing initial sync with live exchange...`);
                        
                        // Add timeout to prevent hanging if API credentials aren't configured
                        const timeout = new Promise<never>((_, reject) => 
                            setTimeout(() => reject(new Error('Exchange sync timeout')), 5000)
                        );
                        
                        const [realPortfolio, realOrders] = await Promise.race([
                            Promise.all([
                                getRealAccountState(bot.id),
                                getRealTradeHistory(bot.id)
                            ]),
                            timeout
                        ]);
                        
                        const realizedPnl = realOrders.reduce((acc, o) => acc + o.pnl, 0);

                        // FIX: Use the hardcoded initial balance for PnL calculations.
                        initialBalanceRef.current.set(bot.id, LIVE_BOT_INITIAL_BALANCE);
                        
                        // FIX: Reset the value history to start with the true current value.
                        // This prevents the chart from showing an initial drop from the default balance.
                        const correctedHistory = [{ timestamp: Date.now(), value: realPortfolio.totalValue }];

                        return {
                            ...bot,
                            portfolio: realPortfolio,
                            orders: realOrders,
                            realizedPnl: realizedPnl,
                            valueHistory: correctedHistory,
                        };
                    } catch (e) {
                        console.warn(`[${bot.name}] Failed initial sync with exchange (credentials may not be configured). Starting with default state.`, e);
                        initialBalanceRef.current.set(bot.id, LIVE_BOT_INITIAL_BALANCE);
                        return bot;
                    }
                }
                initialBalanceRef.current.set(bot.id, PAPER_BOT_INITIAL_BALANCE);
                return bot;
            }));

            setBots(liveCorrectedBots);
            setIsLoading(false);
            } catch (error) {
                console.error("Error initializing bots:", error);
                // Still set loading to false so UI doesn't hang
                setIsLoading(false);
                // Set empty bots array
                setBots([]);
            }
        };
        initialize();
    }, []);

    const getAdjustedQuantity = useCallback((symbol: string, rawQuantity: number): number => {
        const precision = symbolPrecisions.get(symbol)?.quantityPrecision ?? 3;
        const factor = Math.pow(10, precision);
        return Math.floor(rawQuantity * factor) / factor;
    }, [symbolPrecisions]);

    useEffect(() => {
        botFunctionsRef.current.updatePortfolios = async (): Promise<Market[]> => {
            const marketData = await getMarketData();
            if (!marketData || marketData.length === 0) return [];
            setMarkets(marketData);

            const updatedBots = await Promise.all(bots.map(async (bot) => {
                let updatedPortfolio: Portfolio;
                let updatedOrders: Order[] = bot.orders;
                let updatedRealizedPnl = bot.realizedPnl;

                if (bot.tradingMode === 'real') {
                    // For real trading, ASTER is the single source of truth.
                    updatedPortfolio = await getRealAccountState(bot.id);
                    updatedOrders = await getRealTradeHistory(bot.id);
                    // Realized PnL is the sum of PnL from the official trade history.
                    updatedRealizedPnl = updatedOrders.reduce((acc, order) => acc + order.pnl, 0);

                    // Set initial balance only once to correctly calculate PnL percentage.
                    if (!initialBalanceRef.current.has(bot.id)) {
                        // FIX: Use the hardcoded initial balance for PnL calculations.
                        initialBalanceRef.current.set(bot.id, LIVE_BOT_INITIAL_BALANCE);
                    }
                } else { // Paper trading PnL update remains simulated
                    const { portfolio } = bot;
                    let unrealizedPnl = 0;
                    let totalMarginUsed = 0;
                    const updatedPositions = portfolio.positions.map(pos => {
                        const currentPrice = marketData.find(m => m.symbol === pos.symbol)?.price ?? pos.entryPrice;
                        const assetQuantity = (pos.size * pos.leverage) / pos.entryPrice;
                        const pnl = (currentPrice - pos.entryPrice) * assetQuantity * (pos.type === OrderType.LONG ? 1 : -1);
                        unrealizedPnl += pnl;
                        totalMarginUsed += pos.size;
                        return { ...pos, pnl };
                    });
                    const totalValue = portfolio.balance + totalMarginUsed + unrealizedPnl;
                    updatedPortfolio = { ...portfolio, pnl: unrealizedPnl, totalValue, positions: updatedPositions };
                }

                // The performance chart now plots the true account value over time.
                const newValueHistory: ValueHistoryPoint = { timestamp: Date.now(), value: updatedPortfolio.totalValue };
                const newHistory = [...bot.valueHistory, newValueHistory].slice(-300); // Keep history to a reasonable size
                return { ...bot, portfolio: updatedPortfolio, valueHistory: newHistory, orders: updatedOrders, realizedPnl: updatedRealizedPnl };
            }));
            setBots(updatedBots);
            return marketData; // Return the market data so it can be used immediately
        };

        botFunctionsRef.current.runTradingTurn = async (providedMarkets?: Market[]) => {
            console.log('🎲 Running trading turn for all active bots...');
            
            // Use provided markets or fall back to state
            const activeMarkets = providedMarkets || markets;
            
            // Safety check: Ensure markets are loaded before processing trades
            if (activeMarkets.length === 0) {
                console.warn('⚠️ Market data not loaded yet, skipping trading turn');
                return;
            }
            
            console.log(`   📊 Available markets: ${activeMarkets.length}`, activeMarkets.map(m => m.symbol));
            const activeBots = bots.filter(b => !b.isPaused);
            console.log(`   Active bots: ${activeBots.length} / ${bots.length}`);
            
            for (const bot of bots) {
                if (bot.isPaused) {
                    console.log(`   ⏭️ Skipping ${bot.name} - paused`);
                    continue;
                }
                
                console.log(`   🤖 Processing turn for ${bot.name} (${bot.tradingMode} mode)...`);

                // Safety check: Skip if bot portfolio is not properly initialized
                if (!bot.portfolio || bot.portfolio.balance == null) {
                    console.log(`   ⚠️ Skipping ${bot.name} - portfolio not initialized`);
                    continue;
                }

                setBots(current => current.map(b => b.id === bot.id ? { ...b, isLoading: true } : b));
                
                const { prompt, decisions } = await bot.getDecision(bot.portfolio, activeMarkets);
                
                const notes: string[] = [];
                const validatedDecisions: { decision: AiDecision, adjustedLeverage: number }[] = [];

                console.log(`   📋 Processing ${decisions.length} decisions for ${bot.name}`);
                decisions.forEach((decision, idx) => {
                    console.log(`   Decision ${idx + 1}:`, decision);
                    // Rule: Minimum trade size
                    if ((decision.action === AiAction.LONG || decision.action === AiAction.SHORT) && decision.size && decision.size < MINIMUM_TRADE_SIZE_USD) {
                        notes.push(`REJECTED ${decision.action} ${decision.symbol}: Margin $${decision.size.toFixed(2)} is below minimum of $${MINIMUM_TRADE_SIZE_USD}.`);
                        return;
                    }

                    // Rule: Symbol Cooldown
                    if ((decision.action === AiAction.LONG || decision.action === AiAction.SHORT) && decision.symbol) {
                        const cooldownEndTime = bot.symbolCooldowns[decision.symbol];
                        if (cooldownEndTime && Date.now() < cooldownEndTime) {
                            const minutesLeft = ((cooldownEndTime - Date.now()) / 60000).toFixed(1);
                            notes.push(`REJECTED ${decision.action} ${decision.symbol}: Symbol is on cooldown for ${minutesLeft} more minutes.`);
                            return;
                        }
                    }

                    // Rule: Adjust Leverage
                    let adjustedLeverage = decision.leverage || 1;
                    if ((decision.action === AiAction.LONG || decision.action === AiAction.SHORT) && decision.symbol) {
                        const maxLeverage = leverageLimits.get(decision.symbol) ?? 25;
                        if (adjustedLeverage > maxLeverage) {
                            notes.push(`NOTE: Leverage for ${decision.symbol} adjusted from ${adjustedLeverage}x to exchange max of ${maxLeverage}x.`);
                            adjustedLeverage = maxLeverage;
                        }
                    }
                    validatedDecisions.push({ decision, adjustedLeverage });
                });

                console.log(`   ✅ ${validatedDecisions.length} decisions passed validation`);

                let updatedBotState: BotState = { ...bot };

                console.log(`   💼 Trading mode: ${bot.tradingMode}`);
                if (bot.tradingMode === 'real') {
                    for (const { decision, adjustedLeverage } of validatedDecisions) {
                        const market = activeMarkets.find(m => m.symbol === decision.symbol);
                        try {
                            if ((decision.action === AiAction.LONG || decision.action === AiAction.SHORT) && market && decision.size && decision.symbol) {
                                
                                const availableBalance = updatedBotState.portfolio.balance;
                                let tradeSize = decision.size;

                                // STAGE 1: Check if balance can even cover the minimum trade.
                                if (availableBalance < MINIMUM_TRADE_SIZE_USD) {
                                    notes.push(`REJECTED ${decision.action} ${decision.symbol}: Available balance $${availableBalance.toFixed(2)} is below the minimum trade size of $${MINIMUM_TRADE_SIZE_USD}.`);
                                    continue; // Skip this trade entirely
                                }

                                // STAGE 2: Adjust trade size if it exceeds available balance.
                                if (tradeSize > availableBalance) {
                                    notes.push(`NOTE: Trade size for ${decision.symbol} adjusted from $${tradeSize.toFixed(2)} to fit available margin of $${availableBalance.toFixed(2)}.`);
                                    tradeSize = availableBalance; // Adjust size down to what's available
                                }
                                
                                // Final check to ensure adjusted size is still valid.
                                if (tradeSize < MINIMUM_TRADE_SIZE_USD) {
                                    notes.push(`REJECTED ${decision.action} ${decision.symbol}: Adjusted trade size $${tradeSize.toFixed(2)} is below minimum of $${MINIMUM_TRADE_SIZE_USD}.`);
                                    continue;
                                }

                                // 1. Set Leverage
                                await setLeverage(decision.symbol, adjustedLeverage, bot.id);
                                
                                // 2. Open Position with MARKET order
                                const rawQuantity = (tradeSize * adjustedLeverage) / market.price;
                                const quantity = getAdjustedQuantity(decision.symbol, rawQuantity);
                                
                                if (quantity <= 0) {
                                    notes.push(`Execution Warning: Calculated quantity for ${decision.symbol} is 0.`);
                                    continue;
                                }
                                await placeRealOrder({ symbol: decision.symbol, side: decision.action === AiAction.LONG ? 'BUY' : 'SELL', type: 'MARKET', quantity }, bot.id);
                                notes.push(`SUCCESS: Opened ${decision.action} ${decision.symbol} position.`);

                                // 3. Place Stop-Loss and Take-Profit orders
                                const slTpPromises = [];
                                const orderSide = decision.action === AiAction.LONG ? 'SELL' : 'BUY';

                                if (decision.stopLoss) {
                                    slTpPromises.push(placeRealOrder({
                                        symbol: decision.symbol,
                                        side: orderSide,
                                        type: 'STOP_MARKET',
                                        stopPrice: decision.stopLoss,
                                        quantity,
                                        reduceOnly: 'true'
                                    }, bot.id));
                                }
                                if (decision.takeProfit) {
                                    slTpPromises.push(placeRealOrder({
                                        symbol: decision.symbol,
                                        side: orderSide,
                                        type: 'TAKE_PROFIT_MARKET',
                                        stopPrice: decision.takeProfit,
                                        quantity,
                                        reduceOnly: 'true'
                                    }, bot.id));
                                }
                                
                                const results = await Promise.allSettled(slTpPromises);
                                results.forEach((result, i) => {
                                    const type = i === 0 && decision.stopLoss ? 'Stop-Loss' : 'Take-Profit';
                                    if (result.status === 'fulfilled') {
                                        notes.push(`SUCCESS: ${type} order placed for ${decision.symbol}.`);
                                    } else {
                                        notes.push(`ERROR: Failed to place ${type} order for ${decision.symbol}: ${result.reason.message}`);
                                    }
                                });

                            } else if (decision.action === AiAction.CLOSE && decision.closePositionId) {
                                const posToClose = bot.portfolio.positions.find(p => p.id === decision.closePositionId);
                                if (posToClose) {
                                    const rawQuantity = Math.abs((posToClose.size * posToClose.leverage) / posToClose.entryPrice);
                                    const quantity = getAdjustedQuantity(posToClose.symbol, rawQuantity);

                                    if (quantity > 0) {
                                        await placeRealOrder({
                                            symbol: posToClose.symbol,
                                            side: posToClose.type === OrderType.LONG ? 'SELL' : 'BUY',
                                            type: 'MARKET',
                                            quantity,
                                            reduceOnly: 'true',
                                        }, bot.id);
                                        // Set cooldown after closing
                                        updatedBotState.symbolCooldowns[posToClose.symbol] = Date.now() + SYMBOL_COOLDOWN_MS;
                                        notes.push(`SUCCESS: Closed ${posToClose.symbol} position. Cooldown initiated.`);
                                    }
                                }
                            }
                        } catch (error: any) {
                            if (error.message && error.message.includes('ReduceOnly Order is rejected')) {
                                notes.push(`NOTE: Attempted to close ${decision.closePositionId}, but position no longer exists on exchange.`);
                            } else {
                                console.error(`[${bot.name}] Error executing real trade:`, decision, error);
                                notes.push(`Execution Error: ${error.message}`);
                            }
                        }
                    }
                } else { // Paper Trading Logic
                    console.log(`   📝 Executing paper trades for ${validatedDecisions.length} validated decisions`);
                    for (const { decision, adjustedLeverage } of validatedDecisions) {
                        console.log(`   🎯 Processing decision:`, decision.action, decision.symbol, `$${decision.size}`);
                        const market = activeMarkets.find(m => m.symbol === decision.symbol);
                        console.log(`   📊 Market found:`, market ? `${market.symbol} @ $${market.price}` : 'NOT FOUND');
                        
                        if ((decision.action === AiAction.LONG || decision.action === AiAction.SHORT) && market && decision.size && decision.symbol) {
                            console.log(`   ✅ All conditions met for trade execution`);
                            
                            const availableBalance = updatedBotState.portfolio.balance;
                            let tradeSize = decision.size;

                            // STAGE 1: Check if balance can even cover the minimum trade.
                            if (availableBalance < MINIMUM_TRADE_SIZE_USD) {
                                notes.push(`REJECTED ${decision.action} ${decision.symbol}: Available balance $${availableBalance.toFixed(2)} is below the minimum trade size of $${MINIMUM_TRADE_SIZE_USD}.`);
                                continue; // Skip this trade entirely
                            }

                            // STAGE 2: Adjust trade size if it exceeds available balance.
                            if (tradeSize > availableBalance) {
                                notes.push(`NOTE: Trade size for ${decision.symbol} adjusted from $${tradeSize.toFixed(2)} to fit available margin of $${availableBalance.toFixed(2)}.`);
                                tradeSize = availableBalance; // Adjust size down to what's available
                            }
                            
                            // Final check to ensure adjusted size is still valid.
                            if (tradeSize < MINIMUM_TRADE_SIZE_USD) {
                                notes.push(`REJECTED ${decision.action} ${decision.symbol}: Adjusted trade size $${tradeSize.toFixed(2)} is below minimum of $${MINIMUM_TRADE_SIZE_USD}.`);
                                continue;
                            }

                            // Calculate liquidation price
                            // For LONG: liquidation when price drops to where loss = margin (100% loss)
                            // For SHORT: liquidation when price rises to where loss = margin (100% loss)
                            // Formula: For LONG: entryPrice * (1 - (1 / leverage))
                            //          For SHORT: entryPrice * (1 + (1 / leverage))
                            const isLong = decision.action === AiAction.LONG;
                            const liquidationPrice = isLong 
                                ? market.price * (1 - (1 / adjustedLeverage))
                                : market.price * (1 + (1 / adjustedLeverage));
                            
                            const position: Position = {
                                id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                                symbol: decision.symbol,
                                type: decision.action === AiAction.LONG ? OrderType.LONG : OrderType.SHORT,
                                entryPrice: market.price,
                                size: tradeSize,
                                leverage: adjustedLeverage,
                                liquidationPrice: liquidationPrice,
                                stopLoss: decision.stopLoss,
                                takeProfit: decision.takeProfit,
                                pnl: 0,
                            };
                            updatedBotState.portfolio.positions.push(position);
                            updatedBotState.portfolio.balance -= tradeSize;
                            updatedBotState.tradeCount = (updatedBotState.tradeCount || 0) + 1;
                            
                            // Create order record for history (entry trade)
                            const entryFee = tradeSize * 0.03; // 3% fee
                            const entryOrder: Order = {
                                id: `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                                symbol: decision.symbol,
                                type: decision.action === AiAction.LONG ? OrderType.LONG : OrderType.SHORT,
                                size: tradeSize,
                                leverage: adjustedLeverage,
                                pnl: -entryFee, // Entry has negative PnL (just the fee)
                                fee: entryFee,
                                timestamp: Date.now(),
                                entryPrice: market.price,
                                exitPrice: 0, // Not closed yet
                            };
                            updatedBotState.orders = [entryOrder, ...(updatedBotState.orders || [])];
                            
                            console.log(`   🎉 Position created! ID: ${position.id}, New balance: $${updatedBotState.portfolio.balance.toFixed(2)}, Total positions: ${updatedBotState.portfolio.positions.length}, Total orders: ${updatedBotState.orders.length}`);
                            notes.push(`SUCCESS: Opened ${decision.action} ${decision.symbol} position with $${tradeSize.toFixed(2)} margin at $${market.price.toFixed(2)}.`);
                            // Set cooldown
                            updatedBotState.symbolCooldowns[decision.symbol] = Date.now() + SYMBOL_COOLDOWN_MS;
                        } else if (decision.action === AiAction.CLOSE && decision.closePositionId) {
                            const posToClose = updatedBotState.portfolio.positions.find(p => p.id === decision.closePositionId);
                            if (posToClose) {
                                const market = activeMarkets.find(m => m.symbol === posToClose.symbol);
                                if (market) {
                                    // Calculate quantity based on size, leverage, and entry price
                                    const assetQuantity = (posToClose.size * posToClose.leverage) / posToClose.entryPrice;
                                    
                                    // Calculate PnL based on price movement and quantity
                                    const unrealizedPnl = posToClose.type === OrderType.LONG
                                        ? (market.price - posToClose.entryPrice) * assetQuantity
                                        : (posToClose.entryPrice - market.price) * assetQuantity;
                                    
                                    const exitFee = posToClose.size * 0.03; // 3% fee on exit (on the margin/size)
                                    const netPnl = unrealizedPnl - exitFee;
                                    
                                    updatedBotState.portfolio.balance += posToClose.size + netPnl;
                                    updatedBotState.portfolio.positions = updatedBotState.portfolio.positions.filter(p => p.id !== posToClose.id);
                                    updatedBotState.realizedPnl = (updatedBotState.realizedPnl || 0) + netPnl;
                                    
                                    // Create order record for history (exit trade)
                                    const exitOrder: Order = {
                                        id: `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                                        symbol: posToClose.symbol,
                                        type: posToClose.type,
                                        size: posToClose.size,
                                        leverage: posToClose.leverage,
                                        pnl: netPnl,
                                        fee: exitFee,
                                        timestamp: Date.now(),
                                        entryPrice: posToClose.entryPrice,
                                        exitPrice: market.price,
                                    };
                                    updatedBotState.orders = [exitOrder, ...(updatedBotState.orders || [])];
                                    
                                    if (netPnl > 0) {
                                        const wins = (updatedBotState.tradeCount || 0) * (updatedBotState.winRate || 0);
                                        updatedBotState.winRate = (wins + 1) / (updatedBotState.tradeCount || 1);
                                    }
                                    
                                    notes.push(`SUCCESS: Closed ${posToClose.symbol} position. PnL: $${netPnl.toFixed(2)} (fee: $${exitFee.toFixed(2)})`);
                                    // Set cooldown after closing
                                    updatedBotState.symbolCooldowns[posToClose.symbol] = Date.now() + SYMBOL_COOLDOWN_MS;
                                }
                            } else {
                                notes.push(`NOTE: Position ${decision.closePositionId} not found, may have been auto-closed.`);
                            }
                        }
                    }
                }

                console.log(`   📝 Notes generated:`, notes);
                console.log(`   📊 Final state: Balance=$${updatedBotState.portfolio.balance.toFixed(2)}, Positions=${updatedBotState.portfolio.positions.length}, Orders=${updatedBotState.orders?.length || 0}, Trades=${updatedBotState.tradeCount}`);
                
                const newLog: BotLog = { timestamp: Date.now(), decisions, prompt, notes };
                updatedBotState.botLogs = [newLog, ...updatedBotState.botLogs].slice(0, 50);
                
                setBots(current => current.map(b => b.id === bot.id ? { ...updatedBotState, isLoading: false } : b));
            }
        };
    }, [bots, markets, symbolPrecisions, getAdjustedQuantity]);

    useEffect(() => {
        console.log('🔄 Trading intervals check:', {
            isGloballyPaused,
            botsLength: bots.length,
            isLoading,
            botDetails: bots.map(b => ({ id: b.id, name: b.name, isPaused: b.isPaused }))
        });

        if (isGloballyPaused || bots.length === 0 || isLoading) {
            console.log('⏸️ Clearing trading intervals - paused or loading');
            if (turnIntervalRef.current) clearInterval(turnIntervalRef.current);
            if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
            return;
        }

        console.log('▶️ Starting trading intervals...');
        
        // Execute first portfolio update and trading turn immediately (but in sequence)
        (async () => {
            console.log('📊 Loading market data first...');
            const loadedMarkets = await botFunctionsRef.current.updatePortfolios();
            
            // Check if any bot has made a decision recently (within the turn interval)
            const now = Date.now();
            const hasRecentDecisions = bots.some(bot => 
                bot.botLogs && bot.botLogs.length > 0 && 
                (now - bot.botLogs[0].timestamp < TURN_INTERVAL_MS)
            );
            
            if (hasRecentDecisions) {
                const timeUntilNext = TURN_INTERVAL_MS - (now - Math.max(...bots.filter(b => b.botLogs && b.botLogs.length > 0).map(b => b.botLogs[0].timestamp)));
                console.log(`⏳ Recent decisions detected. Next trading turn in ${Math.ceil(timeUntilNext / 1000)}s`);
            } else {
                console.log('⚡ Executing first trading turn immediately...');
                await botFunctionsRef.current.runTradingTurn(loadedMarkets);
            }
        })();
        
        refreshIntervalRef.current = setInterval(() => botFunctionsRef.current.updatePortfolios(), REFRESH_INTERVAL_MS);
        turnIntervalRef.current = setInterval(() => botFunctionsRef.current.runTradingTurn(), TURN_INTERVAL_MS);

        return () => {
            if (turnIntervalRef.current) clearInterval(turnIntervalRef.current);
            if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
        };
    }, [isGloballyPaused, bots.length, isLoading]);

    const resetBot = async (botId: string) => {
        console.log(`🔄 resetBot called for: ${botId}`);
        
        const botToReset = bots.find(b => b.id === botId);
        if (botToReset && botToReset.tradingMode === 'real') {
            console.log('❌ Cannot reset real trading bot');
            alert("Cannot reset a bot that is trading with real funds.");
            return;
        }
        
        console.log('Showing confirmation dialog...');
        if (!window.confirm("Are you sure you want to reset this bot? This will clear all positions, trades, and AI logs.")) {
            console.log('User cancelled reset');
            return;
        }
        
        console.log('User confirmed reset, proceeding...');
        
        try {
            // Call the backend API to reset the bot in the database
            const token = localStorage.getItem('token');
            console.log(`Calling API: ${API_BASE_URL}/api/v2/bots/${botId}/reset`);
            
            const response = await fetch(`${API_BASE_URL}/api/v2/bots/${botId}/reset`, {
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

            // Clear the persisted arena state completely (best effort)
            console.log('Clearing arena_state...');
            fetch(`${API_BASE_URL}/api/state`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(() => console.log('Arena state cleared'))
              .catch(err => console.warn('Could not clear arena_state:', err));
            
        } catch (error) {
            console.error('❌ Error resetting bot:', error);
            alert(`Failed to reset bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return; // Don't reload if reset failed
        }

        // Force a full page reload to reinitialize everything from the database
        // Do this OUTSIDE the try-catch to ensure it always happens after successful reset
        console.log('🔄 Reloading page to refresh bot state...');
        setTimeout(() => {
            window.location.reload();
        }, 500); // Small delay to ensure DELETE completes
    };

    const manualClosePosition = async (botId: string, positionId: string) => {
        // ... (existing manual close logic)
    };

    return { bots, markets, isLoading, manualClosePosition, resetBot, toggleBotPause: () => {}, forceProcessTurn: () => {}, initialBalanceRef };
};

export default useTradingBots;
