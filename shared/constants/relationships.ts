// shared/constants/relationships.ts
/**
 * @file Baselines for the affinity scale.
 *
 * Affinity runs 0–10. NEUTRAL is where authored `dynamic` strings turn from
 * negative to positive: everything written at 3 or below is disdain, resentment
 * or contempt, while 4 is where "Earned Regard" and "Guarded Respect" begin.
 *
 * Every fallback for an unrecorded relationship now resolves here, including the
 * "Dynamic: Strangers" line buildPromptService sends to the LLM. Previously those
 * hardcoded 3, placing strangers one step BELOW neutral — a small permanent
 * hostility between heroes who had simply never met, applied across affinity
 * scoring, discord, command clarity, protector bonds and the council's
 * political score alike.
 */

/** The dividing line between dislike and regard. Strangers should sit here. */
export const NEUTRAL_AFFINITY = 4;

/** The top of the scale, used when inverting affinity into dis-affinity. */
export const MAX_AFFINITY = 10;