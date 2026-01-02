// server/services/weatherService.ts
import type { Weather, ZodiacSeason } from '../../shared/types/types.js';

/**
 * Convert a float weather value to an integer tier (1-9) for description generation
 */
function getWeatherTier(value: number): number {
  return Math.max(1, Math.min(9, Math.round(value)));
}

/**
 * Sample a value from a normal distribution using mean and variance
 * Uses Box-Muller transform for normal distribution, then clamps to 0.5-9.5
 * Returns a FLOAT for smooth transitions
 */
function sampleFromDistribution(mean: number, variance: number): number {
  // Box-Muller transform to get normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  
  // Convert to our distribution: mean + z * standard_deviation
  const stdDev = Math.sqrt(variance);
  const value = mean + z * stdDev;
  
  // Clamp to 0.5-9.5 range (allows smooth float transitions)
  return Math.max(0.5, Math.min(9.5, value));
}

/**
 * Generate initial weather for a given month
 * Returns FLOAT values for heat, rain, wind
 */
export function generateInitialWeather(zodiac: ZodiacSeason): Weather {
  const heat = sampleFromDistribution(zodiac.weather.heat.mean, zodiac.weather.heat.variance);
  const rain = sampleFromDistribution(zodiac.weather.rain.mean, zodiac.weather.rain.variance);
  const wind = sampleFromDistribution(zodiac.weather.wind.mean, zodiac.weather.wind.variance);
  
  return {
    heat,
    rain,
    wind
  };
}

/**
 * Update weather for a new beat using continuous drift with momentum
 * Works with FLOATS for smooth, gradual changes
 */
export function updateWeatherForBeat(
  current: Weather, 
  previous: Weather, 
  zodiac: ZodiacSeason
): { current: Weather; previous: Weather } {
  
  function sampleFromDistribution(mean: number, variance: number): number {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    const stdDev = Math.sqrt(variance);
    const value = mean + z * stdDev;
    
    // Clamp to valid range
    return Math.max(0.5, Math.min(9.5, value));
  }
  
  function driftWithMomentum(
    currentValue: number, 
    previousValue: number,
    mean: number, 
    variance: number
  ): number {
    // 1. Calculate blended mean (30% seasonal mean, 70% current position)
    const blendFactor = 0.3;
    const blendedMean = mean * blendFactor + currentValue * (1 - blendFactor);
    
    // 2. Sample target from blended distribution
    const target = sampleFromDistribution(blendedMean, variance);
    
    // 3. Calculate base movement toward target (move 40% of the way)
    const baseMovement = (target - currentValue) * 0.4;
    
    // 4. Calculate momentum
    const momentum = currentValue - previousValue;
    
    // 5. Apply momentum multiplier (exp(0.3 * momentum))
    // Negative momentum dampens, positive momentum enhances
    const momentumMultiplier = Math.exp(0.3 * momentum);
    
    // 6. Combine and apply
    const movement = baseMovement * momentumMultiplier;
    const newValue = currentValue + movement;
    
    // Soft bounds - keep as FLOAT for smooth transitions
    return Math.max(0.5, Math.min(9.5, newValue));
  }
  
  const heat = driftWithMomentum(
    current.heat, 
    previous.heat, 
    zodiac.weather.heat.mean, 
    zodiac.weather.heat.variance
  );
  
  const rain = driftWithMomentum(
    current.rain, 
    previous.rain,
    zodiac.weather.rain.mean, 
    zodiac.weather.rain.variance
  );
  
  const wind = driftWithMomentum(
    current.wind, 
    previous.wind,
    zodiac.weather.wind.mean, 
    zodiac.weather.wind.variance
  );
  
  return {
    current: {
        heat,
        rain,
        wind
    },
    previous: current // Current becomes previous
  };
}

/**
 * Update weather for a new day - resample but bias toward previous values
 * Returns FLOAT values for smooth transitions
 */
