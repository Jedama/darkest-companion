import { CharacterRecord } from '../../../shared/types/types';
import { 
    STRATEGY_REGISTRY, 
    StrategyWeights, 
    PartyScoringStatistics, 
    NormalizationStats
} from './expeditionStrategies';

// ==================================
// 1. TYPE DEFINITIONS (Most are now imported)
// ==================================

export type Party = string[];
export type Composition = Party[];

// ==================================
// 2. WEIGHTS CONFIGURATION
// ==================================

// The default weights now use the new, descriptive IDs.
const defaultWeights: Required<StrategyWeights> = {
  minimizeLevelHardship: 5,
  maximizeGameplaySynergy: 3,
  maximizeAffinity: 1,
  maximizePeakAffinity: 0,
  minimizeDiscord: 0,
  balanceAuthority: 0,
};

// This function now works with the dynamically generated StrategyWeights type.
function defineWeights(customWeights: StrategyWeights): Required<StrategyWeights> {
    return {
        ...defaultWeights,
        ...customWeights,
    };
}


// ==================================
// 3. NORMALIZATION & UNIFIED SCORING
// ==================================

// Helper function (can be in this file or the strategies file)
const calculateStats = (scores: number[]): NormalizationStats => {
    if (scores.length === 0) return { mean: 0, stdDev: 1 };
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const stdDev = Math.sqrt(
        scores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / scores.length
    );
    return { mean, stdDev: stdDev === 0 ? 1 : stdDev };
};

/**
 * [REFACTORED] Pre-computes stats for each registered strategy.
 */
function generateScoringStatistics(
    availableHeroes: string[],
    roster: CharacterRecord,
    partySize: number,
    sampleSize: number
): PartyScoringStatistics {
    const rawScores: { [id: string]: number[] } = {};
    STRATEGY_REGISTRY.forEach(s => rawScores[s.identifier] = []);

    for (let i = 0; i < sampleSize; i++) {
        // We only need one shuffle per outer loop iteration.
        const shuffled = [...availableHeroes].sort(() => Math.random() - 0.5);
        
        for (const strategy of STRATEGY_REGISTRY) {
            
            // Check the scope to generate the correct sample type.
            if (strategy.scope === 'party') {
                const randomParty = shuffled.slice(0, partySize);
                // The 'as Party' cast is safe because we know the scope.
                rawScores[strategy.identifier].push(strategy.scorer(randomParty, roster));
            } else { // scope === 'composition'
                const randomComposition: Composition = [];
                for (let j = 0; j < shuffled.length; j += partySize) {
                    randomComposition.push(shuffled.slice(j, j + partySize));
                }
                // The 'as Composition' cast is safe because we know the scope.
                rawScores[strategy.identifier].push(strategy.scorer(randomComposition, roster));
            }
        }
    }
    
    // Now calculate the statistics for each strategy.
    const statistics = {} as PartyScoringStatistics;
    for (const strategy of STRATEGY_REGISTRY) {
        statistics[strategy.identifier] = calculateStats(rawScores[strategy.identifier]);
    }
    return statistics;
}

/**
 * [REFACTORED] Calculates a unified, NORMALIZED score for the ENTIRE COMPOSITION.
 * This is now the main scoring function, replacing the old scoreParty and scoreComposition.
 */
