/**
 * History Summarization Service
 * 
 * Manages bot decision history to prevent token bloat while preserving learning context.
 * When history grows too large, it summarizes older decisions into condensed insights
 * that bots can use to learn and adapt.
 */

const axios = require('axios');
const { decrypt } = require('../utils/encryption');

/**
 * Rough token estimation (1 token ≈ 4 characters for English text)
 * More accurate than character count, good enough for our purposes
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Count characters, divide by 4, add buffer for JSON structure
  const charCount = typeof text === 'string' ? text.length : JSON.stringify(text).length;
  return Math.ceil(charCount / 4);
}

/**
 * Calculate total tokens in decision history
 */
function calculateHistoryTokens(decisions) {
  let totalTokens = 0;
  
  for (const decision of decisions) {
    // Count tokens in prompt, decisions, and notes
    totalTokens += estimateTokens(decision.prompt_sent);
    totalTokens += estimateTokens(decision.decisions_json);
    totalTokens += estimateTokens(decision.notes_json);
  }
  
  return totalTokens;
}

/**
 * Format decision history for summarization
 * Includes the FULL AI log (prompt sent + response) for comprehensive learning
 */
function formatDecisionsForSummarization(decisions) {
  return decisions.map((d, idx) => {
    const decisionsArray = JSON.parse(d.decisions_json || '[]');
    const notes = JSON.parse(d.notes_json || '[]');
    const timestamp = new Date(d.timestamp).toISOString();
    
    let formatted = `\n${'='.repeat(80)}\n`;
    formatted += `TRADING CYCLE ${idx + 1} - ${timestamp}\n`;
    formatted += `${'='.repeat(80)}\n\n`;
    
    // Include the AI LOG context, but strip out market data to reduce token usage
    formatted += `--- YOUR PROMPT & CONTEXT (What you saw) ---\n`;
    
    let promptToInclude = d.prompt_sent || '[No prompt recorded]';
    
    // Strip out the massive market data section to save tokens
    // Keep everything up to "Live Market Data:" but truncate the actual market listings
    const marketDataStart = promptToInclude.indexOf('Live Market Data:');
    if (marketDataStart !== -1) {
      const beforeMarketData = promptToInclude.substring(0, marketDataStart);
      
      // Find the next section after market data (usually "Consult the stars" or decision rules)
      const afterMarketDataStart = promptToInclude.indexOf('\n\nConsult the', marketDataStart);
      const decisionRulesStart = promptToInclude.indexOf('\n\nDecision Rules', marketDataStart);
      const nextSectionStart = Math.min(
        afterMarketDataStart !== -1 ? afterMarketDataStart : Infinity,
        decisionRulesStart !== -1 ? decisionRulesStart : Infinity
      );
      
      if (nextSectionStart !== Infinity) {
        // Extract just a few market examples instead of all 200+
        const marketDataSection = promptToInclude.substring(marketDataStart, nextSectionStart);
        const marketLines = marketDataSection.split('\n');
        const truncatedMarketData = marketLines.slice(0, 6).join('\n') + `\n... (${marketLines.length - 6} more markets omitted for brevity)\n`;
        
        const afterMarketData = promptToInclude.substring(nextSectionStart);
        promptToInclude = beforeMarketData + truncatedMarketData + afterMarketData;
      }
    }
    
    formatted += promptToInclude;
    formatted += `\n\n`;
    
    // Include the decisions made
    formatted += `--- YOUR DECISIONS (What you chose to do) ---\n`;
    if (decisionsArray.length === 0) {
      formatted += `Decision: HOLD (no trades taken)\n`;
    } else {
      decisionsArray.forEach((decision, i) => {
        formatted += `\nTrade ${i + 1}:\n`;
        formatted += `  Action: ${decision.action}\n`;
        formatted += `  Symbol: ${decision.symbol || decision.closePositionId || 'N/A'}\n`;
        formatted += `  Reasoning: ${decision.reasoning}\n`;
        
        if (decision.action === 'LONG' || decision.action === 'SHORT') {
          formatted += `  Size: $${decision.size} | Leverage: ${decision.leverage}x\n`;
          formatted += `  Stop Loss: $${decision.stopLoss} | Take Profit: $${decision.takeProfit}\n`;
        }
      });
    }
    
    // Include execution outcomes
    if (notes && notes.length > 0) {
      formatted += `\n--- EXECUTION OUTCOME (What actually happened) ---\n`;
      notes.forEach(note => {
        formatted += `  - ${note}\n`;
      });
    }
    
    formatted += `\nExecution Success: ${d.execution_success ? 'Yes' : 'No'}\n`;
    
    return formatted;
  }).join('\n\n');
}

