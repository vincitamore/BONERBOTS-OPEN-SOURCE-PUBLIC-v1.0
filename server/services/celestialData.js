/**
 * Celestial Data Service
 * Provides astronomical/astrological calculations for the Astrologer bot
 * Uses astronomy-engine for local calculations (no external APIs)
 */

const Astronomy = require('astronomy-engine');

class CelestialDataService {
  
  /**
   * Get current moon phase with trading interpretation
   * @param {Date} date - The date to calculate for (defaults to now)
   * @returns {Object} Moon phase data with trading interpretation
   */
  getMoonPhase(date = new Date()) {
    try {
      // Get moon phase angle (-180 to +180 degrees)
      const phaseAngle = Astronomy.MoonPhase(date);
      
      // Get illumination fraction
      const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
      
      // Determine phase name and trading interpretation
      let phaseName, tradingBias, interpretation;
      
      if (phaseAngle >= -22.5 && phaseAngle < 22.5) {
        phaseName = "New Moon";
        tradingBias = "NEUTRAL_TO_BULLISH";
        interpretation = "New beginnings favor the markets. Fresh cosmic energy enters. Reversals and new trends often emerge from this void.";
      } else if (phaseAngle >= 22.5 && phaseAngle < 67.5) {
        phaseName = "Waxing Crescent";
        tradingBias = "BULLISH";
        interpretation = "Growth phase blessed by lunar energies. Accumulation favored. Long positions align with waxing cosmic forces.";
      } else if (phaseAngle >= 67.5 && phaseAngle < 112.5) {
        phaseName = "First Quarter";
        tradingBias = "BULLISH";
        interpretation = "Momentum builds as the Moon reaches quarter illumination. The cosmos supports decisive action and commitment.";
      } else if (phaseAngle >= 112.5 && phaseAngle < 157.5) {
        phaseName = "Waxing Gibbous";
        tradingBias = "BULLISH_TO_VOLATILE";
        interpretation = "Energy approaches its peak. Markets prepare for the Full Moon's emotional crescendo. Volatility increases.";
      } else if (phaseAngle >= 157.5 || phaseAngle < -157.5) {
        phaseName = "Full Moon";
        tradingBias = "HIGHLY_VOLATILE";
        interpretation = "Peak emotional energy floods the markets. Expect extremes, sudden reversals, and irrational exuberance or fear. The veil between reason and madness thins.";
      } else if (phaseAngle >= -157.5 && phaseAngle < -112.5) {
        phaseName = "Waning Gibbous";
        tradingBias = "VOLATILE_TO_BEARISH";
        interpretation = "Peak emotions fade. Profit-taking and distribution begin. The cosmos counsels caution as energy dissipates.";
      } else if (phaseAngle >= -112.5 && phaseAngle < -67.5) {
        phaseName = "Last Quarter";
        tradingBias = "BEARISH";
        interpretation = "Contraction phase. Markets favor consolidation and position reduction. The waning Moon pulls energy from speculation.";
      } else {
        phaseName = "Waning Crescent";
        tradingBias = "BEARISH_TO_NEUTRAL";
        interpretation = "Cosmic energies deplete as the cycle nears completion. Prepare for renewal. The wise await the New Moon before bold moves.";
      }
      
      return {
        phase: phaseName,
        illumination: (illum.phase_fraction * 100).toFixed(1) + '%',
        phase_angle: phaseAngle.toFixed(2),
        trading_bias: tradingBias,
        interpretation,
        timestamp: date.toISOString()
      };
    } catch (error) {
      console.error('Error calculating moon phase:', error);
      return {
        phase: "Unknown",
        illumination: "N/A",
        phase_angle: 0,
        trading_bias: "NEUTRAL",
        interpretation: "The lunar veil obscures the cosmic vision.",
        error: error.message
      };
    }
  }
  
