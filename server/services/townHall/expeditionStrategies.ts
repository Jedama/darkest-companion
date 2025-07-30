// server/services/townHall/expeditionStrategies.ts
import { CharacterRecord } from '../../../shared/types/types';
import { Party, Composition } from './expeditionPlanner';

// ==================================
// PARTY SCORING FUNCTIONS
// ==================================

function scorePartyByGameplaySynergy(party: Party, roster: CharacterRecord): number {
    let score = 0;
    score += scorePairSynergies(party, roster);
    score += scoreCompositionalSynergies(party, roster);
    return score;
}

function scorePairSynergies(party: Party, roster: CharacterRecord): number {
  let score = 0;
  if (party.length < 2) return 0;

  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const heroA_tags = roster[party[i]].tags;
      const heroB_tags = roster[party[j]].tags;

      // --- POSITIVE SYNERGIES ---
      if (hasPair(heroA_tags, heroB_tags, 'Marker', 'MarkSynergy')) score += 50;
      if (hasPair(heroA_tags, heroB_tags, 'Blighter', 'BlightSynergy')) score += 40;
      if (hasPair(heroA_tags, heroB_tags, 'Bleeder', 'BleedSynergy')) score += 40;
      if (hasPair(heroA_tags, heroB_tags, 'Stunner', 'StunSynergy')) score += 30;
      if (hasPair(heroA_tags, heroB_tags, 'Guarder', 'Frail')) score += 40;
      if (hasPair(heroA_tags, heroB_tags, 'Riposter', 'Healer')) score += 15;
      if (hasPair(heroA_tags, heroB_tags, 'Disruptor', 'ShortReach')) score += 30;

      // --- ANTI-SYNERGIES ---
      if (hasPair(heroA_tags, heroB_tags, 'Dancer', 'Immobile')) score -= 50;
      if (hasPair(heroA_tags, heroB_tags, 'Guarder', 'Hider')) score -= 20;
    }
  }
  return score;
}

// Helper function for the above
function hasPair(tagsA: string[], tagsB: string[], tag1: string, tag2: string): boolean {
    return (tagsA.includes(tag1) && tagsB.includes(tag2)) || (tagsA.includes(tag2) && tagsB.includes(tag1));
}

// Helper functions for gameplay synergy scoring
function scoreCompositionalSynergies(party: Party, roster: CharacterRecord): number {
  let score = 0;

  // --- The Dance Troupe ---
  const dancerCount = countTag(party, roster, 'Dancer');
  const flexibleCount = countTag(party, roster, 'Dancer');
  if (dancerCount >= 2) score += 25 * dancerCount + 10 * flexibleCount; // e.g., 2 dancers = +30, 3 dancers = +45

  // --- The "Pillow Fort" Anti-Synergy ---
  const weakCount = countTag(party, roster, 'Weak');
  if (weakCount > 1) score -= 75 * (weakCount - 1); // 2 weak = -50, 3 weak = -100

  // --- Positional Gridlock Anti-Synergy ---
  const frontlineOnlyCount = countTag(party, roster, 'Frontline') - countTag(party, roster, 'Flexible') - countTag(party, roster, 'Dancer');
  if (frontlineOnlyCount >= 3) score -= 75 * (frontlineOnlyCount - 2); // 3 frontline-only = -75, 4 = -150

  const backlineOnlyCount = countTag(party, roster, 'Backline') - countTag(party, roster, 'Flexible') - countTag(party, roster, 'Dancer'); 
  if (backlineOnlyCount >= 3) score -= 50 * (backlineOnlyCount - 2); // 3 backline-only = -50, 4 = -100

  // --- Stress Overload Anti-Synergy ---
  const selfStressCount = countTag(party, roster, 'SelfStress');
  const stressHealerCount = countTag(party, roster, 'StressHealer');
  if (selfStressCount > 0 && stressHealerCount === 0) score -= 40 * selfStressCount; // Each stressor is a problem without a healer
  if (selfStressCount > 1 && stressHealerCount < selfStressCount) score -= 60 * (selfStressCount - stressHealerCount); // Overwhelming the healer

  // --- Stunner + Setup/Cycler Synergy ---
  const hasStunner = hasTag(party, roster, 'Stunner');
  const setupCyclerCount = countTag(party, roster, 'Setup') + countTag(party, roster, 'Cycler');
  if (hasStunner && setupCyclerCount > 0) score += 25 * setupCyclerCount;

  return score;
}

// Helper functions for the above
function countTag(party: Party, roster: CharacterRecord, tag: string): number {
  return party.reduce((count, id) => count + (roster[id].tags.includes(tag) ? 1 : 0), 0);
}
function hasTag(party: Party, roster: CharacterRecord, tag: string): boolean {
  return party.some(id => roster[id].tags.includes(tag));
}

function scorePartyByLevelPenalty(party: Party, roster: CharacterRecord): number {
  if (party.length === 0) return 0;
  const levels = party.map(id => roster[id]?.level ?? 0);
  const maxLevel = Math.max(...levels);
  let missionLevelTier = 0;
  if (maxLevel >= 5) missionLevelTier = 5;
  else if (maxLevel >= 3) missionLevelTier = 3;
  else missionLevelTier = 0;
  let totalHardship = 0;
  for (const level of levels) {
    const hardship = missionLevelTier - level;
    if (hardship > 0) {
      totalHardship += Math.pow(hardship, 3);
    }
  }
  return totalHardship;
}

