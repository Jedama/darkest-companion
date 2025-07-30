import { CharacterRecord } from '../../../shared/types/types';
import { 
    STRATEGY_REGISTRY, 
    StrategyWeights, 
    PartyScoringStatistics, 
    NormalizationStats,
    StrategyDefinition
} from './expeditionStrategies';

// --- NEW: DEBUG INFORMATION TYPES ---
// These types structure the detailed breakdown of the scoring.

/**
 * Breakdown of a single strategy's contribution to a score.
 */
export interface StrategyScoreBreakdown {
  strategyId: string;
  strategyName: string;
  weight: number;
  rawScore: number;
  normalizedScore: number;
  // The final score contribution after applying weight and direction.
  weightedScore: number; 
}

/**
 * Detailed scoring analysis for a single party.
 */
export interface PartyDebugInfo {
  party: Party;
  totalPartyScore: number;
  // A breakdown of how each party-scoped strategy contributed.
  breakdown: StrategyScoreBreakdown[];
}

/**
 * The complete debug object for an entire composition.
 */
export interface CompositionDebugInfo {
  composition: Composition;
  finalScore: number;
  // Analysis for each party in the composition.
  parties: PartyDebugInfo[];
  // Analysis for strategies that score the composition as a whole.
  compositionScopeBreakdown: StrategyScoreBreakdown[];
}

/**
 * The new, more informative return type for our main function.
 */
export interface BestCompositionResult {
    composition: Composition;
    debugInfo: CompositionDebugInfo;
    scoringStats: PartyScoringStatistics; // Optional stats for further analysis
}

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
  minimizeLevelHardship: 10,
  maximizeGameplaySynergy: 2,
  maximizeAffinity: 1,
  maximizePeakAffinity: 0,
  minimizeDiscord: 0,
  balanceAuthority: 0,
  maximizeChildGuardianship: 0,
  maximizeCommandClarity: 0,
  maximizeCommandClarity_Heiress: 0,
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
 * [REPLACED] The old calculateCompositionScore is now this more powerful function.
 * Calculates a unified score AND generates a detailed analysis object.
 */
function analyzeComposition(
  composition: Composition,
  roster: CharacterRecord,
  weights: Required<StrategyWeights>,
  stats: PartyScoringStatistics
): CompositionDebugInfo {
  let totalWeightedScore = 0;
  const debugInfo: CompositionDebugInfo = {
    composition,
    finalScore: 0,
    parties: [],
    compositionScopeBreakdown: [],
  };

  // --- Process Party-Scoped Strategies ---
  const partyStrategies = STRATEGY_REGISTRY.filter(s => s.scope === 'party');
  for (const party of composition) {
    let singlePartyScore = 0;
    const partyDebug: PartyDebugInfo = {
      party,
      totalPartyScore: 0,
      breakdown: [],
    };

    for (const strategy of partyStrategies) {
        const weight = weights[strategy.identifier] ?? 0;
        if (weight === 0) continue;

        const rawScore = strategy.scorer(party, roster);
        const strategyStats = stats[strategy.identifier];
        const normalizedScore = (rawScore - strategyStats.mean) / (strategyStats.stdDev || 1);
        const directionalMultiplier = strategy.direction === 'maximize' ? 1 : -1;
        const weightedScore = normalizedScore * weight * directionalMultiplier;
        
        singlePartyScore += weightedScore;
        
        partyDebug.breakdown.push({
          strategyId: strategy.identifier,
          strategyName: strategy.name,
          weight,
          rawScore,
          normalizedScore,
          weightedScore,
        });
    }
    partyDebug.totalPartyScore = singlePartyScore;
    debugInfo.parties.push(partyDebug);
    totalWeightedScore += singlePartyScore;
  }

  // --- Process Composition-Scoped Strategies ---
  const compositionStrategies = STRATEGY_REGISTRY.filter(s => s.scope === 'composition');
  for (const strategy of compositionStrategies) {
    const weight = weights[strategy.identifier] ?? 0;
    if (weight === 0) continue;

    const rawScore = strategy.scorer(composition, roster);
    const strategyStats = stats[strategy.identifier];
    const normalizedScore = (rawScore - strategyStats.mean) / (strategyStats.stdDev || 1);
    const directionalMultiplier = strategy.direction === 'maximize' ? 1 : -1;
    const weightedScore = normalizedScore * weight * directionalMultiplier;

    totalWeightedScore += weightedScore;

    debugInfo.compositionScopeBreakdown.push({
      strategyId: strategy.identifier,
      strategyName: strategy.name,
      weight,
      rawScore,
      normalizedScore,
      weightedScore,
    });
  }
  
  debugInfo.finalScore = totalWeightedScore;
  return debugInfo;
}


// ==================================
// 4. OPTIMIZER (Now uses the new structures)
// ==================================

