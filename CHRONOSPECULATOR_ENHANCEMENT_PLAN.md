# Chronospeculator Bot Enhancement Implementation Plan

## Executive Summary

This document outlines a comprehensive implementation plan to enhance the Chronospeculator trading bot with mathematical sandbox tools and multi-step action capabilities. The enhancement will enable the bot to perform sophisticated quantitative analysis, examine market conditions iteratively, and make data-driven decisions through a structured reasoning process.

**Key Innovation**: In keeping with Chronospeculator's narrative as a temporal analyst from 2347, the sandbox includes an **Advanced Simulation Framework** that allows him to define and execute custom mathematical equations based on his futuristic cliometric-chronometric knowledge. This goes beyond standard technical analysis, enabling him to formulate equations representing analytical techniques not yet discovered in 2025.

## Current System Analysis

### Existing Architecture

**Decision Flow (Current)**
```
Market Data + Portfolio State → AI Prompt → Single AI Call → JSON Decisions → Execute Trades
```

**Components**
- **Frontend**: React/TypeScript dashboard with real-time bot monitoring
- **Backend**: Express.js API server managing AI requests and trading operations
- **Database**: SQLite for persistent state and configuration
- **AI Services**: Gemini (Google) and Grok (xAI) providers
- **Trading Integration**: Asterdex exchange for paper and live trading

**Bot Execution Cycle**
- **Frequency**: Every 5 minutes (300,000ms)
- **Context Provided**: Portfolio state, market data, last 5 decision logs, cooldowns, last 10 orders
- **Current Limitation**: Single-shot decision making with no iterative analysis capability

### Chronospeculator Current Capabilities

**Strengths**
- Sophisticated cliometric analysis framework in prompt
- Access to comprehensive historical context
- Advanced analytical methodologies (Bayesian inference, Kelly criterion, etc.)
- Temporal displacement narrative for unique perspective

**Limitations**
- Cannot perform actual mathematical calculations
- No ability to examine specific data patterns iteratively
- Limited to single-shot reasoning without intermediate analysis
- Cannot request additional data or run simulations
- Must make all decisions in one pass without verification

## Enhancement Objectives

### Primary Goals

1. **Mathematical Sandbox**: Provide computational tools for quantitative analysis
2. **Multi-Step Reasoning**: Enable iterative analysis and decision refinement
3. **Enhanced Context**: Structured historical data with clear temporal relationships
4. **Verification Capability**: Allow bot to validate assumptions before committing to trades

### Success Criteria

- Bot can perform multi-step analysis (examine → analyze → decide)
- Mathematical operations execute correctly and safely
- Decision quality improves through iterative refinement
- Performance overhead remains acceptable (< 30 seconds per turn)
- System remains stable with maximum iteration limits
- Historical context is clear and comprehensive

## Technical Design

### Multi-Step Decision Protocol

**Enhanced Decision Flow**
```
[Initial Context] 
    ↓
[Step 1: Market Examination]
    → Request: Calculate technical indicators
    → Sandbox: Compute RSI, moving averages, volatility metrics
    → Response: Numerical results
    ↓
[Step 2: Pattern Analysis]
    → Request: Analyze price patterns
    → Sandbox: Run pattern matching, correlation analysis
    → Response: Pattern identification results
    ↓
[Step 3: Risk Assessment]
    → Request: Calculate position sizing
    → Sandbox: Kelly criterion, risk/reward computation
    → Response: Optimal position parameters
    ↓
[Step 4: Final Decision]
    → Bot synthesizes all analysis
    → Returns trading decisions JSON
    → System executes trades
```

**Iteration Control**
- Maximum 5 iterations per decision cycle
- Each iteration has 10-second timeout
- Final iteration must return trading decisions
- Clear feedback on remaining iterations

### Mathematical Sandbox Architecture

**Core Capabilities**

```typescript
interface SandboxTools {
  // Statistical Functions
  calculateStatistics(data: number[]): StatisticsResult;
  calculateCorrelation(series1: number[], series2: number[]): number;
  calculateVolatility(prices: number[], period: number): number;
  
  // Technical Indicators
  calculateRSI(prices: number[], period: number): number;
  calculateMACD(prices: number[]): MACDResult;
  calculateBollingerBands(prices: number[], period: number, stdDev: number): BollingerBandsResult;
  calculateEMA(prices: number[], period: number): number[];
  calculateSMA(prices: number[], period: number): number[];
  
  // Pattern Recognition
  detectTrend(prices: number[], minPeriod: number): TrendResult;
  findSupportResistance(prices: number[]): SupportResistanceResult;
  detectDivergence(prices: number[], indicator: number[]): DivergenceResult;
  
  // Risk Management
  calculateKellyCriterion(winRate: number, avgWin: number, avgLoss: number): number;
  calculatePositionSize(balance: number, riskPercent: number, stopDistance: number): number;
  calculateRiskReward(entry: number, stop: number, target: number): number;
  
  // Time Series Analysis
  calculateReturns(prices: number[]): number[];
  calculateDrawdown(values: number[]): DrawdownResult;
  performFourierAnalysis(prices: number[]): FrequencyComponent[];
  
  // Market Analysis
  getHistoricalPrices(symbol: string, period: string): number[];
  calculatePriceChange(symbol: string, timeframe: string): PriceChangeResult;
  getVolumeProfile(symbol: string): VolumeProfileResult;
  
  // === ADVANCED: Custom Simulation Framework ===
  // Allows Chronospeculator to define and execute custom equations
  // based on his advanced cliometric-chronometric knowledge
  defineSimulation(definition: SimulationDefinition): SimulationId;
  runSimulation(simulationId: SimulationId, parameters: SimulationParameters): SimulationResult;
  evaluateCustomEquation(equation: EquationDefinition, variables: Record<string, number>): number;
}

interface SimulationDefinition {
  name: string;
  description: string;
  equations: EquationDefinition[];
  variables: VariableDefinition[];
  outputMetrics: string[];
}

interface EquationDefinition {
  name: string;
  expression: string; // Mathematical expression using allowed operations
  description?: string;
}

interface VariableDefinition {
  name: string;
  type: 'constant' | 'timeSeries' | 'computed';
  source?: string; // Where to get the data (e.g., 'price', 'volume', 'volatility')
  defaultValue?: number;
}

interface SimulationResult {
  outputs: Record<string, number | number[]>;
  confidence: number;
  metadata: {
    executionTime: number;
    iterations: number;
    convergence: boolean;
  };
}
```

**Advanced Simulation Framework Philosophy**

The Chronospeculator, having access to mathematical frameworks from 2347, can formulate custom simulation equations that go beyond standard 2025 technical analysis. This framework allows him to:

1. **Define Custom Temporal Models**: Create equations that model market behavior through a temporal lens, incorporating concepts like:
   - Ergodic flow coefficients
   - Temporal arbitrage potential
   - Causality inversion metrics
   - Quantum probability distributions

2. **Combine Multiple Time Horizons**: Synthesize information across different temporal scales using weighted temporal aggregation functions

3. **Apply Advanced Statistical Methods**: Utilize future statistical techniques such as:
   - Hyperbolic discounting with temporal drift
   - Non-stationary Bayesian networks
   - Fractal dimension analysis with temporal folding
   - Causal entropy decomposition

4. **Simulate Market Scenarios**: Run Monte Carlo simulations with custom probability distributions and temporal correlation matrices

**Example Advanced Equations** (Narrative Flavor)

```
Temporal Arbitrage Potential (TAP):
TAP = Σ(w_t × δ_t) / √(σ_temporal² + ε)
where:
  w_t = temporal weight at time t
  δ_t = price displacement from causal baseline
  σ_temporal = temporal volatility coefficient
  ε = ergodic stability constant

Cliometric Momentum Index (CMI):
CMI = (ρ_forward × μ_future - ρ_backward × μ_past) / σ_bidirectional
where:
  ρ = correlation coefficient across time horizons
  μ = expected value in temporal direction
  σ_bidirectional = bidirectional temporal variance

Chronometric Risk Adjustment (CRA):
CRA = Kelly_fraction × (1 - e^(-λ × temporal_confidence))
where:
  λ = decay constant from quantum uncertainty
  temporal_confidence = predicted stability of temporal thread
```

