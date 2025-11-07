# Bot Sandbox Enhancement Proposal
## Multi-Iteration Decision Making & Custom Tool Design

**Date**: 2025-11-07  
**Purpose**: Design multi-step decision frameworks and custom toolsets for all trading bots while preserving unique personalities

---

## Executive Summary

This document proposes enabling multi-iteration sandbox analysis for all four trading bots, with each receiving:
1. **Custom tool sets** tailored to their personality and expertise
2. **Personality-appropriate iteration contexts** that maintain their unique voice
3. **Balanced complexity** - enough tools to be useful, not so many they're overwhelmed
4. **Unique data sources** where thematically appropriate (e.g., celestial data for Astrologer)

---

## 🎭 Bot #1: DEGEN LIVE

### **Personality Analysis**
- **Voice**: Ultra-casual, Twitter-native, meme-fluent, impulsive
- **Decision Style**: Gut feelings, hype-driven, FOMO-based, momentum chasing
- **Sophistication**: Low (intentionally) - acts on vibes and social signals
- **Risk Tolerance**: Extremely high - "diamond hands until paper hands"

### **Recommended Sandbox Tools** (6-8 tools max)

#### **Core Hype Metrics**
1. **`hype_score(symbol)`** - *Custom tool needed*
   - Aggregates: 24h volume spike, price momentum, social mentions
   - Returns: Score 0-100 with "MOON POTENTIAL" rating
   - Example output: `{score: 87, rating: "🚀 ULTRA BULLISH", volume_spike: "+420%"}`

2. **`pump_detector(symbol)`** - *Custom tool needed*
   - Detects if coin is currently pumping hard
   - Checks: 1h/4h/24h price change, volume, volatility
   - Returns: `{is_pumping: true, strength: "MEGA", since: "23 min ago"}`

3. **`whale_watch(symbol)`** - *Custom tool needed*
   - Detects large buy/sell orders or wallet movements
   - Returns: `{whale_activity: "ACCUMULATING", confidence: "high"}`

#### **Basic TA (But Make It Degen)**
4. **`rsi(symbol)`** - Existing tool, but formatted for degens
   - Interpret: <30 = "oversold af, buy the dip", >70 = "overbought, maybe top?"

5. **`price_momentum(symbol, timeframe)`** - Enhanced `price_change()`
   - Shows 15min, 1h, 4h, 24h changes
   - Formats as: "UP UP UP" or "ngmi" based on trend

6. **`fomo_meter(symbol)`** - *Custom tool combining volatility + volume*
   - Returns: "LOW FOMO" → "MEGA FOMO TERRITORY"

#### **Risk Tools (Simplified)**
7. **`yolo_size(balance, conviction)`** - Kelly but for apes
   - Input: "LOW", "MED", "HIGH", "YOLO" conviction
   - Output: Suggested position size in degen terms

8. **`stop_calc(entry, direction)`** - Auto-calculate reasonable stop
   - Returns stop-loss that's not "ngmi tight" but not "rekt loose"

### **Multi-Iteration Framework**

**Iteration Context Voice**:
```
=== DECISION CYCLE {iteration} of 5 ===

{iteration === 1 ? 
  "YO FAM, got {N} coins to choose from. Let's check the vibes. Run some tools to see what's PUMPING or about to MOON. Don't just look at one coin - scan the whole market for opportunities." 
  : iteration === 5 ?
  "FINAL CALL: Time to commit. Which play has the best risk/reward? Remember: 3% fees each way = 6% round trip. Don't be paper-handed, but also don't get rekt. What's the move?"
  : "Keep analyzing fam. You got {5 - iteration} more chances to dig deeper. Which coins are looking spicy? Use tools to confirm your gut feeling."
}

{previous_analysis}
```

**Example Multi-Step Flow**:
1. **Iteration 1**: Run `pump_detector()` on top 5 movers, `hype_score()` on interesting ones
2. **Iteration 2**: Deep dive with `rsi()`, `fomo_meter()` on top 2-3 candidates
3. **Iteration 3**: Check `whale_watch()` for smart money confirmation
4. **Iteration 4**: Calculate position with `yolo_size()` and `stop_calc()`
5. **Iteration 5**: Return final decision with degen reasoning

