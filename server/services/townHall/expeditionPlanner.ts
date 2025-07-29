// server/services/townHall/expeditionPlanner.ts
import { CharacterRecord } from '../../../shared/types/types';

// ==================================
// 1. TYPE DEFINITIONS
// ==================================

export type Party = string[];
export type Composition = Party[];

export interface StrategyWeights {
  levelCohesion: number;
  affinity: number;
  peakAffinity: number;
  discordAvoidance: number;
}

const defaultWeights: StrategyWeights = {
  levelCohesion: 5,
  affinity: 0,
  peakAffinity: 0,
  discordAvoidance: 0,
};

function defineWeights(customWeights: Partial<StrategyWeights>): StrategyWeights {
  return {
    ...defaultWeights,
    ...customWeights,
  };
}

// ==================================
// 1.5. NEW: NORMALIZATION TYPES
// ==================================

export interface NormalizationStats {
  mean: number;
  stdDev: number;
}

export interface PartyScoringStatistics {
  levelCohesion: NormalizationStats;
  affinity: NormalizationStats;
  peakAffinity: NormalizationStats;
  discordPenalty: NormalizationStats;
}

// ==================================
// 2. INDIVIDUAL STRATEGY SCORING FUNCTIONS
// (These functions remain unchanged)
// ==================================

function scorePartyByLevelPenalty(party: Party, roster: CharacterRecord): number {
    if (party.length === 0) return 0;

    const levels = party.map(id => roster[id]?.level ?? 0);
    const maxLevel = Math.max(...levels);
    
    let missionLevelTier = 0;
    if (maxLevel >= 5) missionLevelTier = 5;
    else if (maxLevel >= 3) missionLevelTier = 3;
    else missionLevelTier = 0;

    let totalHardship = 0;
    for (const level of levels) {
        const hardship = missionLevelTier - level;
        if (hardship > 0) {
            totalHardship += Math.pow(hardship, 3);
        }
    }
    return totalHardship;
}

function scorePartyByAffinity(party: Party, roster: CharacterRecord): number {
  let totalAffinity = 0;
  if (party.length < 2) return 0;

  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1 = roster[party[i]];
      const char2 = roster[party[j]];
      if (!char1 || !char2) continue;
      
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? 3;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? 3;
      totalAffinity += affinity1to2 + affinity2to1;
    }
  }
  return totalAffinity;
}

function scorePartyByPeakAffinity(party: Party, roster: CharacterRecord): number {
  let totalPeakAffinity = 0;
  if (party.length < 2) return 0;

  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1 = roster[party[i]];
      const char2 = roster[party[j]];
      if (!char1 || !char2) continue;
      
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? 3;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? 3;
      
      // The core change: we square the values before adding them.
      // You could use Math.pow(affinity, 3) for an even more extreme effect.
      totalPeakAffinity += Math.pow(affinity1to2, 2) + Math.pow(affinity2to1, 2);
    }
  }
  return totalPeakAffinity;
}

function scorePartyByDiscordPenalty(party: Party, roster: CharacterRecord): number {
  let totalDiscord = 0;
  if (party.length < 2) return 0;
  
  const MAX_AFFINITY = 10; // The top of your affinity scale.

  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1 = roster[party[i]];
      const char2 = roster[party[j]];
      if (!char1 || !char2) continue;
      
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? 3; // Default affinity remains 3
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? 3;

      // Calculate the penalty for each relationship and add it to the total.
      totalDiscord += Math.pow(MAX_AFFINITY - affinity1to2, 2);
      totalDiscord += Math.pow(MAX_AFFINITY - affinity2to1, 2);
    }
  }
  return totalDiscord;
}

// ==================================
// 3. NORMALIZATION & UNIFIED SCORING
// ==================================

/**
 * [NEW] Pre-computes the mean and standard deviation for each scoring strategy
 * based on a RANDOM sample of parties. This is the core of "smart" normalization.
 */
function generateScoringStatistics(
    availableHeroes: string[],
    roster: CharacterRecord,
    partySize: number,
    sampleSize: number
): PartyScoringStatistics {
    const affinityScores: number[] = [];
    const peakAffinityScores: number[] = [];
    const discordPenaltyScores: number[] = []; 
    const levelPenaltyScores: number[] = [];

    // This step MUST remain random to create an unbiased statistical baseline.
    for (let i = 0; i < sampleSize; i++) {
        const shuffled = [...availableHeroes].sort(() => Math.random() - 0.5);
        const randomParty = shuffled.slice(0, partySize);

        affinityScores.push(scorePartyByAffinity(randomParty, roster));
        peakAffinityScores.push(scorePartyByPeakAffinity(randomParty, roster));
        discordPenaltyScores.push(scorePartyByDiscordPenalty(randomParty, roster));
        levelPenaltyScores.push(scorePartyByLevelPenalty(randomParty, roster));
    }

    const calculateStats = (scores: number[]): NormalizationStats => {
        if (scores.length === 0) return { mean: 0, stdDev: 1 };
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const stdDev = Math.sqrt(
            scores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / scores.length
        );
        // Avoid division by zero if all scores are identical.
        return { mean, stdDev: stdDev === 0 ? 1 : stdDev };
    };

    return {
        affinity: calculateStats(affinityScores),
        peakAffinity: calculateStats(peakAffinityScores),
        levelCohesion: calculateStats(levelPenaltyScores),
        discordPenalty: calculateStats(discordPenaltyScores),
    };
}

