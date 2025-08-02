/**
 * @file Contains all character-specific, "opinionated" scoring functions.
 * Each function in this file represents the unique worldview, biases, and
 * priorities of a specific character, allowing for highly personalized
 * team drafting strategies.
 */

import { CharacterRecord } from '../../../../shared/types/types';
import { Party, Composition } from '../expeditionPlanner';
import { countTag, calculateSimplePairSynergy } from './strategyUtils';

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
export function scorePartyByCommandClarity_Heiress(party: Party, roster: CharacterRecord): number {
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

export function scoreCompositionByQuarantinedHorrors_Heir(composition: Composition, roster: CharacterRecord): number {
  
  function calculatePartyHorrorScore(party: Party, roster: CharacterRecord): number {
    let score = 0;
    for (const heroId of party) {
      const hero = roster[heroId];
      if (!hero) continue;

      if (hero.race !== 'Human') {
        score += 10;
      }

      if (hero.tags.includes('Eldritch') || hero.tags.includes('Unholy') || hero.tags.includes('Shapeshifter')) {
        score += 10;
      }
      if (hero.tags.includes('Unstable') || hero.tags.includes('Animal')) {
        score += 5;
      }
      if (hero.tags.includes('Brink')) {
        score += 2;
      }
    }
    return score;
  }

  // If the composition is empty or has only one party, return 0
  if (composition.length < 2) return 0;

  const horrorScores = composition.map(party => calculatePartyHorrorScore(party, roster));
  
  const mean = horrorScores.reduce((a, b) => a + b, 0) / horrorScores.length;
  const variance = horrorScores.map(score => Math.pow(score - mean, 2)).reduce((a, b) => a + b, 0) / horrorScores.length;
  
  return variance; // Direction: 'maximize'
}

export function scorePartyByChildGuardianship_Cook(party: Party, roster: CharacterRecord): number {
  let score = 0;
  if (countTag(party, roster, 'Child') === 0) {
    return 0;
  }
  score += calculateSimplePairSynergy(party, roster, 'Child', 'Guarder', 8);
  if (score == 0) {
    score += calculateSimplePairSynergy(party, roster, 'Child', 'Tank', 3);
  }
  score += calculateSimplePairSynergy(party, roster, 'Child', 'Healer', 2);
  return score;
}

export function scorePartyBySocialVitality_Zenith(party: Party, roster: CharacterRecord): number {
  const zenithId = 'zenith'; // Assuming the Zenith has a fixed identifier.
  const zenithIsInParty = party.includes(zenithId);

  // Party size must be 4 for the 2-and-2 logic to be meaningful.
  if (party.length !== 4) {
    return 0; // Not applicable for other party sizes.
  }

  let maleSociability = 0;
  let femaleSociability = 0;
  
  // We'll need the IDs grouped by gender for the new affinity logic
  const males: string[] = [];
  const females: string[] = [];

  for (const heroId of party) {
    const hero = roster[heroId];
    if (!hero) continue;
    if (hero.gender === 'Male') {
      maleSociability += hero.stats.sociability;
      males.push(heroId);
    }
    if (hero.gender === 'Female') {
      femaleSociability += hero.stats.sociability;
      females.push(heroId);
    }
  }

  const totalSociability = maleSociability + femaleSociability;
  if (totalSociability === 0) return 0;

  // --- Base Score: The original balance calculation ---
  let diff = Math.abs(maleSociability - femaleSociability);
  
  // --- Zenith's Personal Bias Bonus ---
  if (zenithIsInParty && males.length === 1) {
    diff /= 5; 
  }

  const charmerCount = countTag(party, roster, 'Charmer');
  if (charmerCount > 1 && diff <= 1) {
    diff /= 1.5; 
  }

  let score = Math.max(0, 100 - (diff / totalSociability) * 100);

  // --- NEW: Affinity Modifier for 2 Male / 2 Female Parties ---
  if (males.length === 2 && females.length === 2) {
    let affinityAdjustment = 0;
    const NEUTRAL_AFFINITY = 4; // On a 0-10 scale.

    const getAffinity = (fromId: string, toId: string) => {
      return roster[fromId]?.relationships?.[toId]?.affinity ?? NEUTRAL_AFFINITY;
    };

    // 1. Intra-Gender Rivalry (low affinity is good)
    const maleAff1 = getAffinity(males[0], males[1]);
    const maleAff2 = getAffinity(males[1], males[0]);
    affinityAdjustment += (NEUTRAL_AFFINITY - maleAff1); // Bonus if aff < 4
    affinityAdjustment += (NEUTRAL_AFFINITY - maleAff2);
    
    const femaleAff1 = getAffinity(females[0], females[1]);
    const femaleAff2 = getAffinity(females[1], females[0]);
    affinityAdjustment += (NEUTRAL_AFFINITY - femaleAff1); // Bonus if aff < 4
    affinityAdjustment += (NEUTRAL_AFFINITY - femaleAff2);

    // 2. Inter-Gender Appreciation (high affinity is good)
    for (const maleId of males) {
      for (const femaleId of females) {
        // Male -> Female affinity
        affinityAdjustment += (getAffinity(maleId, femaleId) - NEUTRAL_AFFINITY);
        // Female -> Male affinity
        affinityAdjustment += (getAffinity(femaleId, maleId) - NEUTRAL_AFFINITY);
      }
    }

    // Scale the adjustment to be a "light" modifier, e.g., +/- 15 points max
    const affinityModifier = affinityAdjustment / 4; 
    score += affinityModifier;
  }

  // Clamp final score between 0 and 100
  return Math.max(0, Math.min(100, score));
}