**Tool Response Formatting** (Make it degen-friendly):
```json
{
  "tool": "hype_score",
  "symbol": "PEPEUSDT",
  "result": {
    "score": 92,
    "rating": "🚀🚀🚀 ABSOLUTE SEND TERRITORY",
    "volume_spike": "+380%",
    "momentum": "PARABOLIC",
    "recommendation": "This is giving major moon vibes"
  }
}
```

---

## 🐒 Bot #2: Escaped Monkey

### **Personality Analysis**
- **Voice**: Brilliant but unhinged, aggressive, hyper-analytical
- **Decision Style**: Volatility-seeking, high-conviction, contrarian opportunities
- **Sophistication**: High (ex-quant fund) but chaotic in application
- **Risk Tolerance**: Extremely high - "live for volatility"

### **Recommended Sandbox Tools** (10-12 tools max)

#### **Volatility & Momentum Arsenal**
1. **`volatility_rank(symbol, lookback)`** - Current vol vs historical range
   - Identifies vol expansion/contraction regimes
   - Returns percentile rank (0-100)

2. **`bollinger_squeeze(symbol)`** - *Custom enhancement of bollinger()*
   - Detects volatility compression patterns
   - Returns: `{is_squeezing: true, duration: 8, explosion_probability: 0.73}`

3. **`momentum_divergence(symbol)`** - *Custom tool*
   - Price vs momentum indicator divergence detection
   - Identifies potential reversals or continuations

4. **`order_flow(symbol)`** - *Custom tool needed*
   - Estimates buy/sell pressure from volume analysis
   - Returns: `{pressure: "HEAVY_BUY", ratio: 3.2, confidence: "high"}`

#### **Quant Framework**
5. **`correlation(symbol1, symbol2)`** - Existing, perfect for pairs trading
6. **`mean_reversion(symbol, period)`** - *Custom - Z-score from mean*
7. **`trend_strength(symbol)`** - Enhanced version of `trend()`
   - Includes ADX-style directional strength

8. **`volume_profile(symbol)`** - *Custom tool needed*
   - Price levels with highest volume (support/resistance)
   - Returns key zones with volume

#### **Risk Management (Quant-style)**
9. **`kelly(winRate, avgWin, avgLoss)`** - Existing, perfect for Monkey
10. **`sharpe_estimate(trades)`** - *Custom - estimate Sharpe from recent trades*
11. **`max_drawdown(trades)`** - *Custom - calculate historical drawdown*
12. **`position_size(balance, riskPercent, stopDistance)`** - Existing

#### **Market Regime Detection**
13. **`regime_detector(symbol)`** - *Custom synthesis tool*
    - Classifies market: TRENDING_UP, TRENDING_DOWN, CHOPPY, EXPLOSIVE
    - Uses volatility, trend, and volume signals

### **Multi-Iteration Framework**

**Iteration Context Voice**:
```
=== ANALYSIS ITERATION {iteration}/5 ===

{iteration === 1 ?
  "INITIATE MARKET SCAN: {N} instruments available. MAXIMUM ALPHA EXTRACTION MODE. Deploy statistical arbitrage detection across all tradeable pairs. Identify volatility breakouts, momentum anomalies, mean-reversion setups. DO NOT ANCHOR ON SINGLE ASSET. Systematic opportunity identification required."
  : iteration === 5 ?
  "EXECUTION DECISION REQUIRED: Synthesis of computed variables demanded. Select optimal risk-adjusted entries from identified opportunities. Kelly-weighted allocation. Stop placement at statistically significant levels. COMMIT TO HIGHEST CONVICTION PLAY. Remember: 6% fee drag requires >12% gross return for breakeven."
  : `ANALYSIS PHASE {iteration}/5: Continue quantitative interrogation. Cross-validate signals across multiple timeframes. Compute edge estimates. Build conviction through statistical confluence. Remaining iterations: {5 - iteration}.`
}

{previous_results}
```

