// server/services/politics/cliqueFinder.ts
/**
 * @file Finds the cliques in a roster: groups of heroes who are genuinely close.
 *
 * Pure. Reads a CharacterRecord, mutates nothing, needs no Estate. Everything
 * here is a property of the affinity graph alone, so it can be unit-tested with
 * a handful of made-up heroes.
 *
 * WHAT A CLIQUE IS, in this model:
 *   - Mutual. One-sided admiration is a fact about the admirer, not a bond.
 *   - Cordial at minimum. A group must average above CORDIAL to exist at all;
 *     a hamlet where everyone is miserable has no cliques, and reporting one
 *     with a negative cohesion would be worse than reporting nothing.
 *   - Connected. Two friendly pairs who have never met are not one group of four.
 */

import { CharacterRecord } from '../../../shared/types/types';
import { NEUTRAL_AFFINITY } from '../../../shared/constants/relationships.js';

// ===================================================================
// CONFIGURATION
// ===================================================================

const CLIQUE_CONFIG = {
  /**
   * The absolute floor for being a clique at all.
   *
   * The gate actually used is  max(CORDIAL, hamlet mean)  — a clique must be
   * warmer than cordial AND warmer than this hamlet's normal, whichever bar is
   * higher. Both halves earn their place:
   *
   *   Bitter hamlet (mean 3.1): a purely relative gate would let four people
   *   sitting at plain neutral register as a bloc for merely not hating each
   *   other. CORDIAL holds the line.
   *
   *   Friendly hamlet (mean 7.0): a purely absolute gate would swallow the whole
   *   roster into one clique. A school class is not a clique because the vibe is
   *   good; the mean raises the bar so only genuinely-closer-than-usual groups pass.
   *
   * The gate is also the zero point for cohesion, so a group sitting exactly on it
   * scores 0 at any size and cannot grow its way past the threshold.
   */
  CORDIAL: 5,

  /**
   * How much of the warmer direction forgives the colder one.
   *
   *   bond = min + ASYMMETRY_CREDIT * (max - min)
   *
   * Pure `min` is the honest starting point — you are not close to someone who
   * despises you, however warmly you feel about them. But pure `min` is brutal on
   * affection that simply has not been returned yet. At 0.25:
   *
   *   8/8 -> 8.00   mutual devotion
   *   8/6 -> 6.50   warm, slightly uneven
   *   8/4 -> 5.00   one-sided, scrapes in exactly at CORDIAL
   *   8/2 -> 3.50   warmth does not redeem contempt
   *
   * A bond is mostly its weaker direction, but not entirely.
   */
  ASYMMETRY_CREDIT: 0.25,

  /**
   * What an unrecorded pair is worth. Strangers dilute a group without damaging
   * it: they contribute below CORDIAL, so padding a clique with people who have
   * never met drags the average down on its own. Lower this to make stranger-
   * padded groups fail faster.
   */
  STRANGER_AFFINITY: NEUTRAL_AFFINITY,

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
// THE BOND
// ===================================================================

/**
 * The strength of the tie between two heroes: mostly the weaker direction,
 * partially forgiven by the stronger. Unrecorded directions fall back to
 * STRANGER_AFFINITY.
 */
export function bondBetween(a: string, b: string, roster: CharacterRecord): number {
  const S = CLIQUE_CONFIG.STRANGER_AFFINITY;
  const aToB = roster[a]?.relationships[b]?.affinity ?? S;
  const bToA = roster[b]?.relationships[a]?.affinity ?? S;

  const low = Math.min(aToB, bToA);
  const high = Math.max(aToB, bToA);
  return low + CLIQUE_CONFIG.ASYMMETRY_CREDIT * (high - low);
}

/**
 * The bar a group must clear: the higher of CORDIAL and the hamlet's mean
 * RECORDED affinity. Unrecorded pairs are excluded from the mean — on a large
 * roster most pairs are strangers, and counting them would drag the average to
 * neutral and make every real relationship look remarkable.
 *
 * Note this scales the entry fee too. Joining a trio of 8s costs affinity
 * `4 + gate/2` — 6.5 in a normal hamlet, 7.5 in a warm one. Getting into a
 * clique is harder where everyone is already friendly, which is correct.
 */
export function cliqueGate(roster: CharacterRecord): number {
  const recorded: number[] = [];
  for (const hero of Object.values(roster)) {
    for (const rel of Object.values(hero.relationships)) {
      if (typeof rel?.affinity === 'number') recorded.push(rel.affinity);
    }
  }
  if (recorded.length === 0) return CLIQUE_CONFIG.CORDIAL;

  const mean = recorded.reduce((a, b) => a + b, 0) / recorded.length;
  return Math.max(CLIQUE_CONFIG.CORDIAL, mean);
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
    const inPool = new Set(ext);
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
      const exclusive: number[] = [];
      for (const u of warm[w]) {
        if (u <= seed || inSub.has(u) || inPool.has(u)) continue;
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