/**
 * [UPDATED] Calculates a unified, NORMALIZED score for a single party.
 */
function scoreParty(
    party: Party,
    roster: CharacterRecord,
    weights: StrategyWeights,
    stats: PartyScoringStatistics // Now required
): number {
    const rawAffinityScore = scorePartyByAffinity(party, roster);
    const rawLevelPenalty = scorePartyByLevelPenalty(party, roster);

    const normalizedAffinity = (rawAffinityScore - stats.affinity.mean) / stats.affinity.stdDev;
    const normalizedLevelPenalty = (rawLevelPenalty - stats.levelCohesion.mean) / stats.levelCohesion.stdDev;

    // A high level penalty is BAD. A high affinity is GOOD.
    // We subtract the weighted penalty from the weighted benefit.
    const weightedScore =
        (normalizedAffinity * weights.affinity) -
        (normalizedLevelPenalty * weights.levelCohesion);

    return weightedScore;
}

/**
 * [UPDATED] Calculates the total score for an entire composition.
 */
function scoreComposition(
    composition: Composition,
    roster: CharacterRecord,
    weights: StrategyWeights,
    stats: PartyScoringStatistics // Now required
): number {
    return composition.reduce((total, party) => {
        return total + scoreParty(party, roster, weights, stats);
    }, 0);
}

// ==================================
// 4. OPTIMIZER
// ==================================

/**
 * [UPDATED] Finds a high-scoring party composition using specified strategy weights.
 */
export function findBestComposition(
    availableHeroes: string[],
    roster: CharacterRecord,
    customWeights: Partial<StrategyWeights>,
    partySize: number = 4
): Composition {
    const numHeroes = availableHeroes.length;
    const weights = defineWeights(customWeights);

    // --- Dynamic Scaling ---
    // Don't optimize if we can't form at least two parties to swap between.
    if (numHeroes <= partySize) {
        const singleParty = availableHeroes.slice(0, partySize);
        return singleParty.length > 0 ? [singleParty] : [];
    }

    // Scale iterations and samples based on the number of heroes.
    const MIN_ITERATIONS = 250;
    const MAX_ITERATIONS = 5000;
    const ITERATION_FACTOR = 100;
    const iterations = Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, numHeroes * ITERATION_FACTOR));

    const MIN_SAMPLES = 500;
    const MAX_SAMPLES = 4000;
    const SAMPLE_FACTOR = 50;
    const sampleSize = Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, numHeroes * SAMPLE_FACTOR));

    // --- Step 1: Pre-compute Normalization Statistics ---
    const scoringStats = generateScoringStatistics(availableHeroes, roster, partySize, sampleSize);
    console.log(`Using ${iterations} iterations and ${sampleSize} samples for ${numHeroes} heroes.`);
    console.log("Normalization Stats:", scoringStats);

    // --- Step 2: Heuristic Seeding (Smarter Initial Guess) ---
    // Instead of random, sort heroes by level to create a strong starting point.
    const sortedHeroes = [...availableHeroes].sort((aId, bId) => {
        const levelA = roster[aId]?.level ?? 0;
        const levelB = roster[bId]?.level ?? 0;
        return levelB - levelA; // Descending order
    });

    let bestComposition: Composition = [];
    for (let i = 0; i < sortedHeroes.length; i += partySize) {
        bestComposition.push(sortedHeroes.slice(i, i + partySize));
    }
    bestComposition = bestComposition.filter(party => party.length > 0);

    let bestScore = scoreComposition(bestComposition, roster, weights, scoringStats);

    // --- Step 3: Iterate and Improve ---
    for (let i = 0; i < iterations; i++) {
        const currentComposition = JSON.parse(JSON.stringify(bestComposition)) as Composition;

        // Ensure we can actually perform a swap
        if (currentComposition.length < 2) break;

        // Pick two different parties to swap between
        let party1Index = Math.floor(Math.random() * currentComposition.length);
        let party2Index = Math.floor(Math.random() * currentComposition.length);
        while (party1Index === party2Index) {
            party2Index = Math.floor(Math.random() * currentComposition.length);
        }

        // Pick one hero from each party
        const hero1Index = Math.floor(Math.random() * currentComposition[party1Index].length);
        const hero2Index = Math.floor(Math.random() * currentComposition[party2Index].length);

        // Perform the swap
        const heroToSwap1 = currentComposition[party1Index][hero1Index];
        const heroToSwap2 = currentComposition[party2Index][hero2Index];

        currentComposition[party1Index][hero1Index] = heroToSwap2;
        currentComposition[party2Index][hero2Index] = heroToSwap1;

        // Evaluate the new composition
        const newScore = scoreComposition(currentComposition, roster, weights, scoringStats);
        
        if (newScore > bestScore) {
            bestScore = newScore;
            bestComposition = currentComposition;
        }
    }

    return bestComposition;
}