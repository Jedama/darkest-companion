/**
 * @file Contains all generic, "objective" scoring functions for evaluating parties
 * and compositions. These strategies form the foundation of the expedition planner
 * and can be used in any character's strategy profile.
 */

import { CharacterRecord, Character, StrategyContext } from '../../../../shared/types/types.js';
import { AfflictionType, VirtueType, isAffliction, isVirtue } from '../../../../shared/constants/conditions.js';
import { Party, Composition } from '../expeditionPlanner.js';
import { NEUTRAL_AFFINITY, MAX_AFFINITY } from '../../../../shared/constants/relationships.js';
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
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? NEUTRAL_AFFINITY;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? NEUTRAL_AFFINITY;
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
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? NEUTRAL_AFFINITY;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? NEUTRAL_AFFINITY;
      totalPeakAffinity += Math.pow(affinity1to2, 1.25) + Math.pow(affinity2to1, 1.25);
    }
  }
  return totalPeakAffinity;
}

export function scorePartyByDiscordPenalty(party: Party, roster: CharacterRecord): number {
  let totalDiscord = 0;
  if (party.length < 2) return 0;
  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1 = roster[party[i]];
      const char2 = roster[party[j]];
      if (!char1 || !char2) continue;
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? NEUTRAL_AFFINITY;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? NEUTRAL_AFFINITY;
      totalDiscord += Math.pow(MAX_AFFINITY - affinity1to2, 1.25);
      totalDiscord += Math.pow(MAX_AFFINITY - affinity2to1, 1.25);
    }
  }
  return totalDiscord;
}

/**
 * [GENERIC] Honors this month's party intents — the signed, pair-wise "march
 * together" / "refuse to march together" decisions raised by the planning
 * meeting (or any other consequence pass) and carried in ctx.partyIntents.
 *
 * Unlike maximizeAffinity, this reads an explicit, one-off decision rather
 * than ambient relationship data, and is meant to weigh in more decisively:
 * a stated refusal should reliably split a pair, not just nudge against them.
 * Purged monthly by the caller once expeditions are actually assembled, so
 * there is nothing to decay or expire here — every intent present is live.
 */
export function scorePartyByPartyIntents(party: Party, roster: CharacterRecord, ctx?: StrategyContext): number {
  if (!ctx?.partyIntents || ctx.partyIntents.length === 0 || party.length < 2) return 0;

  const members = new Set(party);
  let score = 0;
  for (const intent of ctx.partyIntents) {
    if (members.has(intent.a) && members.has(intent.b)) {
      score += intent.score;
    }
  }
  return score;
}

