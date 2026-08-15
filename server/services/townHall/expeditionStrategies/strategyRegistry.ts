// server/services/townHall/expeditionStrategies/strategyRegistry.ts
/**
 * @file This is the central registry for all expedition scoring strategies.
 * It imports scorer functions from other files and assembles them into a
 * master list, `STRATEGY_REGISTRY`. It also defines and exports the core
 * types related to the strategy system, including the dynamically generated
 * `StrategyWeights` type.
 */

import { CharacterRecord } from '../../../../shared/types/types.js';
import type { StrategyId, StrategyWeights } from '../../../../shared/constants/strategies.js';
import type { StrategyContext } from '../../../../shared/types/types.js';
import { Party, Composition } from '../expeditionPlanner.js';

// Re-exported so existing importers (`from './expeditionStrategies/.js'`) keep working.
export type { StrategyId, StrategyWeights, StrategyContext };

// Import all scorer functions from their respective files.
// Using aliases ('generic', 'character') keeps the calls clean.
import * as generic from './genericStrategies.js';
import * as character from './characterStrategies.js';

// ==================================
// 1. CORE TYPE DEFINITIONS
// ==================================

export type StrategyDirection = 'maximize' | 'minimize';
export type StrategyScope = 'party' | 'composition';

interface BaseStrategyDefinition {
  identifier: StrategyId;
  name: string;
  description: string;
  direction: StrategyDirection;
  defaultWeight?: number;
}

interface PartyStrategyDefinition extends BaseStrategyDefinition {
  scope: 'party';
  scorer: (target: Party, roster: CharacterRecord, ctx?: StrategyContext) => number;
}

interface CompositionStrategyDefinition extends BaseStrategyDefinition {
  scope: 'composition';
  scorer: (target: Composition, roster: CharacterRecord, ctx?: StrategyContext) => number;
}

export type StrategyDefinition = PartyStrategyDefinition | CompositionStrategyDefinition;

// ==================================
// 2. THE MASTER STRATEGY REGISTRY
// ==================================

/**
 * NOTE: `satisfies` rather than a `: readonly StrategyDefinition[]` annotation.
 * The annotation used to win over `as const`, widening every `identifier` back to
 * `string` — which silently collapsed StrategyWeights into an index signature and
 * disabled all key checking. `satisfies` validates the shape without widening.
 * (Requires TypeScript 4.9+.)
 */
export const STRATEGY_REGISTRY = [
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

  {
    identifier: 'maximizeExpeditionYield',
    name: 'Expedition Yield',
    description: 'Weighs how much wealth a party can find, appraise and carry home.',
    direction: 'maximize',
    scope: 'party',
    scorer: generic.scorePartyByExpeditionYield,
  },
  {
    identifier: 'minimizeFactionRisk',
    name: 'Faction Risk',
    description: 'Scatters mutually devoted, influential heroes so no single party becomes a power base.',
    direction: 'minimize',
    scope: 'party',
    scorer: generic.scorePartyByFactionRisk,
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
    identifier: 'maximizeCommandClarity_heiress',
    name: 'Command Clarity (Heiress)',
    description: 'Evaluates command clarity according to the Heiress\'s specific biases and anxieties.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.scorePartyByCommandClarity_Heiress,
  },
  {
    identifier: 'maximizeChildGuardianship_cook',
    name: 'Children Guardianship',
    description: 'Ensures children are protected by capable guardians.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.scorePartyByChildGuardianship_Cook,
  },
  {
    identifier: 'maximizeSocialVitality_zenith',
    name: 'Gender Balance (Zenith)',
    description: 'Rewards parties that achieve a balanced gender distribution, and potentially romantic rivalries.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.scorePartyBySocialVitality_Zenith,
  },
  {
    identifier: 'minimizeSufferingDisparity_flagellant',
    name: 'Suffering Disparity (Flagellant)',
    description: 'Minimizes the suffering disparity within a party, ensuring everyone feels the clarity of pain.',
    direction: 'minimize',
    scope: 'party',
    scorer: character.scoreCompositionBySufferingDisparity_Flagellant,
  },
  {
    identifier: 'maximizeDedicatedProtector_snor_rasp',
    name: 'Dedicated Protector (Martyr)',
    description: 'Ensures at least one hero is a dedicated protector, based on their bonds with whom they protect.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.scorePartyByDedicatedProtector_Martyr,
  },
  {
    identifier: 'maximizeDedicatedProtector_offering',
    name: 'Dedicated Protector (Offering)',
    description: 'Value understanding and morbid empathy through protection, according to the philosophy of the Offering.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.scorePartyByDedicatedProtector_Offering,
  },

  {
    identifier: 'maximizeExpeditionYield_hqclaimants',
    name: 'Expedition Yield (Claimants)',
    description: 'Wants the finder at their side and no one awake enough to notice what leaves with them \u2014 and every rival party coming home light.',
    direction: 'maximize',
    scope: 'party',
    scorer: character.scorePartyByExpeditionYield_hqclaimants,
  },
  {
    identifier: 'minimizeFactionRisk_heiress',
    name: 'Faction Risk (Heiress)',
    description: 'While she holds a seat, scatters blocs that resent her and quietly tolerates those that do not.',
    direction: 'minimize',
    scope: 'party',
    scorer: character.scorePartyByFactionRisk_heiress,
  },
  {
    identifier: 'minimizeFactionRisk_hqclaimants',
    name: 'Faction Risk (Claimants)',
    description: 'Scatters rival power bases and sees that the sitting leadership marches out defensibly staffed and quietly fragile.',
    direction: 'minimize',
    scope: 'party',
    scorer: character.scorePartyByFactionRisk_hqclaimants,
  },

  // --- Character-Specific Composition Strategies ---
  {
    identifier: 'maximizeQuarantinedHorrors_kheir',
    name: 'Quarantined Horrors (Heir)',
    description: 'Tries to quarantine all the scary heroes together so they won\'t disturb the rest.',
    direction: 'maximize',
    scope: 'composition',
    scorer: character.scoreCompositionByQuarantinedHorrors_Heir,
  }

] as const satisfies readonly StrategyDefinition[];


