// server/services/politics/cliqueRelations.ts
/**
 * @file How the cliques regard each other.
 *
 * DELIBERATELY NOT SCORED IN BITS, unlike everything in cliqueMetrics. A hamlet
 * has two or three cliques, so there are one or three pairs to compare — you
 * cannot rank a population that small, and a sampled null built from it would be
 * measuring noise. These are reported plainly against the hamlet's own average
 * and printed as a fixed block rather than thrown into the ranking.
 *
 * ON DISJOINT REMAINDERS: cliques may share members (MAX_OVERLAP allows up to
 * half). Every comparison here runs between the parts that are NOT shared. If a
 * hero sat on both sides we would partly be measuring her regard for herself,
 * and any two overlapping cliques would drift toward apparent warmth for no
 * reason but our own overlap threshold.
 */

import { CharacterRecord } from '../../../shared/types/types';
import { NEUTRAL_AFFINITY } from '../../../shared/constants/relationships.js';
import { bondBetween, cliqueGate } from './cliqueFinder.js';
import type { CliqueProfile } from './cliqueMetrics.js';

const RELATION_CONFIG = {
  /** Same shrinkage as the regard metrics: a handful of opinions is not forty. */
  SHRINKAGE: 3,
  /** How far from the hamlet average a cross-regard must sit to be worth a line. */
  NOTABLE_GAP: 0.5,
  /**
   * Relations printed, after ranking.
   *
   * Pairs grow quadratically: 3 cliques give 3 relations, 8 give 28. At five or
   * six lines each that is a wall of text reporting, mostly, that two groups of
   * strangers have no opinion of one another.
   */
  MAX_RELATIONS: 4,
};

export interface DividedLoyalty {
  member: string;
  towardA: number;
  towardB: number;
}

export interface CliqueRelation {
  /**
   * How much these two are worth talking about. Not bits — with two or three
   * cliques there is no population to rank against — just a salience score for
   * ordering, combining distance from the hamlet average, asymmetry between the
   * two directions, and how hard any shared member is pulled.
   */
  salience: number;

  /** Indices into the profile list, so callers can use the same A/B/C labels. */
  aIndex: number;
  bIndex: number;
  /** Members of each, and the overlap. */
  aRemainder: string[];
  bRemainder: string[];
  shared: string[];

  /** How A's remainder regards B's, and the reverse. Shrunk toward the hamlet mean. */
  aTowardB: number;
  bTowardA: number;
  hamletMean: number;

  /** Warm bonds (at or above the clique bar) linking the two remainders. */
  crossingTies: number;

  /**
   * For anyone in both: their mean bond to each remainder. Tells you which way
   * they fall if the two ever pull apart — and it names a person, which reads
   * better than any fact about groups.
   */
  dividedLoyalties: DividedLoyalty[];
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/**
 * Compares every pair of cliques. Returns one entry per pair, in the order the
 * profiles were given.
 */
export function relateCliques(
  profiles: CliqueProfile[],
  roster: CharacterRecord
): CliqueRelation[] {
  if (profiles.length < 2) return [];

  const gate = cliqueGate(roster);

  const recorded: number[] = [];
  for (const hero of Object.values(roster)) {
    for (const rel of Object.values(hero.relationships)) {
      if (typeof rel?.affinity === 'number') recorded.push(rel.affinity);
    }
  }
  const hamletMean = recorded.length ? mean(recorded) : NEUTRAL_AFFINITY;

  const shrink = (values: number[]) => {
    const k = RELATION_CONFIG.SHRINKAGE;
    return values.length
      ? (values.length * mean(values) + k * hamletMean) / (values.length + k)
      : hamletMean;
  };

  /** Directed regard: how `from` sees `to`. Recorded opinions only. */
  const regard = (from: string[], to: string[]): number => {
    const opinions: number[] = [];
    for (const viewer of from) {
      for (const subject of to) {
        const affinity = roster[viewer]?.relationships[subject]?.affinity;
        if (typeof affinity === 'number') opinions.push(affinity);
      }
    }
    return shrink(opinions);
  };

  const relations: CliqueRelation[] = [];

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i].members;
      const b = profiles[j].members;

