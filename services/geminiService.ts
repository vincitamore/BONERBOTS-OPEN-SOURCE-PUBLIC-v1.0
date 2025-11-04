import { Portfolio, Market, AiDecision, AiAction, BotLog, Order } from "../types";
import { API_URL } from "../config";

const generateFullPrompt = (portfolio: Portfolio, marketData: Market[], basePrompt: string, recentLogs?: BotLog[], cooldowns?: Record<string, number>, recentOrders?: Order[]): string => {
  // Defensive null checks
  if (!portfolio || !marketData) {
    console.error('Invalid portfolio or marketData passed to generateFullPrompt');
    return basePrompt;
  }

  const formattedMarketData = marketData.map(m => ` - ${m.symbol}: $${m.price?.toFixed(4) || '0.0000'} (24h change: ${m.price24hChange?.toFixed(2) || '0.00'}%)`).join('\n');
  
  const now = Date.now();
  const formattedPositions = portfolio.positions && portfolio.positions.length > 0
    ? portfolio.positions.map(p => {
        // Try to find when this position was opened from recent orders
        const openOrder = recentOrders?.find(o => o.symbol === p.symbol && o.exitPrice === 0);
        const minutesOpen = openOrder ? Math.floor((now - openOrder.timestamp) / 60000) : '?';
        return ` - ID: ${p.id}, Symbol: ${p.symbol}, Type: ${p.type}, Size: $${p.size || 0}, Leverage: ${p.leverage}x, Entry: $${p.entryPrice?.toFixed(4) || '0.0000'}, SL: $${p.stopLoss?.toFixed(4) || 'N/A'}, TP: $${p.takeProfit?.toFixed(4) || 'N/A'}, Open for: ${minutesOpen} minutes`;
      }).join('\n')
    : 'None';
  
  // Format recent decision history
  let decisionHistory = '';
  if (recentLogs && recentLogs.length > 0) {
    decisionHistory = '\n\nYour Recent Decision History (last 5 cycles):\n';
    recentLogs.forEach((log, idx) => {
      const minutesAgo = Math.floor((now - log.timestamp) / 60000);
      decisionHistory += `\n[${minutesAgo} minutes ago]:\n`;
      if (log.decisions.length === 0) {
        decisionHistory += '  - HOLD (no action taken)\n';
      } else {
        log.decisions.forEach(d => {
          decisionHistory += `  - ${d.action} ${d.symbol || d.closePositionId}: ${d.reasoning}\n`;
        });
      }
      if (log.notes && log.notes.length > 0) {
        decisionHistory += `  Notes: ${log.notes.join('; ')}\n`;
      }
    });
  }
  
  // Format active cooldowns
  let cooldownInfo = '';
  if (cooldowns && Object.keys(cooldowns).length > 0) {
    const activeCooldowns = Object.entries(cooldowns)
      .filter(([symbol, endTime]) => now < endTime)
      .map(([symbol, endTime]) => {
        const minutesLeft = Math.ceil((endTime - now) / 60000);
        return `${symbol} (${minutesLeft} minutes remaining)`;
      });
    
    if (activeCooldowns.length > 0) {
      cooldownInfo = '\n\nSymbols Currently on Cooldown:\n' + activeCooldowns.join(', ') + '\n';
    }
  }
  
  const currentDate = new Date().toUTCString();

  return basePrompt
    .replace('{{totalValue}}', (portfolio.totalValue ?? 0).toFixed(2))
    .replace('{{availableBalance}}', (portfolio.balance ?? 0).toFixed(2))
    .replace('{{unrealizedPnl}}', (portfolio.pnl ?? 0).toFixed(2))
    .replace('{{openPositions}}', formattedPositions)
    .replace('{{marketData}}', formattedMarketData)
    .replace('{{currentDate}}', currentDate) + decisionHistory + cooldownInfo;
};

export const getTradingDecision = async (portfolio: Portfolio, marketData: Market[], basePrompt: string, recentLogs?: BotLog[], cooldowns?: Record<string, number>, recentOrders?: Order[]): Promise<{ prompt: string, decisions: AiDecision[] }> => {
  const prompt = generateFullPrompt(portfolio, marketData, basePrompt, recentLogs, cooldowns, recentOrders);

  if (!API_URL) {
    console.error("API_URL is not configured in config.ts");
    return { prompt, decisions: [] };
  }
  const API_ENDPOINT = `${API_URL}/api/gemini`;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    
    // Robust response handling
    const contentType = response.headers.get('content-type');
    if (!response.ok || !contentType || !contentType.includes('application/json')) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: Expected JSON but received ${contentType}. Status: ${response.status}. Body: ${errorText.substring(0, 200)}`);
    }

    const responseData = await response.json();
    const decisionText = responseData.text?.trim();
    if (!decisionText) {
        return { prompt, decisions: [] };
    }

    const decisions: AiDecision[] = JSON.parse(decisionText);
    const validDecisions = decisions.filter(d => d.action !== AiAction.HOLD);
    
    return { prompt, decisions: validDecisions };

  } catch (error) {
    console.error("Error getting trading decision from Gemini:", error);
    return { prompt, decisions: [] };
  }
};