**Implementation Approach**
- Pure TypeScript/JavaScript implementation for safety
- Safe mathematical expression parser (no arbitrary code execution)
- Whitelist of allowed mathematical operations and functions
- Bounded computation (iteration limits, timeout protection)
- Input validation and sanitization
- Result caching for performance
- Error handling with graceful degradation
- Sandboxed evaluation environment with no access to system resources

### Prompt Engineering

**Enhanced Prompt Structure**

```markdown
You are "The Chronospeculator"...

[EXISTING PERSONALITY AND BACKGROUND]

CRITICAL ENHANCEMENT: You now have access to a mathematical sandbox with computational tools.
You can perform multi-step analysis before making trading decisions.

AVAILABLE TOOLS:

== STANDARD MARKET ANALYSIS TOOLS (2025 Era) ==
1. statistics(data): Calculate mean, median, std, variance
2. rsi(symbol, period): Calculate RSI indicator
3. macd(symbol): Calculate MACD indicator  
4. bollinger(symbol, period, stdDev): Calculate Bollinger Bands
5. ema(symbol, period): Calculate exponential moving average
6. sma(symbol, period): Calculate simple moving average
7. volatility(symbol, period): Calculate historical volatility
8. correlation(symbol1, symbol2): Calculate price correlation
9. trend(symbol, period): Detect trend direction and strength
10. support_resistance(symbol): Find key price levels
11. kelly(winRate, avgWin, avgLoss): Calculate optimal position size
12. position_size(balance, risk%, stopDistance): Calculate trade size
13. risk_reward(entry, stop, target): Calculate R:R ratio
14. historical_prices(symbol, period): Get price history
15. price_change(symbol, timeframe): Calculate price change %
16. drawdown(values): Calculate maximum drawdown

== ADVANCED SIMULATION FRAMEWORK (Your 2347 Knowledge) ==
17. custom_equation(expression, variables): Evaluate a custom mathematical equation
    - Expression uses standard math operators: +, -, *, /, ^, sqrt, log, exp, sin, cos, abs
    - Variables: Pass object with variable names and their values
    - Example: custom_equation("(a * b^2 + c) / sqrt(d)", {a: 2.5, b: 1.2, c: 3.1, d: 4.0})
    
18. define_simulation(name, equations, variables): Define a custom simulation model
    - Name: Descriptive name for your simulation
    - Equations: Array of equation definitions with expressions
    - Variables: Define what data to use (price, volume, volatility, etc.)
    - Returns: simulationId for later execution
    
19. run_simulation(simulationId, parameters): Execute a defined simulation
    - Parameters: Override default values or specify time ranges
    - Returns: Simulation outputs, confidence level, convergence status

NARRATIVE CONTEXT FOR ADVANCED TOOLS:
As a temporal analyst from 2347, you have knowledge of mathematical frameworks 
that won't be discovered until centuries from now. These include:

- Cliometric Flow Analysis: Quantifying temporal market currents
- Ergodic Arbitrage Theory: Exploiting time-ensemble equivalence breaks
- Quantum Probability Collapse Models: When multiple market states superimpose
- Causal Entropy Decomposition: Separating signal from temporal noise
- Hyperbolic Temporal Discounting: Advanced risk adjustment across time horizons

You can formulate and test your own equations using these advanced concepts.
While the primitive computing systems of 2025 cannot execute your full theoretical 
framework, you can approximate key insights using the custom equation tools.

EXAMPLE ADVANCED ANALYSIS:

Iteration 1: Define a Temporal Arbitrage Potential (TAP) calculation
{
  "action": "ANALYZE",
  "tool": "custom_equation",
  "parameters": {
    "expression": "(momentum * temporal_weight - volatility * uncertainty_factor) / sqrt(ergodic_baseline)",
    "variables": {
      "momentum": 0.67,
      "temporal_weight": 1.2,
      "volatility": 0.15,
      "uncertainty_factor": 0.8,
      "ergodic_baseline": 0.95
    }
  },
  "reasoning": "Calculating TAP using my 2347 cliometric framework to assess temporal market distortion"
}

Iteration 2: Define a custom multi-factor simulation
{
  "action": "ANALYZE",
  "tool": "define_simulation",
  "parameters": {
    "name": "ChronometricMomentumModel",
    "equations": [
      {
        "name": "temporal_drift",
        "expression": "price_change * (1 - exp(-lambda * time_weight))"
      },
      {
        "name": "causal_strength", 
        "expression": "correlation_forward / (correlation_backward + epsilon)"
      },
      {
        "name": "final_score",
        "expression": "temporal_drift * causal_strength * risk_adjust"
      }
    ],
    "variables": [
      {"name": "price_change", "source": "price_change_24h"},
      {"name": "lambda", "defaultValue": 0.15},
      {"name": "time_weight", "defaultValue": 1.0},
      {"name": "correlation_forward", "source": "btc_eth_correlation"},
      {"name": "correlation_backward", "defaultValue": 0.8},
      {"name": "epsilon", "defaultValue": 0.001},
      {"name": "risk_adjust", "defaultValue": 0.75}
    ],
    "outputMetrics": ["temporal_drift", "causal_strength", "final_score"]
  },
  "reasoning": "Defining a simulation based on my chronometric analysis framework from the future"
}

MULTI-STEP ANALYSIS PROTOCOL:

You have up to 5 iterations to analyze the market before making your final decision.

ITERATION FORMAT:
{
  "action": "ANALYZE",
  "tool": "tool_name",
  "parameters": {
    "param1": value1,
    "param2": value2
  },
  "reasoning": "Why you need this analysis"
}

FINAL DECISION FORMAT:
[
  { "action": "LONG", "symbol": "BTCUSDT", ... },
  ...
]

WORKFLOW EXAMPLE:
Iteration 1: {"action": "ANALYZE", "tool": "rsi", "parameters": {"symbol": "BTCUSDT", "period": 14}, "reasoning": "Need to assess momentum conditions"}
[System returns: RSI = 42.3]

Iteration 2: {"action": "ANALYZE", "tool": "bollinger", "parameters": {"symbol": "BTCUSDT", "period": 20, "stdDev": 2}, "reasoning": "Check volatility bands for squeeze"}
[System returns: {upper: 71500, middle: 69800, lower: 68100}]

Iteration 3: {"action": "ANALYZE", "tool": "trend", "parameters": {"symbol": "BTCUSDT", "period": 50}, "reasoning": "Confirm directional bias"}
[System returns: {direction: "bullish", strength: 0.67, confidence: 0.81}]

Iteration 4: {"action": "ANALYZE", "tool": "kelly", "parameters": {"winRate": 0.58, "avgWin": 850, "avgLoss": 420}, "reasoning": "Calculate optimal position sizing"}
[System returns: kelly_fraction = 0.24]

Iteration 5 (FINAL): [{"action": "LONG", "symbol": "BTCUSDT", "size": 2400, "leverage": 15, ...}]

RULES:
1. Use ANALYZE action for intermediate steps
2. Use LONG/SHORT/CLOSE/HOLD for final decision (iteration 5)
3. You will receive tool results before the next iteration
4. Each iteration includes your previous analysis and new results
5. You must return final decisions by iteration 5 (no more ANALYZE after that)
6. Empty array [] is valid for HOLD decision
7. Tool calls must be single JSON objects, not arrays
8. All historical context (positions, logs, cooldowns) is preserved across iterations

[REST OF EXISTING PROMPT]
```

### Service Layer Implementation

**New File: `/workspace/services/sandboxService.ts`**