export function findBestComposition(
    availableHeroes: string[],
    roster: CharacterRecord,
    customWeights: StrategyWeights,
    partySize: number = 4
): BestCompositionResult { // <-- Updated return type
    const numHeroes = availableHeroes.length;
    const weights = defineWeights(customWeights);

    if (numHeroes <= partySize) {
        const singleParty = availableHeroes.slice(0, partySize);
        const composition = singleParty.length > 0 ? [singleParty] : [];
        // Even for this simple case, we generate debug info.
        const scoringStats = generateScoringStatistics(availableHeroes, roster, partySize, 500); // Small sample is fine
        const debugInfo = analyzeComposition(composition, roster, weights, scoringStats);
        return { composition, debugInfo, scoringStats };
    }

    const MIN_ITERATIONS = 250, MAX_ITERATIONS = 50000, ITERATION_FACTOR = 200;
    const iterations = Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, numHeroes * ITERATION_FACTOR));
    const MIN_SAMPLES = 500, MAX_SAMPLES = 40000, SAMPLE_FACTOR = 100;
    const sampleSize = Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, numHeroes * SAMPLE_FACTOR));
    
    const scoringStats = generateScoringStatistics(availableHeroes, roster, partySize, sampleSize);
    
    const sortedHeroes = [...availableHeroes].sort((a, b) => (roster[b]?.level ?? 0) - (roster[a]?.level ?? 0));
    let bestComposition: Composition = [];
    for (let i = 0; i < sortedHeroes.length; i += partySize) {
        bestComposition.push(sortedHeroes.slice(i, i + partySize));
    }
    bestComposition = bestComposition.filter(party => party.length > 0);
    
    // --- Store the full debug object for the best result ---
    let bestDebugInfo = analyzeComposition(bestComposition, roster, weights, scoringStats);
    let bestScore = bestDebugInfo.finalScore;

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

        // --- Get the full analysis for the new composition ---
        const currentDebugInfo = analyzeComposition(currentComposition, roster, weights, scoringStats);
        const newScore = currentDebugInfo.finalScore;

        if (newScore > bestScore) {
            bestScore = newScore;
            bestComposition = currentComposition;
            bestDebugInfo = currentDebugInfo; // <-- Save the new best debug info
        }
    }

    // --- Return the comprehensive result object ---
    return { composition: bestComposition, debugInfo: bestDebugInfo, scoringStats };
}


// ==================================
// 5. DEBUG FORMATTING UTILITY (Updated)
// ==================================

/**
 * A handy utility to print the debug information to the console in a readable format.
 */
export function formatDebugInfoForConsole(
    debugInfo: CompositionDebugInfo,
    roster: CharacterRecord, // NEW: Pass in the roster to get character details
    stats: PartyScoringStatistics // NEW: Pass in the stats to show normalization info
): void {
    console.log("========================================");
    console.log("== EXPEDITION COMPOSITION ANALYSIS ==");
    console.log("========================================");

    // --- NEW: Display Normalization Info ---
    console.log("\n--- Normalization Baseline (Mean / StdDev) ---");
    const statsForTable = Object.entries(stats).map(([id, stat]) => ({
        "Strategy": STRATEGY_REGISTRY.find(s => s.identifier === id)?.name || id,
        "Mean Raw Score": parseFloat(stat.mean.toFixed(2)),
        "Std. Deviation": parseFloat(stat.stdDev.toFixed(2)),
        // Approximate the min/max seen during sampling for context
        "Approx. Min Seen": parseFloat(Math.max(0, stat.mean - 2 * stat.stdDev).toFixed(2)),
        "Approx. Max Seen": parseFloat((stat.mean + 2 * stat.stdDev).toFixed(2)),
    }));
    console.table(statsForTable);

    console.log(`\nFINAL COMPOSITION SCORE: ${debugInfo.finalScore.toFixed(4)}`);

    debugInfo.parties.forEach((partyInfo, index) => {
        console.log("\n----------------------------------------");
        
        // --- NEW: Display Members with Levels ---
        const memberDetails = partyInfo.party.map(id => {
            const char = roster[id];
            return char ? `${char.name} (Lvl ${char.level})` : 'Unknown Hero';
        }).join(', ');

        console.log(`PARTY ${index + 1} | Score: ${partyInfo.totalPartyScore.toFixed(4)}`);
        console.log(`Members: ${memberDetails}`);
        console.log("----------------------------------------");
        
        const breakdownForTable = partyInfo.breakdown.map(b => ({
            "Strategy": b.strategyName,
            "Weight": b.weight,
            "Raw Score": parseFloat(b.rawScore.toFixed(2)),
            "Normalized (Z)": parseFloat(b.normalizedScore.toFixed(2)), // Renamed for clarity
            "Final Contribution": parseFloat(b.weightedScore.toFixed(2)),
        }));

        console.table(breakdownForTable);
    });

    if (debugInfo.compositionScopeBreakdown.length > 0) {
        console.log("\n----------------------------------------");
        console.log("COMPOSITION-WIDE SCORES");
        console.log("----------------------------------------");
        
        const compBreakdownForTable = debugInfo.compositionScopeBreakdown.map(b => ({
            "Strategy": b.strategyName,
            "Weight": b.weight,
            "Raw Score": parseFloat(b.rawScore.toFixed(2)),
            "Normalized (Z)": parseFloat(b.normalizedScore.toFixed(2)), // Renamed for clarity
            "Final Contribution": parseFloat(b.weightedScore.toFixed(2)),
        }));

        console.table(compBreakdownForTable);
    }
    console.log("\n========================================");
}