function scorePartyByAffinity(party: Party, roster: CharacterRecord): number {
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

function scorePartyByPeakAffinity(party: Party, roster: CharacterRecord): number {
  let totalPeakAffinity = 0;
  if (party.length < 2) return 0;
  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1 = roster[party[i]];
      const char2 = roster[party[j]];
      if (!char1 || !char2) continue;
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? 3;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? 3;
      totalPeakAffinity += Math.pow(affinity1to2, 2) + Math.pow(affinity2to1, 2);
    }
  }
  return totalPeakAffinity;
}

function scorePartyByDiscordPenalty(party: Party, roster: CharacterRecord): number {
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
      totalDiscord += Math.pow(MAX_AFFINITY - affinity1to2, 2);
      totalDiscord += Math.pow(MAX_AFFINITY - affinity2to1, 2);
    }
  }
  return totalDiscord;
}

// ==================================
// COMPOSITION SCORING FUNCTIONS
// ==================================

function scoreCompositionByAuthorityDistribution(composition: Composition, roster: CharacterRecord): number {
  if (composition.length < 2) return 0; // Variance is 0 if there's only one party

  // Step 1: Calculate the (Leadership Potential Score) LPS for each party
  const leadershipPotentialScores = composition.map(party => {
    if (party.length === 0) return 0;
    
    const partyAuthorities = party.map(id => roster[id]?.stats.authority ?? 0).sort((a, b) => b - a);
    
    const maxAuthority = partyAuthorities[0] ?? 0;
    const secondMaxAuthority = partyAuthorities[1] ?? 0;
    
    // The LPS formula with your specified 0.4 multiplier
    return maxAuthority + (0.4 * secondMaxAuthority);
  });

  // Step 2: Calculate the standard deviation of the LPS values
  const meanLPS = leadershipPotentialScores.reduce((a, b) => a + b, 0) / leadershipPotentialScores.length;
  const variance = leadershipPotentialScores.map(lps => Math.pow(lps - meanLPS, 2)).reduce((a, b) => a + b, 0) / leadershipPotentialScores.length;
  
  return Math.sqrt(variance);
}

// ==================================
// STRATEGY DEFINITIONS & REGISTRY
// ==================================

export type StrategyDirection = 'maximize' | 'minimize';
export type StrategyScope = 'party' | 'composition';

// 1. Define the properties that are common to ALL strategies
interface BaseStrategyDefinition {
  identifier: string;
  name: string;
  description: string;
  direction: StrategyDirection;
}

// 2. Define a specific type for Party-scoped strategies
interface PartyStrategyDefinition extends BaseStrategyDefinition {
  scope: 'party'; // The "discriminant" property
  scorer: (target: Party, roster: CharacterRecord) => number; // Scorer ONLY takes a Party
}

// 3. Define a specific type for Composition-scoped strategies
interface CompositionStrategyDefinition extends BaseStrategyDefinition {
  scope: 'composition'; // The "discriminant" property
  scorer: (target: Composition, roster: CharacterRecord) => number; // Scorer ONLY takes a Composition
}

// 4. The final StrategyDefinition is a union of the specific types
export type StrategyDefinition = PartyStrategyDefinition | CompositionStrategyDefinition;

/**
 * The single source of truth for all expedition planning strategies.
 * To add a new strategy, simply define it and add it to this array.
 */
export const STRATEGY_REGISTRY: readonly StrategyDefinition[] = [
  {
    identifier: 'minimizeLevelHardship',
    name: 'Experience parity',
    description: 'Ensures no single hero is vastly outleveled by their peers, preventing undue hardship.',
    direction: 'minimize',
    scope: 'party',
    scorer: scorePartyByLevelPenalty,
  },
  {
    identifier: 'maximizeGameplaySynergy',
    name: 'Tactical Synergy',
    description: 'Evaluates the core combat synergies and anti-synergies within the party.',
    direction: 'maximize',
    scope: 'party',
    scorer: scorePartyByGameplaySynergy,
  },
  {
    identifier: 'maximizeAffinity',
    name: 'Team cohesion',
    description: 'Promotes well-rounded, positive relationships within a party to ensure smooth cooperation.',
    direction: 'maximize',
    scope: 'party',
    scorer: scorePartyByAffinity,
  },
  {
    identifier: 'maximizePeakAffinity',
    name: "Strong bonds",
    description: 'Strongly favors creating parties with exceptionally strong, established bonds.',
    direction: 'maximize',
    scope: 'party',
    scorer: scorePartyByPeakAffinity,
  },
  {
    identifier: 'minimizeDiscord',
    name: 'Conlict avoidance',
    description: 'Strictly punishes party compositions with known rivalries or poor relationships to avoid infighting.',
    direction: 'minimize',
    scope: 'party',
    scorer: scorePartyByDiscordPenalty,
  },
{
    identifier: 'balanceAuthority',
    name: 'Authority distribution',
    description: 'Ensures a balanced distribution of leadership potential across parties, preventing over-concentration of authority.',
    direction: 'minimize',
    scope: 'composition',
    scorer: scoreCompositionByAuthorityDistribution,
},
] as const; // Using 'as const' provides stronger type inference


// ==================================
// 3. DYNAMICALLY GENERATED TYPES
// ==================================

// This creates a type: { minimizeLevelHardship?: number; maximizeAffinity?: number; ... }
export type StrategyWeights = {
  [K in typeof STRATEGY_REGISTRY[number]['identifier']]?: number;
};

export interface NormalizationStats {
  mean: number;
  stdDev: number;
}

// This creates a type: { minimizeLevelHardship: NormalizationStats; ... }
export type PartyScoringStatistics = {
  [K in typeof STRATEGY_REGISTRY[number]['identifier']]: NormalizationStats;
};