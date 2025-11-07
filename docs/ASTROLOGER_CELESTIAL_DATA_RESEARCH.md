# Astrologer Bot - Celestial Data Research
## Local JavaScript/Node.js Solutions for Astronomical Calculations

**Date**: 2025-11-07  
**Goal**: Find the best local (npm) module for astronomical/astrological data without requiring external APIs

---

## 🔍 Research Summary

Based on available JavaScript/Node.js astronomy libraries, here are the best options for local astronomical calculations:

---

## ✅ **RECOMMENDED PRIMARY SOLUTION**

### **1. astronomy-engine (npm)**

**Package**: `astronomy-engine`  
**Author**: Don Cross  
**GitHub**: https://github.com/cosinekitty/astronomy  
**NPM**: https://www.npmjs.com/package/astronomy-engine  
**License**: MIT (Free, open-source)

**Why This is Perfect**:
- ✅ **Zero dependencies** - Pure JavaScript, no external APIs needed
- ✅ **High accuracy** - Based on NASA JPL data and VSOP87 theory
- ✅ **Comprehensive** - Covers all planets, moon, sun positions
- ✅ **Well-maintained** - Active development, last updated recently
- ✅ **Excellent documentation** - Clear examples and API docs
- ✅ **Fast** - Optimized algorithms, runs entirely client/server side

**Features Directly Useful for Astrologer**:
```javascript
// Moon phase calculation
const phase = Astronomy.MoonPhase(date);
// Returns: -180 to +180 degrees
// 0° = New Moon, 180° = Full Moon

// Planetary positions (ecliptic longitude - zodiac position)
const mars = Astronomy.Ecliptic(date, Body.Mars);
// Returns: { elat, elon } where elon is zodiac degree

// Rise/set times
const moonRise = Astronomy.SearchRiseSet(Body.Moon, observer, direction, startDate, limitDays);

// Distance between planets
const elongation = Astronomy.Elongation(Body.Venus, date);

// Moon illumination
const illum = Astronomy.Illumination(Body.Moon, date);
// Returns: { phase_angle, phase_fraction, mag }
```

**Installation**:
```bash
pnpm add astronomy-engine
```

