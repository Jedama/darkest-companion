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
    defaultWeight: 2,
  },
  {
    identifier: 'maximizeAffinity',
    name: 'Team Cohesion',
    description: 'Promotes well-rounded, positive relationships within a party to ensure smooth cooperation.',
    direction: 'maximize',
    scope: 'party',
    scorer: generic.scorePartyByAffinity,
    defaultWeight: 1,
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
    identifier: 'maximizeChildGuardianship',
    name: 'Children Guardianship',
    description: 'Ensures children are protected by capable guardians.',
    direction: 'maximize',
    scope: 'party',
    scorer: generic.scorePartyByChildGuardianship,
  },
  {
    identifier: 'minimizeLiabilityExposure',
    name: 'Liability Neutralization',
    description: 'Punishes parties for unmitigated weaknesses and liabilities like "Unstable" or "Elder".',
    direction: 'minimize',
    scope: 'party',
    scorer: generic.minimizeLiabilityExposure,
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
  },

  // --- "Standard" Opinionated Strategies (Can be used by multiple characters) ---
  {
    identifier: 'maximizeCommandClarity',
    name: 'Command Clarity',
    description: 'Evaluates the clarity of command and authority distribution within a party using a standard, objective model.',
    direction: 'maximize',
    scope: 'party',
    scorer: generic.maximizeCommandClarity,
  },
  
  // --- Character-Specific Strategies ---
  {
    identifier: 'maximizeCommandClarity_Heiress',
    name: 'Command Clarity (Heiress)',
    description: 'Evaluates command clarity according to the Heiress\'s specific biases and anxieties.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.maximizeCommandClarity_Heiress,
  },

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