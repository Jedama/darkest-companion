//server/services/townHall/expeditionPlanner.ts
import { CharacterRecord } from '../../../shared/types/types';
import { PARTY_SIZE } from '../../../shared/constants/expedition';
import { 
  STRATEGY_REGISTRY, 
  StrategyWeights, 
  PartyScoringStatistics, 
  NormalizationStats,
  generateDefaultWeights
} from './expeditionStrategies/';

// --- DEBUG INFORMATION TYPES ---
// These types structure the detailed breakdown of the scoring.

const CONSISTENCY_WEIGHT = 0.5; // Tunable constant for consistency penalty in scoring
const MASTER_PARTY_WEIGHT = 1.0; // Master weight for party scores
const MASTER_COMPOSITION_WEIGHT = 0.85;

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

/**
 * Return shape of the meta-optimizer. debugInfo/scoringStats are null only in the
 * degenerate path where there aren't enough heroes to form a single party.
 */
export interface OptimalArrangementResult {
    composition: Composition;
    debugInfo: CompositionDebugInfo | null;
    score: number;
    activePartiesCount: number;
    scoringStats: PartyScoringStatistics | null;
}

// ==================================
// TYPE DEFINITIONS
// ==================================

export type Party = string[];
export type Composition = Party[];

const VALID_STRATEGY_IDS = new Set(STRATEGY_REGISTRY.map(s => s.identifier));