**Example Code**:
```javascript
const Astronomy = require('astronomy-engine');

// Get current moon phase
function getMoonPhase(date = new Date()) {
  const phase = Astronomy.MoonPhase(date);
  
  // Convert to illumination percentage
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
  
  // Determine phase name
  let phaseName;
  if (phase >= -22.5 && phase < 22.5) phaseName = "New Moon";
  else if (phase >= 22.5 && phase < 67.5) phaseName = "Waxing Crescent";
  else if (phase >= 67.5 && phase < 112.5) phaseName = "First Quarter";
  else if (phase >= 112.5 && phase < 157.5) phaseName = "Waxing Gibbous";
  else if (phase >= 157.5 || phase < -157.5) phaseName = "Full Moon";
  else if (phase >= -157.5 && phase < -112.5) phaseName = "Waning Gibbous";
  else if (phase >= -112.5 && phase < -67.5) phaseName = "Last Quarter";
  else phaseName = "Waning Crescent";
  
  return {
    phase: phaseName,
    illumination: illum.phase_fraction,
    phase_angle: phase
  };
}

// Get planetary zodiac positions
function getPlanetaryPositions(date = new Date()) {
  const planets = {};
  const bodies = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 
    'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'
  ];
  
  const zodiacSigns = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
  ];
  
  bodies.forEach(bodyName => {
    const ecliptic = Astronomy.Ecliptic(date, Astronomy.Body[bodyName]);
    const longitude = ecliptic.elon;
    
    // Normalize to 0-360
    const normalizedLon = ((longitude % 360) + 360) % 360;
    
    // Determine zodiac sign (each sign is 30 degrees)
    const signIndex = Math.floor(normalizedLon / 30);
    const degreeInSign = normalizedLon % 30;
    
    planets[bodyName] = {
      sign: zodiacSigns[signIndex],
      degree: degreeInSign.toFixed(2),
      longitude: normalizedLon.toFixed(2)
    };
  });
  
  return planets;
}

// Check Mercury retrograde
function isMercuryRetrograde(date = new Date()) {
  // Mercury retrograde occurs when apparent motion reverses
  // Check velocity by comparing positions over 2 days
  const d1 = new Date(date.getTime() - 86400000); // 1 day before
  const d2 = new Date(date.getTime() + 86400000); // 1 day after
  
  const pos1 = Astronomy.Ecliptic(d1, Astronomy.Body.Mercury).elon;
  const pos2 = Astronomy.Ecliptic(d2, Astronomy.Body.Mercury).elon;
  
  // If longitude decreased (accounting for wraparound), it's retrograde
  let delta = pos2 - pos1;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  
  return delta < 0; // Retrograde if moving backward
}

// Calculate aspects between planets
function calculateAspect(planet1, planet2, date = new Date()) {
  const pos1 = Astronomy.Ecliptic(date, Astronomy.Body[planet1]).elon;
  const pos2 = Astronomy.Ecliptic(date, Astronomy.Body[planet2]).elon;
  
  let angle = Math.abs(pos2 - pos1);
  if (angle > 180) angle = 360 - angle;
  
  // Major aspects with 8-degree orb
  const aspects = [
    { name: 'Conjunction', angle: 0, orb: 8 },
    { name: 'Sextile', angle: 60, orb: 6 },
    { name: 'Square', angle: 90, orb: 8 },
    { name: 'Trine', angle: 120, orb: 8 },
    { name: 'Opposition', angle: 180, orb: 8 }
  ];
  
  for (const aspect of aspects) {
    if (Math.abs(angle - aspect.angle) <= aspect.orb) {
      return {
        aspect: aspect.name,
        exactAngle: angle.toFixed(2),
        orb: Math.abs(angle - aspect.angle).toFixed(2)
      };
    }
  }
  
  return null; // No major aspect
}
```

---

## 📦 **ALTERNATIVE OPTIONS**

### **2. suncalc (npm)**

**Package**: `suncalc`  
**NPM**: https://www.npmjs.com/package/suncalc  
**License**: BSD-2-Clause

**Pros**:
- ✅ Lightweight and simple
- ✅ Moon phases and illumination
- ✅ Sun/Moon rise/set times
- ✅ Good for basic solar/lunar calculations

**Cons**:
- ❌ **Limited to Sun and Moon only** - No planetary positions
- ❌ Less accurate than astronomy-engine
- ❌ No zodiac/ecliptic coordinate support

**Best for**: Simple moon phase tracking if planets aren't needed

---

### **3. lune (npm)**

**Package**: `lune`  
**NPM**: https://www.npmjs.com/package/lune  
**License**: MIT

**Pros**:
- ✅ Focused specifically on moon calculations
- ✅ Very simple API
- ✅ Phase names and illumination

**Cons**:
- ❌ **Moon only** - No planets
- ❌ Less comprehensive than astronomy-engine
- ❌ No zodiac positions

---

### **4. astronomia (npm)**

**Package**: `astronomia`  
**NPM**: https://www.npmjs.com/package/astronomia  
**License**: MIT

**Pros**:
- ✅ Based on Jean Meeus "Astronomical Algorithms" (the gold standard)
- ✅ Very comprehensive (planets, moon, sun, stars)
- ✅ High accuracy

**Cons**:
- ❌ More complex API (lower-level)
- ❌ Requires more astronomical knowledge to use
- ❌ Documentation is technical

**Best for**: Advanced users who need maximum flexibility

---

## 🎯 **FINAL RECOMMENDATION**

### **Use `astronomy-engine`**

**Reasons**:
1. ✅ **Perfect balance** - Comprehensive but easy to use
2. ✅ **All features we need**:
   - Moon phases with illumination
   - Planetary zodiac positions (all 8 planets + Pluto)
   - Mercury retrograde detection (via velocity)
   - Planetary aspects (angular relationships)
   - Rise/set times
