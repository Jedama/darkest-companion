import { CharacterRecord } from '../../../shared/types/types';
import { 
    STRATEGY_REGISTRY, 
    StrategyWeights, 
    PartyScoringStatistics, 
    NormalizationStats,
    generateDefaultWeights
} from './expeditionStrategies/';

// --- DEBUG INFORMATION TYPES ---
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
  
  // Totals for the scored portion of the composition
  partyScopeScore: number;       // The sum of all active party scores
  compositionScopeScore: number; // The unscaled sum of all composition-scoped scores
  scaledPartyScore: number;      // The scaled party score, averaged across all parties and adjusted for composition scope

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
// TYPE DEFINITIONS
// ==================================

export type Party = string[];
export type Composition = Party[];


// This function now works with the dynamically generated StrategyWeights type.
function defineWeights(customWeights: StrategyWeights): Required<StrategyWeights> {
  const defaultWeights = generateDefaultWeights();
  return {
    ...defaultWeights,
    ...customWeights,
  };
}


// ==================================
// NORMALIZATION & UNIFIED SCORING
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
 * Pre-computes stats for each registered strategy.
 */
export function generateScoringStatistics(
    availableHeroes: string[],
    roster: CharacterRecord,
    partySize: number,
    sampleSize: number,
    numPartiesToSample?: number // <-- NEW optional parameter
): PartyScoringStatistics {
    const rawScores: { [id: string]: number[] } = {};
    STRATEGY_REGISTRY.forEach(s => rawScores[s.identifier] = []);

    // Determine the total number of heroes to use for composition sampling.
    // If numPartiesToSample is given, use it. Otherwise, use all available heroes.
    const totalPartiesInRoster = Math.floor(availableHeroes.length / partySize);
    const partiesToCreate = numPartiesToSample ?? totalPartiesInRoster;
    const numHeroesToUse = partiesToCreate * partySize;

    for (let i = 0; i < sampleSize; i++) {
        // We only need one shuffle per outer loop iteration.
        const shuffled = [...availableHeroes].sort(() => Math.random() - 0.5);
        
        for (const strategy of STRATEGY_REGISTRY) {
            
            if (strategy.scope === 'party') {
                // Party-scope sampling is unaffected and can use any heroes.
                const randomParty = shuffled.slice(0, partySize);
                rawScores[strategy.identifier].push(strategy.scorer(randomParty, roster));
            } else { // scope === 'composition'
                // Take a subset of heroes corresponding to the desired number of parties.
                const heroSubset = shuffled.slice(0, numHeroesToUse);

                const randomComposition: Composition = [];
                for (let j = 0; j < heroSubset.length; j += partySize) {
                    const party = heroSubset.slice(j, j + partySize);
                    if (party.length === partySize) { // Ensure only full parties are added
                       randomComposition.push(party);
                    }
                }
                
                // Only score if we actually formed a composition of the correct size.
                if (randomComposition.length === partiesToCreate) {
                    rawScores[strategy.identifier].push(strategy.scorer(randomComposition, roster));
                }
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
 * Calculates a unified score AND generates a detailed analysis object.
 */
function analyzeComposition(
  composition: Composition,
  roster: CharacterRecord,
  weights: Required<StrategyWeights>,
  stats: PartyScoringStatistics,
  partiesToScore?: number
): CompositionDebugInfo {
  // If partiesToScore is not provided, score all of them. Otherwise, take the first N.
  const activeParties = partiesToScore === undefined 
    ? composition 
    : composition.slice(0, partiesToScore);

  let totalPartyScopeScore = 0;
  let totalCompositionScopeScore = 0;

  const debugInfo: CompositionDebugInfo = {
    composition, // Always show the full composition
    finalScore: 0,
    partyScopeScore: 0,
    compositionScopeScore: 0,
    scaledPartyScore: 0,
    parties: [],
    compositionScopeBreakdown: [],
  };

  // --- Process Party-Scoped Strategies ---
  // NOTE: This loop still analyzes ALL parties for the debug breakdown,
  // but we only add the scores of ACTIVE parties to the total.
  const partyStrategies = STRATEGY_REGISTRY.filter(s => s.scope === 'party');
  for (const [index, party] of composition.entries()) {
    let singlePartyScore = 0;
    const partyDebug: PartyDebugInfo = {
      party,
      totalPartyScore: 0,
      breakdown: [],
    };

    for (const strategy of partyStrategies) {
        const weight = weights[strategy.identifier] ?? 0;
        // We still calculate even with weight 0 for complete debug info
        const rawScore = strategy.scorer(party, roster);
        const strategyStats = stats[strategy.identifier];
        const normalizedScore = (rawScore - strategyStats.mean) / (strategyStats.stdDev || 1);
        const directionalMultiplier = strategy.direction === 'maximize' ? 1 : -1;
        const weightedScore = normalizedScore * weight * directionalMultiplier;
        
        if (weight > 0) {
          singlePartyScore += weightedScore;
        }
        
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

    // CRUCIAL: Only add the score to the total if the party is "active"
    if (index < activeParties.length) {
      totalPartyScopeScore += singlePartyScore;
    }
  }

  // --- Process Composition-Scoped Strategies ---
  // This part now operates ONLY on the active subset of parties.
  const compositionStrategies = STRATEGY_REGISTRY.filter(s => s.scope === 'composition');
  for (const strategy of compositionStrategies) {
    const weight = weights[strategy.identifier] ?? 0;
    if (weight === 0) continue;

    // Pass the active subset to the scorer
    const rawScore = strategy.scorer(activeParties, roster);
    const strategyStats = stats[strategy.identifier];
    const normalizedScore = (rawScore - strategyStats.mean) / (strategyStats.stdDev || 1);
    const directionalMultiplier = strategy.direction === 'maximize' ? 1 : -1;
    const weightedScore = normalizedScore * weight * directionalMultiplier;

    totalCompositionScopeScore += weightedScore;

    debugInfo.compositionScopeBreakdown.push({
      strategyId: strategy.identifier,
      strategyName: strategy.name,
      weight,
      rawScore,
      normalizedScore,
      weightedScore,
    });
  }

  // --- Final Score Calculation with Scaling ---
  const numActiveParties = activeParties.length || 1;
  
  // Scale the party-scoped score by averaging it.
  const scaledPartyScore = totalPartyScopeScore / numActiveParties;

  // The final score is the sum of the averaged party score and the (unscaled) composition score.
  const finalScore = scaledPartyScore + (totalCompositionScopeScore * 0.75);

  // Populate the debug info with all the calculated values for clear analysis.
  debugInfo.partyScopeScore = totalPartyScopeScore;
  debugInfo.compositionScopeScore = totalCompositionScopeScore;
  debugInfo.scaledPartyScore = scaledPartyScore;
  debugInfo.finalScore = finalScore;
  
  return debugInfo;
}


// ==================================
// OPTIMIZER
// ==================================

export function findBestComposition(
    availableHeroes: string[],
    roster: CharacterRecord,
    customWeights: StrategyWeights,
    partySize: number = 4,
    partiesToScore?: number
): BestCompositionResult {
    const numHeroes = availableHeroes.length;
    const weights = defineWeights(customWeights);

    if (numHeroes <= partySize) {
        const singleParty = availableHeroes.slice(0, partySize);
        const composition = singleParty.length > 0 ? [singleParty] : [];
        const scoringStats = generateScoringStatistics(availableHeroes, roster, partySize, 500);
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
    
    let bestDebugInfo = analyzeComposition(bestComposition, roster, weights, scoringStats, partiesToScore);
    let bestScore = bestDebugInfo.finalScore;

    // --- Main Optimization Loop with Multiple Move Types ---
    for (let i = 0; i < iterations; i++) {
        const currentComposition = JSON.parse(JSON.stringify(bestComposition)) as Composition;
        const numParties = currentComposition.length;

        if (numParties < 2) break; // Not enough parties to perform any swaps.

        const moveChoice = Math.random();

        // --- MOVE SELECTION ---
        // We'll use a probability distribution to select a move.
        // 60% chance for a Simple Swap (local fine-tuning)
        // 25% chance for a Double Swap (breaking up pairs)
        // 15% chance for a Chain Reaction Swap (major exploration)
        
        // ** Fallback Logic: If a complex move isn't possible (e.g., not enough parties),
        // ** we'll default to a simple swap.

        // --- MOVE 1: Double Swap (25% chance) ---
        if (moveChoice < 0.25 && numParties >= 2) {
            const allPartyIndices = Array.from({ length: numParties }, (_, k) => k);
            const shuffledIndices = allPartyIndices.sort(() => 0.5 - Math.random());
            const [p1_idx, p2_idx] = shuffledIndices.slice(0, 2);

            // Ensure parties have at least 2 heroes for a double swap
            if (currentComposition[p1_idx].length >= 2 && currentComposition[p2_idx].length >= 2) {
                // Select two distinct heroes from party 1
                const h1a_idx = Math.floor(Math.random() * currentComposition[p1_idx].length);
                let h1b_idx = Math.floor(Math.random() * currentComposition[p1_idx].length);
                while (h1b_idx === h1a_idx) {
                    h1b_idx = Math.floor(Math.random() * currentComposition[p1_idx].length);
                }

                // Select two distinct heroes from party 2
                const h2a_idx = Math.floor(Math.random() * currentComposition[p2_idx].length);
                let h2b_idx = Math.floor(Math.random() * currentComposition[p2_idx].length);
                while (h2b_idx === h2a_idx) {
                    h2b_idx = Math.floor(Math.random() * currentComposition[p2_idx].length);
                }

                // Perform the 2-for-2 swap
                const [hero1a, hero1b] = [currentComposition[p1_idx][h1a_idx], currentComposition[p1_idx][h1b_idx]];
                const [hero2a, hero2b] = [currentComposition[p2_idx][h2a_idx], currentComposition[p2_idx][h2b_idx]];
                
                currentComposition[p1_idx][h1a_idx] = hero2a;
                currentComposition[p1_idx][h1b_idx] = hero2b;
                currentComposition[p2_idx][h2a_idx] = hero1a;
                currentComposition[p2_idx][h2b_idx] = hero1b;
            }

        // --- MOVE 2: Chain Reaction Swap (15% chance) ---
        } else if (moveChoice < 0.40 && numParties >= 3) {
            // Determine the length of the chain, from 3 up to all parties
            const chainLength = Math.floor(Math.random() * (numParties - 2)) + 3;

            // Get N unique party indices for the chain
            const allPartyIndices = Array.from({ length: numParties }, (_, k) => k);
            const shuffledIndices = allPartyIndices.sort(() => 0.5 - Math.random());
            const chainIndices = shuffledIndices.slice(0, chainLength);

            // Select one random hero from each party in the chain
            const heroIndices = chainIndices.map(p_idx => Math.floor(Math.random() * currentComposition[p_idx].length));
            const heroesToCycle = chainIndices.map((p_idx, k) => currentComposition[p_idx][heroIndices[k]]);
            
            // Perform the cycle swap (last hero moves to first party, others move forward)
            for (let k = 0; k < chainLength; k++) {
                const sourceHero = heroesToCycle[(k + chainLength - 1) % chainLength]; // Get hero from previous party in the cycle
                const targetPartyIdx = chainIndices[k];
                const targetHeroIdx = heroIndices[k];
                currentComposition[targetPartyIdx][targetHeroIdx] = sourceHero;
            }

        // --- MOVE 3: Simple Swap (60% chance or fallback) ---
        } else {
            const p1_idx = Math.floor(Math.random() * numParties);
            let p2_idx = Math.floor(Math.random() * numParties);
            while (p1_idx === p2_idx) {
                p2_idx = Math.floor(Math.random() * numParties);
            }
            const h1_idx = Math.floor(Math.random() * currentComposition[p1_idx].length);
            const h2_idx = Math.floor(Math.random() * currentComposition[p2_idx].length);
            
            // Perform the simple 1-for-1 swap
            const hero1 = currentComposition[p1_idx][h1_idx];
            const hero2 = currentComposition[p2_idx][h2_idx];
            currentComposition[p1_idx][h1_idx] = hero2;
            currentComposition[p2_idx][h2_idx] = hero1;
        }


        // --- Score the new composition and check for improvement ---
        const currentDebugInfo = analyzeComposition(currentComposition, roster, weights, scoringStats, partiesToScore);
        const newScore = currentDebugInfo.finalScore;

        if (newScore > bestScore) {
            bestScore = newScore;
            bestComposition = currentComposition;
            bestDebugInfo = currentDebugInfo;
        }
    }

    return { composition: bestComposition, debugInfo: bestDebugInfo, scoringStats };
}


// ==================================
// DEBUG FORMATTING UTILITY
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

    // --- Display Normalization Info ---
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
        
        // --- Display Members with Levels ---
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
            "Normalized (Z)": parseFloat(b.normalizedScore.toFixed(2)),
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
            "Normalized (Z)": parseFloat(b.normalizedScore.toFixed(2)),
            "Final Contribution": parseFloat(b.weightedScore.toFixed(2)),
        }));

        console.table(compBreakdownForTable);
    }
    console.log("\n========================================");
}

// expeditionPlanner.ts

/**
 * A "meta" optimizer that wraps findBestComposition.
 * It determines the optimal number of parties to send by iteratively testing
 * if benching a team improves the average quality of the remaining active teams.
 * This version includes a "Diminishing Returns" penalty to incentivize sending
 * more parties.
 * 
 * @returns An object containing the best composition, its debug info, and the recommended number of active parties.
 */
export async function findOptimalArrangement(
    availableHeroes: string[],
    roster: CharacterRecord,
    customWeights: StrategyWeights,
    partySize: number = 4
) {
    // Tunable constant for the benching penalty ---
    // A value of 0.95 means each benched team makes the total score worth 5% less.
    // Raise this value (e.g., to 0.98) to be MORE willing to bench teams.
    // Lower this value (e.g., to 0.90) to be LESS willing to bench teams.
    const BENCH_PENALTY_FACTOR = 0.95; 
    
    const weights = defineWeights(customWeights);
    const completeParties = Math.floor(availableHeroes.length / partySize);

    if (completeParties === 0) {
        console.log("Not enough heroes to form a single complete party.");
        return {
            composition: [availableHeroes],
            debugInfo: null,
            score: -Infinity,
            activePartiesCount: 0,
            scoringStats: null,
        };
    }

    // Determine sample size for stats generation just once.
    const sampleSize = Math.min(4000, Math.max(500, availableHeroes.length * 50));

    // --- Baseline Run: Use stats generated for the FULL number of parties ---
    console.log(`[Meta-Optimizer] Generating stats for baseline (${completeParties} parties)...`);
    const baselineStats = generateScoringStatistics(availableHeroes, roster, partySize, sampleSize, completeParties);
    
    console.log(`[Meta-Optimizer] Baseline run: Optimizing for ${completeParties} active parties.`);
    const baselineResult = findBestComposition(availableHeroes, roster, customWeights, partySize, completeParties);
    const baselineDebugInfo = analyzeComposition(baselineResult.composition, roster, weights, baselineStats, completeParties);

    let overallBest = {
        composition: baselineResult.composition,
        debugInfo: baselineDebugInfo,
        score: baselineDebugInfo.finalScore,
        activePartiesCount: completeParties,
        // Store the stats that correspond to this result for final display
        scoringStats: baselineStats, 
    };
    
    // --- Iterative Benching Runs ---
    for (let numToBench = 1; numToBench < completeParties; numToBench++) {
        const numActive = completeParties - numToBench;
        
        // --- NEW: Generate a dedicated stats object FOR THIS SCENARIO ---
        console.log(`\n[Meta-Optimizer] Generating stats for scenario (${numActive} parties)...`);
        const statsForThisRun = generateScoringStatistics(availableHeroes, roster, partySize, sampleSize, numActive);

        console.log(`[Meta-Optimizer] Testing scenario: Optimizing for ${numActive} active parties.`);

        const heroesForNextRun = overallBest.composition.flat();
        const candidateResult = findBestComposition(heroesForNextRun, roster, customWeights, partySize, numActive);
        
        // --- NEW: Use the DEDICATED stats object for analysis ---
        const candidateDebugInfo = analyzeComposition(candidateResult.composition, roster, weights, statsForThisRun, numActive);
        const candidateScore = candidateDebugInfo.finalScore;

        const candidatePenalty = Math.pow(BENCH_PENALTY_FACTOR, numToBench);
        const adjustedCandidateScore = candidateScore * candidatePenalty;
        
        const prevNumBenched = completeParties - overallBest.activePartiesCount;
        const bestSoFarPenalty = Math.pow(BENCH_PENALTY_FACTOR, prevNumBenched);
        const adjustedBestScore = overallBest.score * bestSoFarPenalty;
        
        console.log(`> Result for ${numActive} parties: ${candidateScore.toFixed(4)} (Adjusted: ${adjustedCandidateScore.toFixed(4)}). Best adjusted so far: ${adjustedBestScore.toFixed(4)}`);
        
        if (adjustedCandidateScore > adjustedBestScore) {
            console.log(`---> New best strategy found! Benching ${numToBench} team(s) improves average quality.`);
            overallBest = {
                composition: candidateResult.composition,
                debugInfo: candidateDebugInfo,
                score: candidateScore,
                activePartiesCount: numActive,
                // NEW: Store the correct stats for the new best result
                scoringStats: statsForThisRun, 
            };
        } else {
            console.log(`---> Benching did not improve average party quality enough to justify the cost. Sticking with ${overallBest.activePartiesCount} active parties.`);
            break; 
        }
    }

    console.log("\n--- OPTIMIZATION COMPLETE ---");
    console.log(`Final Recommendation: Send ${overallBest.activePartiesCount} out of ${Math.ceil(availableHeroes.length / partySize)} parties.`);

    return overallBest;
}