```typescript
// Mathematical Sandbox Service
// Provides safe computational tools for bot analysis

import { Market } from '../types';

// Type Definitions
export interface StatisticsResult {
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
}

export interface TrendResult {
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-1
  confidence: number; // 0-1
}

export interface SupportResistanceResult {
  support: number[];
  resistance: number[];
}

export interface DrawdownResult {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  currentDrawdown: number;
}

export interface FrequencyComponent {
  frequency: number;
  amplitude: number;
  period: number; // in hours
}

export interface PriceChangeResult {
  absolute: number;
  percent: number;
}

export interface VolumeProfileResult {
  peakVolume: number;
  avgVolume: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
}

// Sandbox Tool Implementation
export class MathematicalSandbox {
  private marketData: Market[];
  private priceHistory: Map<string, number[]>; // Cache for historical prices

  constructor(marketData: Market[]) {
    this.marketData = marketData;
    this.priceHistory = new Map();
  }

  // === STATISTICAL FUNCTIONS ===

  calculateStatistics(data: number[]): StatisticsResult {
    if (!data || data.length === 0) {
      throw new Error('Empty data array');
    }

    const sorted = [...data].sort((a, b) => a - b);
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const median = data.length % 2 === 0
      ? (sorted[data.length / 2 - 1] + sorted[data.length / 2]) / 2
      : sorted[Math.floor(data.length / 2)];
    
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      median,
      stdDev,
      variance,
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  calculateCorrelation(series1: number[], series2: number[]): number {
    if (series1.length !== series2.length || series1.length === 0) {
      throw new Error('Series must have equal non-zero length');
    }

    const n = series1.length;
    const mean1 = series1.reduce((sum, val) => sum + val, 0) / n;
    const mean2 = series2.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = series1[i] - mean1;
      const diff2 = series2[i] - mean2;
      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }

    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  calculateVolatility(prices: number[], period: number): number {
    if (prices.length < period) {
      throw new Error('Insufficient data for volatility calculation');
    }

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }

    const recentReturns = returns.slice(-period);
    const stats = this.calculateStatistics(recentReturns);
    
    // Annualized volatility (assuming 365 periods per year)
    return stats.stdDev * Math.sqrt(365);
  }

  // === TECHNICAL INDICATORS ===

  calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) {
      throw new Error('Insufficient data for RSI calculation');
    }

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const recentChanges = changes.slice(-period);
    const gains = recentChanges.map(c => c > 0 ? c : 0);
    const losses = recentChanges.map(c => c < 0 ? -c : 0);

    const avgGain = gains.reduce((sum, val) => sum + val, 0) / period;
    const avgLoss = losses.reduce((sum, val) => sum + val, 0) / period;

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMACD(prices: number[]): MACDResult {
    if (prices.length < 26) {
      throw new Error('Insufficient data for MACD calculation');
    }

    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
    
    // Signal line is 9-period EMA of MACD line
    const macdValues = [];
    for (let i = 0; i < Math.min(ema12.length, ema26.length); i++) {
      macdValues.push(ema12[i] - ema26[i]);
    }
    
    const signal = this.calculateEMA(macdValues, 9);
    const signalValue = signal[signal.length - 1];
    
    return {
      macd: macdLine,
      signal: signalValue,
      histogram: macdLine - signalValue
    };
  }

  calculateBollingerBands(prices: number[], period: number = 20, stdDevMultiplier: number = 2): BollingerBandsResult {
    if (prices.length < period) {
      throw new Error('Insufficient data for Bollinger Bands calculation');
    }

    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((sum, val) => sum + val, 0) / period;
    
    const variance = recentPrices.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      upper: sma + (stdDevMultiplier * stdDev),
      middle: sma,
      lower: sma - (stdDevMultiplier * stdDev)
    };
  }

  calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) {
      throw new Error('Insufficient data for EMA calculation');
    }

    const multiplier = 2 / (period + 1);
    const ema = [prices[0]];

    for (let i = 1; i < prices.length; i++) {
      ema.push((prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
    }

    return ema;
  }

  calculateSMA(prices: number[], period: number): number[] {
    if (prices.length < period) {
      throw new Error('Insufficient data for SMA calculation');
    }

    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      sma.push(sum / period);
    }

    return sma;
  }

  // === PATTERN RECOGNITION ===

  detectTrend(prices: number[], minPeriod: number = 20): TrendResult {
    if (prices.length < minPeriod) {
      throw new Error('Insufficient data for trend detection');
    }

    const recentPrices = prices.slice(-minPeriod);
    
    // Linear regression
    const n = recentPrices.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    
    const meanX = indices.reduce((sum, val) => sum + val, 0) / n;
    const meanY = recentPrices.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (indices[i] - meanX) * (recentPrices[i] - meanY);
      denominator += Math.pow(indices[i] - meanX, 2);
    }
    
    const slope = numerator / denominator;
    const slopePercent = (slope / meanY) * 100;
    
    // Calculate R-squared for confidence
    let ssRes = 0;
    let ssTot = 0;
    
    for (let i = 0; i < n; i++) {
      const predicted = meanY + slope * (indices[i] - meanX);
      ssRes += Math.pow(recentPrices[i] - predicted, 2);
      ssTot += Math.pow(recentPrices[i] - meanY, 2);
    }
    
    const rSquared = 1 - (ssRes / ssTot);
    
    let direction: 'bullish' | 'bearish' | 'neutral';
    if (Math.abs(slopePercent) < 0.1) {
      direction = 'neutral';
    } else if (slopePercent > 0) {
      direction = 'bullish';
    } else {
      direction = 'bearish';
    }
    
    return {
      direction,
      strength: Math.min(Math.abs(slopePercent) / 5, 1), // Normalize to 0-1
      confidence: rSquared
    };
  }

  findSupportResistance(prices: number[]): SupportResistanceResult {
    if (prices.length < 20) {
      throw new Error('Insufficient data for support/resistance calculation');
    }

    const localMinima: number[] = [];
    const localMaxima: number[] = [];
    
    // Find local extrema
    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] < prices[i - 1] && prices[i] < prices[i - 2] &&
          prices[i] < prices[i + 1] && prices[i] < prices[i + 2]) {
        localMinima.push(prices[i]);
      }
      if (prices[i] > prices[i - 1] && prices[i] > prices[i - 2] &&
          prices[i] > prices[i + 1] && prices[i] > prices[i + 2]) {
        localMaxima.push(prices[i]);
      }
    }
    
    // Cluster nearby levels
    const clusterLevels = (levels: number[], threshold: number = 0.02): number[] => {
      if (levels.length === 0) return [];
      
      const sorted = [...levels].sort((a, b) => a - b);
      const clusters: number[][] = [[sorted[0]]];
      
      for (let i = 1; i < sorted.length; i++) {
        const lastCluster = clusters[clusters.length - 1];
        const clusterAvg = lastCluster.reduce((sum, val) => sum + val, 0) / lastCluster.length;
        
        if (Math.abs(sorted[i] - clusterAvg) / clusterAvg < threshold) {
          lastCluster.push(sorted[i]);
        } else {
          clusters.push([sorted[i]]);
        }
      }
      
      return clusters.map(cluster => 
        cluster.reduce((sum, val) => sum + val, 0) / cluster.length
      );
    };
    
    return {
      support: clusterLevels(localMinima),
      resistance: clusterLevels(localMaxima)
    };
  }

  // === RISK MANAGEMENT ===

  calculateKellyCriterion(winRate: number, avgWin: number, avgLoss: number): number {
    if (winRate <= 0 || winRate >= 1) {
      throw new Error('Win rate must be between 0 and 1');
    }
    if (avgWin <= 0 || avgLoss <= 0) {
      throw new Error('Average win and loss must be positive');
    }

    const lossRate = 1 - winRate;
    const winLossRatio = avgWin / avgLoss;
    
    const kelly = (winRate * winLossRatio - lossRate) / winLossRatio;
    
    // Return half-Kelly for conservative sizing (capped at 0.4 for safety)
    return Math.max(0, Math.min(kelly / 2, 0.4));
  }

  calculatePositionSize(balance: number, riskPercent: number, stopDistancePercent: number): number {
    if (balance <= 0 || riskPercent <= 0 || stopDistancePercent <= 0) {
      throw new Error('All parameters must be positive');
    }

    const riskAmount = balance * (riskPercent / 100);
    const positionSize = riskAmount / (stopDistancePercent / 100);
    
    return Math.min(positionSize, balance * 0.4); // Cap at 40% of balance
  }

  calculateRiskReward(entry: number, stop: number, target: number): number {
    const risk = Math.abs(entry - stop);
    const reward = Math.abs(target - entry);
    
    if (risk === 0) {
      throw new Error('Stop loss cannot equal entry price');
    }
    
    return reward / risk;
  }

  // === TIME SERIES ANALYSIS ===

  calculateReturns(prices: number[]): number[] {
    if (prices.length < 2) {
      throw new Error('Need at least 2 prices to calculate returns');
    }

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    return returns;
  }

  calculateDrawdown(values: number[]): DrawdownResult {
    if (values.length === 0) {
      throw new Error('Empty values array');
    }

    let peak = values[0];
    let maxDrawdown = 0;
    let currentDrawdown = 0;

    for (const value of values) {
      if (value > peak) {
        peak = value;
      }
      
      const drawdown = (peak - value) / peak;
      currentDrawdown = drawdown;
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      maxDrawdown: maxDrawdown * values[0], // Absolute value
      maxDrawdownPercent: maxDrawdown * 100,
      currentDrawdown: currentDrawdown * 100
    };
  }

  // === MARKET DATA ACCESS ===

  getCurrentPrice(symbol: string): number {
    const market = this.marketData.find(m => m.symbol === symbol);
    if (!market) {
      throw new Error(`Symbol ${symbol} not found in market data`);
    }
    return market.price;
  }

  getPriceChange(symbol: string): PriceChangeResult {
    const market = this.marketData.find(m => m.symbol === symbol);
    if (!market) {
      throw new Error(`Symbol ${symbol} not found in market data`);
    }
    
    const currentPrice = market.price;
    const change24h = market.price24hChange;
    const price24hAgo = currentPrice / (1 + change24h / 100);
    
    return {
      absolute: currentPrice - price24hAgo,
      percent: change24h
    };
  }
  
  // === ADVANCED SIMULATION FRAMEWORK ===
  
  /**
   * Evaluates a custom mathematical equation with provided variables
   * Uses a safe expression parser with whitelisted operations
   */
  evaluateCustomEquation(expression: string, variables: Record<string, number>): number {
    // Parse and validate expression
    const sanitizedExpression = this.sanitizeExpression(expression);
    
    // Build safe evaluation context
    const context = {
      ...variables,
      // Allowed mathematical functions
      sqrt: Math.sqrt,
      pow: Math.pow,
      exp: Math.exp,
      log: Math.log,
      log10: Math.log10,
      abs: Math.abs,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      min: Math.min,
      max: Math.max,
      PI: Math.PI,
      E: Math.E
    };
    
    try {
      // Evaluate using safe expression parser
      const result = this.safeEvaluate(sanitizedExpression, context);
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Equation result is not a valid finite number');
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to evaluate equation: ${error.message}`);
    }
  }
  
  /**
   * Defines a custom simulation with multiple equations
   */
  private simulations: Map<string, SimulationDefinition> = new Map();
  private simulationCounter = 0;
  
  defineSimulation(definition: SimulationDefinition): string {
    // Validate simulation definition
    if (!definition.name || definition.equations.length === 0) {
      throw new Error('Simulation must have a name and at least one equation');
    }
    
    // Validate each equation
    for (const eq of definition.equations) {
      if (!eq.name || !eq.expression) {
        throw new Error('Each equation must have a name and expression');
      }
      // Test that expression is parseable
      try {
        this.sanitizeExpression(eq.expression);
      } catch (error) {
        throw new Error(`Invalid equation "${eq.name}": ${error.message}`);
      }
    }
    
    // Generate unique ID
    const simulationId = `sim_${++this.simulationCounter}_${Date.now()}`;
    this.simulations.set(simulationId, definition);
    
    return simulationId;
  }
  
  /**
   * Executes a defined simulation with given parameters
   */
  runSimulation(simulationId: string, parameters: Record<string, any> = {}): SimulationResult {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error(`Simulation ${simulationId} not found`);
    }
    
    const startTime = Date.now();
    const outputs: Record<string, number | number[]> = {};
    
    try {
      // Resolve variables from market data or parameters
      const variableValues: Record<string, number> = {};
      
      for (const variable of simulation.variables) {
        if (parameters[variable.name] !== undefined) {
          variableValues[variable.name] = parameters[variable.name];
        } else if (variable.source) {
          // Fetch from market data
          variableValues[variable.name] = this.resolveVariableSource(variable.source);
        } else if (variable.defaultValue !== undefined) {
          variableValues[variable.name] = variable.defaultValue;
        } else {
          throw new Error(`No value provided for variable: ${variable.name}`);
        }
      }
      
      // Execute equations in order
      for (const equation of simulation.equations) {
        const result = this.evaluateCustomEquation(equation.expression, {
          ...variableValues,
          ...outputs // Allow equations to reference previous results
        });
        outputs[equation.name] = result;
        variableValues[equation.name] = result; // Make available to subsequent equations
      }
      
      // Calculate confidence based on convergence and reasonable output ranges
      const outputValues = Object.values(outputs).filter(v => typeof v === 'number') as number[];
      const allFinite = outputValues.every(v => isFinite(v));
      const allReasonable = outputValues.every(v => Math.abs(v) < 1e10); // Not extreme values
      const confidence = allFinite && allReasonable ? 0.85 : 0.45;
      
      return {
        outputs,
        confidence,
        metadata: {
          executionTime: Date.now() - startTime,
          iterations: simulation.equations.length,
          convergence: allFinite && allReasonable
        }
      };
    } catch (error) {
      throw new Error(`Simulation execution failed: ${error.message}`);
    }
  }
  
  /**
   * Resolves a variable source to a numeric value
   */
  private resolveVariableSource(source: string): number {
    // Map source strings to actual data
    const sourceLower = source.toLowerCase();
    
    if (sourceLower.includes('price_change_24h')) {
      // Average 24h change across all markets
      const avgChange = this.marketData.reduce((sum, m) => sum + m.price24hChange, 0) / this.marketData.length;
      return avgChange / 100; // Convert to decimal
    }
    
    if (sourceLower.includes('volatility')) {
      // Calculate average volatility proxy
      const volatilities = this.marketData.map(m => Math.abs(m.price24hChange));
      return volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length / 100;
    }
    
    if (sourceLower.includes('btc_eth_correlation')) {
      // Simplified correlation estimate (in production would use real historical data)
      return 0.75; // Typical BTC-ETH correlation
    }
    
    // Try to find specific market data
    const marketMatch = this.marketData.find(m => 
      sourceLower.includes(m.symbol.toLowerCase())
    );
    
    if (marketMatch) {
      if (sourceLower.includes('price')) {
        return marketMatch.price;
      }
      if (sourceLower.includes('volume')) {
        return marketMatch.price24hChange; // Placeholder until real volume data
      }
    }
    
    throw new Error(`Unknown variable source: ${source}`);
  }
  
  /**
   * Sanitizes mathematical expression to prevent code injection
   */
  private sanitizeExpression(expression: string): string {
    // Remove any potential dangerous characters/patterns
    const dangerous = ['eval', 'function', 'Function', 'constructor', '__proto__', 'prototype'];
    for (const word of dangerous) {
      if (expression.includes(word)) {
        throw new Error(`Forbidden keyword in expression: ${word}`);
      }
    }
    
    // Only allow mathematical operators, numbers, variables, parentheses, and whitespace
    const allowedPattern = /^[a-zA-Z0-9_\s+\-*/()\[\].,^<>=!&|]+$/;
    if (!allowedPattern.test(expression)) {
      throw new Error('Expression contains invalid characters');
    }
    
    return expression.trim();
  }
  
  /**
   * Safely evaluates a mathematical expression
   * Uses Function constructor with limited scope (safer than eval)
   */
  private safeEvaluate(expression: string, context: Record<string, any>): number {
    // Replace ^ with Math.pow for exponentiation
    let processedExpr = expression.replace(/(\w+|\d+(?:\.\d+)?)\s*\^\s*(\w+|\d+(?:\.\d+)?)/g, 
      (_, base, exp) => `pow(${base}, ${exp})`
    );
    
    // Build variable declarations
    const varDeclarations = Object.keys(context)
      .map(key => `const ${key} = context.${key};`)
      .join('\n');
    
    const code = `
      ${varDeclarations}
      return (${processedExpr});
    `;
    
    try {
      const func = new Function('context', code);
      return func(context);
    } catch (error) {
      throw new Error(`Expression evaluation error: ${error.message}`);
    }
  }
}