      const inB = new Set(b);
      const inA = new Set(a);
      const shared = a.filter(m => inB.has(m));
      const aRemainder = a.filter(m => !inB.has(m));
      const bRemainder = b.filter(m => !inA.has(m));

      // Nothing left to compare — one clique is wholly inside the other. Should
      // not happen given MAX_OVERLAP, but a relation between a group and itself
      // is meaningless rather than merely uninteresting.
      if (aRemainder.length === 0 || bRemainder.length === 0) continue;

      let crossingTies = 0;
      for (const x of aRemainder) {
        for (const y of bRemainder) {
          if (bondBetween(x, y, roster) >= gate) crossingTies++;
        }
      }

      // ENTANGLEMENT GATE. Two cliques are only in a relationship if something
      // connects them: a shared member, seats on both sides, or opinions actually
      // recorded across the divide. Two groups who have never met are not cold
      // toward each other — they are simply two groups, and in a large hamlet
      // most pairs are exactly that.
      let recordedCrossings = 0;
      for (const x of aRemainder) {
        for (const y of bRemainder) {
          if (typeof roster[x]?.relationships[y]?.affinity === 'number') recordedCrossings++;
          if (typeof roster[y]?.relationships[x]?.affinity === 'number') recordedCrossings++;
        }
      }
      const entangled = shared.length > 0 || recordedCrossings > 0;
      if (!entangled) continue;

      const aTowardB = regard(aRemainder, bRemainder);
      const bTowardA = regard(bRemainder, aRemainder);
      const dividedLoyalties: DividedLoyalty[] = shared.map(member => ({
        member,
        towardA: mean(aRemainder.map(other => bondBetween(member, other, roster))),
        towardB: mean(bRemainder.map(other => bondBetween(member, other, roster))),
      }));

      const worstPull = dividedLoyalties.reduce(
        (worst, l) => Math.max(worst, Math.abs(l.towardA - l.towardB)), 0
      );

      // Silence is only interesting when there is a reason these two SHOULD be
      // speaking — a shared member, or opinions that exist but are cold. On its
      // own, no warm bond between two unconnected groups is the default state.
      const silenceMatters = crossingTies === 0 && shared.length > 0 ? 1 : 0;

      const salience =
        Math.abs(aTowardB - hamletMean) +
        Math.abs(bTowardA - hamletMean) +
        Math.abs(aTowardB - bTowardA) * 1.5 +   // asymmetry is the better story
        worstPull * 1.5 +                        // a person torn between them, better still
        silenceMatters;

      relations.push({
        salience,
        aIndex: i,
        bIndex: j,
        aRemainder,
        bRemainder,
        shared,
        aTowardB,
        bTowardA,
        hamletMean,
        crossingTies,
        dividedLoyalties,
      });
    }
  }

  return relations
    .filter(isNotable)
    .sort((a, b) => b.salience - a.salience)
    .slice(0, RELATION_CONFIG.MAX_RELATIONS);
}

/**
 * True when a relation says anything worth a line.
 *
 * Note what is NOT here: `crossingTies === 0` used to qualify on its own, which
 * made this close to a no-op — two unrelated cliques in a large hamlet almost
 * never share a warm bond, so the most common case passed the gate. Silence now
 * only contributes through `salience`, and only when the two are entangled.
 */
export function isNotable(relation: CliqueRelation): boolean {
  const gap = RELATION_CONFIG.NOTABLE_GAP;
  return (
    Math.abs(relation.aTowardB - relation.hamletMean) >= gap ||
    Math.abs(relation.bTowardA - relation.hamletMean) >= gap ||
    Math.abs(relation.aTowardB - relation.bTowardA) >= gap ||
    relation.dividedLoyalties.some(l => Math.abs(l.towardA - l.towardB) >= gap)
  );
}