3. ✅ **High accuracy** - NASA JPL-based
4. ✅ **No dependencies** - Pure JavaScript
5. ✅ **Great documentation** - Easy to integrate
6. ✅ **Active maintenance** - Regular updates

---

## 🛠️ **Implementation Plan for Astrologer**

### **Tools to Implement** (Priority Order):

#### **HIGH PRIORITY** (Week 1)
1. **`moon_phase(date)`** - Using `Astronomy.MoonPhase()` + `Illumination()`
   - Returns: phase name, illumination %, trading interpretation
   
2. **`planetary_positions(date)`** - Using `Astronomy.Ecliptic()`
   - Returns: All planet zodiac signs and degrees
   
3. **`mercury_retrograde(date)`** - Using velocity calculation
   - Returns: is_retrograde boolean, next retrograde dates

#### **MEDIUM PRIORITY** (Week 2)
4. **`cosmic_aspect(planet1, planet2, date)`** - Using `Ecliptic()` positions
   - Returns: aspect name (conjunction, square, trine, etc.), orb
   
5. **`zodiac_sign(symbol)`** - Custom mapping function
   - Map crypto symbols to zodiac signs based on characteristics
   - Check compatibility with current planetary energies

#### **NICE-TO-HAVE** (Week 3+)
6. **`moon_void_of_course(date)`** - Advanced lunar calculation
7. **`planetary_day_ruler(date)`** - Traditional planetary hour system
8. **`lunar_mansions(date)`** - 28 lunar mansions (Vedic astrology)

---

## 📋 **Sample Integration Code**