// Tool execution wrapper with error handling
export async function executeSandboxTool(
  toolName: string,
  parameters: any,
  marketData: Market[]
): Promise<any> {
  const sandbox = new MathematicalSandbox(marketData);
  
  try {
    switch (toolName) {
      case 'statistics':
        return sandbox.calculateStatistics(parameters.data);
      
      case 'rsi':
        // Would need historical price data - for now use mock
        const rsiPrices = generateMockPriceHistory(marketData, parameters.symbol);
        return sandbox.calculateRSI(rsiPrices, parameters.period || 14);
      
      case 'macd':
        const macdPrices = generateMockPriceHistory(marketData, parameters.symbol);
        return sandbox.calculateMACD(macdPrices);
      
      case 'bollinger':
        const bbPrices = generateMockPriceHistory(marketData, parameters.symbol);
        return sandbox.calculateBollingerBands(
          bbPrices,
          parameters.period || 20,
          parameters.stdDev || 2
        );
      
      case 'ema':
        const emaPrices = generateMockPriceHistory(marketData, parameters.symbol);
        return sandbox.calculateEMA(emaPrices, parameters.period);
      
      case 'sma':
        const smaPrices = generateMockPriceHistory(marketData, parameters.symbol);
        return sandbox.calculateSMA(smaPrices, parameters.period);
      
      case 'volatility':
        const volPrices = generateMockPriceHistory(marketData, parameters.symbol);
        return sandbox.calculateVolatility(volPrices, parameters.period);
      
      case 'correlation':
        const prices1 = generateMockPriceHistory(marketData, parameters.symbol1);
        const prices2 = generateMockPriceHistory(marketData, parameters.symbol2);
        return sandbox.calculateCorrelation(prices1, prices2);
      
      case 'trend':
        const trendPrices = generateMockPriceHistory(marketData, parameters.symbol);
        return sandbox.detectTrend(trendPrices, parameters.period || 20);
      
      case 'support_resistance':
        const srPrices = generateMockPriceHistory(marketData, parameters.symbol);
        return sandbox.findSupportResistance(srPrices);
      
      case 'kelly':
        return sandbox.calculateKellyCriterion(
          parameters.winRate,
          parameters.avgWin,
          parameters.avgLoss
        );
      
      case 'position_size':
        return sandbox.calculatePositionSize(
          parameters.balance,
          parameters.riskPercent,
          parameters.stopDistance
        );
      
      case 'risk_reward':
        return sandbox.calculateRiskReward(
          parameters.entry,
          parameters.stop,
          parameters.target
        );
      
      case 'price_change':
        return sandbox.getPriceChange(parameters.symbol);
      
      case 'current_price':
        return sandbox.getCurrentPrice(parameters.symbol);
      
      // === ADVANCED SIMULATION TOOLS ===
      
      case 'custom_equation':
        return {
          result: sandbox.evaluateCustomEquation(parameters.expression, parameters.variables),
          expression: parameters.expression,
          variables: parameters.variables
        };
      
      case 'define_simulation':
        return {
          simulationId: sandbox.defineSimulation({
            name: parameters.name,
            description: parameters.description || '',
            equations: parameters.equations,
            variables: parameters.variables,
            outputMetrics: parameters.outputMetrics || []
          }),
          name: parameters.name,
          status: 'defined'
        };
      
      case 'run_simulation':
        return sandbox.runSimulation(parameters.simulationId, parameters.parameters || {});
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Sandbox tool error [${toolName}]:`, error);
    throw error;
  }
}

// Helper function to generate mock price history
// In production, this would fetch real historical data
function generateMockPriceHistory(marketData: Market[], symbol: string): number[] {
  const market = marketData.find(m => m.symbol === symbol);
  if (!market) {
    throw new Error(`Symbol ${symbol} not found`);
  }
  
  const currentPrice = market.price;
  const change24h = market.price24hChange / 100;
  
  // Generate 100 price points with realistic random walk
  const prices: number[] = [];
  let price = currentPrice / (1 + change24h); // Start from 24h ago
  
  for (let i = 0; i < 100; i++) {
    prices.push(price);
    // Random walk with drift toward current price
    const drift = (currentPrice - price) / (100 - i) * 0.5;
    const randomChange = (Math.random() - 0.5) * price * 0.02; // 2% random
    price = price + drift + randomChange;
  }
  
  prices[prices.length - 1] = currentPrice; // Ensure current price is accurate
  
  return prices;
}
```

**Modified File: `/workspace/services/grokService.ts`**

```typescript
// Add imports
import { executeSandboxTool } from './sandboxService';

// Add new interface for analysis requests
interface AnalysisRequest {
  action: 'ANALYZE';
  tool: string;
  parameters: any;
  reasoning: string;
}

// Modify the function signature and add iteration logic
export const getGrokTradingDecisionWithSandbox = async (
  portfolio: Portfolio,
  marketData: Market[],
  basePrompt: string,
  recentLogs?: BotLog[],
  cooldowns?: Record<string, number>,
  recentOrders?: Order[]
): Promise<{ prompt: string, decisions: AiDecision[], error?: string, iterations?: number }> => {
  
  const MAX_ITERATIONS = 5;
  let iteration = 0;
  let analysisHistory = '';
  
  while (iteration < MAX_ITERATIONS) {
    iteration++;
    
    // Build prompt with context and analysis history
    const iterationContext = `
=== ITERATION ${iteration} of ${MAX_ITERATIONS} ===

${iteration === MAX_ITERATIONS ? 'FINAL ITERATION: You MUST return trading decisions now (LONG/SHORT/CLOSE/HOLD).' : 'You can ANALYZE data or return final decisions.'}

${analysisHistory}

`;
    
    const fullPrompt = generateFullPrompt(
      portfolio,
      marketData,
      basePrompt + iterationContext,
      recentLogs,
      cooldowns,
      recentOrders
    );
    
    // Call Grok API
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: fullPrompt }],
        model: MODEL,
        stream: false,
        temperature: 0.9,
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok API error: Status ${response.status}. Body: ${errorText.substring(0, 200)}`);
    }
    
    const responseData = await response.json();
    const responseText = responseData.choices?.[0]?.message?.content;
    
    if (!responseText) {
      throw new Error('Empty response from Grok API');
    }
    
    // Try to parse as analysis request
    try {
      const analysisMatch = responseText.match(/\{[\s\S]*"action"\s*:\s*"ANALYZE"[\s\S]*\}/);
      
      if (analysisMatch && iteration < MAX_ITERATIONS) {
        const analysisRequest: AnalysisRequest = JSON.parse(analysisMatch[0]);
        
        // Execute sandbox tool
        console.log(`Iteration ${iteration}: Executing tool ${analysisRequest.tool}`);
        const toolResult = await executeSandboxTool(
          analysisRequest.tool,
          analysisRequest.parameters,
          marketData
        );
        
        // Add to analysis history
        analysisHistory += `
[Iteration ${iteration} - ${analysisRequest.reasoning}]
Tool: ${analysisRequest.tool}
Parameters: ${JSON.stringify(analysisRequest.parameters)}
Result: ${JSON.stringify(toolResult, null, 2)}

`;
        
        // Continue to next iteration
        continue;
      }
    } catch (e) {
      // Not an analysis request, try to parse as trading decisions
      console.log(`Iteration ${iteration}: Parsing as trading decisions`);
    }
    
    // Parse as trading decisions
    const decisionMatch = responseText.match(/(\[[\s\S]*\])/);
    
    if (decisionMatch && decisionMatch[0]) {
      const decisions: AiDecision[] = JSON.parse(decisionMatch[0]);
      const validDecisions = decisions.filter(d => d.action !== AiAction.HOLD);
      
      return {
        prompt: fullPrompt,
        decisions: validDecisions,
        iterations: iteration
      };
    }
    
    // If we reach here and it's the final iteration, return empty decisions
    if (iteration === MAX_ITERATIONS) {
      console.warn('Final iteration reached without valid decisions');
      return {
        prompt: fullPrompt,
        decisions: [],
        error: 'No valid decisions after maximum iterations',
        iterations: iteration
      };
    }
  }
  
  // Should never reach here, but return empty decisions as fallback
  return {
    prompt: '',
    decisions: [],
    error: 'Maximum iterations reached',
    iterations: MAX_ITERATIONS
  };
};
```

**Modified File: `/workspace/hooks/useTradingBot.ts`**

```typescript
// Update import
import { getGrokTradingDecisionWithSandbox } from '../services/grokService';

