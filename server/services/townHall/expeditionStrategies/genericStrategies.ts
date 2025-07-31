/**
 * @file Contains all generic, "objective" scoring functions for evaluating parties
 * and compositions. These strategies form the foundation of the expedition planner
 * and can be used in any character's strategy profile.
 */

import { CharacterRecord } from '../../../../shared/types/types';
import { Party, Composition } from '../expeditionPlanner';
import {
  countTag,
  calculateStackingPairSynergy,
  calculateSimplePairSynergy,
  calculateCombinatorialSynergy,
  calculateStackingTagSynergy
} from './strategyUtils';

// ==================================
// GAMEPLAY SYNERGY SCORING
// ==================================

export function scorePartyByGameplaySynergy(party: Party, roster: CharacterRecord): number {
    let score = 0;

    // --- KEYSTONE + ENABLER SYNERGIES (A + B Stacking) ---
    score += calculateStackingPairSynergy(party, roster, 'Marker', 'MarkSynergy', 30, 5, 15);
    score += calculateStackingPairSynergy(party, roster, 'Blighter', 'BlightSynergy', 25, 5, 10);
    score += calculateStackingPairSynergy(party, roster, 'Bleeder', 'BleedSynergy', 25, 5, 10);
    score += calculateStackingPairSynergy(party, roster, 'Stunner', 'StunSynergy', 25, 5, 10);
    // Stunners buy time for Setup heroes to do their thing.
    score += calculateStackingPairSynergy(party, roster, 'Stunner', 'Setup', 20, 10, 5);

    // --- SIMPLE PAIR SYNERGIES (One-to-One relationships) ---
    score += calculateSimplePairSynergy(party, roster, 'Guarder', 'Frail', 40);
    score += calculateSimplePairSynergy(party, roster, 'Riposter', 'Healer', 15);
    // A flexible hero in a dance troupe is a nice bonus.
    score += calculateCombinatorialSynergy(party, roster, 'Dancer', 'Flexible', 10);

    // --- WOLFPACK SYNERGIES (More of the same is good) ---
    score += calculateStackingTagSynergy(party, roster, 'Dancer', 5, 20, 2);

    // --- ANTI-SYNERGIES (using the same helpers with negative scores) ---
    score += calculateSimplePairSynergy(party, roster, 'Dancer', 'Immobile', -40);
    score += calculateSimplePairSynergy(party, roster, 'Guarder', 'Hider', -15);

    // Positional gridlock
    score += calculateStackingTagSynergy(party, roster, 'Frontline', -50, -25, 3);
    score += calculateStackingTagSynergy(party, roster, 'Backline', -40, -20, 3);

    score += calculateStackingTagSynergy(party, roster, 'Weak', -60, -30, 2); // The Pillow Fort

    // Stress still needs custom logic as it's a bit more complex.
    const selfStressCount = countTag(party, roster, 'SelfStress');
    const stressHealerCount = countTag(party, roster, 'StressHealer');
    if (selfStressCount > 0 && stressHealerCount === 0) score -= 40 * selfStressCount;
    if (selfStressCount > stressHealerCount) score -= 50 * (selfStressCount - stressHealerCount);

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

export function scorePartyByChildGuardianship(party: Party, roster: CharacterRecord): number {
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

// ==================================
// GENERIC "OPINIONATED" STRATEGIES
// ==================================

/**
 * Calculates a "command clarity" score based on a standard, objective model.
 * It values experience, recognized leadership tags, and a clear authority gap,
 * while penalizing instability.
 */
export function maximizeCommandClarity(party: Party, roster: CharacterRecord): number {
  if (party.length < 2) return 0;

  const partyLevels = party.map(id => roster[id]?.level ?? 0);
  const maxLevelInParty = Math.max(...partyLevels);

  // STEP 1: Calculate "Standard" Effective Authority Score (EAS)
  const partyWithEAS = party.map(id => {
    const hero = roster[id];
    let bonus = 0;

    // Objective Qualifications:
    if (hero.tags.includes('Leader')) bonus += 3;
    if (hero.tags.includes('Strategist')) bonus += 2;

    // Objective Penalties:
    if (hero.tags.includes('Unstable')) bonus -= 3;
    if (hero.tags.includes('Child')) bonus -= 2; // Children are seen as less reliable

    // Experience Factor: Punishes inexperience relative to the team's best.
    const levelDeficit = maxLevelInParty - hero.level;
    bonus -= levelDeficit; // Each level below the max is a -1 EAS penalty.

    const eas = hero.stats.authority + bonus;
    return { id, eas, hero };
  }).sort((a, b) => b.eas - a.eas);

  const leader1 = partyWithEAS[0];
  const leader2 = partyWithEAS[1];

  // STEP 2: Calculate Potential Score (Balanced View)
  const scoreA = leader1.eas * 2; // Moderate weight on leader's power
  const primaryGap = leader1.eas - leader2.eas;
  const scoreB = Math.log(primaryGap + 1) * 5; // Moderate weight on the gap
  const potentialScore = scoreA + scoreB;

  // STEP 3: Calculate Total Pressure Score (Reasonable)
  let totalPressureScore = 0;
  for (let i = 1; i < partyWithEAS.length; i++) {
    const subordinate = partyWithEAS[i];
    const gap_to_leader = leader1.eas - subordinate.eas;
    const riskFactor = 1 / (gap_to_leader + 0.5);

    // Reasonable Neutral Point: Basic respect is the baseline.
    const affinity_to_leader = subordinate.hero.relationships[leader1.id]?.affinity ?? 3;
    let affinityModifier = affinity_to_leader - 6;

    // An Abrasive subordinate adds significant pressure, independent of their loyalty.
    if (subordinate.hero.tags.includes('Abrasive')) {
      affinityModifier -= 1.5;
    }

    totalPressureScore += (riskFactor * affinityModifier * 5);
  }

  // STEP 4: Convert to Cohesion Factor (More sensitive to internal strife)
  const cohesionFactor = 1 + (totalPressureScore / 25); // Smaller denominator = more swing

  // STEP 5: Final Score
  return potentialScore * cohesionFactor;
}

/**
 * Calculates a total liability exposure score for a given party.
 * A lower score is better (target is 0). The goal is to create a balanced party
 * where character weaknesses are mitigated by the strengths of their companions.
 */
export function minimizeLiabilityExposure(party: Party, roster: CharacterRecord): number {
  let totalRiskScore = 0;
  if (party.length === 0) return 0;

  const partyHeroes = party.map(id => roster[id]);

  // SECTION 1: INDIVIDUAL RISK ASSESSMENT
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

  // SECTION 2: GROUP RISK ASSESSMENT
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

// ==================================
// COMPOSITION SCORING FUNCTIONS
// ==================================

export function scoreCompositionByAuthorityDistribution(composition: Composition, roster: CharacterRecord): number {
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