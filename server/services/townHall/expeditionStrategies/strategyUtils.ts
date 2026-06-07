/**
 * @file Contains low-level, reusable helper functions for scoring expedition parties.
 * These functions provide the core building blocks for more complex strategy scorers.
 * They are designed to be generic and opinion-free.
 */

import { CharacterRecord } from '../../../../shared/types/types';
import { Party } from '../expeditionPlanner';

// ==================================
// UTILITY/HELPER FUNCTIONS
// ==================================

/**
 * Counts how many members of a party have a specific tag.
 */
export function countTag(party: Party, roster: CharacterRecord, tag: string): number {
  if (!party || party.length === 0) return 0;
  return party.reduce((count, id) => count + (roster[id]?.tags.includes(tag) ? 1 : 0), 0);
}

/**
 * Returns the maximum number of valid (A, B) pairs that can be formed from two
 * hero lists, where a hero may never be paired with itself (the case that arises
 * when one hero carries both tags).
 *
 * This is a maximum bipartite matching on a complete bipartite graph minus the
 * "diagonal" edges between shared heroes. It has a clean closed form:
 *   - unequal counts  -> min(countA, countB)   (the surplus side always covers the diagonal)
 *   - equal counts >= 2 -> countA              (a perfect matching always exists; removing a
 *                                                partial matching from K(n,n) leaves one intact)
 *   - equal counts == 1 -> 1 unless it's the same single shared hero, in which case 0
 *
 * The old greedy matcher was order-dependent (it could consume a shared hero's only
 * legal partner first), and the old closed form `countA - heroesWithBothTags`
 * under-counted whenever counts were equal and >= 2.
 */
export function countMaxCrossPairs(heroesA: string[], heroesB: string[]): number {
  const countA = heroesA.length;
  const countB = heroesB.length;

  if (countA === 0 || countB === 0) return 0;
  if (countA !== countB) return Math.min(countA, countB);
  if (countA === 1) return heroesA[0] === heroesB[0] ? 0 : 1;
  return countA;
}

/**
 * Scores "A+B" synergies that stack. Rewards having a base pair, with additional
 * bonuses for more of each tag. Ideal for "enabler + keystone" combos.
 * (e.g., Marker + MarkSynergy)
 */
export function calculateStackingPairSynergy(
    party: Party, roster: CharacterRecord,
    tagA: string, tagB: string,
    baseScore: number, bonusPerA: number, bonusPerB: number
): number {
    const countA = countTag(party, roster, tagA);
    const countB = countTag(party, roster, tagB);

    if (countA === 0 || countB === 0) {
        return 0;
    }

    // Score for the base pair, plus bonus for each *additional* member.
    const score = baseScore
                + (bonusPerA * (countA - 1))
                + (bonusPerB * (countB - 1));
    return score;
}

/**
 * Scores a simple one-to-one pair synergy. The score is applied for each
 * unique pair of (A, B) that can be formed. Handles positive and negative scores.
 *
 * This implementation uses a greedy matching algorithm to ensure a hero cannot
 * be paired with themselves, and that each hero is only used in one pair.
 * (e.g., Frontline + Backline)
 */
export function calculateExactPairsSynergy(
  party: Party, roster: CharacterRecord,
  tagA: string, tagB: string,
  scorePerPair: number
): number {
  // This function is for A+B pairs. For A+A pairs, use calculateStackingTagSynergy.
  if (tagA === tagB) {
    // Self-pairing is not what this function is for, to avoid ambiguity.
    return 0;
  }

  // 1. Get the lists of individual heroes with each tag.
  const heroesA = party.filter(id => roster[id]?.tags.includes(tagA));
  const heroesB = party.filter(id => roster[id]?.tags.includes(tagB));

  // No need to proceed if one of the lists is empty.
  if (heroesA.length === 0 || heroesB.length === 0) {
    return 0;
  }

  // The maximum number of valid A-B pairs has a clean closed form (see
  // countMaxCrossPairs). The old greedy match was order-dependent and could
  // undercount when a shared hero's only legal partner was taken first.
  return countMaxCrossPairs(heroesA, heroesB) * scorePerPair;
}

/**
 * Scores a 1-to-1 paired synergy, such as a 'Guarder' protecting a 'Frail' hero.
 *
 * This function correctly handles the edge case where a hero has both tags
 * (e.g., 'Guarder' and 'Frail') and cannot be paired with themself.
 *
 * The number of pairs is limited by the count of the less numerous tag. However,
 * when the counts are equal, heroes with both tags reduce the number of possible pairs.
 *
 * @param scorePerPair - The score applied for each successful pair.
 */
export function calculateSimplePairSynergy(
  party: Party, roster: CharacterRecord,
  tagA: string, tagB: string,
  scorePerPair: number
): number {
  if (tagA === tagB) {
    // This function is for A+B pairs. A+A stacking has a different pattern.
    return 0;
  }

  // We need the actual hero lists to check for overlaps.
  const heroesA = party.filter(id => roster[id]?.tags.includes(tagA));
  const heroesB = party.filter(id => roster[id]?.tags.includes(tagB));

  const countA = heroesA.length;
  const countB = heroesB.length;

  if (countA === 0 || countB === 0) {
    return 0;
  }

  // Correct maximum matching (the equal-count branch used to subtract one pair per
  // shared hero, which under-counts: for equal counts >= 2 a full matching always exists).
  return countMaxCrossPairs(heroesA, heroesB) * scorePerPair;
}

/**
 * Scores a combinatorial synergy where each hero with tagA provides a bonus
 * for every hero with tagB.
 *
 * Use case: "Each 'Dancer' benefits from every 'Flexible', granting a bonus."
 *
 * This implementation avoids self-synergy (a hero with both tags does not
 * grant a bonus to themselves).
 */
export function calculateCombinatorialSynergy(
  party: Party, roster: CharacterRecord,
  tagA: string, tagB: string,
  scorePerInteraction: number
): number {
  if (tagA === tagB) {
    // This pattern doesn't make sense for A+A. That would be n*(n-1) interactions.
    // Use a different function for that specific case if needed.
    return 0;
  }

  const heroesA = party.filter(id => roster[id]?.tags.includes(tagA));
  const heroesB = party.filter(id => roster[id]?.tags.includes(tagB));

  if (heroesA.length === 0 || heroesB.length === 0) {
    return 0;
  }
  
  // Calculate the total possible interactions by multiplication.
  const totalInteractions = heroesA.length * heroesB.length;

  // Now, subtract the self-interactions.
  // A self-interaction occurs if a hero has both tagA and tagB.
  const heroesWithBothTags = heroesA.filter(id => heroesB.includes(id));
  const selfInteractions = heroesWithBothTags.length;

  const validInteractions = totalInteractions - selfInteractions;

  return validInteractions * scorePerInteraction;
}

/**
 * Scores "wolfpack" synergies where having more of the same tag is good (or bad).
 * A base score is awarded when a `requiredCount` is met, with bonuses for each
 * member beyond that count.
 * (e.g., Dancer Troupe, Positional Gridlock)
 */
export function calculateStackingTagSynergy(
    party: Party, roster: CharacterRecord,
    tag: string,
    baseScore: number, bonusPerAdditional: number, requiredCount: number = 2
): number {
    const count = countTag(party, roster, tag);

    if (count < requiredCount) {
        return 0;
    }

    const score = baseScore + (bonusPerAdditional * (count - requiredCount));
    return score;
}