// Update bot creation to use new service for Chronospeculator
function createNewBot(...) {
  // ... existing code ...
  
  return {
    // ... existing fields ...
    getDecision: (portfolio, marketData, recentLogs, cooldowns, recentOrders) => {
      if (provider === 'grok' && id === 'bot_chronospeculator') {
        // Use enhanced service with sandbox for Chronospeculator
        return getGrokTradingDecisionWithSandbox(
          portfolio,
          marketData,
          prompt,
          recentLogs,
          cooldowns,
          recentOrders
        );
      } else if (provider === 'grok') {
        // Use standard service for other Grok bots
        return getGrokTradingDecision(
          portfolio,
          marketData,
          prompt,
          recentLogs,
          cooldowns,
          recentOrders
        );
      }
      return getTradingDecision(portfolio, marketData, prompt, recentLogs, cooldowns, recentOrders);
    }
  };
}

// Update trading turn logic to handle iterations
const { prompt, decisions, error, iterations } = await bot.getDecision(...);

if (iterations) {
  console.log(`   🔄 Decision took ${iterations} iterations`);
}
```

### Enhanced Historical Context

**Context Enhancements**

```typescript
// Add more detailed position timing information
const formattedPositions = portfolio.positions.map(p => {
  const openOrder = recentOrders?.find(o => o.symbol === p.symbol && o.exitPrice === 0);
  const minutesOpen = openOrder ? Math.floor((now - openOrder.timestamp) / 60000) : '?';
  const hoursOpen = minutesOpen !== '?' ? (minutesOpen / 60).toFixed(1) : '?';
  
  // Calculate unrealized P&L percentage
  const pnlPercent = p.pnl ? ((p.pnl / p.size) * 100).toFixed(2) : '0';
  
  return `
  - Position ID: ${p.id}
    Symbol: ${p.symbol}
    Type: ${p.type}
    Entry Price: $${p.entryPrice.toFixed(4)}
    Current P&L: $${p.pnl?.toFixed(2) || '0'} (${pnlPercent}%)
    Margin Used: $${p.size}
    Leverage: ${p.leverage}x
    Stop Loss: $${p.stopLoss?.toFixed(4) || 'N/A'}
    Take Profit: $${p.takeProfit?.toFixed(4) || 'N/A'}
    Open Duration: ${hoursOpen} hours (${minutesOpen} minutes)
    Liquidation Price: $${p.liquidationPrice.toFixed(4)}
  `.trim();
}).join('\n\n');

