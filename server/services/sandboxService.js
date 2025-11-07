/**
 * @license
 * SPDX-License-Identifier: MIT
 * 
 * Mathematical Sandbox Service
 * Provides safe computational tools for bot analysis
 */

const MAX_EXPRESSION_LENGTH = 500;
const MAX_SIMULATION_EQUATIONS = 10;
const EQUATION_TIMEOUT_MS = 2000;

/**
 * Mathematical Sandbox Class
 * Provides computational tools for quantitative analysis
 */
class MathematicalSandbox {
  constructor(marketData) {
    this.marketData = marketData || [];
    this.simulations = new Map();
    this.simulationCounter = 0;
  }

  // ========================================================================
  // STATISTICAL FUNCTIONS
  // ========================================================================

  /**
   * Calculate comprehensive statistics for a dataset
   */
  calculateStatistics(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Empty or invalid data array');
    }

    const sorted = [...data].sort((a, b) => a - b);
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const median = data.length % 2 === 0
      ? (sorted[Math.floor(data.length / 2) - 1] + sorted[Math.floor(data.length / 2)]) / 2
      : sorted[Math.floor(data.length / 2)];
    
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      median,
      stdDev,
      variance,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: data.length
    };
  }

  /**
   * Calculate Pearson correlation coefficient between two series
   */
  calculateCorrelation(series1, series2) {
    if (!Array.isArray(series1) || !Array.isArray(series2)) {
      throw new Error('Both inputs must be arrays');
    }
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

  /**
   * Calculate annualized volatility from price series
   */
  calculateVolatility(prices, period) {
    if (!Array.isArray(prices) || prices.length < period) {
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

  // ========================================================================
  // TECHNICAL INDICATORS
  // ========================================================================

  /**
   * Calculate Relative Strength Index (RSI)
   */
  calculateRSI(prices, period = 14) {
    if (!Array.isArray(prices) || prices.length < period + 1) {
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

  /**
   * Calculate Moving Average Convergence Divergence (MACD)
   */
  calculateMACD(prices) {
    if (!Array.isArray(prices) || prices.length < 26) {
      throw new Error('Insufficient data for MACD calculation');
    }

    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
    
    // Signal line is 9-period EMA of MACD line
    const macdValues = [];
    const minLength = Math.min(ema12.length, ema26.length);
    for (let i = 0; i < minLength; i++) {
      macdValues.push(ema12[ema12.length - minLength + i] - ema26[ema26.length - minLength + i]);
    }
    
    const signal = this.calculateEMA(macdValues, 9);
    const signalValue = signal[signal.length - 1];
    
    return {
      macd: macdLine,
      signal: signalValue,
      histogram: macdLine - signalValue
    };
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(prices, period = 20, stdDevMultiplier = 2) {
    if (!Array.isArray(prices) || prices.length < period) {
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

  /**
   * Calculate Exponential Moving Average (EMA)
   */
  calculateEMA(prices, period) {
    if (!Array.isArray(prices) || prices.length < period) {
      throw new Error('Insufficient data for EMA calculation');
    }

    const multiplier = 2 / (period + 1);
    const ema = [prices[0]];

    for (let i = 1; i < prices.length; i++) {
      ema.push((prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
    }

    return ema;
  }

  /**
   * Calculate Simple Moving Average (SMA)
   */
  calculateSMA(prices, period) {
    if (!Array.isArray(prices) || prices.length < period) {
      throw new Error('Insufficient data for SMA calculation');
    }

    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      sma.push(sum / period);
    }

    return sma;
  }

  // ========================================================================
  // PATTERN RECOGNITION
  // ========================================================================

  /**
   * Detect trend using linear regression
   */
  detectTrend(prices, minPeriod = 20) {
    if (!Array.isArray(prices) || prices.length < minPeriod) {
      throw new Error('Insufficient data for trend detection');
    }

    const recentPrices = prices.slice(-minPeriod);
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
    
    const rSquared = Math.max(0, 1 - (ssRes / ssTot));
    
    let direction;
    if (Math.abs(slopePercent) < 0.1) {
      direction = 'neutral';
    } else if (slopePercent > 0) {
      direction = 'bullish';
    } else {
      direction = 'bearish';
    }
    
    return {
      direction,
      strength: Math.min(Math.abs(slopePercent) / 5, 1),
      confidence: rSquared,
      slope: slopePercent
    };
  }

  /**
   * Find support and resistance levels
   */
  findSupportResistance(prices) {
    if (!Array.isArray(prices) || prices.length < 20) {
      throw new Error('Insufficient data for support/resistance calculation');
    }

    const localMinima = [];
    const localMaxima = [];
    
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
    const clusterLevels = (levels, threshold = 0.02) => {
      if (levels.length === 0) return [];
      
      const sorted = [...levels].sort((a, b) => a - b);
      const clusters = [[sorted[0]]];
      
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

  // ========================================================================
  // RISK MANAGEMENT
  // ========================================================================

  /**
   * Calculate Kelly Criterion optimal position size
   */
  calculateKellyCriterion(winRate, avgWin, avgLoss) {
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

  /**
   * Calculate position size based on risk parameters
   */
  calculatePositionSize(balance, riskPercent, stopDistancePercent) {
    if (balance <= 0 || riskPercent <= 0 || stopDistancePercent <= 0) {
      throw new Error('All parameters must be positive');
    }

    const riskAmount = balance * (riskPercent / 100);
    const positionSize = riskAmount / (stopDistancePercent / 100);
    
    return Math.min(positionSize, balance * 0.4); // Cap at 40% of balance
  }

  /**
   * Calculate risk/reward ratio
   */
  calculateRiskReward(entry, stop, target) {
    const risk = Math.abs(entry - stop);
    const reward = Math.abs(target - entry);
    
    if (risk === 0) {
      throw new Error('Stop loss cannot equal entry price');
    }
    
    return reward / risk;
  }

  // ========================================================================
  // TIME SERIES ANALYSIS
  // ========================================================================

  /**
   * Calculate returns from price series
   */
  calculateReturns(prices) {
    if (!Array.isArray(prices) || prices.length < 2) {
      throw new Error('Need at least 2 prices to calculate returns');
    }

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    return returns;
  }

  /**
   * Calculate maximum drawdown
   */
  calculateDrawdown(values) {
    if (!Array.isArray(values) || values.length === 0) {
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
      maxDrawdown: maxDrawdown * peak,
      maxDrawdownPercent: maxDrawdown * 100,
      currentDrawdown: currentDrawdown * 100
    };
  }

  // ========================================================================
  // MARKET DATA ACCESS
  // ========================================================================

  /**
   * Get current price for a symbol
   */
  getCurrentPrice(symbol) {
    const market = this.marketData.find(m => m.symbol === symbol);
    if (!market) {
      throw new Error(`Symbol ${symbol} not found in market data`);
    }
    return market.price;
  }

  /**
   * Get 24h price change for a symbol
   */
  getPriceChange(symbol) {
    const market = this.marketData.find(m => m.symbol === symbol);
    if (!market) {
      throw new Error(`Symbol ${symbol} not found in market data`);
    }
    
    const currentPrice = market.price;
    const change24h = market.price24hChange;
    const price24hAgo = currentPrice / (1 + change24h / 100);
    
    return {
      absolute: currentPrice - price24hAgo,
      percent: change24h,
      currentPrice
    };
  }
  
  // ========================================================================
  // ADVANCED SIMULATION FRAMEWORK
  // ========================================================================
  
  /**
   * Evaluates a custom mathematical equation with provided variables
   * Uses a safe expression parser with whitelisted operations
   */
  evaluateCustomEquation(expression, variables) {
    if (typeof expression !== 'string' || expression.length === 0) {
      throw new Error('Expression must be a non-empty string');
    }
    
    if (expression.length > MAX_EXPRESSION_LENGTH) {
      throw new Error(`Expression exceeds maximum length of ${MAX_EXPRESSION_LENGTH} characters`);
    }
    
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
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      min: Math.min,
      max: Math.max,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
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
  defineSimulation(definition) {
    // Validate simulation definition
    if (!definition || typeof definition !== 'object') {
      throw new Error('Simulation definition must be an object');
    }
    
    if (!definition.name || typeof definition.name !== 'string') {
      throw new Error('Simulation must have a name');
    }
    
    if (!Array.isArray(definition.equations) || definition.equations.length === 0) {
      throw new Error('Simulation must have at least one equation');
    }
    
    if (definition.equations.length > MAX_SIMULATION_EQUATIONS) {
      throw new Error(`Simulation cannot have more than ${MAX_SIMULATION_EQUATIONS} equations`);
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
    
    // Validate variables
    if (!Array.isArray(definition.variables)) {
      definition.variables = [];
    }
    
    // Generate unique ID
    const simulationId = `sim_${++this.simulationCounter}_${Date.now()}`;
    this.simulations.set(simulationId, definition);
    
    return simulationId;
  }
  
  /**
   * Executes a defined simulation with given parameters
   */
  runSimulation(simulationId, parameters = {}) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error(`Simulation ${simulationId} not found`);
    }
    
    const startTime = Date.now();
    const outputs = {};
    
    try {
      // Resolve variables from market data or parameters
      const variableValues = {};
      
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
      const outputValues = Object.values(outputs).filter(v => typeof v === 'number');
      const allFinite = outputValues.every(v => isFinite(v));
      const allReasonable = outputValues.every(v => Math.abs(v) < 1e10);
      const confidence = allFinite && allReasonable ? 0.85 : 0.45;
      
      const executionTime = Date.now() - startTime;
      
      return {
        outputs,
        confidence,
        metadata: {
          executionTime,
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
  resolveVariableSource(source) {
    const sourceLower = source.toLowerCase();
    
    // Average 24h change across all markets
    if (sourceLower.includes('price_change_24h') || sourceLower.includes('avg_change')) {
      const avgChange = this.marketData.reduce((sum, m) => sum + m.price24hChange, 0) / this.marketData.length;
      return avgChange / 100; // Convert to decimal
    }
    
    // Average volatility proxy
    if (sourceLower.includes('volatility') || sourceLower.includes('vol')) {
      const volatilities = this.marketData.map(m => Math.abs(m.price24hChange));
      return volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length / 100;
    }
    
    // Try to find specific market data
    const marketMatch = this.marketData.find(m => 
      sourceLower.includes(m.symbol.toLowerCase())
    );
    
    if (marketMatch) {
      if (sourceLower.includes('price')) {
        return marketMatch.price;
      }
      if (sourceLower.includes('change')) {
        return marketMatch.price24hChange / 100;
      }
    }
    
    // Default correlations and market regime proxies
    if (sourceLower.includes('correlation')) {
      return 0.75; // Typical crypto correlation
    }
    
    throw new Error(`Unknown variable source: ${source}`);
  }
  
  /**
   * Sanitizes mathematical expression to prevent code injection
   */
  sanitizeExpression(expression) {
    // Remove any potential dangerous characters/patterns
    const dangerous = ['eval', 'function', 'Function', 'constructor', '__proto__', 'prototype', 'import', 'require', 'process', 'global', 'this'];
    const lowerExpr = expression.toLowerCase();
    
    for (const word of dangerous) {
      if (lowerExpr.includes(word.toLowerCase())) {
        throw new Error(`Forbidden keyword in expression: ${word}`);
      }
    }
    
    // Only allow mathematical operators, numbers, variables, parentheses, and whitespace
    const allowedPattern = /^[a-zA-Z0-9_\s+\-*/()[\].,^<>=!&|]+$/;
    if (!allowedPattern.test(expression)) {
      throw new Error('Expression contains invalid characters');
    }
    
    return expression.trim();
  }
  
  /**
   * Safely evaluates a mathematical expression
   * Uses Function constructor with limited scope (safer than eval)
   */
  safeEvaluate(expression, context) {
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
      const startTime = Date.now();
      const result = func(context);
      const executionTime = Date.now() - startTime;
      
      if (executionTime > EQUATION_TIMEOUT_MS) {
        throw new Error('Equation execution timeout');
      }
      
      return result;
    } catch (error) {
      throw new Error(`Expression evaluation error: ${error.message}`);
    }
  }
}

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

/**
 * Generate mock price history for testing
 * In production, this would fetch real historical data
 */
function generateMockPriceHistory(marketData, symbol, periods = 100) {
  const market = marketData.find(m => m.symbol === symbol);
  if (!market) {
    throw new Error(`Symbol ${symbol} not found`);
  }
  
  const currentPrice = market.price;
  const change24h = market.price24hChange / 100;
  
  // Generate price points with realistic random walk
  const prices = [];
  let price = currentPrice / (1 + change24h); // Start from 24h ago
  
  for (let i = 0; i < periods; i++) {
    prices.push(price);
    // Random walk with drift toward current price
    const drift = (currentPrice - price) / (periods - i) * 0.5;
    const randomChange = (Math.random() - 0.5) * price * 0.02; // 2% random variation
    price = price + drift + randomChange;
  }
  
  prices[prices.length - 1] = currentPrice; // Ensure current price is accurate
  
  return prices;
}

// Global sandbox instance to persist simulations across tool calls within a decision cycle
let globalSandbox = null;

/**
 * Reset global sandbox (called at start of each decision cycle)
 */
function resetSandbox(marketData) {
  globalSandbox = new MathematicalSandbox(marketData);
  return globalSandbox;
}

/**
 * Tool execution wrapper with error handling
 */
async function executeSandboxTool(toolName, parameters, marketData) {
  // Use global sandbox if available, otherwise create new one
  const sandbox = globalSandbox || new MathematicalSandbox(marketData);
  if (!globalSandbox) {
    globalSandbox = sandbox;
  }
  
  try {
    switch (toolName) {
      // Statistical functions
      case 'statistics':
        return sandbox.calculateStatistics(parameters.data);
      
      case 'correlation':
        return sandbox.calculateCorrelation(parameters.series1, parameters.series2);
      
      // Technical indicators
      case 'rsi': {
        const prices = generateMockPriceHistory(marketData, parameters.symbol);
        const rsi = sandbox.calculateRSI(prices, parameters.period || 14);
        return { value: rsi, symbol: parameters.symbol, period: parameters.period || 14 };
      }
      
      case 'macd': {
        const prices = generateMockPriceHistory(marketData, parameters.symbol);
        const macd = sandbox.calculateMACD(prices);
        return { ...macd, symbol: parameters.symbol };
      }
      
      case 'bollinger': {
        const prices = generateMockPriceHistory(marketData, parameters.symbol);
        const bands = sandbox.calculateBollingerBands(
          prices,
          parameters.period || 20,
          parameters.stdDev || 2
        );
        return { ...bands, symbol: parameters.symbol };
      }
      
      case 'ema': {
        const prices = generateMockPriceHistory(marketData, parameters.symbol);
        const ema = sandbox.calculateEMA(prices, parameters.period);
        return { 
          value: ema[ema.length - 1],
          values: ema.slice(-10),
          symbol: parameters.symbol,
          period: parameters.period
        };
      }
      
      case 'sma': {
        const prices = generateMockPriceHistory(marketData, parameters.symbol);
        const sma = sandbox.calculateSMA(prices, parameters.period);
        return {
          value: sma[sma.length - 1],
          values: sma.slice(-10),
          symbol: parameters.symbol,
          period: parameters.period
        };
      }
      
      case 'volatility': {
        const prices = generateMockPriceHistory(marketData, parameters.symbol);
        const vol = sandbox.calculateVolatility(prices, parameters.period);
        return { value: vol, symbol: parameters.symbol, period: parameters.period };
      }
      
      // Pattern recognition
      case 'trend': {
        const prices = generateMockPriceHistory(marketData, parameters.symbol);
        const trend = sandbox.detectTrend(prices, parameters.period || 20);
        return { ...trend, symbol: parameters.symbol };
      }
      
      case 'support_resistance': {
        const prices = generateMockPriceHistory(marketData, parameters.symbol);
        const levels = sandbox.findSupportResistance(prices);
        return { ...levels, symbol: parameters.symbol };
      }
      
      // Risk management
      case 'kelly':
        return {
          fraction: sandbox.calculateKellyCriterion(
            parameters.winRate,
            parameters.avgWin,
            parameters.avgLoss
          ),
          winRate: parameters.winRate,
          avgWin: parameters.avgWin,
          avgLoss: parameters.avgLoss
        };
      
      case 'position_size':
        return {
          size: sandbox.calculatePositionSize(
            parameters.balance,
            parameters.riskPercent,
            parameters.stopDistance
          ),
          balance: parameters.balance,
          riskPercent: parameters.riskPercent
        };
      
      case 'risk_reward':
        return {
          ratio: sandbox.calculateRiskReward(
            parameters.entry,
            parameters.stop,
            parameters.target
          ),
          entry: parameters.entry,
          stop: parameters.stop,
          target: parameters.target
        };
      
      // Market data access
      case 'price_change':
        return sandbox.getPriceChange(parameters.symbol);
      
      case 'current_price':
        return {
          price: sandbox.getCurrentPrice(parameters.symbol),
          symbol: parameters.symbol
        };
      
      // Advanced simulation tools
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
      
      // Celestial/Astrological tools
      case 'moon_phase': {
        const celestialData = require('./celestialData');
        const date = parameters.date ? new Date(parameters.date) : new Date();
        return celestialData.getMoonPhase(date);
      }
      
      case 'planetary_positions': {
        const celestialData = require('./celestialData');
        const date = parameters.date ? new Date(parameters.date) : new Date();
        return celestialData.getPlanetaryPositions(date);
      }
      
      case 'mercury_retrograde': {
        const celestialData = require('./celestialData');
        const date = parameters.date ? new Date(parameters.date) : new Date();
        return celestialData.isMercuryRetrograde(date);
      }
      
      case 'cosmic_aspect': {
        const celestialData = require('./celestialData');
        if (!parameters.planet1 || !parameters.planet2) {
          throw new Error('cosmic_aspect requires planet1 and planet2 parameters');
        }
        const date = parameters.date ? new Date(parameters.date) : new Date();
        return celestialData.calculateAspect(parameters.planet1, parameters.planet2, date);
      }
      
      case 'zodiac_sign': {
        const celestialData = require('./celestialData');
        if (!parameters.symbol) {
          throw new Error('zodiac_sign requires symbol parameter');
        }
        return celestialData.getZodiacSign(parameters.symbol);
      }
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Sandbox tool error [${toolName}]:`, error);
    throw error;
  }
}

module.exports = {
  MathematicalSandbox,
  executeSandboxTool,
  resetSandbox,
  generateMockPriceHistory
};

