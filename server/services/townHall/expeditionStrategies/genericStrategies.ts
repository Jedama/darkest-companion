/**
 * @file Contains all generic, "objective" scoring functions for evaluating parties
 * and compositions. These strategies form the foundation of the expedition planner
 * and can be used in any character's strategy profile.
 */

import { CharacterRecord } from '../../../../shared/types/types';
import { AfflictionType, VirtueType, isAffliction, isVirtue } from '../../../../shared/constants/conditions.js';
import { Party, Composition } from '../expeditionPlanner';
import {
  countTag,
  calculateStackingPairSynergy,
  calculateSimplePairSynergy,
  calculateCombinatorialSynergy,
  calculateStackingTagSynergy
} from './strategyUtils.js';

// ==================================
// MAPS FOR SCORING
// ==================================

// --- Severity & Benefit Mappings ---
// These maps translate a named condition into a numerical score.
const AFFLICTION_SEVERITY: Record<AfflictionType, number> = {
  // High disruption
  abusive: 80,
  paranoid: 75,
  ferocious: 70,
  // High risk
  masochistic: 65,
  fearful: 60,
  refracted: 60,
  // Moderate disruption
  irrational: 50,
  selfish: 45,
  discordant: 45,
  // Low disruption
  hopeless: 35,
  rapturous: 30,
};

const VIRTUE_BENEFIT: Record<VirtueType, number> = {
  stalwart: 50,
  courageous: 45,
  vigorous: 40,
  powerful: 35,
  focused: 30,
};

// ==================================
// GAMEPLAY SYNERGY SCORING
// ==================================

export function scorePartyByGameplaySynergy(party: Party, roster: CharacterRecord): number {
  let score = 0;

  // --- FOUNDATION ROLE BONUSES (Raising the Sea Level) ---
  let roleBonus = 0;

  // Archetype 1: Does the party have a Protector?
  if (countTag(party, roster, 'Tank') > 0 || countTag(party, roster, 'Guarder') > 0) {
    roleBonus += 10;
  }

  // Archetype 2: Does the party have a Sustainer?
  if (countTag(party, roster, 'Healer') > 0 || countTag(party, roster, 'StressHealer') > 0 || countTag(party, roster, 'Cleanser') > 0) {
    roleBonus += 10;
  }

  // Archetype 3: Does the party have a Controller?
  if (countTag(party, roster, 'Stunner') > 0 || countTag(party, roster, 'Disruptor') > 0 || countTag(party, roster, 'Debuffer') > 0) {
    roleBonus += 5;
  }

  // Archetype 4: Does the party have a Striker?
  if (countTag(party, roster, 'HeavyHitter') > 0 || countTag(party, roster, 'Bleeder') > 0 || countTag(party, roster, 'Blighter') > 0) {
    roleBonus += 5;
  }

  // Archetype 5: Does the party have a Front- and Backliner?
  if (countTag(party, roster, 'Frontliner') > 0 || countTag(party, roster, 'Flexible') > 0 || countTag(party, roster, 'Dancer') > 0) {
    roleBonus += 5;
  }
  if (countTag(party, roster, 'Backliner') > 0 || countTag(party, roster, 'Flexible') > 0 || countTag(party, roster, 'Dancer') > 0) {
    roleBonus += 5;
  }

  // Add the role bonus to the main score
  score += roleBonus;

  // --- KEYSTONE + ENABLER SYNERGIES (A + B Stacking) ---
  score += calculateStackingPairSynergy(party, roster, 'Marker', 'MarkSynergy', 30, 5, 15);
  score += calculateStackingPairSynergy(party, roster, 'Blighter', 'BlightSynergy', 25, 5, 10);
  score += calculateStackingPairSynergy(party, roster, 'Bleeder', 'BleedSynergy', 25, 5, 10);
  score += calculateStackingPairSynergy(party, roster, 'Stunner', 'StunSynergy', 25, 5, 10);
  // Stunners buy time for Setup heroes to do their thing.
  score += calculateStackingPairSynergy(party, roster, 'Stunner', 'Setup', 20, 10, 5);

  // --- SIMPLE PAIR SYNERGIES (One-to-One relationships) ---
  score += calculateSimplePairSynergy(party, roster, 'Guarder', 'Frail', 30);
  score += calculateSimplePairSynergy(party, roster, 'Riposter', 'Healer', 10);
  score += calculateSimplePairSynergy(party, roster, 'Buffer', 'HeavyHitter', 15);
  // A flexible hero in a dance troupe is a nice bonus.
  score += calculateCombinatorialSynergy(party, roster, 'Dancer', 'Flexible', 10);

  // --- WOLFPACK SYNERGIES (More of the same is good) ---
  score += calculateStackingTagSynergy(party, roster, 'Dancer', 5, 20, 2);

  // --- ANTI-SYNERGIES (using the same helpers with negative scores) ---
  score += calculateSimplePairSynergy(party, roster, 'Dancer', 'Immobile', -5);
  score += calculateSimplePairSynergy(party, roster, 'Guarder', 'Hider', -5);

  // Positional gridlock
  score += calculateStackingTagSynergy(party, roster, 'Frontline', -50, -25, 3);
  score += calculateStackingTagSynergy(party, roster, 'Backline', -40, -20, 3);

  score += calculateStackingTagSynergy(party, roster, 'Weak', -60, -30, 2); // The Pillow Fort

  // Stress still needs custom logic as it's a bit more complex.
  const selfStressCount = countTag(party, roster, 'SelfStress');
  const stressHealerCount = countTag(party, roster, 'StressHealer');
  if (selfStressCount > 0 && stressHealerCount === 0) score -= 40 * selfStressCount;
  else if (selfStressCount > stressHealerCount) score -= 25 * (selfStressCount - stressHealerCount);

  return score;
}