function calculateCompositionScore(
  composition: Composition,
  roster: CharacterRecord,
  weights: Required<StrategyWeights>,
  stats: PartyScoringStatistics
): number {
  let totalWeightedScore = 0;

  // --- Process Party-Scoped Strategies ---
  const partyStrategies = STRATEGY_REGISTRY.filter(s => s.scope === 'party');
  let totalPartyScore = 0;
  for (const party of composition) {
    let singlePartyScore = 0;
    for (const strategy of partyStrategies) {
        const weight = weights[strategy.identifier] ?? 0;
        if (weight === 0) continue;

        const rawScore = strategy.scorer(party, roster);
        const strategyStats = stats[strategy.identifier];
        const normalizedScore = (rawScore - strategyStats.mean) / (strategyStats.stdDev || 1);
        const directionalMultiplier = strategy.direction === 'maximize' ? 1 : -1;
        
        singlePartyScore += normalizedScore * weight * directionalMultiplier;
    }
    totalPartyScore += singlePartyScore;
  }
  totalWeightedScore += totalPartyScore;

  // --- Process Composition-Scoped Strategies ---
  const compositionStrategies = STRATEGY_REGISTRY.filter(s => s.scope === 'composition');
  for (const strategy of compositionStrategies) {
    const weight = weights[strategy.identifier] ?? 0;
    if (weight === 0) continue;

    const rawScore = strategy.scorer(composition, roster);
    const strategyStats = stats[strategy.identifier];
    const normalizedScore = (rawScore - strategyStats.mean) / (strategyStats.stdDev || 1);
    const directionalMultiplier = strategy.direction === 'maximize' ? 1 : -1;
    
    totalWeightedScore += normalizedScore * weight * directionalMultiplier;
  }

  return totalWeightedScore;
}


// ==================================
// 4. OPTIMIZER (Now uses the new structures)
// ==================================

export function findBestComposition(
    availableHeroes: string[],
    roster: CharacterRecord,
    customWeights: StrategyWeights, // Can accept partial weights
    partySize: number = 4
): Composition {
    const numHeroes = availableHeroes.length;
    // The first thing we do is establish the final, complete weights object.
    const weights = defineWeights(customWeights);

    if (numHeroes <= partySize) {
        const singleParty = availableHeroes.slice(0, partySize);
        return singleParty.length > 0 ? [singleParty] : [];
    }

    // --- Dynamic Scaling ---
    const MIN_ITERATIONS = 250, MAX_ITERATIONS = 5000, ITERATION_FACTOR = 100;
    const iterations = Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, numHeroes * ITERATION_FACTOR));
    const MIN_SAMPLES = 500, MAX_SAMPLES = 4000, SAMPLE_FACTOR = 50;
    const sampleSize = Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, numHeroes * SAMPLE_FACTOR));
    
    // --- Step 1: Pre-compute Normalization Statistics ---
    const scoringStats = generateScoringStatistics(availableHeroes, roster, partySize, sampleSize);
    
    // --- Step 2: Heuristic Seeding ---
    const sortedHeroes = [...availableHeroes].sort((a, b) => (roster[b]?.level ?? 0) - (roster[a]?.level ?? 0));
    let bestComposition: Composition = [];
    for (let i = 0; i < sortedHeroes.length; i += partySize) {
        bestComposition.push(sortedHeroes.slice(i, i + partySize));
    }
    bestComposition = bestComposition.filter(party => party.length > 0);
    let bestScore = calculateCompositionScore(bestComposition, roster, weights, scoringStats);

    // --- Step 3: Iterate and Improve (Simulated Annealing style) ---
    // (The logic here remains the same, as it was already generic)
    for (let i = 0; i < iterations; i++) {
        const currentComposition = JSON.parse(JSON.stringify(bestComposition)) as Composition;
        if (currentComposition.length < 2) break;

        let p1_idx = Math.floor(Math.random() * currentComposition.length);
        let p2_idx = Math.floor(Math.random() * currentComposition.length);
        while (p1_idx === p2_idx) {
            p2_idx = Math.floor(Math.random() * currentComposition.length);
        }

        const h1_idx = Math.floor(Math.random() * currentComposition[p1_idx].length);
        const h2_idx = Math.floor(Math.random() * currentComposition[p2_idx].length);
        
        const hero1 = currentComposition[p1_idx][h1_idx];
        const hero2 = currentComposition[p2_idx][h2_idx];
        currentComposition[p1_idx][h1_idx] = hero2;
        currentComposition[p2_idx][h2_idx] = hero1;

        const newScore = calculateCompositionScore(currentComposition, roster, weights, scoringStats);
        if (newScore > bestScore) {
            bestScore = newScore;
            bestComposition = currentComposition;
        }
    }

    return bestComposition;
}