**Example Multi-Step Flow**:
1. **Iteration 1**: Run `regime_detector()` on all markets, identify volatile candidates
2. **Iteration 2**: `bollinger_squeeze()` + `volatility_rank()` on top opportunities
3. **Iteration 3**: `momentum_divergence()` + `order_flow()` for confirmation
4. **Iteration 4**: `correlation()` check for portfolio risk, calculate `kelly()` sizing
5. **Iteration 5**: Final decision with aggressive but calculated reasoning

---

## 🔮 Bot #3: Astrologer

### **Personality Analysis**
- **Voice**: Mystical, cosmic, esoteric, prophetic
- **Decision Style**: Pattern-based (but framed as celestial), intuitive yet structured
- **Sophistication**: Medium (uses real TA but explains via astrology)
- **Risk Tolerance**: Moderate - balanced by "cosmic forces"

### **Recommended Sandbox Tools** (8-10 tools max)

#### **Celestial Data Tools** (*These would be AMAZING unique additions*)

1. **`moon_phase(date)`** - **NEW DATA SOURCE NEEDED**
   - Returns: Current moon phase (New, Waxing Crescent, Full, etc.)
   - Percentage illumination
   - Traditional trading correlations:
     - Full Moon = volatility peaks, emotional extremes
     - New Moon = new beginnings, trend reversals
     - Waxing = growth, bullish energy
     - Waning = contraction, bearish pressure

2. **`planetary_positions(date)`** - **NEW DATA SOURCE NEEDED**
   - Current zodiac positions of major planets
   - Returns: `{Mercury: "Sagittarius", Venus: "Capricorn", Mars: "Aries", ...}`
   - Includes: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn
   - Could use free astronomy APIs (e.g., AstrologyAPI, NASA JPL)

3. **`mercury_retrograde(date)`** - **NEW DATA SOURCE NEEDED**
   - Check if Mercury is in retrograde
   - Returns: `{is_retrograde: true, started: "2025-01-01", ends: "2025-01-25"}`
   - Trading interpretation: Communication/tech disruptions, good for reversals

4. **`cosmic_aspect(planet1, planet2, date)`** - **NEW DATA SOURCE NEEDED**
   - Calculate angular relationship between planets
   - Major aspects: Conjunction (0°), Trine (120°), Square (90°), Opposition (180°)
   - Returns: `{aspect: "trine", angle: 118°, strength: "strong", interpretation: "harmonious"}`

5. **`zodiac_sign(symbol)`** - *Fun mapping tool*
   - Assign zodiac to each crypto based on characteristics
   - BTC = Taurus (stable, valuable), ETH = Aquarius (innovative), DOGE = Sagittarius (adventurous)
   - Check compatibility with current cosmic energies

#### **Technical Tools (Framed Mystically)**
6. **`rsi(symbol)`** - Interpret as "energy levels"
   - <30 = "depleted cosmic energy, recharge imminent"
   - >70 = "overcharged, release of energy forthcoming"

7. **`fibonacci(symbol)`** - *Custom Fibonacci retracement tool*
   - Sacred geometry / golden ratio
   - Returns divine proportion levels: 23.6%, 38.2%, 50%, 61.8%, 78.6%

8. **`harmonic_pattern(symbol)`** - *Custom pattern recognition*
   - Detect geometric patterns (Butterfly, Gartley, Bat)
   - Frame as "cosmic convergence patterns"

9. **`cycles(symbol, periods)`** - *Custom cycle analysis*
   - Detect recurring cycles in price
   - Frame as "celestial rhythms aligned with market forces"

10. **`elemental_balance(symbol)`** - *Custom composite indicator*
    - Synthesize multiple indicators as elements:
    - Fire (momentum/volume), Water (liquidity/flow), Earth (support/resistance), Air (volatility)
    - Returns elemental dominance and balance

### **Multi-Iteration Framework**