export function updateWeatherForDay(previous: Weather, zodiac: ZodiacSeason): Weather {
  function resampleWithBias(previousValue: number, mean: number, variance: number): number {
    // 60% chance to sample near previous value, 40% completely resample
    if (Math.random() < 0.6) {
      // Bias toward previous: sample from tighter distribution around previous value
      return sampleFromDistribution(previousValue, variance * 0.5);
    } else {
      // Full resample from season distribution
      return sampleFromDistribution(mean, variance);
    }
  }
  
  const heat = resampleWithBias(previous.heat, zodiac.weather.heat.mean, zodiac.weather.heat.variance);
  const rain = resampleWithBias(previous.rain, zodiac.weather.rain.mean, zodiac.weather.rain.variance);
  const wind = resampleWithBias(previous.wind, zodiac.weather.wind.mean, zodiac.weather.wind.variance);
  
  return {
    heat,
    rain,
    wind
  };
}

/**
 * Convert weather axes to natural prose
 * Takes FLOAT values but converts to integer tiers for description
 */
export function generateWeatherDescription(weather: Weather): string {
  // Convert float values to integer tiers for description
  const heatTier = getWeatherTier(weather.heat);
  const rainTier = getWeatherTier(weather.rain);
  const windTier = getWeatherTier(weather.wind);
  
  // Temperature descriptors
  const tempDesc = [
    "", // 0 index unused
    "freezing",
    "very cold",
    "cold",
    "cool",
    "mild",
    "warm",
    "hot",
    "very hot",
    "scorching"
  ][heatTier];
  
  // Precipitation descriptors (with snow logic)
  const isSnow = heatTier <= 3;
  const precipDesc = [
    "", // 0 index unused
    "under clear skies",
    "under feather clouds",
    "with some clouds",
    "under overcast skies",
    "with threatening clouds",
    isSnow ? "with light snow" : "with a light drizzle",
    isSnow ? "with snow" : "with heavy rain",
    isSnow ? "with heavy snow" : "with a downpour",
    isSnow ? "in blizzard conditions" : "with torrential rain"
  ][rainTier];
  
  // Wind descriptors (only include if >= 5)
  let windDesc = "";
  if (windTier >= 5) {
    windDesc = [
      "", "", "", "", "", // 0-3 unused
      "and a gentle breeze",
      "and moderate winds",
      "and strong winds",
      "and gale-force winds",
      "and storm-force winds"
    ][windTier];
  }
  
  // Construct final description
  return windDesc 
    ? `${tempDesc} ${precipDesc} ${windDesc}`
    : `${tempDesc} ${precipDesc}`;
}

/**
 * Generate a description of how weather has changed from previous beat
 * Uses integer tiers for comparison to avoid reporting tiny float changes
 * Returns empty string if no significant change
 */
