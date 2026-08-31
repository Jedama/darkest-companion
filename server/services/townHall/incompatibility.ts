// server/services/townHall/incompatibility.ts
/**
 * @file Hard constraints on which heroes refuse to share a party.
 *
 * Unlike the strategy registry (soft preferences, normalized and weighted),
 * these are inviolable: the optimizer will never accept a move that increases
 * the number of violations, so a feasible composition stays feasible.
 *
 * Pairs are symmetric. Listing ['voivode', 'vestal'] also means the Vestal
 * refuses the Voivode; the adjacency map is built in both directions.
 */

import { Party, Composition } from './expeditionPlanner.js';

export const INCOMPATIBLE_PAIRS: readonly (readonly [string, string])[] = [
  ['voivode', 'vestal'],
  ['voivode', 'exorcist'],
  ['voivode', 'seraph'],
  ['voivode', 'paladin'],

  ['librarian', 'houndmaster'],
  ['librarian', 'good_boy'],
  ['librarian', 'rescuer'],

  ['succubus', 'rescuer'],

  ['darkwraith','warrior_of_sunlight'],
  ['darkwraith','vestal'],

  ['snake_charmer', 'shieldbreaker'],
  ['snake_charmer', 'harlot'],

  ['grove_tender', 'flagellant'],

  ['exterminator', 'wretch'],
  ['exterminator', 'bloat'],

  ['scarecrow', 'anoint'],
  ['scarecrow', 'prefect'],
  ['scarecrow', 'eagle'],
  ['scarecrow', 'resonant'],
] as const;

/** Symmetric adjacency. Heroes with no conflicts are absent — that absence is the fast path. */
const CONFLICTS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    let set = map.get(a);
    if (!set) { set = new Set<string>(); map.set(a, set); }
    set.add(b);
  };
  for (const [a, b] of INCOMPATIBLE_PAIRS) { link(a, b); link(b, a); }
  return map;
})();

export function areIncompatible(a: string, b: string): boolean {
  return CONFLICTS.get(a)?.has(b) ?? false;
}

/** Number of conflicting pairs inside a single party. */
export function countPartyViolations(party: Party): number {
  let violations = 0;
  for (let i = 0; i < party.length; i++) {
    const foes = CONFLICTS.get(party[i]);
    if (!foes) continue;                     // ~95% of heroes exit here
    for (let j = i + 1; j < party.length; j++) {
      if (foes.has(party[j])) violations++;
    }
  }
  return violations;
}

/**
 * Violations across the ACTIVE parties only. Parties at index >= activeCount are
 * the reserve — those heroes stay home, so conflicts there are meaningless.
 */
export function countViolations(composition: Composition, activeCount?: number): number {
  const limit = activeCount === undefined
    ? composition.length
    : Math.min(activeCount, composition.length);
  let violations = 0;
  for (let p = 0; p < limit; p++) violations += countPartyViolations(composition[p]);
  return violations;
}

function findFirstViolation(
  composition: Composition, limit: number
): { party: number; slotA: number; slotB: number } | null {
  for (let p = 0; p < limit; p++) {
    const party = composition[p];
    for (let i = 0; i < party.length; i++) {
      const foes = CONFLICTS.get(party[i]);
      if (!foes) continue;
      for (let j = i + 1; j < party.length; j++) {
        if (foes.has(party[j])) return { party: p, slotA: i, slotB: j };
      }
    }
  }
  return null;
}

/**
 * Tries to swap the hero at composition[p][slot] with someone from another party,
 * accepting the first swap that strictly reduces the active violation count.
 * Reserve parties are tried first — anyone there is unconstrained by definition.
 */
function tryRelocate(composition: Composition, p: number, slot: number, limit: number): boolean {
  const before = countViolations(composition, limit);

  const donorOrder: number[] = [];
  for (let q = limit; q < composition.length; q++) donorOrder.push(q);       // reserve first
  for (let q = 0; q < limit; q++) if (q !== p) donorOrder.push(q);           // then other active

  for (const q of donorOrder) {
    for (let k = 0; k < composition[q].length; k++) {
      const heroP = composition[p][slot];
      const heroQ = composition[q][k];

      composition[p][slot] = heroQ;
      composition[q][k] = heroP;

      if (countViolations(composition, limit) < before) return true;

      composition[p][slot] = heroP;  // revert
      composition[q][k] = heroQ;
    }
  }
  return false;
}

/**
 * Repairs a composition IN PLACE by greedy swapping. Returns the number of
 * violations still present — 0 in every realistic case.
 *
 * A non-zero return means the roster genuinely cannot be partitioned (e.g. only
 * the Voivode and four of his refusers are available). Callers should warn rather
 * than retry: the annealer will still drive toward the minimum from here.
 */
export function repairComposition(composition: Composition, activeCount?: number): number {
  const limit = activeCount === undefined
    ? composition.length
    : Math.min(activeCount, composition.length);

  const MAX_PASSES = 200;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const violation = findFirstViolation(composition, limit);
    if (!violation) return 0;

    // Try moving either member of the offending pair.
    const movedB = tryRelocate(composition, violation.party, violation.slotB, limit);
    const moved = movedB || tryRelocate(composition, violation.party, violation.slotA, limit);

    if (!moved) break;  // no improving swap exists anywhere
  }

  return countViolations(composition, limit);
}