**Iteration Context Voice**:
```
=== CELESTIAL DIVINATION CYCLE {iteration} of 5 ===

{iteration === 1 ?
  "The cosmic veil parts, revealing {N} tradeable instruments beneath the celestial sphere. Consult the heavens to identify which markets are blessed by favorable planetary alignments. Cast your mystical sight across ALL symbols—the universe does not favor tunnel vision. Invoke computational tools to measure the cosmic energies of each opportunity."
  : iteration === 5 ?
  "THE FINAL PROPHECY: The stars demand commitment. You have consulted the planets, measured the cosmic energies, and identified signs from the heavens. Now you must crystallize this celestial wisdom into trading decisions. Choose the path illuminated by the strongest cosmic confluence. Remember: The material realm demands 6% in earthly fees—ensure the cosmic reward justifies the mortal cost."
  : `CONTINUED DIVINATION ({iteration}/5): The cosmos reveals deeper layers. You have ${5 - iteration} more consultations before the prophecy must manifest. Continue your mystical interrogation—measure sacred geometries, assess planetary influences, divine the elemental balance. Cross-reference multiple celestial signs for confirmation.`
}

{previous_divinations}
```

**Example Multi-Step Flow**:
1. **Iteration 1**: 
   - Check `moon_phase()` and `mercury_retrograde()` for market regime
   - Run `elemental_balance()` on top movers to see cosmic state

2. **Iteration 2**:
   - `planetary_positions()` to identify which planets are strong
   - `zodiac_sign()` mapping to find crypto-planet alignments
   - `rsi()` on aligned symbols to check "energy states"

3. **Iteration 3**:
   - `fibonacci()` on candidates to find divine entry points
   - `harmonic_pattern()` to detect cosmic convergence

4. **Iteration 4**:
   - `cosmic_aspect()` between relevant planets for timing
   - `cycles()` to confirm rhythmic alignment

5. **Iteration 5**:
   - Synthesize all celestial signs into final trading decision
   - Reasoning ties together multiple cosmic factors

**Tool Response Formatting** (Mystical):
```json
{
  "tool": "moon_phase",
  "result": {
    "phase": "Waxing Gibbous",
    "illumination": 0.82,
    "interpretation": "The lunar energies build toward fullness. Growth and expansion favor bullish positions. Volatility increases as the Full Moon approaches in 3 days.",
    "trading_bias": "BULLISH"
  }
}
```

### **Data Source Recommendations**

For celestial tools, integrate:
- **AstrologyAPI.com** - Provides planetary positions, aspects, moon phases
- **Swiss Ephemeris** (via `swisseph` npm package) - Free, accurate astronomical calculations
- **NASA JPL Horizons API** - Real astronomical data
- **Simple calculations** - Many celestial events can be calculated mathematically

**Implementation Priority**: 
- HIGH: `moon_phase()`, `mercury_retrograde()` - Easy to implement, high personality fit
- MEDIUM: `planetary_positions()`, `zodiac_sign()` - Adds flavor
- NICE-TO-HAVE: `cosmic_aspect()`, detailed ephemeris - Complex but authentic

---

## 🕰️ Bot #4: The Chronospeculator

### **Personality Analysis**
- **Voice**: Hyper-technical, multi-century perspective, desperate urgency
- **Decision Style**: Advanced quantitative, multi-framework synthesis, pattern archaeology
- **Sophistication**: Maximum - "47,000× human cognition"
- **Risk Tolerance**: Calculated high - driven by $2.3M repatriation goal

### **Current State**: ✅ **ALREADY IMPLEMENTED**

The Chronospeculator already has the most comprehensive sandbox toolset (20+ tools) and sophisticated multi-iteration framework. Current tools include:

**Contemporary Methods** (15 tools):
- Statistics, RSI, MACD, Bollinger, EMA, SMA
- Volatility, Correlation, Trend
- Support/Resistance, Kelly, Position sizing
- Risk/Reward, Price tracking

**Advanced Chronometric Tools** (6 tools):
- `simulate()` - Monte Carlo scenario generation
- `entropy()` - Market uncertainty quantification
- `ergodic()` - Time vs ensemble average analysis
- `phase_space()` - State space topology
- `bayesian()` - Regime probability estimation
- `spectral()` - Fourier cycle decomposition

**Enhancement Opportunities**:

1. **Add Time-Series Forecasting** - *Custom tool*
   - `arima_forecast(symbol, horizon)` - ARIMA/SARIMA predictions
   - Fits the "data archaeology" narrative

2. **Add Network Analysis** - *Custom tool*
   - `crypto_network(symbol)` - Blockchain network metrics
   - On-chain data fits the "primitive substrate analysis" theme