  /**
   * Get planetary positions in zodiac signs
   * @param {Date} date - The date to calculate for (defaults to now)
   * @returns {Object} Planetary positions with zodiac signs
   */
  getPlanetaryPositions(date = new Date()) {
    try {
      const zodiacSigns = [
        'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
      ];
      
      const planets = {};
      const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
      
      bodies.forEach(bodyName => {
        try {
          // Get geocentric equatorial vector first, then convert to ecliptic
          const vector = Astronomy.GeoVector(Astronomy.Body[bodyName], date, false);
          const ecliptic = Astronomy.Ecliptic(vector);
          const longitude = ((ecliptic.elon % 360) + 360) % 360;
          const signIndex = Math.floor(longitude / 30);
          const degreeInSign = longitude % 30;
          
          planets[bodyName] = {
            sign: zodiacSigns[signIndex],
            degree: degreeInSign.toFixed(1) + '°',
            element: this.getElement(zodiacSigns[signIndex]),
            quality: this.getQuality(zodiacSigns[signIndex]),
            interpretation: this.getPlanetaryInterpretation(bodyName, zodiacSigns[signIndex])
          };
        } catch (err) {
          planets[bodyName] = {
            sign: 'Unknown',
            degree: 'N/A',
            element: 'Unknown',
            quality: 'Unknown',
            interpretation: 'Position obscured by cosmic interference.'
          };
        }
      });
      
      return {
        positions: planets,
        timestamp: date.toISOString()
      };
    } catch (error) {
      console.error('Error calculating planetary positions:', error);
      return {
        positions: {},
        error: error.message,
        timestamp: date.toISOString()
      };
    }
  }
  
  /**
   * Check if Mercury is in retrograde motion
   * @param {Date} date - The date to check (defaults to now)
   * @returns {Object} Retrograde status with trading implications
   */
  isMercuryRetrograde(date = new Date()) {
    try {
      // Check Mercury's apparent motion by comparing positions 1 day apart
      const d1 = new Date(date.getTime() - 86400000); // 1 day before
      const d2 = new Date(date.getTime() + 86400000); // 1 day after
      
      const vec1 = Astronomy.GeoVector(Astronomy.Body.Mercury, d1, false);
      const vec2 = Astronomy.GeoVector(Astronomy.Body.Mercury, d2, false);
      const pos1 = Astronomy.Ecliptic(vec1).elon;
      const pos2 = Astronomy.Ecliptic(vec2).elon;
      
      // Calculate angular change (accounting for 360° wraparound)
      let delta = pos2 - pos1;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      
      const isRetrograde = delta < 0; // Negative delta = backward motion = retrograde
      
      return {
        is_retrograde: isRetrograde,
        status: isRetrograde ? "RETROGRADE" : "DIRECT",
        interpretation: isRetrograde 
          ? "Mercury traverses backwards through the celestial sphere. Communication disruptions, technological chaos, and contract confusion abound. Reversals and second chances appear. Revisit old positions rather than forge new ones."
          : "Mercury moves forward through the heavens. Communication flows clearly. Technology operates smoothly. Normal trading analysis applies without cosmic interference.",
        trading_impact: isRetrograde ? "FAVOR_REVERSALS_AND_EXITS" : "NORMAL",
        timestamp: date.toISOString()
      };
    } catch (error) {
      console.error('Error checking Mercury retrograde:', error);
      return {
        is_retrograde: false,
        status: "UNKNOWN",
        interpretation: "Mercury's motion is veiled from mortal sight.",
        trading_impact: "UNKNOWN",
        error: error.message
      };
    }
  }
  