export function scorePartyByCommandClarity(party: Party, roster: CharacterRecord): number {
  if (party.length < 2) return 0;

  const partyLevels = party.map(id => roster[id]?.level ?? 0);
  const maxLevelInParty = Math.max(...partyLevels);

  const partyWithEAS = party.map(id => {
    const hero = roster[id];
    if (!hero) return { id, eas: -Infinity, hero: null }; // safeguard against stale ids
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
  if (!leader1?.hero || !leader2?.hero) return 0;

  const scoreA = leader1.eas * 2;
  const primaryGap = leader1.eas - leader2.eas;
  const scoreB = Math.log(primaryGap + 1) * 5;
  const potentialScore = scoreA + scoreB;

  let totalPressureScore = 0;
  for (let i = 1; i < partyWithEAS.length; i++) {
    const subordinate = partyWithEAS[i];
    if (!subordinate.hero) continue;
    const gap_to_leader = leader1.eas - subordinate.eas;
    const riskFactor = 1 / (gap_to_leader + 0.5);
    const affinity_to_leader = subordinate.hero.relationships[leader1.id]?.affinity ?? NEUTRAL_AFFINITY;
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
        const affinity = stabilizer.relationships[hero.identifier]?.affinity ?? NEUTRAL_AFFINITY;
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

/**
 * [GENERIC] Maximizes the effectiveness of a "dedicated protector" party structure.
 *
 * This strategy is based on the philosophy that a party's defensive strength is
 * the product of a powerful protector multiplied by the party's effective
 * utilization of that protection. A great shield is useless if there's nothing
 * fragile to defend.
 *
 * The function scores a party by:
 * 1. Identifying the single best protector (the "Bulwark") based on a score
 *    derived primarily from defensive tags (`Tank`, `Guarder`) and modified by
 *    Strength and relative Level.
 * 2. Calculating the "Vulnerability" of the other three members (the "Wards")
 *    based on tags like `Frail` and `Child`.
 * 3. The final score is the natural logarithm of (`Bulwark's Score` * `Total Vulnerability`),
 *    which heavily rewards parties that pair a strong protector with genuinely
 *    vulnerable allies, while compressing the final score to a manageable range.
 *
 * @param party The party to be scored.
 * @param roster The complete character roster.
 * @returns A score representing the party's defensive synergy. Higher is better.
 */
export function scorePartyByDedicatedProtector(party: Party, roster: CharacterRecord): number {
  // Generalized off a hardcoded size of 4: this "one bulwark, everyone else is a ward"
  // model works for any party of >= 2. The filter also drops any stale/missing ids.
  const partyHeroes = party.map(id => roster[id]).filter((h): h is Character => !!h);
  if (partyHeroes.length < 2) {
    return 0;
  }

  const averagePartyLevel = partyHeroes.reduce((sum, h) => sum + h.level, 0) / partyHeroes.length;

  // ===================================================================
  // 1. Calculate the "Protector Score" for every hero to find the Bulwark.
  // ===================================================================
  const protectorScores = partyHeroes.map(hero => {
    // --- Base Score from Tags ---
    let baseScore = 1; // "Best of a bad situation" base value.
    if (hero.tags.includes('Tank')) baseScore += 30;
    if (hero.tags.includes('Guarder')) baseScore += 25;
    if (hero.tags.includes('SelfSufficient')) baseScore += 10;
    if (hero.tags.includes('Warrior')) baseScore += 5; // Small bonus for martial training

    // --- Stat & Level Modifiers ---
    const strengthModifier = 1 + (hero.stats.strength / 10); // Range [1.0, 2.0]
    const levelDelta = hero.level - averagePartyLevel;
    const levelModifier = 1 + (levelDelta * 0.1);

    return {
      id: hero.identifier,
      score: baseScore * strengthModifier * levelModifier,
    };
  });

  // Identify the Bulwark (hero with the highest Protector Score).
  protectorScores.sort((a, b) => b.score - a.score);
  const bulwark = protectorScores[0];
  const bulwarkPotency = bulwark.score;

  // ===================================================================
  // 2. Calculate the "Vulnerability" of the Wards.
  // ===================================================================
  const wards = partyHeroes.filter(h => h.identifier !== bulwark.id);
  let partyVulnerability = 0;

  for (const ward of wards) {
    // --- Base Score from Tags ---
    let baseVulnerability = 0;
    if (ward.tags.includes('Child')) baseVulnerability += 30; // Highest priority
    if (ward.tags.includes('Frail')) baseVulnerability += 20;
    if (ward.tags.includes('Weak')) baseVulnerability += 15;
    if (ward.tags.includes('Hider')) baseVulnerability += 10;
    if (ward.tags.includes('Backline')) baseVulnerability += 5;

    // --- Stat Modifier ---
    const fragilityModifier = 1 + ((10 - ward.stats.strength) / 10); // Range [1.0, 2.0]

    partyVulnerability += baseVulnerability * fragilityModifier;
  }

  // ===================================================================
  // 3. Calculate the Final, Scaled Score.
  // ===================================================================
  const rawScore = bulwarkPotency * partyVulnerability;

  // Use the natural logarithm to compress the score into a manageable range.
  // The `+ 1` ensures the input is always positive.
  const scaledScore = Math.log(rawScore + 1);

  return scaledScore;
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

    // Add a small, fixed fraction of the inter-party liability std-dev as a nudge toward
    // balance, without letting imbalance dominate the (primary) average-liability metric.
    // IMBALANCE_WEIGHT is 0.1 = 10% of the std-dev (the old comment mis-stated this as 0.1%).
    const IMBALANCE_WEIGHT = 0.1;
    return averagePartyLiability + (imbalancePenalty * IMBALANCE_WEIGHT);
  }

  // If only one party, just return the average liability.
  return averagePartyLiability;
}


export function scoreCompositionByAuthorityBalance(composition: Composition, roster: CharacterRecord): number {
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

// ==================================
// EXPEDITION YIELD
// ==================================

/**
 * Value that a party can plausibly bring home, expressed as three factors:
 * FIND it, APPRAISE it, HAUL it.
 *
 * Deliberately narrow. Survivability, cohesion and tactical soundness are the
 * business of other strategies; this one only asks how much wealth walks back
 * through the gate. The tags it reads (Scavenger, Scout, Scholar/Scholarly)
 * are otherwise untouched by the registry, so it carves out its own territory
 * rather than restating scorePartyByGameplaySynergy in a different currency.
 *
 * Exported because the Claimants' variant scores every party's haul too — with
 * the sign reversed for anyone who isn't them.
 */
export function calculateHaulValue(party: Party, roster: CharacterRecord): number {
  if (party.length === 0) return 0;
  const heroes = party.map(id => roster[id]).filter((h): h is Character => !!h);
  if (heroes.length === 0) return 0;

  // --- FIND ---
  // Having a Scavenger gives +6.0. Extra Scavengers yield ZERO additional bonus.
  const scavengers = countTag(party, roster, 'Scavenger');
  const scouts = countTag(party, roster, 'Scout');
  const findValue = 1 + (scavengers > 0 ? 6.0 : 0) + (scouts * 0.4);

  // --- HAUL ---
  let carriers = 0;
  for (const hero of heroes) {
    let contribution = hero.stats.strength;
    if (hero.tags.includes('Child')) contribution -= 4;
    if (hero.tags.includes('Elder')) contribution -= 3;
    carriers += contribution;
  }
  const haulModifier = 1 + (Math.max(0, carriers) * 0.01);

  // --- APPRAISE ---
  const scholars = heroes.filter(h =>
    h.tags.includes('Scholar') || h.tags.includes('Scholarly')
  ).length;
  const appraiseModifier = 1 + (scholars * 0.10);

  return findValue * haulModifier * appraiseModifier;
}

/**
 * [GENERIC] Maximizes the wealth an expedition brings back to the Hamlet.
 *
 * Base value is FIND x APPRAISE x HAUL (see calculateHaulValue). On top of that,
 * and ONLY when the party actually has a Scavenger, it rewards two things that
 * let a treasure-finder keep working: level headroom inside the mission bracket,
 * and a party built to hold a room rather than flee it.
 *
 * That conditional matters. Level parity and role coverage are already the
 * business of minimizeLevelHardship and maximizeGameplaySynergy; restating them
 * unconditionally here would just be a second vote for the same thing. Applied
 * only behind a Scavenger, they mean something specific: a team that can find
 * treasure should be equipped to stay in the dungeon and strip it properly.
 */
export function scorePartyByExpeditionYield(party: Party, roster: CharacterRecord): number {
  if (party.length === 0) return 0;

  let value = calculateHaulValue(party, roster);

  const scavengers = countTag(party, roster, 'Scavenger');
  if (scavengers > 0) {
    const heroes = party.map(id => roster[id]).filter((h): h is Character => !!h);
    if (heroes.length > 0) {

      // --- Dungeon Tier Headroom ---
      const maxLevel = Math.max(...heroes.map(h => h.level));
      const tierBaseFloor = maxLevel >= 5 ? 5 : maxLevel >= 3 ? 3 : 1;
      
      let totalHeadroom = 0;
      for (const hero of heroes) {
        totalHeadroom += Math.max(0, hero.level - tierBaseFloor);
      }
      const avgHeadroom = totalHeadroom / heroes.length; // Range [0.0, 1.0]
      const headroomBonus = avgHeadroom * 0.20; // Up to +20%

      // --- Room-Holding Archetypes (1 slot per core role, max +30%) ---
      let archetypes = 0;
      
      // 1. Defense / Tank
      if (
        countTag(party, roster, 'Tank') > 0 ||
        countTag(party, roster, 'Guarder') > 0 ||
        countTag(party, roster, 'SelfSufficient') > 0
      ) {
        archetypes++;
      }
      
      // 2. Sustain / Healing
      if (
        countTag(party, roster, 'Healer') > 0 ||
        countTag(party, roster, 'Cleanser') > 0 ||
        countTag(party, roster, 'StressHealer') > 0
      ) {
        archetypes++;
      }
      
      // 3. Offense / Damage Dealer
      if (
        countTag(party, roster, 'HeavyHitter') > 0 ||
        countTag(party, roster, 'Bleeder') > 0 ||
        countTag(party, roster, 'Blighter') > 0 ||
        countTag(party, roster, 'ArmorPiercer') > 0
      ) {
        archetypes++;
      }

      const archetypeBonus = archetypes * 0.10; // Up to +30%

      value *= (1 + headroomBonus + archetypeBonus);
    }
  }

  return Math.pow(value, 1.3);
}


// ==================================
// FACTION RISK
// ==================================

/**
 * A mutual bond between two heroes, and how dangerous that bond is.
 * Exported so character-specific variants can reuse the detection and disagree
 * only about what to do with the result.
 */
export interface DetectedBloc {
  a: string;
  b: string;
  /** How far the WEAKER of the two directed affinities sits above neutral. */
  bond: number;
  /** Bond sharpened by the pair's combined standing. */
  danger: number;
}

/**
 * Finds every mutually warm pair inside a party.
 *
 * Mutual is the point: min() of the two directed affinities, not the average.
 * One-sided admiration is not a faction — the Highwayman looking up to the
 * Crusader is a fact about the Highwayman. Two people who trust each other is
 * a fact about the Hamlet.
 *
 * The bond is raised to a power slightly above 1 so closeness ACCELERATES:
 * the step from 9 to 10 counts for more than the step from 5 to 6, because
 * inseparable allies are qualitatively worse than friendly colleagues.
 * Authority is what makes a bond dangerous rather than merely pleasant;
 * sociability contributes at a fifth of the weight, since reach amplifies
 * influence without creating it.
 */
export function detectBlocs(party: Party, roster: CharacterRecord): DetectedBloc[] {
  const blocs: DetectedBloc[] = [];
  if (party.length < 2) return blocs;

  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const heroA = roster[party[i]];
      const heroB = roster[party[j]];
      if (!heroA || !heroB) continue;

      const aToB = heroA.relationships[party[j]]?.affinity ?? NEUTRAL_AFFINITY;
      const bToA = heroB.relationships[party[i]]?.affinity ?? NEUTRAL_AFFINITY;

      const bond = Math.min(aToB, bToA) - NEUTRAL_AFFINITY;
      if (bond <= 0) continue; // indifference and dislike are not conspiracies

      const standing =
        heroA.stats.authority + heroB.stats.authority +
        0.2 * (heroA.stats.sociability + heroB.stats.sociability);

      blocs.push({
        a: heroA.identifier,
        b: heroB.identifier,
        bond,
        danger: Math.pow(bond, 1.2) * standing,
      });
    }
  }

  return blocs;
}

/**
 * [GENERIC] Minimizes the concentration of cohesive, influential heroes.
 *
 * A party containing two powerful people who genuinely trust each other is a
 * power base with legs. Minimizing this across parties scatters such pairs.
 *
 * Note this is the deliberate mirror of maximizeAffinity and maximizePeakAffinity:
 * the same pair scores well there and badly here. A character weighting both is
 * expressing something contradictory — which may be exactly right for a paranoid
 * one, but it will show up as opposing rows in the debug table and is not a bug.
 */
export function scorePartyByFactionRisk(party: Party, roster: CharacterRecord): number {
  return detectBlocs(party, roster).reduce((sum, bloc) => sum + bloc.danger, 0);
}