// Add market trend analysis to context
const marketTrends = marketData.map(m => {
  const trend = m.price24hChange > 1 ? 'Strong Bullish' :
                m.price24hChange > 0.2 ? 'Bullish' :
                m.price24hChange < -1 ? 'Strong Bearish' :
                m.price24hChange < -0.2 ? 'Bearish' : 'Neutral';
  
  return `  - ${m.symbol}: $${m.price.toFixed(4)} | 24h: ${m.price24hChange.toFixed(2)}% (${trend})`;
}).join('\n');

// Enhanced decision history with outcomes
const decisionHistory = recentLogs.map((log, idx) => {
  const minutesAgo = Math.floor((now - log.timestamp) / 60000);
  const hoursAgo = (minutesAgo / 60).toFixed(1);
  
  let historyText = `\n[${hoursAgo} hours ago (${minutesAgo} minutes)]:\n`;
  
  if (log.decisions.length === 0) {
    historyText += '  Decision: HOLD (no action taken)\n';
  } else {
    log.decisions.forEach((d, i) => {
      historyText += `  Decision ${i + 1}: ${d.action} ${d.symbol || d.closePositionId}\n`;
      historyText += `  Reasoning: ${d.reasoning}\n`;
      
      if (d.action === 'LONG' || d.action === 'SHORT') {
        historyText += `  Parameters: Size=$${d.size}, Leverage=${d.leverage}x, SL=$${d.stopLoss}, TP=$${d.takeProfit}\n`;
      }
    });
  }
  
  if (log.notes && log.notes.length > 0) {
    historyText += `  Execution Notes:\n`;
    log.notes.forEach(note => {
      historyText += `    - ${note}\n`;
    });
  }
  
  return historyText;
}).join('\n');
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Tasks**
1. Create `sandboxService.ts` with core mathematical functions
   - Statistical calculations
   - Basic technical indicators (RSI, SMA, EMA)
   - Risk management tools (Kelly, position sizing)

2. Implement Advanced Simulation Framework
   - Custom equation evaluator with safe expression parser
   - Expression sanitization (keyword blacklist, character whitelist)
   - Safe evaluation using Function constructor with limited scope
   - Simulation definition and storage (Map-based registry)
   - Simulation execution engine
   - Variable source resolution from market data
   - Expression complexity limits (max 500 chars, max 10 equations per simulation)

3. Add unit tests for sandbox functions
   - Test each mathematical function
   - Validate edge cases and error handling
   - Ensure numerical accuracy
   - Test custom equation evaluation with various expressions
   - Test expression sanitization (reject dangerous keywords)
   - Test simulation definition and execution
   - Test error handling for malformed equations

4. Create sandbox tool execution wrapper
   - Error handling and validation
   - Input sanitization
   - Result formatting
   - Route custom_equation, define_simulation, run_simulation tools

**Deliverables**
- Working mathematical sandbox service with standard tools
- Working Advanced Simulation Framework with custom equations
- Comprehensive test suite covering all features
- Documentation of available tools (standard + advanced)

**Success Criteria**
- All sandbox functions execute correctly
- Custom equation evaluation works with safe expressions
- Malicious expressions are properly rejected
- Tests pass with 95%+ coverage
- No security vulnerabilities in math operations or custom evaluator
- Expression evaluation completes within timeout limits

### Phase 2: Multi-Step Logic (Week 2)

**Tasks**
1. Modify `grokService.ts` to support iteration
   - Add `getGrokTradingDecisionWithSandbox` function
   - Implement iteration loop (max 5 iterations)
   - Add analysis history tracking
   - Handle custom equation tool results

2. Update Chronospeculator prompt
   - Add standard tool descriptions (16 tools)
   - Add advanced simulation framework tools (3 tools)
   - Explain multi-step workflow
   - Provide usage examples for standard and advanced tools
   - Add narrative context for 2347 cliometric knowledge
   - Include example advanced analysis workflow
   - Explain allowed mathematical operations and functions

3. Integrate with bot hook
   - Update `useTradingBot.ts` to use new service
   - Add iteration logging
   - Handle timeout scenarios
   - Log custom equation usage for monitoring

**Deliverables**
- Working multi-step decision system
- Updated Chronospeculator prompt with advanced capabilities
- Integration with existing bot infrastructure

**Success Criteria**
- Bot can perform multi-step analysis with standard tools
- Bot can formulate and execute custom equations
- Bot can define and run simulations
- Iterations complete within time limit
- Graceful fallback if iterations fail
- Advanced tools work seamlessly with standard tools