// ==================================
// CORE PARTY SCORING FUNCTIONS
// ==================================

export function scorePartyByLevelPenalty(party: Party, roster: CharacterRecord): number {
  if (party.length === 0) return 0;
  const levels = party.map(id => roster[id]?.level ?? 0);
  const maxLevel = Math.max(...levels);
  let missionLevelTier = 0;
  if (maxLevel >= 5) missionLevelTier = 5;
  else if (maxLevel >= 3) missionLevelTier = 3;
  else missionLevelTier = 0;
  let totalHardship = 0;
  for (const level of levels) {
    let hardship = missionLevelTier - level;
    if (hardship < 0) hardship = 0; // No penalty for being overleveled
    totalHardship += Math.pow(hardship, 1.5);
  }

  // Cap total hardship at 8, as anything beyond is a disaster.
  if (totalHardship > 8) totalHardship = 8;

  return totalHardship;
}

export function scorePartyByAffinity(party: Party, roster: CharacterRecord): number {
  let totalAffinity = 0;
  if (party.length < 2) return 0;
  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1 = roster[party[i]];
      const char2 = roster[party[j]];
      if (!char1 || !char2) continue;
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? 3;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? 3;
      totalAffinity += affinity1to2 + affinity2to1;
    }
  }
  return totalAffinity;
}

export function scorePartyByPeakAffinity(party: Party, roster: CharacterRecord): number {
  let totalPeakAffinity = 0;
  if (party.length < 2) return 0;
  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1 = roster[party[i]];
      const char2 = roster[party[j]];
      if (!char1 || !char2) continue;
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? 3;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? 3;
      totalPeakAffinity += Math.pow(affinity1to2, 1.25) + Math.pow(affinity2to1, 1.25);
    }
  }
  return totalPeakAffinity;
}

export function scorePartyByDiscordPenalty(party: Party, roster: CharacterRecord): number {
  let totalDiscord = 0;
  if (party.length < 2) return 0;
  const MAX_AFFINITY = 10;
  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1 = roster[party[i]];
      const char2 = roster[party[j]];
      if (!char1 || !char2) continue;
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? 3;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? 3;
      totalDiscord += Math.pow(MAX_AFFINITY - affinity1to2, 1.25);
      totalDiscord += Math.pow(MAX_AFFINITY - affinity2to1, 1.25);
    }
  }
  return totalDiscord;
}

