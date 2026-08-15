// server/services/politics/cliqueFinder.ts
/**
 * @file Finds the cliques in a roster: groups of heroes who are genuinely close.
 *
 * Pure. Reads a CharacterRecord, mutates nothing, needs no Estate. Everything
 * here is a property of the affinity graph alone, so it can be unit-tested with
 * a handful of made-up heroes.
 *
 * The vocabulary — what a bond is, where the bar sits — lives in roster.ts, since
 * every other layer needs it and none of them are finding cliques.
 *
 * WHAT A CLIQUE IS, in this model:
 *   - Mutual. One-sided admiration is a fact about the admirer, not a bond.
 *   - Cordial at minimum. A group must average above CORDIAL to exist at all;
 *     a hamlet where everyone is miserable has no cliques, and reporting one
 *     with a negative cohesion would be worse than reporting nothing.
 *   - Connected. Two friendly pairs who have never met are not one group of four.
 */

import { CharacterRecord } from '../../../shared/types/types.js';
import { bondBetween, cliqueGate } from './roster.js';

// ===================================================================
// CONFIGURATION
// ===================================================================

const CLIQUE_CONFIG = {
  /**
   * Size exponent:  score = cohesion * size^SIZE_EXPONENT
   *
   * Really an ENTRY FEE. It sets how warm a newcomer must be with every existing
   * member before the larger group outscores the smaller one — and that fee turns
   * out to be near-constant regardless of group size, which makes it the sane way
   * to pick this number.
   *
   * To join a group of close friends (all 8s), a newcomer needs affinity:
   *
   *   0.5  -> 7.20    punishing; only near-perfect groups ever grow
   *   0.8  -> 6.77
   *   1.0  -> 6.50    <- current: noticeably warm with everyone, short of the core's 8s
   *   1.2  -> 6.25
   *   1.41 -> 6.00
   *   2.0  -> 5.38    permissive; size dominates cohesion
   *
   * The fee can never fall below CORDIAL however high this goes, so there is no
   * runaway.
   */
  SIZE_EXPONENT: 1.0,

  /** Groups smaller than this are friendships, not cliques; the log system covers them. */
  MIN_SIZE: 3,

  /** Safety rail on enumeration depth. Nothing in a hamlet should be a bloc of nine. */
  MAX_SIZE: 6,

  /**
   * Overlap penalty when suppressing near-duplicates:
   *
   *   adjusted = score * (1 - LAMBDA * sharedMembers / candidateSize)
   *
   * Measured as a fraction of the CANDIDATE, not Jaccard: a clique wholly
   * contained in an already-chosen one then takes the full penalty, which is what
   * we want — reporting ABCD after ABCDEFGH is noise.
   *
   * Falls out naturally at 0.85: a 4-set sharing two members keeps 58% of its
   * score, a 6-set sharing two keeps 72%. Bigger groups tolerate more overlap
   * without a size-specific rule.
   */
  LAMBDA: 0.85,

  /**
   * Hard ceiling on overlap with an already-reported clique, as a fraction of the
   * candidate. Above this the group is not a second finding — it is the same one
   * plus or minus a member. Catches subsets (ABC inside ABCD), supersets (ABCDE
   * around ABCD) and swaps (ABCE beside ABCD) with one rule, in both directions.
   *
   * LAMBDA then orders whatever survives.
   */
  MAX_OVERLAP: 0.5,

  /** Cliques returned after suppression. */
  MAX_RESULTS: 8,

  /** Stop enumerating if a roster is pathologically well-connected. */
  MAX_CANDIDATES: 2_000_000,
};

// ===================================================================
// TYPES
// ===================================================================

export interface Clique {
  members: string[];
  /** Mean bond above CORDIAL. Zero means "exactly cordial"; this is the scored quantity. */
  cohesion: number;
  /** Mean raw bond, for presenting against the hamlet average. */
  meanBond: number;
  /** cohesion * size^SIZE_EXPONENT, before overlap suppression. */
  score: number;
  /** Score after overlap suppression; the ranking key. */
  adjustedScore: number;
  /** Fraction of internal pairs above CORDIAL. Separates a dense court from a thin chain. */
  density: number;
  /** The seam: weakest internal bond. Near the floor by construction in found cliques. */
  weakestLink: { a: string; b: string; bond: number };
}

// ===================================================================
// FINDING
// ===================================================================

/**
 * Finds and ranks the cliques in a roster.
 *
 * Enumerates connected subgraphs of the WARM graph — the graph whose edges are
 * pairs bonded above CORDIAL. Two things justify that restriction:
 *
 *   1. It is what makes this tractable. Unrestricted, a 150-hero roster has 591
 *      million 5-subsets; connected-only leaves a couple of hundred thousand.
 *   2. It is semantically right. A set that is disconnected in the warm graph is
 *      two friendly pairs who have never met, not a group of four.
 */
