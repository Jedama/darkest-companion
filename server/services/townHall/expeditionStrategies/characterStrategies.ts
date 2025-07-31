/**
 * @file Contains all character-specific, "opinionated" scoring functions.
 * Each function in this file represents the unique worldview, biases, and
 * priorities of a specific character, allowing for highly personalized
 * team drafting strategies.
 */

import { CharacterRecord } from '../../../../shared/types/types';
import { Party } from '../expeditionPlanner';

// ===================================================================
// HEIRESS (PERSEPHONE) - STRATEGIES
// ===================================================================

/**
 * maximizeCommandClarity_Heiress
 *
 * Calculates a "command clarity" score for a party based on leadership strength,
 * authority gaps, and interpersonal cohesion, all filtered through the specific
 * biases and anxieties of the Heiress (Persephone).
 *
 * Her biases include:
 * - A preference for Nobles and those who demonstrate reliability (Vigilant, Leader).
 * - A strange respect for fellow Drunkards, seeing it as a sign of self-awareness.
 * - A deep distrust of rival power bases (Charmers) and instability (Unstable).
 * - A demanding leadership style that requires proven loyalty and harshly penalizes abrasive personalities.
 */
export function maximizeCommandClarity_Heiress(party: Party, roster: CharacterRecord): number {
  if (party.length < 2) return 0;

  // STEP 1: Calculate "Persephone's" Effective Authority Score (EAS)
  const partyWithEAS = party.map(id => {
    const hero = roster[id];
    if (!hero) return { id, eas: -99, hero: null }; // Should not happen, but a safeguard.

    let bonus = 0;

    // Her Personal Biases:
    if (hero.tags.includes('Leader')) bonus += 3;
    if (hero.tags.includes('Noble')) bonus += 2;
    if (hero.tags.includes('Drunkard')) bonus += 2; // Her personal quirk
    if (hero.tags.includes('Vigilant')) bonus += 1; // Values reliability
    if (hero.tags.includes('SelfSufficient')) bonus += 1; // Values low-maintenance assets
    if (hero.tags.includes('Strategist')) bonus += 1;

    // Her Anxieties:
    if (hero.tags.includes('Unstable')) bonus -= 3; // Direct threat to order
    if (hero.tags.includes('Charmer')) bonus -= 2; // A rival power base
    if (hero.tags.includes('Child')) bonus -= 1;

    const eas = hero.stats.authority + bonus;
    return { id, eas, hero };
  }).sort((a, b) => b.eas - a.eas);

  const leader1 = partyWithEAS[0];
  const leader2 = partyWithEAS[1];

  // Safeguard against empty party or bad data
  if (!leader1?.hero || !leader2?.hero) {
    return 0;
  }

  // STEP 2: Calculate Potential Score (Emphasizes Leader & Gap)
  const scoreA = leader1.eas * 3; // High weight on leader's raw power
  const primaryGap = leader1.eas - leader2.eas;
  const scoreB = Math.log(primaryGap + 1) * 7; // High weight on the primary gap
  const potentialScore = scoreA + scoreB;

  // STEP 3: Calculate Total Pressure Score (Demanding)
  let totalPressureScore = 0;
  for (let i = 1; i < partyWithEAS.length; i++) {
    const subordinate = partyWithEAS[i];
    if (!subordinate.hero) continue;

    const gap_to_leader = leader1.eas - subordinate.eas;
    const riskFactor = 1 / (gap_to_leader + 0.5);

    // Demanding Neutral Point: Only proven loyalty is rewarded.
    const affinity_to_leader = subordinate.hero.relationships[leader1.id]?.affinity ?? 3;
    let affinityModifier = affinity_to_leader - 7.5;

    // An Abrasive subordinate adds significant pressure, independent of their loyalty.
    if (subordinate.hero.tags.includes('Abrasive')) {
      affinityModifier -= 4; // She finds this trait exceptionally grating.
    }

    totalPressureScore += (riskFactor * affinityModifier * 5);
  }

  // STEP 4: Convert to Cohesion Factor (Less sensitive to internal strife)
  const cohesionFactor = 1 + (totalPressureScore / 40); // Larger denominator = less swing

  // STEP 5: Final Score
  // Ensure cohesion doesn't flip the score negative if pressure is extremely high
  return potentialScore * Math.max(0, cohesionFactor);
}


// ===================================================================
// HOUNDMASTER (WILLIAM) - STRATEGIES (Future Example)
// ===================================================================
/*
export function maximizePackCohesion_Houndmaster(party: Party, roster: CharacterRecord): number {
  // Future implementation could focus on:
  // - Rewarding 'Flexible' and 'SelfSufficient' heroes.
  // - Synergy with 'Companion' and 'BeastHunter' tags.
  // - Valuing high 'Agility' for tactical repositioning.
  // - Penalizing 'Immobile' or 'Hider' tags that disrupt pack tactics.
  return 0;
}
*/