export function scorePartyByCommandClarity(party: Party, roster: CharacterRecord): number {
  if (party.length < 2) return 0;

  const partyLevels = party.map(id => roster[id]?.level ?? 0);
  const maxLevelInParty = Math.max(...partyLevels);

  const partyWithEAS = party.map(id => {
    const hero = roster[id];
    let bonus = 0;
    if (hero.tags.includes('Leader')) bonus += 3;
    if (hero.tags.includes('Strategist')) bonus += 2;
    if (hero.tags.includes('Unstable')) bonus -= 3;
    if (hero.tags.includes('Child')) bonus -= 2;
    const levelDeficit = maxLevelInParty - hero.level;
    bonus -= levelDeficit;
    const eas = hero.stats.authority + bonus;
    return { id, eas, hero };
  }).sort((a, b) => b.eas - a.eas);

  const leader1 = partyWithEAS[0];
  const leader2 = partyWithEAS[1];

  const scoreA = leader1.eas * 2;
  const primaryGap = leader1.eas - leader2.eas;
  const scoreB = Math.log(primaryGap + 1) * 5;
  const potentialScore = scoreA + scoreB;

  let totalPressureScore = 0;
  for (let i = 1; i < partyWithEAS.length; i++) {
    const subordinate = partyWithEAS[i];
    const gap_to_leader = leader1.eas - subordinate.eas;
    const riskFactor = 1 / (gap_to_leader + 0.5);
    const affinity_to_leader = subordinate.hero.relationships[leader1.id]?.affinity ?? 3;
    let affinityModifier = affinity_to_leader - 6;
    if (subordinate.hero.tags.includes('Abrasive')) {
      affinityModifier -= 1.5;
    }
    totalPressureScore += (riskFactor * affinityModifier * 5);
  }

  const cohesionFactor = 1 + (totalPressureScore / 25);
  return potentialScore * cohesionFactor;
}

export function scorePartyByLiabilityExposure(party: Party, roster: CharacterRecord): number {
  let totalRiskScore = 0;
  if (party.length === 0) return 0;
  const partyHeroes = party.map(id => roster[id]);
  for (const hero of partyHeroes) {
    if (!hero) continue;
    const otherHeroes = partyHeroes.filter(h => h && h.identifier !== hero.identifier);
    if (hero.tags.includes('Unstable')) {
      let containmentScore = 0;
      for (const stabilizer of otherHeroes) {
        const affinity = stabilizer.relationships[hero.identifier]?.affinity ?? 3;
        const healerBonus = stabilizer.tags.includes('StressHealer') ? 8 : 0;
        containmentScore += stabilizer.stats.authority + (stabilizer.stats.strength * 0.5) + affinity + healerBonus;
      }
      totalRiskScore += Math.max(0, 80 - (containmentScore * 2.5));
    }
    if (hero.tags.includes('Brink') && !hero.tags.includes('SelfSufficient')) {
      if (!otherHeroes.some(h => h.tags.includes('Healer'))) totalRiskScore += 10;
    }
    if (hero.tags.includes('Elder')) {
        let careScore = 0;
        for (const caretaker of otherHeroes) {
            careScore += caretaker.stats.strength + (caretaker.tags.includes('Guarder') ? 10 : 0);
        }
        totalRiskScore += Math.max(0, 28 - careScore);
    }
    if (hero.tags.includes('Outcast')) {
        let socialIntegration = 0;
        for (const unifier of otherHeroes) {
            socialIntegration += (unifier.stats.sociability * 0.5) + (unifier.tags.includes('Charmer') ? 8 : 0) + (unifier.tags.includes('StressHealer') ? 5 : 0);
        }
        totalRiskScore += Math.max(0, 22 - socialIntegration);
    }
    if (hero.tags.includes('SelfStress')) {
        let supportScore = 0;
        for (const supporter of otherHeroes) {
            supportScore += (supporter.stats.sociability * 1.2) + (supporter.tags.includes('StressHealer') ? 12 : 0);
        }
        totalRiskScore += Math.max(0, 25 - supportScore);
    }
    if (hero.tags.includes('Drunkard')) {
        let temptationScore = 0;
        let disciplineScore = 0;
        for (const influencer of otherHeroes) {
            temptationScore += (influencer.tags.includes('Entertainer') ? 3 : 0) + (influencer.tags.includes('Charmer') ? 2 : 0) + (influencer.stats.sociability * 0.2);
            disciplineScore += (influencer.tags.includes('Cleanser') ? 8 : 0) + (influencer.tags.includes('Just') ? 4 : 0) + (influencer.stats.authority * 0.5);
        }
        totalRiskScore += Math.max(0, temptationScore - disciplineScore) * 3;
    }
  }
  let corruptionPressure = 0;
  let moralFortitude = 0;
  for (const hero of partyHeroes) {
    if (!hero) continue;
    if (hero.tags.includes('Immoral')) {
      corruptionPressure += hero.stats.authority * 0.75 + hero.stats.sociability * 0.8;
    } else if (hero.tags.includes('Just')) {
      moralFortitude += hero.stats.authority * 2.0;
    } else {
      moralFortitude += hero.stats.authority * 0.75;
    }
  }
  if (corruptionPressure > 0) {
    totalRiskScore += Math.max(0, corruptionPressure - moralFortitude) * 2;
  }
  const immobileCount = countTag(party, roster, 'Immobile');
  if (immobileCount > 0) {
      const positionalRiskBase = Math.pow(immobileCount, 2) * 10;
      let repositioningScore = 0;
      for (const hero of partyHeroes) {
        if (!hero) continue;
        repositioningScore += (hero.tags.includes('Dancer') ? 12 : 0) + hero.stats.agility;
      }
      const avgRepositioning = party.length > 0 ? repositioningScore / party.length : 1;
      totalRiskScore += positionalRiskBase / avgRepositioning;
  }
  return totalRiskScore;
}