// This function now works with the dynamically generated StrategyWeights type.
function defineWeights(customWeights: StrategyWeights): Required<StrategyWeights> {
  const defaultWeights = generateDefaultWeights();
  const sanitizedCustomWeights: StrategyWeights = {};

  // Validate and sanitize the custom weights against the valid strategy IDs.
  for (const key in customWeights) {
    const strategyId = key as keyof StrategyWeights;

    if (VALID_STRATEGY_IDS.has(strategyId)) {
      // If the key is valid, add it to our sanitized object.
      sanitizedCustomWeights[strategyId] = customWeights[strategyId];
    } else {
      // If the key is invalid, issue a warning and DO NOT add it.
      console.warn(
        `[Strategy Warning] An invalid strategy identifier was provided in customWeights: "${strategyId}". ` +
        `This weight will be ignored. Please check for typos or ensure the strategy is registered.`
      );
    }
  }

  // Merge the sanitized custom weights with the default weights.
  return {
    ...defaultWeights,
    ...sanitizedCustomWeights,
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
// ==================================
// LOW-LEVEL HELPERS (shuffling & moves)
// ==================================

/**
 * Uniform in-place Fisher–Yates shuffle. Returns the same array for convenience.
 * Replaces the old `sort(() => Math.random() - 0.5)` idiom, which is NOT a uniform
 * shuffle and was biasing the normalization sampling.
 */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks `k` distinct indices in [0, n) uniformly at random via a partial
 * Fisher–Yates shuffle. If k >= n, returns all indices in shuffled order.
 */
function pickDistinctIndices(n: number, k: number): number[] {
  const pool = Array.from({ length: n }, (_, idx) => idx);
  const count = Math.min(k, n);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (n - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/**
 * Applies one random neighbourhood move to `comp` IN PLACE and returns an `undo()`
 * closure that exactly reverts it. Only the touched cells are snapshotted, so both
 * applying and undoing are O(move size) rather than O(roster). This is what lets the
 * annealing loop avoid deep-cloning the whole composition on every iteration.
 *
 * Distribution: ~25% double swap, ~15% chain reaction (needs >=3 parties), the rest
 * simple swaps. Complex moves fall back to a simple swap if the structure can't
 * support them. Callers must ensure `comp.length >= 2` (guaranteed by the loop guard).
 */
function applyRandomMove(comp: Composition): () => void {
  const numParties = comp.length;
  const touched: { p: number; i: number; v: string }[] = [];
  const record = (p: number, i: number) => { touched.push({ p, i, v: comp[p][i] }); };
  const restore = () => { for (const c of touched) comp[c.p][c.i] = c.v; };

  const moveChoice = Math.random();

  // --- Double swap (2-for-2 between two parties) ---
  if (moveChoice < 0.25 && numParties >= 2) {
    const [p1, p2] = pickDistinctIndices(numParties, 2);
    if (comp[p1].length >= 2 && comp[p2].length >= 2) {
      const [h1a, h1b] = pickDistinctIndices(comp[p1].length, 2);
      const [h2a, h2b] = pickDistinctIndices(comp[p2].length, 2);
      record(p1, h1a); record(p1, h1b); record(p2, h2a); record(p2, h2b);
      const t1 = comp[p1][h1a], t2 = comp[p1][h1b];
      comp[p1][h1a] = comp[p2][h2a];
      comp[p1][h1b] = comp[p2][h2b];
      comp[p2][h2a] = t1;
      comp[p2][h2b] = t2;
      return restore;
    }
    // party too small: fall through to a simple swap
  }
  // --- Chain reaction (rotate one hero through >=3 parties) ---
  else if (moveChoice < 0.40 && numParties >= 3) {
    const chainLength = Math.floor(Math.random() * (numParties - 2)) + 3;
    const chainParties = pickDistinctIndices(numParties, chainLength);
    const heroIdx = chainParties.map(p => Math.floor(Math.random() * comp[p].length));
    const originals = chainParties.map((p, k) => comp[p][heroIdx[k]]);
    const len = chainParties.length;
    for (let k = 0; k < len; k++) record(chainParties[k], heroIdx[k]);
    for (let k = 0; k < len; k++) {
      comp[chainParties[k]][heroIdx[k]] = originals[(k + len - 1) % len];
    }
    return restore;
  }

  // --- Simple swap (1-for-1) — default and universal fallback ---
  const [p1, p2] = pickDistinctIndices(numParties, 2);
  const h1 = Math.floor(Math.random() * comp[p1].length);
  const h2 = Math.floor(Math.random() * comp[p2].length);
  record(p1, h1); record(p2, h2);
  const tmp = comp[p1][h1];
  comp[p1][h1] = comp[p2][h2];
  comp[p2][h2] = tmp;
  return restore;
}

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
    const shuffled = shuffleInPlace([...availableHeroes]);
    
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

  /**
   * A simple stats calculator for the final score analysis.
   * Unlike the global `calculateStats`, this allows for a stdDev of 0.
   */
  const calculateFinalScoreDistribution = (scores: number[]): NormalizationStats => {
    if (scores.length < 2) return { mean: scores[0] || 0, stdDev: 0 };
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const stdDev = Math.sqrt(
      scores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / scores.length
    );
    return { mean, stdDev }; // No guard for stdDev === 0
  };

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

  // 1. Get an array of the individual party scores
  const partyScores = debugInfo.parties
    .slice(0, activeParties.length) // Only consider active parties
    .map(p => p.totalPartyScore);
  
  // 2. Calculate their mean and standard deviation
  const scoreStats = calculateFinalScoreDistribution(partyScores); // We already have this helper!
  
  // 3. Define the new final score
  const scoreMean = scoreStats.mean;
  const scoreStdDev = scoreStats.stdDev;
  
  // The final score is the mean, penalized by its standard deviation.
  // The `0.5` is a tunable "consistency weight". Higher values penalize inconsistency more.
  const consistencyPenalty = scoreStdDev * CONSISTENCY_WEIGHT; 
  // 4. Apply the penalty to BOTH components
  const partyComponent = scoreMean; // Start with the pure average
  const compositionComponent = totalCompositionScopeScore; // Start with the pure comp score

  // The final score is the sum of the components, BOTH reduced by the same penalty.
  // (We could also add them first and then subtract the penalty once, the math is the same)
  const finalScore_metaWeighted = 
    (partyComponent * MASTER_PARTY_WEIGHT) + 
    (compositionComponent * MASTER_COMPOSITION_WEIGHT) - 
    consistencyPenalty; // The penalty is applied to the final combined result.

  // Populate debug info...
  debugInfo.partyScopeScore = partyComponent;
  debugInfo.compositionScopeScore = compositionComponent; 
  // It would be good to add the penalty to the debug info!
  // debugInfo.consistencyPenalty = consistencyPenalty; 
  debugInfo.finalScore = finalScore_metaWeighted; // Or the simpler version
  
  return debugInfo;
}


// ==================================
// OPTIMIZER
// ==================================

/**
 * HELPER: Checks if all numeric values in the weights object are zero.
 */
export function areAllWeightsZero(weights: Required<StrategyWeights>): boolean {
  for (const key in weights) {
    if (typeof weights[key] === 'number' && weights[key] !== 0) {
      return false; // Found a non-zero weight, so we can stop.
    }
  }
  return true; // No non-zero weights were found.
}

export function findBestComposition(
  availableHeroes: string[],
  roster: CharacterRecord,
  customWeights: StrategyWeights,
  partySize: number = PARTY_SIZE,
  partiesToScore?: number
): BestCompositionResult {
  const numHeroes = availableHeroes.length;
  const weights = defineWeights(customWeights); 

  if (areAllWeightsZero(weights)) {
    console.warn(
      "[Optimizer Warning] All strategy weights are zero. " +
      "Optimization has been skipped. Returning a default composition sorted by level."
    );
    
    // Create the sensible default composition
    const sortedHeroes = [...availableHeroes].sort((a, b) => (roster[b]?.level ?? 0) - (roster[a]?.level ?? 0));
    let defaultComposition: Composition = [];
    for (let i = 0; i < sortedHeroes.length; i += partySize) {
      defaultComposition.push(sortedHeroes.slice(i, i + partySize));
    }
    defaultComposition = defaultComposition.filter(party => party.length > 0);

    // We still need to generate stats and analyze the composition once for a valid return object.
    const scoringStats = generateScoringStatistics(availableHeroes, roster, partySize, 500); // Small sample size is fine
    const debugInfo = analyzeComposition(defaultComposition, roster, weights, scoringStats, partiesToScore);

    // Return immediately, skipping the optimization loop
    return { composition: defaultComposition, debugInfo, scoringStats };
  }

  if (numHeroes <= partySize) {
    const singleParty = availableHeroes.slice(0, partySize);
    const composition = singleParty.length > 0 ? [singleParty] : [];
    const scoringStats = generateScoringStatistics(availableHeroes, roster, partySize, 500);
    const debugInfo = analyzeComposition(composition, roster, weights, scoringStats);
    return { composition, debugInfo, scoringStats };
  }  
  // --- Adaptive iteration & sampling budgets (heuristics unchanged) ---
  const MIN_ITERATIONS = 250, MAX_ITERATIONS = 50000, ITERATION_FACTOR = 200;
  const iterations = Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, numHeroes * ITERATION_FACTOR));
  const MIN_SAMPLES = 500, MAX_SAMPLES = 40000, SAMPLE_FACTOR = 100;
  const sampleSize = Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, numHeroes * SAMPLE_FACTOR));

  // Align the normalization baseline with the number of parties we actually score.
  // (Previously the stats sampled full-roster compositions even when only a subset was
  //  scored, so composition-scope strategies were normalized against the wrong shape.)
  const completeParties = Math.floor(numHeroes / partySize);
  const partiesToSample = partiesToScore ?? completeParties;
  const scoringStats = generateScoringStatistics(availableHeroes, roster, partySize, sampleSize, partiesToSample);

  // --- Build the initial composition (level-sorted seed) ---
  const sortedHeroes = [...availableHeroes].sort((a, b) => (roster[b]?.level ?? 0) - (roster[a]?.level ?? 0));
  let current: Composition = [];
  for (let i = 0; i < sortedHeroes.length; i += partySize) {
    current.push(sortedHeroes.slice(i, i + partySize));
  }
  current = current.filter(party => party.length > 0);

  // `current` is the wandering incumbent; `best` is the best composition seen so far.
  let currentScore = analyzeComposition(current, roster, weights, scoringStats, partiesToScore).finalScore;
  let best: Composition = current.map(party => [...party]);
  let bestScore = currentScore;
  let bestDebugInfo = analyzeComposition(best, roster, weights, scoringStats, partiesToScore);

  // With fewer than two parties there are no swaps to make.
  if (current.length < 2) {
    return { composition: best, debugInfo: bestDebugInfo, scoringStats };
  }

  // --- Auto-calibrate the initial temperature from the score landscape ---
  // Probe a handful of random moves to learn the typical |delta|, then set the start
  // temperature so a typical *worsening* move is accepted with probability
  // TARGET_INITIAL_ACCEPTANCE. This keeps the schedule scale-invariant: it adapts to
  // whatever magnitude the active weights / normalization happen to produce.
  const TARGET_INITIAL_ACCEPTANCE = 0.8;
  const COOLING_TARGET_RATIO = 1e-3; // end temperature ~= start * this
  const BURN_IN = Math.min(200, Math.max(20, Math.floor(iterations * 0.02)));

  let deltaSum = 0, deltaCount = 0;
  for (let b = 0; b < BURN_IN; b++) {
    const undo = applyRandomMove(current);
    const probeScore = analyzeComposition(current, roster, weights, scoringStats, partiesToScore).finalScore;
    const d = Math.abs(probeScore - currentScore);
    if (d > 0) { deltaSum += d; deltaCount++; }
    undo(); // a probe must not move the incumbent
  }
  const avgDelta = deltaCount > 0 ? deltaSum / deltaCount : 1;
  let temperature = -avgDelta / Math.log(TARGET_INITIAL_ACCEPTANCE);
  if (!isFinite(temperature) || temperature <= 0) temperature = 1; // degenerate landscape fallback
  const coolingRate = Math.pow(COOLING_TARGET_RATIO, 1 / iterations);

  // --- Simulated annealing main loop ---
  for (let i = 0; i < iterations; i++) {
    const undo = applyRandomMove(current);                 // mutate in place
    const candidateInfo = analyzeComposition(current, roster, weights, scoringStats, partiesToScore);
    const candidateScore = candidateInfo.finalScore;
    const delta = candidateScore - currentScore;           // > 0 means improvement (we maximize)

    // Metropolis acceptance: always take improvements, sometimes step downhill to escape local optima.
    const accept = delta > 0 || Math.random() < Math.exp(delta / temperature);

    if (accept) {
      currentScore = candidateScore;
      if (candidateScore > bestScore) {
        // New global best. Cloning here is cheap (only happens on improvement). We recompute
        // the debug info against the *clone* so later mutations of `current` can never alias
        // into the stored best.
        bestScore = candidateScore;
        best = current.map(party => [...party]);
        bestDebugInfo = analyzeComposition(best, roster, weights, scoringStats, partiesToScore);
      }
    } else {
      undo(); // reject: revert the in-place move, no fresh allocation
    }

    temperature *= coolingRate;
  }

  return { composition: best, debugInfo: bestDebugInfo, scoringStats };
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
    partySize: number = PARTY_SIZE
): Promise<OptimalArrangementResult> {
    // Tunable constant for the benching penalty ---
    // A value of 0.95 means each benched team makes the total score worth 5% less.
    // Raise this value (e.g., to 0.98) to be MORE willing to bench teams.
    // Lower this value (e.g., to 0.90) to be LESS willing to bench teams.
    const BENCH_PENALTY_FACTOR = 0.95; 
    
    const weights = defineWeights(customWeights);
    const completeParties = Math.floor(availableHeroes.length / partySize);

    // --- TOP-LEVEL FAST PATH FOR ZERO WEIGHTS ---
    if (areAllWeightsZero(weights)) {
      console.warn(
        "[Meta-Optimizer Warning] All strategy weights are zero. " +
        "Optimization and benching analysis have been skipped. " +
        "Returning a default composition with all available parties."
      );

      // Create the sensible default (send everyone)
      const sortedHeroes = [...availableHeroes].sort((a, b) => (roster[b]?.level ?? 0) - (roster[a]?.level ?? 0));
      let defaultComposition: Composition = [];
      for (let i = 0; i < sortedHeroes.length; i += partySize) {
        defaultComposition.push(sortedHeroes.slice(i, i + partySize));
      }
      defaultComposition = defaultComposition.filter(party => party.length > 0);
      
      // We still need a valid report, so we run analysis once.
      const stats = generateScoringStatistics(availableHeroes, roster, partySize, 500, completeParties);
      const debugInfo = analyzeComposition(defaultComposition, roster, weights, stats, completeParties);

      // Return the complete default result immediately
      return {
        composition: defaultComposition,
        debugInfo: debugInfo,
        score: debugInfo.finalScore,
        activePartiesCount: completeParties,
        scoringStats: stats,
      };
    }

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