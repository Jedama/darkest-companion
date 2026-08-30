// server/services/townHall/fitness.ts
/**
 * @file Decides how many parties the hamlet can field this month, from hero
 * condition alone — independent of composition quality, doctrine weights, or
 * who ends up grouped with whom.
 *
 * This used to be inferred from the annealer's own score (see git history on
 * findOptimalArrangement): bench a party if doing so raised the average
 * z-score of the rest. That conflated two unrelated decisions. How many teams
 * to send is a fact about the hamlet's condition; who goes in which team is
 * an optimization. Deciding the first from the second's output made both
 * unreliable — selection freedom alone (fewer active parties means more
 * choice of who fills them) pushed the mean up even on a perfectly healthy
 * roster, with no term for what the benched party would have accomplished.
 *
 * So the two are split. This module answers "how many" from condition alone;
 * the annealer in expeditionPlanner.ts is simply told that number and never
 * votes on it.
 *
 * Deliberately not shared with getDetailedLiability (genericStrategies.ts),
 * despite reading the same status fields. That asks "how much trouble is
 * this hero for their party" — unbounded, party-relative. This asks "should
 * they go at all" — bounded to at most one hero's worth of absence, and
 * absolute. Health is included only lightly: it resets to full on return
 * from an expedition, so it should read on a wounded hero, not decide
 * whether they march. Virtues aren't read at all — they're cleared at month
 * end, and planning is the first thing each month, so status.affliction can
 * never hold a virtue key when this runs.
 */

import { CharacterRecord, Character } from '../../../shared/types/types.js';
import { AFFLICTION_SEVERITY, isAffliction } from '../../../shared/constants/conditions.js';
import { DISEASE_SEVERITY, isDisease } from '../../../shared/constants/diseases.js';

// A hero's month-end condition, translated into an absolute 0-1 "fit to march"
// score. Tuned against a hypothetical roster (see PR discussion); recalibrate
// against real save data once available if the typical hero's numbers differ.
const STRESS_EXPONENT = 1.8;   // convex — mild fatigue nearly free, severe cases dominate
const WOUND_SCALE = 0.25;      // health resets on return, so it barely counts here
const AFFLICTION_FLOOR = 0.30; // flat cost of being afflicted at all, whichever affliction
const SLACK = 1.0;             // one free hero-equivalent before the first team is cut

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * A single hero's fitness to march, in [0, 1]. 1 is perfectly fit; 0 means
 * they cost a full hero-equivalent of the hamlet's capacity. Never negative —
 * however wrecked, one hero can cost at most one hero's worth of absence.
 */
export function heroFitness(hero: Character): number {
  const stressCost = Math.pow((100 - hero.status.mental) / 100, STRESS_EXPONENT);
  const woundCost = Math.pow((100 - hero.status.physical) / 100, 2) * WOUND_SCALE;

  let afflictionCost = 0;
  const condition = hero.status.affliction;
  if (condition && isAffliction(condition)) {
    const severity = AFFLICTION_SEVERITY[condition] ?? 0;
    afflictionCost = AFFLICTION_FLOOR + (1 - AFFLICTION_FLOOR) * (severity / 100);
  }

  // Unlike affliction, no floor: the disease list runs from near-lethal down to
  // pure-flavor quirks (tongue_tie, bad_breath) with no mechanical bite, so
  // there's no "being sick at all costs a minimum" premise to encode here. A
  // hero can carry several diseases at once, so this sums rather than picking
  // the worst — still bounded by the clamp below either way.
  let diseaseCost = 0;
  for (const id of hero.status.diseases ?? []) {
    if (isDisease(id)) {
      diseaseCost += (DISEASE_SEVERITY[id] ?? 0) / 100;
    }
  }

  return clamp01(1 - stressCost - woundCost - afflictionCost - diseaseCost);
}

export interface PartyCountResult {
  /** Number of parties the hamlet can field this month. */
  k: number;
  /** Complete parties the roster's headcount alone allows, before fitness. */
  completeParties: number;
  /** Sum of fitness over the fittest `completeParties * partySize` heroes. */
  capacity: number;
  /** That many hero-slots minus capacity — how much of a full hero's absence the roster is carrying. */
  deficit: number;
  /** Every available hero's fitness, for debug display / calibration. */
  fitness: Record<string, number>;
}

/**
 * How many parties the hamlet can field this month, from condition alone.
 *
 * The `n mod partySize` stragglers who can't complete a party under any
 * choice of k are excluded from the capacity sum before it's taken — not
 * because they don't matter, but because those slots don't exist under any
 * decision, so their fitness (good or bad) can't move it. Excluding the
 * *worst* r rather than an arbitrary r is safe because it's also what the
 * annealer would do anyway: its own liability/condition terms already push
 * an unfit hero toward the reserve, so the r left out here are the same r
 * likely to end up unassigned regardless.
 */
export function computeActivePartyCount(
  availableHeroes: string[],
  roster: CharacterRecord,
  partySize: number
): PartyCountResult {
  const fitness: Record<string, number> = {};
  for (const id of availableHeroes) {
    const hero = roster[id];
    fitness[id] = hero ? heroFitness(hero) : 0;
  }

  const completeParties = Math.floor(availableHeroes.length / partySize);

  if (completeParties === 0) {
    return { k: 0, completeParties: 0, capacity: 0, deficit: 0, fitness };
  }

  const n2 = completeParties * partySize;
  const fittestFirst = [...availableHeroes].sort((a, b) => fitness[b] - fitness[a]);
  const capacity = fittestFirst.slice(0, n2).reduce((sum, id) => sum + fitness[id], 0);
  const deficit = n2 - capacity;

  const rawK = Math.floor((capacity + SLACK) / partySize);
  const k = Math.min(completeParties, Math.max(1, rawK));

  return { k, completeParties, capacity, deficit, fitness };
}
