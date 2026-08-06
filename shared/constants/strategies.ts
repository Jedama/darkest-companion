// shared/constants/strategies.ts
/**
 * @file The single source of truth for strategy IDENTIFIERS.
 *
 * The scorer implementations live server-side in
 * `server/services/townHall/expeditionStrategies/`, but `shared/types/types.ts`
 * needs to type `Character.strategyWeights` and cannot import from `server/`.
 * So the names live here and the registry is checked against them.
 *
 * ADDING A STRATEGY — two steps, and the compiler enforces the second:
 *   1. Add the identifier to STRATEGY_IDS below.
 *   2. Add the matching entry (scorer, scope, direction) to STRATEGY_REGISTRY.
 * Skip step 2 and `_NoMissingStrategies` in strategyRegistry.ts fails to compile,
 * naming the identifier you forgot. Skip step 1 and the registry entry's
 * `identifier` field fails to typecheck.
 */

export const STRATEGY_IDS = [
  // --- Generic party strategies ---
  'minimizeLevelHardship',
  'maximizeGameplaySynergy',
  'maximizeAffinity',
  'maximizePeakAffinity',
  'minimizeDiscord',
  'maximizeCommandClarity',
  'minimizeLiabilityExposure',
  'minimizeTacticalNonsense',
  'maximizeDedicatedProtector',
  'maximizeExpeditionYield',
  'minimizeFactionRisk',

  // --- Generic composition strategies ---
  'balanceAuthority',
  'balanceCondition',

  // --- Character-specific party strategies ---
  'maximizeCommandClarity_heiress',
  'maximizeChildGuardianship_cook',
  'maximizeSocialVitality_zenith',
  'minimizeSufferingDisparity_flagellant',
  'maximizeDedicatedProtector_snor_rasp',
  'maximizeDedicatedProtector_offering',
  'maximizeExpeditionYield_hqclaimants',
  'minimizeFactionRisk_heiress',
  'minimizeFactionRisk_hqclaimants',

  // --- Character-specific composition strategies ---
  'maximizeQuarantinedHorrors_kheir',
] as const;

/** The union of every legal strategy identifier. */
export type StrategyId = (typeof STRATEGY_IDS)[number];

/**
 * A hero's opinion about how expeditions should be composed. Every key is
 * optional; anything absent falls back to the strategy's `defaultWeight`.
 */
export type StrategyWeights = Partial<Record<StrategyId, number>>;

const STRATEGY_ID_SET: ReadonlySet<string> = new Set(STRATEGY_IDS);

/**
 * Runtime guard for data crossing a trust boundary — parsed save files,
 * API payloads, anything the type system did not get to check.
 */
export function isStrategyId(value: string): value is StrategyId {
  return STRATEGY_ID_SET.has(value);
}