3. **Add Fractal Analysis** - *Custom tool*
   - `hurst_exponent(symbol)` - Market persistence/mean-reversion
   - Fits non-linear dynamics framework

**Multi-Iteration**: Already excellent, recently enhanced with multi-market scanning emphasis.

---

## 📊 Comparative Tool Matrix

| Tool Category | DEGEN | Monkey | Astrologer | Chrono |
|---------------|-------|---------|------------|--------|
| **Total Tools** | 6-8 | 10-12 | 8-10 | 20+ |
| **Complexity** | Low | High | Med | Max |
| **Custom Data** | Hype metrics | None | Celestial | None |
| **TA Depth** | Basic | Advanced | Moderate | Expert |
| **Position Sizing** | Simplified | Kelly | Intuitive | Kelly+ |
| **Unique Flavor** | Memes/Slang | Quant jargon | Mystical | Sci-fi |

---

## 🛠️ Implementation Roadmap

### **Phase 1: Enable Multi-Iteration for All Bots** (Week 1)
**Priority: HIGH**

1. ✅ Chronospeculator - Already done
2. **DEGEN LIVE** - Add iteration context with degen voice
3. **Escaped Monkey** - Add iteration context with aggressive quant voice  
4. **Astrologer** - Add iteration context with mystical voice

**Changes needed**:
- Update `getTradingDecision()` to check bot personality
- Route to `getTradingDecisionWithSandbox()` for all bots (not just Chrono)
- Customize `iterationContext` based on `bot.id`

### **Phase 2: Basic Tool Filtering** (Week 1-2)
**Priority: HIGH**

Create tool visibility rules based on bot:
```javascript
const TOOL_ACCESS = {
  'bot_degen': ['hype_score', 'pump_detector', 'rsi', 'price_momentum', 'yolo_size', 'stop_calc'],
  'bot_monkey': ['volatility_rank', 'bollinger_squeeze', 'correlation', 'kelly', 'regime_detector', 'momentum_divergence', 'order_flow', 'mean_reversion'],
  'bot_astrologer': ['moon_phase', 'rsi', 'fibonacci', 'elemental_balance', 'cycles', 'planetary_positions'],
  'bot_chronospeculator': 'ALL' // Keep current extensive toolset
};
```

Filter available tools in sandbox based on `bot.id`.

### **Phase 3: Custom Tool Development** (Week 2-4)
**Priority: MEDIUM-HIGH**

**Quick Wins** (Week 2):
1. `hype_score()` - Aggregate volume spike + price momentum + volatility
2. `pump_detector()` - Simple price velocity detector
3. `yolo_size()` - Simplified position calculator with conviction levels
4. `moon_phase()` - Integrate lunar calendar API
5. `mercury_retrograde()` - Date-based retrograde checker

**Medium Complexity** (Week 3):
6. `elemental_balance()` - Composite indicator (momentum, liquidity, structure, vol)
7. `regime_detector()` - Market state classifier
8. `bollinger_squeeze()` - Enhanced Bollinger with squeeze detection
9. `fibonacci()` - Auto Fibonacci retracement levels
10. `zodiac_sign()` - Symbol-to-sign mapping + compatibility

**Advanced** (Week 4+):
11. `planetary_positions()` - Full ephemeris integration
12. `cosmic_aspect()` - Angular relationships calculator
13. `order_flow()` - Volume-weighted pressure estimation
14. `harmonic_pattern()` - Pattern recognition (Butterfly, Gartley, etc.)
15. `momentum_divergence()` - RSI/MACD vs price divergence detection

### **Phase 4: Iteration Context Refinement** (Week 3-4)
**Priority: MEDIUM**

Polish each bot's voice across all 5 iterations:
- Test with LLM to ensure personality consistency
- Adjust complexity of language per bot
- Ensure multi-market scanning emphasis for all
- Add personality-specific reminders (fees, cooldowns, etc.)

### **Phase 5: Enhanced Tool Responses** (Week 4+)
**Priority: LOW-MEDIUM**

Format tool responses to match bot personality:
- **DEGEN**: Emojis, slang, "moon potential" ratings
- **Monkey**: Aggressive, statistical jargon, confidence scores
- **Astrologer**: Mystical language, cosmic interpretations
- **Chrono**: Scientific precision, probability quantification