export function generateWeatherChangeDescription(previous: Weather, current: Weather): string {
  const changes: string[] = [];
  
  const prevHeat = getWeatherTier(previous.heat);
  const currHeat = getWeatherTier(current.heat);
  const prevRain = getWeatherTier(previous.rain);
  const currRain = getWeatherTier(current.rain);
  const prevWind = getWeatherTier(previous.wind);
  const currWind = getWeatherTier(current.wind);

  // Constants matching the other functions
  const PRECIP_START_TIER = 6; 
  const SNOW_MAX_TIER = 3;   
  const WIND_NOTICEABLE_TIER = 5; 

  // --- 1. Temperature & Phase Changes ---
  const heatDiff = currHeat - prevHeat;
  const wasSnow = prevHeat <= SNOW_MAX_TIER;
  const isSnow = currHeat <= SNOW_MAX_TIER;
  const isWet = currRain >= PRECIP_START_TIER;

  let phaseChangeReported = false;
  
  if (isWet && wasSnow !== isSnow) {
    // Phase change logic
    const precipType = isSnow ? "snow" : "rain";
    
    // Check if we should mention intensity along with the phase change
    // e.g. "Light snow turned into heavy rain"
    let intensityAdjective = "";
    if (currRain >= 8) intensityAdjective = "heavy ";
    else if (currRain === 9) intensityAdjective = "torrential ";
    
    if (isSnow) {
      changes.push(`the rain has turned into ${intensityAdjective}snow`);
    } else {
      // "Slushy" fits best for Tier 4 or 5. If it jumps to 6+, it's just warm rain.
      const isSlushy = currHeat <= 5;
      const desc = isSlushy ? "slushy " : "";
      changes.push(`the snow has turned into ${intensityAdjective}${desc}rain`);
    }
    phaseChangeReported = true;
  } 
  else if (heatDiff !== 0) {
    const magnitude = Math.abs(heatDiff);
    const direction = heatDiff > 0 ? "warmed up" : "gotten colder";
    
    if (magnitude >= 3) {
      changes.push(`it has ${direction} significantly`);
    } else if (magnitude === 2) {
      changes.push(`it has ${direction}`);
    } else {
      changes.push(`it has ${direction} a bit`);
    }
  }

  // --- 2. Precipitation / Cloud Cover ---
  const rainDiff = currRain - prevRain;
  const wasWet = prevRain >= PRECIP_START_TIER;
  const precipWord = isSnow ? "snow" : "rain";

  if (rainDiff !== 0) {
    if (!wasWet && !isWet) {
      // DRY -> DRY (Cloud shifts)
      if (rainDiff > 0) {
         if (currRain === 5) changes.push("the clouds have thickened");
         else if (currRain >= 3) changes.push("clouds are gathering");
         else changes.push("a few wisps of cloud have appeared");
      } else {
         // Fix: Distinguish between totally clear (1) and mostly clear (2)
         if (currRain === 1) changes.push("the sky has cleared completely");
         else if (currRain <= 2) changes.push("the sky has cleared up"); 
         else changes.push("the clouds are breaking up");
      }
    } 
    else if (wasWet && isWet) {
      // WET -> WET (Intensity)
      if (!phaseChangeReported) {
        if (rainDiff > 0) changes.push(`the ${precipWord} has gotten heavier`);
        else changes.push(`the ${precipWord} has eased off a little`);
      }
    } 
    else if (!wasWet && isWet) {
      // DRY -> WET (Start)
      // Optional: Check intensity on start. 
      // If it starts as a downpour immediately, "started to rain" is a bit weak.
      if (currRain >= 8) changes.push(`heavy ${precipWord} has started to fall`);
      else changes.push(`it has started to ${precipWord}`);
    } 
    else if (wasWet && !isWet) {
      // WET -> DRY (Stop)
      if (currRain <= 2) {
        changes.push(`the ${precipWord} has stopped and the sky has cleared`);
      } else {
        changes.push(`the ${precipWord} has stopped`);
      }
    }
  }

  // --- 3. Wind ---
  const windDiff = currWind - prevWind;
  const wasWindy = prevWind >= WIND_NOTICEABLE_TIER;
  const isWindy = currWind >= WIND_NOTICEABLE_TIER;

  if (windDiff !== 0) {
    if (!wasWindy && isWindy) {
      // Fix: Check intensity on entry. 
      // If jumping from 2 -> 8, "a breeze" is wrong.
      if (currWind >= 8) changes.push("a storm wind has kicked up");
      else if (currWind >= 6) changes.push("a strong wind has started blowing");
      else changes.push("a breeze has picked up");
    }
    else if (wasWindy && !isWindy) {
      changes.push("the wind has died down");
    }
    else if (isWindy) {
      const windMag = Math.abs(windDiff);
      if (windDiff > 0) {
        changes.push(windMag >= 2 ? "the wind has picked up significantly" : "the wind is blowing harder");
      } else {
        changes.push(windMag >= 2 ? "the wind has died down significantly" : "the wind has settled down slightly");
      }
    }
  }

  // --- Assembly ---
  if (changes.length === 0) return "";
  if (changes.length === 1) return changes[0];
  
  // Join with commas and add 'and' for the last item
  const last = changes.pop();
  return `${changes.join(", ")}, and ${last}`;
}