export function scorePartyByTacticalNonsense(party: Party, roster: CharacterRecord): number {
  let nonsenseScore = 0; // Starts at 0, goes negative.

  // 1. Penalize over-reliance on luck/enemy action
  nonsenseScore += calculateStackingTagSynergy(party, roster, 'Crit', 10, 15, 2); // Crits are unreliable
  nonsenseScore += calculateStackingTagSynergy(party, roster, 'Riposter', 15, 20, 2); // Riposters rely on enemy actions
  nonsenseScore += countTag(party, roster, 'Brink') * 50; // Being on low health is not a strategy, it's a liability

  // 2. Penalize inefficient or slow setups
  nonsenseScore += calculateStackingTagSynergy(party, roster, 'Setup', -5, 25, 1); // Too many setup heroes is exploitable
  nonsenseScore += calculateStackingTagSynergy(party, roster, 'Stealther', -5, 20, 1); // Half the party can't be hiding

  // 3. Penalize chaotic movement
  nonsenseScore += calculateStackingTagSynergy(party, roster, 'Dancer', 10, 15, 2); // The battlefield is not a dance floor
  nonsenseScore += calculateStackingTagSynergy(party, roster, 'Disruptor', -5, 10, 1); // We don't need everyone throwing enemies around
  
  return nonsenseScore;
}


// ==================================
// COMPOSITION SCORING FUNCTIONS
// ==================================

/**
 * [HELPER] Calculates a detailed breakdown of a hero's condition liability.
 */
function getDetailedLiability(hero: CharacterRecord[string] | undefined): { stress: number, other: number, total: number } {
  if (!hero) return { stress: 0, other: 0, total: 0 };

  let stressLiability = 0;
  let otherLiability = 0;

  // --- Stress Penalty (Exponential) ---
  const stress = 100 - hero.status.mental;
  stressLiability += Math.pow(stress / 10, 2.5);

  // --- Health Penalty (Linear) ---
  const missingHealth = 100 - hero.status.physical;
  otherLiability += missingHealth * 0.25;

  // --- Affliction/Virtue Modifier ---
  const condition = hero.status.affliction;
  if (condition) {
    if (isAffliction(condition)) {
      otherLiability += AFFLICTION_SEVERITY[condition];
    } else if (isVirtue(condition)) {
      // A virtue reduces non-stress liability (it makes you more resilient)
      otherLiability -= VIRTUE_BENEFIT[condition] * 1.5;
    }
  }

  const totalLiability = stressLiability + otherLiability;
  return {
      stress: Math.max(0, stressLiability),
      other: Math.max(0, otherLiability),
      total: Math.max(0, totalLiability)
  };
}