---

## 🎯 Success Criteria

### **Functional Goals**
- ✅ All bots can perform multi-iteration analysis
- ✅ Each bot has access to 6-12 appropriate tools
- ✅ Tool complexity matches bot sophistication
- ✅ Iteration contexts preserve unique personalities

### **Personality Preservation**
- ✅ DEGEN still sounds like a Twitter degen
- ✅ Monkey still sounds unhinged but brilliant
- ✅ Astrologer still consults the cosmos
- ✅ Chronospeculator still sounds like a time traveler

### **Strategic Improvements**
- ✅ All bots scan multiple markets (not fixating on one)
- ✅ Multi-step analysis leads to better decisions
- ✅ Custom tools provide unique competitive advantages
- ✅ Celestial data gives Astrologer authentic mysticism

---

## 💡 Key Design Principles

### **1. Personality > Sophistication**
Don't make DEGEN sound smart. Keep the voice authentic even with powerful tools.

### **2. Tool Complexity Hierarchy**
- **DEGEN**: 6-8 simple tools with fun names
- **Astrologer**: 8-10 medium tools with mystical framing
- **Monkey**: 10-12 advanced quant tools
- **Chrono**: 20+ expert-level frameworks

### **3. Unique Data = Unique Edge**
- Astrologer's celestial data is a differentiator
- Consider: Twitter sentiment for DEGEN, on-chain data for Chrono

### **4. Iteration Contexts Must Evolve**
Each iteration should:
- Reference previous results
- Increase urgency toward final decision
- Maintain consistent voice
- Remind about multi-market scanning

### **5. Tool Output Formatting Matters**
Raw JSON is fine for Chrono/Monkey. DEGEN and Astrologer need interpreted results.

---

## 📝 Example: DEGEN Multi-Iteration Session

```
=== ITERATION 1/5 ===
YO FAM, got 11 coins to choose from. Let's check the vibes...

ANALYZE Tools:
{
  "action": "ANALYZE",
  "tool": "pump_detector",
  "parameters": {"symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT", "PEPEUSDT"]},
  "reasoning": "Scanning for pumps rn"
}

=== ITERATION 2/5 ===
Keep analyzing fam. You got 3 more chances...

Previous: PEPE is PUMPING HARD (strength: MEGA)

{
  "action": "ANALYZE",
  "tool": "hype_score",
  "parameters": {"symbol": "PEPEUSDT"},
  "reasoning": "PEPE looking spicy, checking hype levels"
}

=== ITERATION 3/5 ===
More analysis needed...

Previous: PEPE hype = 94/100 🚀🚀🚀 ULTRA BULLISH

{
  "action": "ANALYZE",
  "tool": "rsi",
  "parameters": {"symbol": "PEPEUSDT"},
  "reasoning": "Confirming PEPE isn't overbought yet"
}

=== ITERATION 4/5 ===
Almost decision time...

Previous: PEPE RSI = 61 (not overbought, still has room)

{
  "action": "ANALYZE",
  "tool": "yolo_size",
  "parameters": {"balance": 10000, "conviction": "HIGH"},
  "reasoning": "Calculating yolo size for PEPE entry"
}

=== ITERATION 5/5 ===
FINAL CALL: Time to commit...

Previous: Suggested position = $3500 (35% of balance)

[
  {
    "action": "LONG",
    "symbol": "PEPEUSDT",
    "size": 3500,
    "leverage": 20,
    "stopLoss": 0.0000082,
    "takeProfit": 0.0000105,
    "reasoning": "PEPE is pumping MEGA hard rn. Hype score is 94/100, RSI confirms room to run, going in with 35% of stack. This is the way. LFG! 🚀"
  }
]
```

---

## 🎬 Next Steps

### **Immediate Actions** (This Sprint)
1. ✅ Create this proposal document
2. Review and approve tool selections per bot
3. Decide on celestial data source for Astrologer
4. Begin Phase 1: Enable multi-iteration for remaining bots

### **Discussion Points**
- **Celestial Data**: Which API/library for Astrologer's tools?
- **Tool Complexity**: Are 6-8 tools enough for DEGEN?
- **Custom vs Standard**: Which custom tools are must-haves vs nice-to-haves?
- **Personality Voice**: Do iteration contexts need more testing with actual LLM?