```javascript
// server/services/celestialData.js
const Astronomy = require('astronomy-engine');

class CelestialDataService {
  
  // Get current moon phase with trading interpretation
  getMoonPhase(date = new Date()) {
    const phase = Astronomy.MoonPhase(date);
    const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
    
    let phaseName, tradingBias, interpretation;
    
    if (phase >= -22.5 && phase < 22.5) {
      phaseName = "New Moon";
      tradingBias = "NEUTRAL_TO_BULLISH";
      interpretation = "New beginnings. Fresh energy enters markets. Reversals favored.";
    } else if (phase >= 22.5 && phase < 67.5) {
      phaseName = "Waxing Crescent";
      tradingBias = "BULLISH";
      interpretation = "Growth phase. Lunar energies support accumulation and long positions.";
    } else if (phase >= 67.5 && phase < 112.5) {
      phaseName = "First Quarter";
      tradingBias = "BULLISH";
      interpretation = "Momentum building. Markets favor decisive action.";
    } else if (phase >= 112.5 && phase < 157.5) {
      phaseName = "Waxing Gibbous";
      tradingBias = "BULLISH_TO_VOLATILE";
      interpretation = "Energy peaks approaching. Volatility increases.";
    } else if (phase >= 157.5 || phase < -157.5) {
      phaseName = "Full Moon";
      tradingBias = "HIGHLY_VOLATILE";
      interpretation = "Maximum emotional energy. Expect extremes, reversals, and volatility spikes.";
    } else if (phase >= -157.5 && phase < -112.5) {
      phaseName = "Waning Gibbous";
      tradingBias = "VOLATILE_TO_BEARISH";
      interpretation = "Peak emotions fade. Profit-taking and distribution phase begins.";
    } else if (phase >= -112.5 && phase < -67.5) {
      phaseName = "Last Quarter";
      tradingBias = "BEARISH";
      interpretation = "Contraction phase. Markets favor consolidation and position reduction.";
    } else {
      phaseName = "Waning Crescent";
      tradingBias = "BEARISH_TO_NEUTRAL";
      interpretation = "Energy depleting. Prepare for cycle renewal. Caution advised.";
    }
    
    return {
      phase: phaseName,
      illumination: (illum.phase_fraction * 100).toFixed(1) + '%',
      phase_angle: phase.toFixed(2),
      trading_bias: tradingBias,
      interpretation
    };
  }
  
  // Get all planetary zodiac positions
  getPlanetaryPositions(date = new Date()) {
    const zodiacSigns = [
      'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];
    
    const planets = {};
    const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
    
    bodies.forEach(bodyName => {
      const ecliptic = Astronomy.Ecliptic(date, Astronomy.Body[bodyName]);
      const longitude = ((ecliptic.elon % 360) + 360) % 360;
      const signIndex = Math.floor(longitude / 30);
      
      planets[bodyName] = {
        sign: zodiacSigns[signIndex],
        degree: (longitude % 30).toFixed(1),
        element: this.getElement(zodiacSigns[signIndex]),
        quality: this.getQuality(zodiacSigns[signIndex])
      };
    });
    
    return planets;
  }
  
  // Check if Mercury is in retrograde
  isMercuryRetrograde(date = new Date()) {
    const d1 = new Date(date.getTime() - 86400000);
    const d2 = new Date(date.getTime() + 86400000);
    
    const pos1 = Astronomy.Ecliptic(d1, Astronomy.Body.Mercury).elon;
    const pos2 = Astronomy.Ecliptic(d2, Astronomy.Body.Mercury).elon;
    
    let delta = pos2 - pos1;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    
    const isRetrograde = delta < 0;
    
    return {
      is_retrograde: isRetrograde,
      interpretation: isRetrograde 
        ? "Mercury retrograde: Communication disruptions, tech issues. Good for reversals, bad for new positions."
        : "Mercury direct: Normal communication flow. Proceed with standard analysis.",
      trading_impact: isRetrograde ? "FAVOR_REVERSALS" : "NORMAL"
    };
  }
  
  // Helper: Get element for zodiac sign
  getElement(sign) {
    const elements = {
      'Aries': 'Fire', 'Leo': 'Fire', 'Sagittarius': 'Fire',
      'Taurus': 'Earth', 'Virgo': 'Earth', 'Capricorn': 'Earth',
      'Gemini': 'Air', 'Libra': 'Air', 'Aquarius': 'Air',
      'Cancer': 'Water', 'Scorpio': 'Water', 'Pisces': 'Water'
    };
    return elements[sign];
  }
  
  // Helper: Get quality for zodiac sign
  getQuality(sign) {
    const qualities = {
      'Aries': 'Cardinal', 'Cancer': 'Cardinal', 'Libra': 'Cardinal', 'Capricorn': 'Cardinal',
      'Taurus': 'Fixed', 'Leo': 'Fixed', 'Scorpio': 'Fixed', 'Aquarius': 'Fixed',
      'Gemini': 'Mutable', 'Virgo': 'Mutable', 'Sagittarius': 'Mutable', 'Pisces': 'Mutable'
    };
    return qualities[sign];
  }
}

module.exports = new CelestialDataService();
```

---

## 💰 **Cost Analysis**

### **astronomy-engine**
- **Cost**: $0 (MIT License, completely free)
- **API Limits**: None (runs locally)
- **Dependencies**: None (zero-dependency package)
- **Maintenance**: Actively maintained by Don Cross

### **Alternative: External APIs**
- AstrologyAPI.com: $9-49/month
- AstroSeek API: $15-99/month
- API rate limits and potential downtime

**Conclusion**: Local solution with `astronomy-engine` is vastly superior - free, fast, reliable, no limits.

---

## ✅ **Next Steps**

1. **Install**: `pnpm add astronomy-engine`
2. **Create**: `server/services/celestialData.js` (service layer)
3. **Integrate**: Add celestial tools to sandbox for Astrologer bot
4. **Test**: Verify calculations match known astronomical events
5. **Enhance**: Add trading interpretations to each calculation

---

## 📚 **Resources**

- **astronomy-engine docs**: https://cosinekitty.github.io/astronomy/
- **GitHub**: https://github.com/cosinekitty/astronomy
- **NPM**: https://www.npmjs.com/package/astronomy-engine
- **Astronomical Algorithms** (Jean Meeus book): Reference for algorithm validation

---

**Status**: ✅ Ready to implement  
**Confidence**: Very High - This is the best available JavaScript solution  
**Estimated Implementation Time**: 1-2 days for core features