/**
 * [REVISED] Calculates a holistic "Total Liability" score for a composition.
 * This score's primary purpose is to heavily penalize the inclusion of any high-risk
 * heroes (high stress, afflicted, low health) anywhere in the composition. The balancing
 * of risk between parties is now a secondary, but still present, concern.
 *
 * It works by:
 * 1. Calculating an individual, non-linear "liability" score for each hero.
 * 2. Summing these scores to get a total liability for the entire composition (primary component).
 * 3. Adding a penalty based on the standard deviation of liability between parties (secondary component).
 *
 * The goal is to minimize this score. A higher score means more overall liability and/or imbalance.
 */
export function scoreCompositionByConditionBalance(composition: Composition, roster: CharacterRecord): number {
  if (composition.length === 0) return 0;

  const STRESS_HEALER_FACTOR = 0.9; // Stress healers reduce stress liability by 10%

  const partyLiabilityScores = composition.map(party => {
    if (party.length === 0) return 0;

    // 1. Identify if a stress healer is present in this specific party.
    const partyHasStressHealer = party.some(id => {
      const hero = roster[id];
      return hero && (hero.tags.includes('StressHealer'));
    });

    // 2. Calculate the total stress liability and other liability for the party.
    let totalPartyStressLiability = 0;
    let totalPartyOtherLiability = 0;

    for (const id of party) {
        const detailedLiability = getDetailedLiability(roster[id]);
        totalPartyStressLiability += detailedLiability.stress;
        totalPartyOtherLiability += detailedLiability.other;
    }

    // 3. If a healer is present, apply the multiplicative bonus ONLY to the stress part.
    if (partyHasStressHealer) {
        totalPartyStressLiability *= STRESS_HEALER_FACTOR;
    }
    
    // 4. The final liability for this party is the sum of the (potentially reduced) stress
    //    and the unchanged other liabilities.
    return totalPartyStressLiability + totalPartyOtherLiability;
  });

  // 1. Calculate the TOTAL liability.
  const totalCompositionLiability = partyLiabilityScores.reduce((sum, score) => sum + score, 0);

  // 2. The PRIMARY component of the score is the AVERAGE liability per party.
  // This is what we will return. It's clean, simple, and size-independent.
  const averagePartyLiability = totalCompositionLiability / composition.length;

  // --- Handling the Imbalance Penalty ---
  // The imbalance should be a small nudge, not a core part of the score that gets normalized.
  // We can add it as a small percentage of the main score.
  if (partyLiabilityScores.length > 1) {
    const meanLiability = averagePartyLiability; // Same value
    const variance = partyLiabilityScores
      .map(score => Math.pow(score - meanLiability, 2))
      .reduce((sum, squaredDiff) => sum + squaredDiff, 0) / partyLiabilityScores.length;
    const imbalancePenalty = Math.sqrt(variance);

    // Instead of adding them, make the penalty a *small multiplier* on the main score.
    // e.g., add 0.1% of the imbalance penalty value to the average liability.
    // This gives a tiny nudge towards balance without corrupting the main metric.
    // The '0.1' here is a tuning factor.
    return averagePartyLiability + (imbalancePenalty * 0.1);
  }

  // If only one party, just return the average liability.
  return averagePartyLiability;
}


export function scoreCompositionByAuthorityBalance(composition: Composition, roster: CharacterRecord): number {
  // ... this function remains unchanged ...
  if (composition.length < 2) return 0;

  const leadershipPotentialScores = composition.map(party => {
    if (party.length === 0) return 0;
    
    const partyAuthorities = party.map(id => roster[id]?.stats.authority ?? 0).sort((a, b) => b - a);
    
    const maxAuthority = partyAuthorities[0] ?? 0;
    const secondMaxAuthority = partyAuthorities[1] ?? 0;
    
    return maxAuthority + (0.4 * secondMaxAuthority);
  });

  const meanLPS = leadershipPotentialScores.reduce((a, b) => a + b, 0) / leadershipPotentialScores.length;
  const variance = leadershipPotentialScores.map(lps => Math.pow(lps - meanLPS, 2)).reduce((a, b) => a + b, 0) / leadershipPotentialScores.length;
  
  return Math.sqrt(variance);
}