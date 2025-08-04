// server/services/townHall/expeditionStrategies/strategyRegistry.ts
/**
 * @file This is the central registry for all expedition scoring strategies.
 * It imports scorer functions from other files and assembles them into a
 * master list, `STRATEGY_REGISTRY`. It also defines and exports the core
 * types related to the strategy system, including the dynamically generated
 * `StrategyWeights` type.
 */

import { CharacterRecord } from '../../../../shared/types/types';
import { Party, Composition } from '../expeditionPlanner';

// Import all scorer functions from their respective files.
// Using aliases ('generic', 'character') keeps the calls clean.
import * as generic from './genericStrategies';
import * as character from './characterStrategies';

// ==================================
// 1. CORE TYPE DEFINITIONS
// ==================================

export type StrategyDirection = 'maximize' | 'minimize';
export type StrategyScope = 'party' | 'composition';

interface BaseStrategyDefinition {
  identifier: string;
  name: string;
  description: string;
  direction: StrategyDirection;
  defaultWeight?: number;
}

interface PartyStrategyDefinition extends BaseStrategyDefinition {
  scope: 'party';
  scorer: (target: Party, roster: CharacterRecord) => number;
}

interface CompositionStrategyDefinition extends BaseStrategyDefinition {
  scope: 'composition';
  scorer: (target: Composition, roster: CharacterRecord) => number;
}

export type StrategyDefinition = PartyStrategyDefinition | CompositionStrategyDefinition;

// ==================================
// 2. THE MASTER STRATEGY REGISTRY
// ==================================