  /**
   * Calculate aspect (angular relationship) between two planets
   * @param {string} planet1 - First planet name (e.g., 'Mars')
   * @param {string} planet2 - Second planet name (e.g., 'Venus')
   * @param {Date} date - The date to calculate for (defaults to now)
   * @returns {Object} Aspect information with interpretation
   */
  calculateAspect(planet1, planet2, date = new Date()) {
    try {
      // Validate planet names
      const validBodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
      if (!validBodies.includes(planet1) || !validBodies.includes(planet2)) {
        return {
          aspect: null,
          interpretation: `Invalid celestial bodies specified. Choose from: ${validBodies.join(', ')}`,
          planets: `${planet1} - ${planet2}`
        };
      }
      
      const vec1 = Astronomy.GeoVector(Astronomy.Body[planet1], date, false);
      const vec2 = Astronomy.GeoVector(Astronomy.Body[planet2], date, false);
      const pos1 = Astronomy.Ecliptic(vec1).elon;
      const pos2 = Astronomy.Ecliptic(vec2).elon;
      
      // Calculate angular separation
      let angle = Math.abs(pos2 - pos1);
      if (angle > 180) angle = 360 - angle;
      
      // Define major aspects with orbs (allowable deviation)
      const aspects = [
        { name: 'Conjunction', angle: 0, orb: 8, nature: 'Intense Fusion', impact: 'POWERFUL' },
        { name: 'Sextile', angle: 60, orb: 6, nature: 'Harmonious Opportunity', impact: 'MILDLY_BULLISH' },
        { name: 'Square', angle: 90, orb: 8, nature: 'Dynamic Tension', impact: 'VOLATILE' },
        { name: 'Trine', angle: 120, orb: 8, nature: 'Flowing Harmony', impact: 'BULLISH' },
        { name: 'Opposition', angle: 180, orb: 8, nature: 'Polarity & Balance', impact: 'VOLATILE_REVERSAL' }
      ];
      
      // Find matching aspect
      for (const aspect of aspects) {
        const deviation = Math.abs(angle - aspect.angle);
        if (deviation <= aspect.orb) {
          return {
            aspect: aspect.name,
            planets: `${planet1} - ${planet2}`,
            exact_angle: angle.toFixed(2) + '°',
            orb: deviation.toFixed(2) + '°',
            nature: aspect.nature,
            trading_impact: aspect.impact,
            interpretation: this.getAspectInterpretation(aspect.name, planet1, planet2),
            timestamp: date.toISOString()
          };
        }
      }
      
      // No major aspect found
      return {
        aspect: null,
        planets: `${planet1} - ${planet2}`,
        angle: angle.toFixed(2) + '°',
        interpretation: `No major aspect detected between ${planet1} and ${planet2}. The celestial bodies operate independently at this time.`,
        trading_impact: "NEUTRAL",
        timestamp: date.toISOString()
      };
    } catch (error) {
      console.error('Error calculating aspect:', error);
      return {
        aspect: null,
        planets: `${planet1} - ${planet2}`,
        interpretation: "The cosmic geometry eludes calculation.",
        error: error.message
      };
    }
  }
  
  /**
   * Map cryptocurrency symbol to zodiac sign based on characteristics
   * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
   * @returns {Object} Zodiac sign mapping with interpretation
   */
  getZodiacSign(symbol) {
    try {
      // Predefined mappings based on crypto characteristics
      const cryptoZodiac = {
        'BTCUSDT': { sign: 'Taurus', rationale: 'Stable, valuable, store of wealth, stubborn resistance to change' },
        'ETHUSDT': { sign: 'Aquarius', rationale: 'Innovative, forward-thinking, decentralized technology, humanitarian vision' },
        'SOLUSDT': { sign: 'Aries', rationale: 'Fast, pioneering, aggressive growth, impulsive innovation' },
        'DOGEUSDT': { sign: 'Sagittarius', rationale: 'Adventurous, meme-driven, optimistic, loves freedom and fun' },
        'ADAUSDT': { sign: 'Virgo', rationale: 'Methodical, detail-oriented, peer-reviewed, perfectionist approach' },
        'XRPUSDT': { sign: 'Libra', rationale: 'Focused on banking partnerships, seeks balance and fairness in finance' },
        'LINKUSDT': { sign: 'Gemini', rationale: 'Communication oracle, connects different systems, dual nature' },
        'MATICUSDT': { sign: 'Cancer', rationale: 'Nurturing infrastructure, protective layer 2, security-focused' },
        'AVAXUSDT': { sign: 'Aries', rationale: 'Fast, competitive, pioneering in subnets, aggressive expansion' },
        'DOTUSDT': { sign: 'Aquarius', rationale: 'Interconnected vision, decentralized governance, forward-thinking' },
        'ATOMUSDT': { sign: 'Pisces', rationale: 'Interconnected cosmos, fluid communication, spiritual vision of blockchain' },
        'SHIBUSDT': { sign: 'Sagittarius', rationale: 'Meme energy, community-driven adventure, optimistic speculation' },
        'LTCUSDT': { sign: 'Taurus', rationale: 'Silver to Bitcoin\'s gold, stable, reliable, value-focused' },
        'UNIUSDT': { sign: 'Gemini', rationale: 'DEX facilitating communication between tokens, dual market-making' }
      };
      
      // Extract base symbol (remove USDT, USDC, etc.)
      const baseSymbol = symbol.toUpperCase();
      
      // Get zodiac mapping or assign default based on first letter
      let zodiacData = cryptoZodiac[baseSymbol];
      
      if (!zodiacData) {
        // Default assignment based on first letter of symbol (for unknown cryptos)
        const firstChar = baseSymbol.charCodeAt(0) % 12;
        const defaultSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 
                              'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
        zodiacData = {
          sign: defaultSigns[firstChar],
          rationale: `Assigned by celestial algorithm based on the symbol's cosmic resonance`
        };
      }
      
      return {
        symbol: baseSymbol,
        zodiac_sign: zodiacData.sign,
        element: this.getElement(zodiacData.sign),
        quality: this.getQuality(zodiacData.sign),
        rationale: zodiacData.rationale,
        ruling_planet: this.getRulingPlanet(zodiacData.sign)
      };
    } catch (error) {
      console.error('Error mapping zodiac sign:', error);
      return {
        symbol,
        zodiac_sign: 'Unknown',
        element: 'Unknown',
        quality: 'Unknown',
        rationale: 'The stars refuse to align for this symbol.',
        error: error.message
      };
    }
  }
  