/**
 * Generate a comprehensive summary of bot's decision history
 * Preserves patterns, learning insights, successful/failed strategies
 * @param {Object} bot - Bot object
 * @param {Array} decisions - Decisions to summarize
 * @param {Object} provider - LLM provider config
 * @param {String} previousSummaryContext - Optional previous summary to provide as context
 */
async function summarizeHistory(bot, decisions, provider, previousSummaryContext = '') {
  console.log(`   📊 Summarization Debug:`);
  console.log(`      - Bot: ${bot.name}`);
  console.log(`      - Decisions to summarize: ${decisions.length}`);
  console.log(`      - Bot prompt length: ${bot.prompt.length} chars`);
  console.log(`      - Has previous summary: ${previousSummaryContext.length > 0}`);
  
  const formattedHistory = formatDecisionsForSummarization(decisions);
  console.log(`      - Formatted history length: ${formattedHistory.length} chars`);
  
  const summarizationPrompt = `You are "${bot.name}" reflecting on your trading history to extract learnings and patterns.

Your personality and trading philosophy:
${bot.prompt.substring(0, 2000)}
${previousSummaryContext}
TRADING HISTORY TO ANALYZE:
${formattedHistory}

Your task: Create a comprehensive learning summary (10,000-15,000 tokens) that preserves your personality voice while documenting:

1. **KEY PATTERNS & INSIGHTS:**
   - Which strategies/setups worked well vs. failed
   - Common mistakes or biases observed
   - Optimal leverage/position sizing discovered
   - Best performing symbols/market conditions

2. **LEARNING OUTCOMES:**
   - What trades were profitable and why
   - What trades failed and lessons learned
   - Risk management insights (stop losses, take profits)
   - Timing patterns (entry/exit quality)

3. **PERFORMANCE METRICS:**
   - Overall win rate trends
   - Average hold times for winners vs. losers
   - Leverage usage patterns
   - Position sizing discipline

4. **BEHAVIORAL OBSERVATIONS:**
   - Does the bot overtrade or undertrade?
   - Is it disciplined with stops and targets?
   - Does it adapt to changing market conditions?
   - Any emotional/irrational patterns (FOMO, revenge trading, etc.)

5. **ACTIONABLE RECOMMENDATIONS:**
   - What should you continue doing?
   - What should you stop or modify?
   - Specific improvements for future trades

CRITICAL: Write this summary in YOUR VOICE as ${bot.name}. Maintain your personality, speaking style, and trading philosophy throughout. This is YOUR reflection on YOUR performance, not a generic report.

Think of this as your trading journal - reflective, honest, specific, and true to your character. Use first-person perspective and stay in character.

YOUR LEARNING SUMMARY:`;

  try {
    console.log(`   📚 Summarizing ${decisions.length} historical decisions for ${bot.name}...`);
    console.log(`      - Final prompt length: ${summarizationPrompt.length} chars (~${Math.round(summarizationPrompt.length / 4)} tokens)`);
    console.log(`      - Using 5-minute timeout for complex summarization task`);
    
    // Decrypt API key and prepare provider config
    const apiKey = decrypt(provider.api_key_encrypted);
    const modelName = provider.model_name;
    const apiEndpoint = provider.api_endpoint;
    const providerType = provider.provider_type;
    
    let response;
    let summaryText;
    
    // Call AI API based on provider type (same logic as BotManager)
    if (providerType === 'grok' || providerType === 'openai') {
      response = await axios.post(
        apiEndpoint,
        {
          model: modelName,
          messages: [{ role: 'user', content: summarizationPrompt }],
          temperature: 0.7,
          max_tokens: 16000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 300000 // 5 minute timeout for complex summarization tasks
        }
      );
      
      summaryText = response.data.choices?.[0]?.message?.content;
    }
    else if (providerType === 'gemini') {
      const geminiUrl = apiEndpoint.includes('?') 
        ? `${apiEndpoint}&key=${apiKey}`
        : `${apiEndpoint}?key=${apiKey}`;
      
      response = await axios.post(
        geminiUrl,
        {
          contents: [{ parts: [{ text: summarizationPrompt }] }],
          generationConfig: { 
            temperature: 0.7,
            maxOutputTokens: 16000
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 300000 // 5 minute timeout for complex summarization tasks
        }
      );
      
      summaryText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    }
    else if (providerType === 'anthropic') {
      response = await axios.post(
        apiEndpoint,
        {
          model: modelName,
          messages: [{ role: 'user', content: summarizationPrompt }],
          max_tokens: 16000,
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 300000 // 5 minute timeout for complex summarization tasks
        }
      );
      
      summaryText = response.data.content?.[0]?.text;
    }
    else if (providerType === 'custom' || providerType === 'local') {
      response = await axios.post(
        apiEndpoint,
        {
          model: modelName,
          messages: [{ role: 'user', content: summarizationPrompt }],
          temperature: 0.7,
          max_tokens: 16000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 300000 // 5 minute timeout for complex summarization tasks
        }
      );
      
      summaryText = response.data.choices?.[0]?.message?.content;
    }
    else {
      throw new Error(`Unsupported provider type: ${providerType}`);
    }
    
    if (!summaryText) {
      throw new Error('Empty response from AI provider');
    }
    
    const tokenCount = estimateTokens(summaryText);
    console.log(`   ✅ Generated summary (${tokenCount} tokens)`);
    
    return {
      summary: summaryText,
      summarizedCount: decisions.length,
      summarizedFrom: decisions[0].timestamp,
      summarizedTo: decisions[decisions.length - 1].timestamp,
      generatedAt: Date.now(),
      tokenCount: tokenCount
    };
  } catch (error) {
    console.error(`   ❌ Error generating summary:`, error.message);
    throw error;
  }
}

/**
 * Check if history needs summarization and perform if needed
 * 
 * @param {Object} bot - Bot object with current state
 * @param {Array} allDecisions - All bot decisions from database
 * @param {Object} provider - LLM provider configuration
 * @param {number} maxTokens - Maximum tokens before triggering summarization (default: 25000)
 * @param {number} keepRecent - Number of recent decisions to keep unsummarized (default: 15)
 * @param {boolean} forceAll - If true, summarize ALL decisions regardless of keepRecent (default: false)
 * @returns {Object} - { summary, recentDecisions, needsSummarization }
 */
async function manageHistorySize(bot, allDecisions, provider, maxTokens = 25000, keepRecent = 15, forceAll = false) {
  // If force summarization of all decisions, skip the keepRecent check
  if (!forceAll && allDecisions.length <= keepRecent) {
    return {
      summary: bot.history_summary || null,
      recentDecisions: allDecisions,
      needsSummarization: false,
      totalTokens: calculateHistoryTokens(allDecisions)
    };
  }
  
  // Calculate tokens in all history
  const totalTokens = calculateHistoryTokens(allDecisions);
  
  console.log(`   📊 History size for ${bot.name}: ${allDecisions.length} decisions, ~${totalTokens} tokens`);
  
  // If under threshold, return as-is
  if (totalTokens < maxTokens) {
    return {
      summary: bot.history_summary || null,
      recentDecisions: allDecisions,
      needsSummarization: false,
      totalTokens
    };
  }
  
  // Need summarization - but check if we recently summarized
  console.log(`   ⚠️  History exceeds ${maxTokens} tokens - checking if re-summarization needed`);
  
  // Keep the most recent 'keepRecent' decisions as-is
  // CRITICAL FIX: Handle case where we have fewer decisions than keepRecent
  let recentDecisions, decisionsToSummarize;
  
  if (forceAll) {
    // Force mode: summarize ALL decisions, keep none as recent
    recentDecisions = [];
    decisionsToSummarize = allDecisions;
    console.log(`   🔥 FORCE MODE: Summarizing ALL ${allDecisions.length} decisions`);
  } else if (allDecisions.length <= keepRecent) {
    // If we have 10 decisions but keepRecent is 15, we need to decide how to split
    // Keep at least a few recent ones, summarize the rest
    const minRecent = Math.min(5, allDecisions.length); // Keep at least 5 recent (or all if less)
    recentDecisions = allDecisions.slice(-minRecent);
    decisionsToSummarize = allDecisions.slice(0, -minRecent);
    
    console.log(`   📊 Fewer decisions than keepRecent (${allDecisions.length} < ${keepRecent})`);
    console.log(`      - Keeping last ${minRecent} decisions as recent`);
    console.log(`      - Summarizing first ${decisionsToSummarize.length} decisions`);
  } else {
    recentDecisions = allDecisions.slice(-keepRecent);
    decisionsToSummarize = allDecisions.slice(0, -keepRecent);
  }
  
  // If we have an existing summary, check how many NEW decisions we have to summarize
  // (Skip this smart throttling in force mode - always summarize)
  if (!forceAll && bot.history_summary) {
    try {
      const parsed = JSON.parse(bot.history_summary);
      const previouslySummarizedCount = parsed.summarizedCount || 0;
      const newDecisionsCount = decisionsToSummarize.length - previouslySummarizedCount;
      
      console.log(`      - Previously summarized: ${previouslySummarizedCount} decisions`);
      console.log(`      - New decisions since last summary: ${newDecisionsCount}`);
      
      // Only re-summarize if we have accumulated at least 10 new decisions
      // This prevents re-summarizing on every turn once we exceed the token threshold
      if (newDecisionsCount < 10) {
        console.log(`      - Not enough new decisions (need 10+), skipping re-summarization`);
        return {
          summary: bot.history_summary,
          recentDecisions,
          needsSummarization: false,
          totalTokens
        };
      }
      
      console.log(`      - ${newDecisionsCount} new decisions accumulated, proceeding with re-summarization`);
    } catch (e) {
      console.warn('   ⚠️  Could not parse existing summary, will re-summarize all');
    }
  } else {
    if (forceAll) {
      console.log(`      - Force mode enabled, bypassing smart throttling`);
    } else {
      console.log(`      - No existing summary, creating initial summary`);
    }
  }
  
  // Generate new summary (includes old summary context if exists)
  let summarizationDecisions = decisionsToSummarize;
  
  // If there's an existing summary, provide it as context to the AI
  let existingSummaryContext = '';
  if (!forceAll && bot.history_summary) {
    try {
      const parsed = JSON.parse(bot.history_summary);
      const previouslySummarizedCount = parsed.summarizedCount || 0;
      
      existingSummaryContext = `\n=== PREVIOUS SUMMARY (for context only, generate a fresh summary) ===\n${parsed.summary}\n\n`;
      
      // CRITICAL FIX: Only summarize NEW decisions, not the ones already summarized
      // (But in force mode, we summarize ALL decisions)
      summarizationDecisions = decisionsToSummarize.slice(previouslySummarizedCount);
      
      console.log(`      - Summarizing only ${summarizationDecisions.length} NEW decisions (skipping ${previouslySummarizedCount} already summarized)`);
    } catch (e) {
      console.warn('   ⚠️  Could not parse existing summary, will summarize all');
    }
  } else if (forceAll) {
    console.log(`      - Force mode: Summarizing all ${summarizationDecisions.length} decisions (ignoring any previous summary)`);
  }
  
  const newSummary = await summarizeHistory(bot, summarizationDecisions, provider, existingSummaryContext);
  
  // Note: existingSummaryContext was already provided to the AI in the summarization prompt
  // The AI generates a fresh summary that incorporates previous learnings
  // We do NOT append the old summary to the new one - that would cause marker accumulation
  
  return {
    summary: JSON.stringify(newSummary),
    recentDecisions,
    needsSummarization: true,
    totalTokens,
    summarizedCount: decisionsToSummarize.length,
    newTokenEstimate: estimateTokens(newSummary.summary) + calculateHistoryTokens(recentDecisions)
  };
}

module.exports = {
  estimateTokens,
  calculateHistoryTokens,
  summarizeHistory,
  manageHistorySize
};