// ==================================
// 3. COMPLETENESS CHECK
// ==================================

/** Every identifier the registry actually implements. */
type RegisteredStrategyId = (typeof STRATEGY_REGISTRY)[number]['identifier'];

/**
 * Compile-time proof that every id in STRATEGY_IDS has a registry entry.
 * If one is missing, this line fails with a message naming the absent id.
 * (The reverse direction is guaranteed by `identifier: StrategyId` above.)
 */
type MissingFromRegistry = Exclude<StrategyId, RegisteredStrategyId>;

type NoMissingStrategies = [MissingFromRegistry] extends [never]
  ? true
  : ['STRATEGY_REGISTRY is missing an entry for:', MissingFromRegistry];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _noMissingStrategies: NoMissingStrategies = true as NoMissingStrategies;


// ==================================
// 4. SCOPE-NARROWED VIEWS
// ==================================

/**
 * Pre-split by scope. `analyzeComposition` runs once per annealing iteration
 * (tens of thousands of times per plan), so filtering the registry there was
 * pure waste — and the type predicates are what let callers invoke `scorer`
 * without TypeScript trying to reconcile the Party and Composition signatures.
 */
/**
 * The registry widened to the declared StrategyDefinition shape.
 *
 * Iterate THIS, not STRATEGY_REGISTRY, whenever you intend to CALL a scorer.
 * `as const` preserves each entry's concrete function reference, whose type has
 * only the two required parameters — passing a StrategyContext through it fails
 * to typecheck. The widened view carries the declared 3-parameter signature.
 */
export const ALL_STRATEGIES: readonly StrategyDefinition[] = STRATEGY_REGISTRY;

export const PARTY_STRATEGIES: readonly PartyStrategyDefinition[] =
  ALL_STRATEGIES.filter((s): s is PartyStrategyDefinition => s.scope === 'party');

export const COMPOSITION_STRATEGIES: readonly CompositionStrategyDefinition[] =
  ALL_STRATEGIES.filter((s): s is CompositionStrategyDefinition => s.scope === 'composition');


// ==================================
// 5. DERIVED TYPES
// ==================================

export interface NormalizationStats {
  mean: number;
  stdDev: number;
}

export type PartyScoringStatistics = Record<StrategyId, NormalizationStats>;

/**
 * Dynamically generates the default weights object from the STRATEGY_REGISTRY.
 * This ensures there is a single source of truth for strategy defaults.
 */
export function generateDefaultWeights(): Required<StrategyWeights> {
  const weights = {} as Required<StrategyWeights>;
  for (const strategy of ALL_STRATEGIES) {
    weights[strategy.identifier] = strategy.defaultWeight ?? 0;
  }
  return weights;
}