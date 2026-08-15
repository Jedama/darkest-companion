// server/services/politics/roster.ts
/**
 * @file What a bond is, and where the bar sits.
 *
 * These three functions are the vocabulary every other file in this folder
 * speaks. They lived in cliqueFinder, which meant givenGroups and cliqueRelations
 * had to import from a module named after a job they do not do. Finding cliques
 * is one use of a bond, not the definition of one.
 *
 * Pure. Reads a CharacterRecord, mutates nothing, needs no Estate.
 */

import { CharacterRecord } from '../../../shared/types/types.js';
import { NEUTRAL_AFFINITY } from '../../../shared/constants/relationships.js';

export const BOND_CONFIG = {
  /**
   * The absolute floor for a group being close at all.
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
};

/**
 * Every recorded affinity in the hamlet, as a flat list.
 *
 * THE ONE DEFINITION. Five separate copies of this loop existed — in cliqueGate,
 * relateCliques, profileCliques, profileHeroes and summariseHamlet — and they did
 * not agree, because some walked hero.relationships directly while others walked
 * roster pairs. That put two different "hamlet averages" in the same prompt.
 *
 * Relationships pointing at heroes who are not on the roster are IGNORED. They
 * should not exist; they currently do, because default relationships can be
 * written before their target is added.
 *
 * TODO: revisit when dead heroes are handled. If departed heroes stay in the
 * roster under some flag, "not in the roster" stops being the right test and this
 * needs to ask about that flag instead.
 */
export function hamletAffinities(roster: CharacterRecord): number[] {
  const recorded: number[] = [];
  for (const hero of Object.values(roster)) {
    for (const [targetId, rel] of Object.entries(hero.relationships)) {
      if (!roster[targetId]) continue;
      if (typeof rel?.affinity === 'number') recorded.push(rel.affinity);
    }
  }
  return recorded;
}

/**
 * The strength of the tie between two heroes: mostly the weaker direction,
 * partially forgiven by the stronger. Unrecorded directions fall back to
 * STRANGER_AFFINITY.
 */
export function bondBetween(a: string, b: string, roster: CharacterRecord): number {
  const S = BOND_CONFIG.STRANGER_AFFINITY;
  const aToB = roster[a]?.relationships[b]?.affinity ?? S;
  const bToA = roster[b]?.relationships[a]?.affinity ?? S;

  const low = Math.min(aToB, bToA);
  const high = Math.max(aToB, bToA);
  return low + BOND_CONFIG.ASYMMETRY_CREDIT * (high - low);
}

/**
 * The bar a group must clear: the higher of CORDIAL and the hamlet's mean
 * RECORDED affinity. Unrecorded pairs are excluded from the mean — on a large
 * roster most pairs are strangers, and counting them would drag the average to
 * neutral and make every real relationship look remarkable.
 *
 * Note this scales the entry fee too. Joining a trio of 8s costs affinity
 * `NEUTRAL_AFFINITY + gate/2` — 6.5 in a normal hamlet, 7.5 in a warm one. Getting
 * into a clique is harder where everyone is already friendly, which is correct.
 */
export function cliqueGate(roster: CharacterRecord): number {
  const recorded = hamletAffinities(roster);
  if (recorded.length === 0) return BOND_CONFIG.CORDIAL;

  const mean = recorded.reduce((a, b) => a + b, 0) / recorded.length;
  return Math.max(BOND_CONFIG.CORDIAL, mean);
}