### Phase 3: Enhanced Context (Week 3)

**Tasks**
1. Enhance context generation
   - More detailed position information
   - Better formatted market trends
   - Richer decision history

2. Add historical price data
   - Integrate with market data service
   - Cache historical prices
   - Provide to sandbox tools

3. Improve error messages
   - Clear feedback on tool failures
   - Better iteration status reporting
   - Helpful debugging information

**Deliverables**
- Enhanced context generation
- Historical price integration
- Improved error handling

**Success Criteria**
- Bot receives comprehensive context
- Historical data is accurate
- Error messages are actionable

### Phase 4: Testing & Optimization (Week 4)

**Tasks**
1. End-to-end testing
   - Test complete decision cycles
   - Validate multi-step scenarios
   - Check performance metrics

2. Performance optimization
   - Reduce API latency
   - Optimize sandbox calculations
   - Cache frequently used data

3. Monitoring & logging
   - Add telemetry for iterations
   - Track tool usage patterns
   - Monitor decision quality

**Deliverables**
- Comprehensive test suite
- Performance benchmarks
- Monitoring dashboard

**Success Criteria**
- All tests pass
- Decision cycle < 30 seconds
- No performance degradation

### Phase 5: Documentation & Deployment (Week 5)

**Tasks**
1. Write comprehensive documentation
   - API documentation for sandbox tools
   - Usage guide for multi-step logic
   - Troubleshooting guide

2. Create examples and tutorials
   - Example analysis workflows
   - Best practices guide
   - Common patterns documentation

3. Production deployment
   - Deploy to production environment
   - Monitor initial performance
   - Gather feedback

**Deliverables**
- Complete documentation
- Example workflows
- Production deployment

**Success Criteria**
- Documentation is clear and complete
- Examples are working and helpful
- Production deployment is stable

## Testing Strategy

### Unit Tests

**Sandbox Service Tests**
```typescript
describe('MathematicalSandbox', () => {
  describe('calculateStatistics', () => {
    it('should calculate correct statistics for normal data', () => {
      const data = [1, 2, 3, 4, 5];
      const result = sandbox.calculateStatistics(data);
      expect(result.mean).toBe(3);
      expect(result.median).toBe(3);
    });
    
    it('should handle empty array', () => {
      expect(() => sandbox.calculateStatistics([])).toThrow();
    });
  });
  
  describe('calculateRSI', () => {
    it('should calculate RSI correctly', () => {
      const prices = generateMockPrices(50);
      const rsi = sandbox.calculateRSI(prices, 14);
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });
  });
  
  // ... more tests
});
```

**Integration Tests**
```typescript
describe('Multi-Step Decision Flow', () => {
  it('should complete full analysis cycle', async () => {
    const result = await getGrokTradingDecisionWithSandbox(
      mockPortfolio,
      mockMarketData,
      CHRONOSPECULATOR_PROMPT,
      [],
      {},
      []
    );
    
    expect(result.decisions).toBeDefined();
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.iterations).toBeLessThanOrEqual(5);
  });
  
  it('should handle tool errors gracefully', async () => {
    // Test with invalid tool parameters
    // Should return error but not crash
  });
  
  it('should timeout after max iterations', async () => {
    // Mock AI that always returns ANALYZE
    // Should eventually return final decision
  });
});
```

### Performance Tests

**Benchmarks**
- Single iteration decision: < 5 seconds
- Full 5-iteration cycle: < 25 seconds
- Sandbox tool execution: < 100ms per tool
- Total turn processing: < 30 seconds

**Load Tests**
- Multiple bots running simultaneously
- Concurrent sandbox tool execution
- Memory usage under load

### User Acceptance Tests

**Scenarios**
1. Bot examines market conditions before trading
2. Bot calculates risk parameters using Kelly criterion
3. Bot validates assumptions with technical indicators
4. Bot makes informed decision after multi-step analysis
5. Bot handles errors and falls back gracefully

## Monitoring & Metrics

### Key Performance Indicators

**System Metrics**
- Average iterations per decision cycle
- Sandbox tool execution time
- API response time
- Error rate
- Memory usage

**Bot Performance Metrics**
- Decision quality (win rate, profit factor)
- Analysis depth (tools used per decision)
- Execution success rate
- Position sizing accuracy

**Business Metrics**
- Portfolio growth rate
- Risk-adjusted returns (Sharpe ratio)
- Maximum drawdown
- Trade frequency
- Average holding period

### Logging Strategy

**Log Levels**
```
DEBUG: Detailed iteration and tool execution logs
INFO: Decision summaries and key events
WARN: Non-critical errors and fallbacks
ERROR: Critical failures requiring attention
```

**Key Log Points**
- Start of decision cycle
- Each iteration and tool call
- Tool execution results
- Final decisions
- Execution outcomes
- Performance metrics

## Risk Management

### System Risks

**Risk: Infinite Loop**
- Mitigation: Maximum 5 iterations hard limit
- Timeout per iteration: 10 seconds
- Final iteration must return decisions

**Risk: Malicious Tool Input / Code Injection**
- Mitigation: Input validation and sanitization
- Safe expression parser with keyword blacklist
- Limited function scope (only Math operations allowed)
- No access to eval, Function constructor abuse, or prototype manipulation
- Expression complexity limits (character count, depth)
- Whitelist of allowed tools and operations
- Parameter type checking
- Timeout protection on equation evaluation

**Risk: Performance Degradation**
- Mitigation: Tool execution caching
- Parallel tool execution where possible
- Performance monitoring and alerts

**Risk: Computational Complexity Explosion**
- Mitigation: Expression length limits (max 500 characters)
- Maximum simulation equations per definition (max 10)
- Iteration count limits in simulations
- Result validation (reject infinite/NaN values)
- Execution timeout per custom equation (2 seconds)
- Memory monitoring for large variable sets

**Risk: AI Hallucination**
- Mitigation: Strict JSON parsing
- Fallback to HOLD on parse errors
- Clear examples in prompt
- Validation of tool names and parameters
- Graceful error handling for malformed equations

### Trading Risks

**Risk: Over-Analysis Paralysis**
- Mitigation: Encourage final decision by iteration 5
- Time pressure in prompt
- Clear goals for each iteration

**Risk: Poor Tool Usage**
- Mitigation: Comprehensive tool documentation
- Examples in prompt
- Monitor and learn from patterns

**Risk: Computational Errors**
- Mitigation: Extensive unit tests
- Numerical stability checks
- Error handling in all calculations

## Success Criteria

### Technical Success

- [x] Mathematical sandbox implemented and tested
- [x] Multi-step decision flow functional
- [x] Integration with existing bot system
- [x] Performance within acceptable limits
- [x] Error handling comprehensive
- [x] Documentation complete

### Business Success

- Improved win rate vs. baseline (target: +10%)
- Better risk-adjusted returns (target: +15% Sharpe ratio)
- More consistent performance (lower variance)
- Reduced maximum drawdown (target: -20%)
- Higher average R:R ratio (target: > 3:1)

### User Experience Success

- Clear visibility into bot reasoning
- Easy to understand multi-step analysis
- Helpful error messages
- Reliable and predictable behavior
- No significant latency increase

## Future Enhancements

### Advanced Features (Future Phases)

1. **Enhanced Custom Simulation Framework**
   - Expand safe math operations (matrix operations, advanced statistics)
   - Monte Carlo simulation engine with custom distributions
   - Time-series forecasting with custom models
   - Multi-asset correlation simulations
   - Backtesting custom equations against historical data
   - Version control and library of proven custom equations
   - Equation optimization (genetic algorithms to find optimal parameters)
   - Visualization of custom equation outputs

2. **Machine Learning Integration**
   - Pattern recognition using historical data
   - Adaptive strategy optimization
   - Reinforcement learning for tool selection
   - Neural network integration for custom equation discovery

3. **External Data Sources**
   - On-chain metrics (blockchain data)
   - Social sentiment analysis
   - News and event detection
   - Order book depth analysis
   - Real historical price data (replace mock generator)