export function findCliques(roster: CharacterRecord): Clique[] {
  const ids = Object.keys(roster).sort();
  const n = ids.length;
  if (n < CLIQUE_CONFIG.MIN_SIZE) return [];

  const GATE = cliqueGate(roster);

  const index = new Map(ids.map((id, i) => [id, i]));

  // Cache every bond once; the enumeration will ask for the same pairs repeatedly.
  const bond: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const warm: Set<number>[] = Array.from({ length: n }, () => new Set<number>());

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const value = bondBetween(ids[i], ids[j], roster);
      bond[i][j] = value;
      bond[j][i] = value;
      // >= not >: an exactly-cordial bond still CONNECTS two people, it just
      // cannot on its own lift a group above the gate — such a clique would have
      // cohesion 0 and be rejected below.
      if (value >= GATE) {
        warm[i].add(j);
        warm[j].add(i);
      }
    }
  }

  const found: Clique[] = [];
  let candidates = 0;

  const evaluate = (members: number[]) => {
    let sum = 0;
    let abovePairs = 0;
    let pairs = 0;
    let worst = { a: -1, b: -1, bond: Infinity };

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const value = bond[members[i]][members[j]];
        sum += value;
        pairs++;
        if (value >= GATE) abovePairs++;
        if (value < worst.bond) worst = { a: members[i], b: members[j], bond: value };
      }
    }

    const meanBond = sum / pairs;
    const cohesion = meanBond - GATE;

    // The gate. At or below it is not a clique, at any size.
    if (cohesion <= 0) return;

    const score = cohesion * Math.pow(members.length, CLIQUE_CONFIG.SIZE_EXPONENT);

    found.push({
      members: members.map(i => ids[i]).sort(),
      cohesion,
      meanBond,
      score,
      adjustedScore: score,
      density: abovePairs / pairs,
      weakestLink: { a: ids[worst.a], b: ids[worst.b], bond: worst.bond },
    });
  };

  /**
   * ESU (Wernicke): enumerates every connected subgraph exactly once.
   *
   * Uniqueness comes from two rules — only vertices with an index above the seed
   * may ever be added, and a newly added vertex contributes only its EXCLUSIVE
   * neighbours (those not already adjacent to the set). Without the second rule
   * the same group surfaces once per order it could be built in.
   */
  const extend = (sub: number[], ext: number[], seed: number): void => {
    const inSub = new Set(sub);
    if (sub.length >= CLIQUE_CONFIG.MIN_SIZE) {
      if (++candidates > CLIQUE_CONFIG.MAX_CANDIDATES) return;
      evaluate(sub);
    }
    if (sub.length >= CLIQUE_CONFIG.MAX_SIZE) return;

    const pool = [...ext];
    while (pool.length > 0) {
      const w = pool.pop()!;

      // Exclusive neighbours of w: warm to w, above the seed, not already in or
      // adjacent to the current set.
      //
      // INVARIANT: every vertex in `ext` is already a neighbour of `sub` — true
      // at the seed, and preserved by each recursive call, since what we pass
      // down is the remaining pool (neighbours of sub, so still neighbours of
      // sub + w) plus w's own neighbours. A membership test against `ext` would
      // therefore only ever reject vertices the N(sub) check below rejects
      // anyway, so there is no third condition here and none is needed.
      const exclusive: number[] = [];
      for (const u of warm[w]) {
        if (u <= seed || inSub.has(u)) continue;
        if (sub.some(s => warm[s].has(u))) continue;
        exclusive.push(u);
      }

      extend([...sub, w], [...pool, ...exclusive], seed);
    }
  };

  for (let v = 0; v < n; v++) {
    const ext = [...warm[v]].filter(u => u > v);
    extend([v], ext, v);
  }

  if (candidates > CLIQUE_CONFIG.MAX_CANDIDATES) {
    console.warn(
      `[Cliques] Enumeration hit the ${CLIQUE_CONFIG.MAX_CANDIDATES} candidate cap; ` +
      `results are partial. The roster is unusually well-connected.`
    );
  }

  return suppressOverlap(found);
}

/**
 * Pick-and-discount. Take the best clique, discount everything that overlaps it,
 * re-rank, repeat. Cohesion never changes — only the ranking multiplier — so this
 * is a cheap pass over an already-scored list.
 */
function suppressOverlap(cliques: Clique[]): Clique[] {
  const remaining = [...cliques];
  const chosen: Clique[] = [];
  const claimed = new Set<string>();

  while (remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      const shared = c.members.filter(m => claimed.has(m)).length;

      // Mostly someone we have already reported. Skip outright rather than
      // discount: "A, B and C are close" adds nothing after "A, B, C and D are close".
      if (shared / c.members.length > CLIQUE_CONFIG.MAX_OVERLAP) continue;

      const penalty = 1 - CLIQUE_CONFIG.LAMBDA * (shared / c.members.length);
      const adjusted = c.score * penalty;

      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestIndex = i;
      }
    }

    if (bestIndex === -1 || bestScore <= 0) break;
    if (chosen.length >= CLIQUE_CONFIG.MAX_RESULTS) break;

    const [winner] = remaining.splice(bestIndex, 1);
    winner.adjustedScore = bestScore;
    chosen.push(winner);
    for (const m of winner.members) claimed.add(m);
  }

  return chosen;
}