export const STRATEGY_REGISTRY: readonly StrategyDefinition[] = [
  // --- Generic Party Strategies ---
  {
    identifier: 'minimizeLevelHardship',
    name: 'Experience Parity',
    description: 'Ensures no single hero is vastly outleveled by their peers, preventing undue hardship.',
    direction: 'minimize',
    scope: 'party',
    scorer: generic.scorePartyByLevelPenalty,
    defaultWeight: 15,
  },
  {
    identifier: 'maximizeGameplaySynergy',
    name: 'Tactical Synergy',
    description: 'Evaluates the core combat synergies and anti-synergies within the party.',
    direction: 'maximize',
    scope: 'party',
    scorer: generic.scorePartyByGameplaySynergy,
    defaultWeight: 1,
  },
  {
    identifier: 'maximizeAffinity',
    name: 'Team Cohesion',
    description: 'Promotes well-rounded, positive relationships within a party to ensure smooth cooperation.',
    direction: 'maximize',
    scope: 'party',
    scorer: generic.scorePartyByAffinity,
    defaultWeight: 3,
  },
  {
    identifier: 'maximizePeakAffinity',
    name: "Strong Bonds",
    description: 'Strongly favors creating parties with exceptionally strong, established bonds.',
    direction: 'maximize',
    scope: 'party',
    scorer: generic.scorePartyByPeakAffinity,
  },
  {
    identifier: 'minimizeDiscord',
    name: 'Conflict Avoidance',
    description: 'Strictly punishes party compositions with known rivalries or poor relationships to avoid infighting.',
    direction: 'minimize',
    scope: 'party',
    scorer: generic.scorePartyByDiscordPenalty,
  },
  {
    identifier: 'maximizeCommandClarity',
    name: 'Command Clarity',
    description: 'Evaluates the clarity of command and authority distribution within a party using a standard, objective model.',
    direction: 'maximize',
    scope: 'party',
    scorer: generic.scorePartyByCommandClarity,
  },
  {
    identifier: 'minimizeLiabilityExposure',
    name: 'Liability Neutralization',
    description: 'Punishes parties for unmitigated weaknesses and liabilities like "Unstable" or "Elder".',
    direction: 'minimize',
    scope: 'party',
    scorer: generic.scorePartyByLiabilityExposure,
  },
  {
    identifier: 'minimizeTacticalNonsense',
    name: 'Tactical Nonsense',
    description: 'Avoids parties with heroes that have no clear role or synergy, preventing tactical confusion.',
    direction: 'minimize',
    scope: 'party',
    scorer: generic.scorePartyByTacticalNonsense,
  },
  {
    identifier: 'maximizeDedicatedProtector',
    name: 'Dedicated Protector',
    description: 'Ensures at least one hero is a dedicated protector, enhancing party defense and survivability.',
    direction: 'maximize',
    scope: 'party',
    scorer: generic.scorePartyByDedicatedProtector,
  },

  // --- Generic Composition Strategies ---
  {
    identifier: 'balanceAuthority',
    name: 'Authority Distribution',
    description: 'Ensures a balanced distribution of leadership potential across parties, preventing over-concentration of authority.',
    direction: 'minimize',
    scope: 'composition',
    scorer: generic.scoreCompositionByAuthorityBalance,
  },
  {
    identifier: 'balanceCondition',
    name: 'Condition Distribution',
    description: 'Balances the distribution of afflictions and virtues across parties to ensure no single party is overly burdened or empowered.',
    direction: 'minimize',
    scope: 'composition',
    scorer: generic.scoreCompositionByConditionBalance,
    defaultWeight: 3,
  },
  
  // --- Character-Specific Strategies ---
  {
    identifier: 'maximizeCommandClarity_Heiress',
    name: 'Command Clarity (Heiress)',
    description: 'Evaluates command clarity according to the Heiress\'s specific biases and anxieties.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.scorePartyByCommandClarity_Heiress,
  },
  {
    identifier: 'maximizeChildGuardianship_Cook',
    name: 'Children Guardianship',
    description: 'Ensures children are protected by capable guardians.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.scorePartyByChildGuardianship_Cook,
  },
  {
    identifier: 'maximizeSocialVitality_Zenith',
    name: 'Gender Balance (Zenith)',
    description: 'Rewards parties that achieve a balanced gender distribution, and potentially romantic rivalries.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.scorePartyBySocialVitality_Zenith,
  },
  {
    identifier: 'minimizeSufferingDisparity_Flagellant',
    name: 'Suffering Disparity (Flagellant)',
    description: 'Minimizes the suffering disparity within a party, ensuring everyone feels the clarity of pain.',
    direction: 'minimize',
    scope: 'party',
    scorer: character.scoreCompositionBySufferingDisparity_Flagellant,
  },
  {
    identifier: 'maximizeDedicatedProtector_Martyr',
    name: 'Dedicated Protector (Martyr)',
    description: 'Ensures at least one hero is a dedicated protector, based on their bonds with whom they protect.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.scorePartyByDedicatedProtector_Martyr,
  },
  {
    identifier: 'maximizeDedicatedProtector_Offering',
    name: 'Dedicated Protector (Offering)',
    description: 'Value understanding and morbid empathy through protection, according to the philosophy of the Offering.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.scorePartyByDedicatedProtector_Offering,
  },

  // --- Character-Specific Composition Strategies ---
  {
    identifier: 'maximizeQuarantinedHorrors_Heir',
    name: 'Quarantined Horrors (Heir)',
    description: 'Tries to quarantine all the scary heroes together so they won\'t disturb the rest.',
    direction: 'maximize',
    scope: 'composition',
    scorer: character.scoreCompositionByQuarantinedHorrors_Heir,
  }

] as const;


// ==================================
// 3. DYNAMICALLY GENERATED TYPES
// ==================================

export type StrategyWeights = {
  [K in typeof STRATEGY_REGISTRY[number]['identifier']]?: number;
};

export interface NormalizationStats {
  mean: number;
  stdDev: number;
}

export type PartyScoringStatistics = {
  [K in typeof STRATEGY_REGISTRY[number]['identifier']]: NormalizationStats;
};

/**
 * Dynamically generates the default weights object from the STRATEGY_REGISTRY.
 * This ensures there is a single source of truth for strategy defaults.
 */
export function generateDefaultWeights(): Required<StrategyWeights> {
  return STRATEGY_REGISTRY.reduce((weights, strategy) => {
    weights[strategy.identifier] = strategy.defaultWeight ?? 0;
    return weights;
  }, {} as any) as Required<StrategyWeights>;
}