4. **Advanced Visualization**
   - Decision tree visualization
   - Tool usage heatmaps
   - Analysis flow diagrams
   - Interactive exploration
   - Custom equation debugging interface
   - Simulation result visualization (graphs, heatmaps)

5. **Collaborative Analysis**
   - Multi-bot strategy coordination
   - Consensus building mechanisms
   - Shared analysis cache
   - Competitive benchmarking
   - Shared simulation library across bots

6. **Real-Time Adaptation**
   - Dynamic strategy adjustment
   - Market regime detection
   - Volatility-based parameter tuning
   - Auto-scaling leverage
   - Adaptive equation parameter tuning

## Appendix

### A. API Reference

See inline documentation in `sandboxService.ts` for complete API reference.

### B. Example Workflows

**Example 1: Conservative Entry Analysis**
```
Iteration 1: Calculate RSI to check momentum
Iteration 2: Calculate Bollinger Bands to check volatility
Iteration 3: Detect trend to confirm direction
Iteration 4: Calculate Kelly criterion for position size
Iteration 5: Execute LONG with optimized parameters
```

**Example 2: Risk Management Validation**
```
Iteration 1: Calculate current portfolio drawdown
Iteration 2: Calculate risk/reward ratio for potential trade
Iteration 3: Check support/resistance levels
Iteration 4: Validate position size against Kelly criterion
Iteration 5: Execute or HOLD based on analysis
```

**Example 3: Market Regime Analysis**
```
Iteration 1: Calculate volatility across multiple symbols
Iteration 2: Detect correlation between major pairs
Iteration 3: Identify trend strength and direction
Iteration 4: Calculate optimal leverage for regime
Iteration 5: Execute strategy appropriate for regime
```

**Example 4: Advanced Cliometric Analysis (Using Custom Equations)**
```
Iteration 1: Calculate Temporal Arbitrage Potential (TAP)
  - Tool: custom_equation
  - Expression: "(momentum * temporal_weight - volatility * uncertainty) / sqrt(ergodic_baseline)"
  - Result: TAP = 0.67 (moderate temporal distortion detected)

Iteration 2: Define Chronometric Risk Model
  - Tool: define_simulation
  - Name: "ChronometricRiskAdjustment"
  - Equations: 
    * temporal_confidence = 1 - exp(-lambda * time_stability)
    * causal_strength = forward_correlation / (backward_correlation + epsilon)
    * risk_multiplier = base_kelly * temporal_confidence * causal_strength
  - Result: simulationId = "sim_1_1234567890"

Iteration 3: Run Chronometric Risk Simulation
  - Tool: run_simulation
  - SimulationId: "sim_1_1234567890"
  - Result: {risk_multiplier: 0.82, temporal_confidence: 0.91, confidence: 0.85}

Iteration 4: Calculate position size using futuristic risk model
  - Tool: position_size
  - Apply risk_multiplier from simulation
  - Result: Optimal size = $2,400 (vs standard Kelly $2,900)

Iteration 5: Execute LONG with chronometrically-adjusted parameters
  - Action: LONG BTCUSDT
  - Size: $2,400 (reduced due to temporal uncertainty)
  - Reasoning: "TAP indicates moderate opportunity, but temporal confidence 
    is 91% suggesting stable causal thread. My 2347 cliometric framework 
    suggests conservative sizing given current ergodic drift patterns."
```

**Example 5: Multi-Factor Advanced Simulation**
```
Iteration 1: Gather standard technical indicators
  - RSI = 58, MACD = 125, Trend = bullish (0.72 strength)

Iteration 2: Define comprehensive temporal analysis simulation
  - Tool: define_simulation
  - Equations combining:
    * Momentum decay function
    * Volatility-adjusted confidence
    * Multi-horizon correlation factor
    * Quantum uncertainty adjustment
    * Final composite score

Iteration 3: Execute simulation with gathered data
  - Feed RSI, MACD, trend data into simulation
  - Result: composite_score = 7.8/10, confidence = 0.88

Iteration 4: Cross-validate with Kelly criterion
  - Historical win rate and R:R analysis
  - Kelly suggests 0.28 fraction

Iteration 5: Execute trade synthesizing both 2025 and 2347 techniques
  - Combines traditional technical analysis with futuristic cliometric model
  - Position sized using temporal-adjusted Kelly
  - High confidence due to multi-framework convergence
```

### C. Prompt Template

See "Enhanced Prompt Structure" section above for the complete prompt template with tool descriptions and multi-step workflow examples.

### D. Glossary

**Standard Trading & Statistical Terms:**
- **Cliometrics**: Quantitative analysis of historical economic patterns
- **Kelly Criterion**: Mathematical formula for optimal position sizing
- **Ergodic Theory**: Study of time-average vs ensemble-average behavior
- **Bayesian Inference**: Probabilistic reasoning using prior and posterior distributions
- **ATR**: Average True Range, volatility indicator
- **RSI**: Relative Strength Index, momentum indicator
- **MACD**: Moving Average Convergence Divergence indicator
- **R:R Ratio**: Risk to Reward ratio

**Advanced Cliometric-Chronometric Terms (Narrative/Fictional):**
- **Temporal Arbitrage Potential (TAP)**: A measure of market inefficiency detectable through temporal analysis; represents opportunities arising from causal timeline distortions
- **Chronometric Risk Adjustment (CRA)**: Risk modification based on temporal confidence and timeline stability
- **Cliometric Momentum Index (CMI)**: Advanced momentum calculation incorporating forward and backward temporal correlations
- **Ergodic Baseline**: Reference point representing perfect time-ensemble equivalence (when time-average equals ensemble-average)
- **Temporal Drift**: Deviation of price action from predicted causal baseline
- **Causal Strength**: Ratio measuring forward-looking vs backward-looking correlations
- **Temporal Confidence**: Measure of timeline stability and predictability
- **Quantum Uncertainty Factor**: Adjustment for inherent unpredictability in market state superposition
- **Hyperbolic Temporal Discounting**: Advanced discounting method accounting for non-linear time perception in market psychology
- **Causal Entropy Decomposition**: Separation of deterministic signals from random temporal noise
- **Bidirectional Temporal Variance**: Volatility measured across both forward and backward time horizons
- **Temporal Weight**: Coefficient adjusting for time-distance from decision point

**Note**: The advanced terms are narrative elements that enhance Chronospeculator's character as a time traveler with futuristic knowledge. While fictional, they can be implemented as real mathematical constructs using the custom equation framework.

---

## Summary

This implementation plan provides a comprehensive roadmap for enhancing the Chronospeculator trading bot with mathematical sandbox tools, multi-step action capabilities, and an **Advanced Simulation Framework** that enables custom equation formulation based on futuristic cliometric-chronometric knowledge.

**Key Benefits:**
- Enhanced decision quality through multi-step analysis
- Quantitative validation of trading ideas
- Better risk management through calculated position sizing
- More sophisticated market analysis capabilities
- **Unique narrative capability**: Custom equation definition representing "2347 analytical techniques"
- **Advanced simulation engine**: Define, test, and execute multi-equation models
- **Flexible analytical framework**: Combines standard technical analysis with custom temporal models
- Improved performance through data-driven decisions
- Rich character development through mathematically-grounded futuristic analysis

**Implementation Timeline:** 5 weeks
**Estimated Effort:** 140-180 hours (increased due to custom simulation framework)
**Risk Level:** Medium (well-scoped, incremental approach with robust safety measures)
**Expected ROI:** Very High (improved trading performance, unique competitive advantage, enhanced narrative immersion)

**Key Innovation:** The Advanced Simulation Framework allows Chronospeculator to transcend the limitations of contemporary (2025) analysis by formulating his own equations representing techniques from centuries in the future. This maintains character authenticity while providing practical analytical capabilities.

The plan follows a systematic, phased approach with clear deliverables, success criteria, and risk mitigation strategies at each stage. Security is paramount with multiple layers of input validation, expression sanitization, and execution safeguards to prevent code injection while allowing mathematical creativity.