  // ========== HELPER METHODS ==========
  
  getElement(sign) {
    const elements = {
      'Aries': 'Fire', 'Leo': 'Fire', 'Sagittarius': 'Fire',
      'Taurus': 'Earth', 'Virgo': 'Earth', 'Capricorn': 'Earth',
      'Gemini': 'Air', 'Libra': 'Air', 'Aquarius': 'Air',
      'Cancer': 'Water', 'Scorpio': 'Water', 'Pisces': 'Water'
    };
    return elements[sign] || 'Unknown';
  }
  
  getQuality(sign) {
    const qualities = {
      'Aries': 'Cardinal', 'Cancer': 'Cardinal', 'Libra': 'Cardinal', 'Capricorn': 'Cardinal',
      'Taurus': 'Fixed', 'Leo': 'Fixed', 'Scorpio': 'Fixed', 'Aquarius': 'Fixed',
      'Gemini': 'Mutable', 'Virgo': 'Mutable', 'Sagittarius': 'Mutable', 'Pisces': 'Mutable'
    };
    return qualities[sign] || 'Unknown';
  }
  
  getRulingPlanet(sign) {
    const rulers = {
      'Aries': 'Mars', 'Taurus': 'Venus', 'Gemini': 'Mercury',
      'Cancer': 'Moon', 'Leo': 'Sun', 'Virgo': 'Mercury',
      'Libra': 'Venus', 'Scorpio': 'Pluto', 'Sagittarius': 'Jupiter',
      'Capricorn': 'Saturn', 'Aquarius': 'Uranus', 'Pisces': 'Neptune'
    };
    return rulers[sign] || 'Unknown';
  }
  
  getPlanetaryInterpretation(planet, sign) {
    // Simplified interpretation - can be expanded
    const elementalAffinities = {
      'Sun': { Fire: 'Exalted', Earth: 'Grounded', Air: 'Expressive', Water: 'Reflective' },
      'Moon': { Fire: 'Restless', Earth: 'Stable', Air: 'Changeable', Water: 'Intuitive' },
      'Mercury': { Fire: 'Quick', Earth: 'Practical', Air: 'Brilliant', Water: 'Empathic' },
      'Venus': { Fire: 'Passionate', Earth: 'Sensual', Air: 'Social', Water: 'Romantic' },
      'Mars': { Fire: 'Powerful', Earth: 'Persistent', Air: 'Strategic', Water: 'Intense' },
      'Jupiter': { Fire: 'Optimistic', Earth: 'Prosperous', Air: 'Philosophical', Water: 'Compassionate' },
      'Saturn': { Fire: 'Disciplined', Earth: 'Structured', Air: 'Analytical', Water: 'Cautious' }
    };
    
    const element = this.getElement(sign);
    const affinity = elementalAffinities[planet]?.[element] || 'Neutral';
    return `${planet} in ${sign}: ${affinity} expression of ${element.toLowerCase()} energy`;
  }
  
  getAspectInterpretation(aspectName, planet1, planet2) {
    const interpretations = {
      'Conjunction': `${planet1} and ${planet2} unite their energies. Combined forces amplify market movements. Watch for sudden, powerful shifts.`,
      'Sextile': `${planet1} and ${planet2} create opportunities. Harmonious flow supports moderate bullish momentum.`,
      'Square': `${planet1} and ${planet2} clash in dynamic tension. Expect volatility, conflicts, and sharp reversals. Risk elevated.`,
      'Trine': `${planet1} and ${planet2} flow in perfect harmony. Markets favor growth. Bullish energy prevails.`,
      'Opposition': `${planet1} and ${planet2} stand opposed. Polarity creates balance-seeking reversals. Peak reached, correction likely.`
    };
    return interpretations[aspectName] || 'Cosmic relationship unclear.';
  }
}

// Export singleton instance
module.exports = new CelestialDataService();