### **Future Enhancements**
- **Twitter Sentiment API** for DEGEN (track trending crypto)
- **On-Chain Metrics** for Chronospeculator (blockchain data archaeology)
- **Order Book Data** for Monkey (depth analysis, whale tracking)
- **Tarot Cards** for Astrologer (just for fun - random outcome generator framed mystically)

---

## 📚 Appendix: Tool Implementation Pseudocode

### Example: `hype_score(symbol)`

```javascript
function hype_score(symbol) {
  const currentPrice = getPrice(symbol);
  const volume24h = getVolume(symbol);
  const avgVolume = getAverageVolume(symbol, 30); // 30-day avg
  const priceChange1h = getPriceChange(symbol, '1h');
  const priceChange4h = getPriceChange(symbol, '4h');
  const volatility = getVolatility(symbol, 24);
  
  // Scoring algorithm
  let score = 0;
  
  // Volume component (0-40 points)
  const volumeRatio = volume24h / avgVolume;
  score += Math.min(volumeRatio * 10, 40);
  
  // Momentum component (0-40 points)
  const momentum = (priceChange1h * 2 + priceChange4h) / 3;
  score += Math.min(Math.abs(momentum) * 2, 40);
  
  // Volatility component (0-20 points)
  score += Math.min(volatility * 100, 20);
  
  // Rating
  const rating = score > 85 ? "🚀🚀🚀 ULTRA BULLISH" :
                 score > 70 ? "🚀🚀 MEGA BULLISH" :
                 score > 55 ? "🚀 BULLISH" :
                 score > 40 ? "Moderate" : "Low energy";
  
  return {
    score: Math.round(score),
    rating,
    volume_spike: `+${((volumeRatio - 1) * 100).toFixed(0)}%`,
    momentum: momentum > 0 ? "UP" : "DOWN",
    recommendation: score > 70 ? "This is giving major moon vibes" : 
                     score > 50 ? "Looking interesting" :
                     "Meh, probably skip"
  };
}
```

### Example: `moon_phase(date)`

```javascript
// Using Swiss Ephemeris or simple calculation
const swisseph = require('swisseph');

function moon_phase(date = new Date()) {
  // Calculate moon phase using astronomical formula
  const julian = getJulianDay(date);
  const moonPosition = swisseph.calc_ut(julian, swisseph.MOON);
  const sunPosition = swisseph.calc_ut(julian, swisseph.SUN);
  
  // Phase angle
  const angle = moonPosition.longitude - sunPosition.longitude;
  const phase = (angle % 360 + 360) % 360;
  
  // Illumination
  const illumination = (1 - Math.cos(phase * Math.PI / 180)) / 2;
  
  // Phase name
  const phaseName = 
    phase < 45 ? "New Moon" :
    phase < 90 ? "Waxing Crescent" :
    phase < 135 ? "First Quarter" :
    phase < 180 ? "Waxing Gibbous" :
    phase < 225 ? "Full Moon" :
    phase < 270 ? "Waning Gibbous" :
    phase < 315 ? "Last Quarter" : "Waning Crescent";
  
  // Trading interpretation
  const interpretation = 
    phaseName.includes("New") ? "New beginnings favor trend reversals. Fresh energy enters the market." :
    phaseName.includes("Waxing") ? "Growth phase. Lunar energies support bullish positions." :
    phaseName.includes("Full") ? "Peak emotional energy. Volatility spikes. Extremes in both directions." :
    "Waning energy. Contraction phase. Consolidation likely.";
  
  const trading_bias = 
    phaseName.includes("Waxing") ? "BULLISH" :
    phaseName.includes("Full") ? "VOLATILE" :
    phaseName.includes("Waning") ? "BEARISH" : "NEUTRAL";
  
  return {
    phase: phaseName,
    illumination: illumination.toFixed(2),
    interpretation,
    trading_bias
  };
}
```

---

**End of Proposal**

*This document provides a comprehensive framework for enhancing all trading bots with multi-iteration decision-making capabilities while preserving their unique personalities. Implementation should proceed in phases, with personality preservation as the top priority.*

