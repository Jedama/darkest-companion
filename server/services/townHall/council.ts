// server/services/townHall/council.ts
/**
 * @file Assembles the room for the monthly planning meeting.
 *
 * TWO KINDS OF CHAIR, and the distinction is the point:
 *
 *  - SEATS (`leadership.council`) are DE JURE and persistent. They are granted,
 *    inherited, bought and lost through storytelling, never computed here. A
 *    councillor holds their seat while diseased, disgraced or useless; they
 *    simply do not attend.
 *
 *  - ADVISORS are computed fresh every month and stored nowhere. They are in the
 *    room because the room will listen to them: competence, tempered by the state
 *    they are actually in, plus standing with the leadership and the roster.
 *
 * Leadership works the same way. `leadership.margrave` is DE JURE and is never
 * overwritten here — a Margrave laid up with the Crimson Curse keeps her title.
 * What this file computes is the DE FACTO leader: whoever steps into the chair
 * for the month. Recomputed on demand, so recovery needs no special handling.
 */

import { Character, CharacterRecord, EstateLeadership } from '../../../shared/types/types.js';
import { isVirtue, isAffliction } from '../../../shared/constants/conditions.js';
import { NEUTRAL_AFFINITY } from '../../../shared/constants/relationships.js';

import type { StrategyId, StrategyWeights } from '../../../shared/constants/strategies.js';

// ===================================================================
// 0. CONFIGURATION
// ===================================================================

const COUNCIL_CONFIG = {
  /** An advisor must be functional enough to be worth sending for. Seats ignore this. */
  ADVISOR_FITNESS: {
    MIN_MENTAL: 25,
    MIN_PHYSICAL: 25,
  },

  ADVISORS: {
    /** A hamlet this small is a household, not a government. */
    ROSTER_FOR_FIRST_ADVISOR: 8,
    ROSTER_FOR_SECOND_ADVISOR: 16,
    BASE: 2,

    /**
     * If fewer than this many seated councillors attend, advisors are called in to
     * make up the difference — an institution reaching for competence when its own
     * membership fails to supply it. Four seats with one stepping up leaves three,
     * which is presence enough; nobody extra is summoned. An empty council pulls
     * in the full complement.
     */
    MIN_COUNCIL_PRESENCE: 2,

    MAX: 4,

    /** Score-gap clustering: a near-tie for the last chair pulls one more in. */
    INCLUSION_THRESHOLD: 0.05,
    /** A cliff below the last chair leaves it empty. */
    EXCLUSION_THRESHOLD: 0.2,
  },

  /**
   * Who steps up when a chair is empty.
   *
   * Level outweighs authority per point because its range is so much narrower:
   * authority spans 1-10 while a veteran is level 5 or 6. At these weights a brand
   * new hamlet is decided purely by authority (everyone is level 0), while a
   * level-5 veteran with authority 4 outranks a level-0 newcomer with authority 10.
   * No three-week recruit inherits the estate.
   */
  SUCCESSION: {
    MARGRAVE: { authority: 2, level: 3, intelligence: 0.5, sociability: 0.25 },
    BURSAR: { intelligence: 2, level: 3, authority: 0.5, sociability: 0.25 },
  },

  /**
   * Whose good opinion counts when calling in advisors, and how much. The council
   * has a voice here — advisors are quietly democratic, chosen in part by the
   * people already in the room.
   */
  LEADERSHIP_AFFINITY: {
    MARGRAVE: 1.5,
    BURSAR: 1.25,
    COUNCILLOR: 1.0,
  },

  /**
   * The stars favour those born under the reigning sign. Advisors only — who runs
   * the estate while the Margrave is ill is a question of continuity, not birthdays.
   *
   * Multiplicative rather than additive, and deliberately so: it lifts whoever is
   * already near the cut rather than elevating the plainly unsuitable. A lucky star
   * does not make a fool wise. On a twelve-sign wheel this reshuffles the advisory
   * bench in roughly half of all months.
   */
  ZODIAC_BONUS: 1.25,
};

// ===================================================================
// 1. TYPES
// ===================================================================

/** Everyone attending this month's planning meeting, and in what capacity. */
export interface PlanningCouncil {
  /** DE FACTO Margrave — the de jure holder unless they could not serve. */
  margrave: string;
  /** DE FACTO Bursar. */
  bursar: string;
  /** Seated councillors attending as councillors (excludes the absent and those who stepped up). */
  council: string[];
  /** Called in on merit and standing, for this month only. */
  advisors: string[];

  /** True when the de facto leader is not the de jure one. */
  margraveIsActing: boolean;
  bursarIsActing: boolean;

  /** Chair-holders who could not attend, and why. */
  absent: { identifier: string; reason: 'disease' | 'missing' }[];
}

export interface CouncilOptions {
  /** Name of the reigning zodiac season, matched against `character.zodiac`. */
  zodiac?: string;
}

// ===================================================================
// 2. FITNESS & SCORE HELPERS
// ===================================================================

/**
 * Disease is the one hard bar. The Black Plague, the Runs, Rabies — none of these
 * are conditions you argue expedition policy through. Affliction is NOT a bar:
 * a Paranoid Margrave slamming her goblet on the table is the meeting.
 */
function canAttend(hero: Character | undefined): hero is Character {
  return !!hero && hero.status.diseases.length === 0;
}

/**
 * Fit to be CALLED IN as an advisor. Stricter than merely attending: you keep a
 * seat you already hold while barely standing, but nobody sends for you.
 */
function isEligibleAdvisor(hero: Character | undefined): hero is Character {
  return (
    canAttend(hero) &&
    hero.status.mental >= COUNCIL_CONFIG.ADVISOR_FITNESS.MIN_MENTAL &&
    hero.status.physical >= COUNCIL_CONFIG.ADVISOR_FITNESS.MIN_PHYSICAL
  );
}

/** Current fitness for duty as a multiplier on competence. Typically 0.15 to 1.15. */
function getReadinessModifier(hero: Character): number {
  let modifier = 1.0;

  if (isVirtue(hero.status.affliction)) {
    modifier += 0.15;
  } else if (isAffliction(hero.status.affliction)) {
    // You do not seek counsel from the selfish, the paranoid or the fearful.
    modifier -= 0.4;
  }

  const missingHealthPercent = (100 - hero.status.physical) / 100;
  modifier -= missingHealthPercent * 0.2;

  const stressPercent = (100 - hero.status.mental) / 100;
  modifier -= Math.pow(stressPercent, 2.5);

  modifier -= hero.status.wounds.length * 0.04;

  return Math.max(0.15, modifier);
}

/**
 * Political capital in the Hamlet at large. Regard from influential heroes counts
 * for more than regard from the meek.
 */
function getWeightedRosterAffinity(hero: Character, roster: CharacterRecord): number {
  let weightedAffinitySum = 0;
  let totalInfluence = 0;

  for (const otherHero of Object.values(roster)) {
    if (otherHero.identifier === hero.identifier) continue;

    const influenceWeight = 1 + otherHero.stats.authority * 0.5 + otherHero.stats.sociability * 0.2;
    const affinity = hero.relationships[otherHero.identifier]?.affinity ?? NEUTRAL_AFFINITY;

    weightedAffinitySum += affinity * influenceWeight;
    totalInfluence += influenceWeight;
  }

  return totalInfluence > 0 ? weightedAffinitySum / totalInfluence : NEUTRAL_AFFINITY;
}

/**
 * How the people already in the room regard a candidate.
 *
 * The DE FACTO leaders are used rather than the de jure ones: the favour that
 * matters when summoning an advisor is the favour of whoever is running the meeting.
 */
function getLeadershipAffinity(
  candidateId: string,
  roster: CharacterRecord,
  margraveId: string,
  bursarId: string,
  councillorIds: readonly string[]
): number {
  const W = COUNCIL_CONFIG.LEADERSHIP_AFFINITY;
  const voices: { id: string; weight: number }[] = [
    { id: margraveId, weight: W.MARGRAVE },
    { id: bursarId, weight: W.BURSAR },
    ...councillorIds.map(id => ({ id, weight: W.COUNCILLOR })),
  ];

  let sum = 0;
  let totalWeight = 0;

  for (const voice of voices) {
    if (voice.id === candidateId) continue;
    const speaker = roster[voice.id];
    if (!speaker) continue;

    sum += (speaker.relationships[candidateId]?.affinity ?? NEUTRAL_AFFINITY) * voice.weight;
    totalWeight += voice.weight;
  }

  return totalWeight > 0 ? sum / totalWeight : NEUTRAL_AFFINITY;
}

/**
 * Suitability to be called in as an advisor: competence, adjusted for the state
 * they are in, plus standing with the room and with the Hamlet.
 */
function calculateAdvisorScore(
  hero: Character,
  roster: CharacterRecord,
  margraveId: string,
  bursarId: string,
  councillorIds: readonly string[],
  zodiac?: string
): number {
  const competence = hero.stats.authority * 3 + hero.stats.intelligence * 2 + hero.level;
  const readiness = getReadinessModifier(hero);

  const leadershipAffinity = getLeadershipAffinity(
    hero.identifier, roster, margraveId, bursarId, councillorIds
  );
  const rosterAffinity = getWeightedRosterAffinity(hero, roster);
  const standing = leadershipAffinity * 1.5 + rosterAffinity;

  const score = competence * readiness + standing;

  const favoured = !!zodiac && hero.zodiac === zodiac;
  return favoured ? score * COUNCIL_CONFIG.ZODIAC_BONUS : score;
}

// ===================================================================
// 3. SUCCESSION (DE FACTO LEADERSHIP)
// ===================================================================

type SuccessionWeights = {
  authority: number;
  level: number;
  intelligence: number;
  sociability: number;
};

/**
 * Fitness to step into a vacant chair. Deliberately NOT the advisor score: this is
 * about experience and standing to command, not about whose counsel is worth
 * hearing. Health and stress apply only as a softened nudge, so a wounded veteran
 * still outranks a hale newcomer.
 */
function calculateSuccessionScore(hero: Character, weights: SuccessionWeights): number {
  const base =
    hero.stats.authority * weights.authority +
    hero.level * weights.level +
    hero.stats.intelligence * weights.intelligence +
    hero.stats.sociability * weights.sociability;

  // Halved influence: a readiness of 0.6 becomes a multiplier of 0.8.
  const softenedReadiness = 0.5 + 0.5 * getReadinessModifier(hero);
  return base * softenedReadiness;
}

/**
 * Picks whoever steps up, preferring the sitting council over the roster at large.
 * The institution promotes from within: a councillor is already in the room, already
 * briefed, already trusted with a chair.
 *
 * Ties break on `identifier`, so the outcome is deterministic. Without that, two
 * heroes equal on every stat would be separated by `Object.values` ordering, and the
 * acting Margrave could silently change from one month to the next because an
 * unrelated hero died.
 */
function chooseSuccessor(
  candidates: Character[],
  councilSeats: readonly string[],
  weights: SuccessionWeights
): Character | undefined {
  if (candidates.length === 0) return undefined;

  const seated = new Set(councilSeats);
  const fromCouncil = candidates.filter(h => seated.has(h.identifier));
  const pool = fromCouncil.length > 0 ? fromCouncil : candidates;

  return [...pool].sort((a, b) => {
    const diff = calculateSuccessionScore(b, weights) - calculateSuccessionScore(a, weights);
    if (Math.abs(diff) > 1e-9) return diff;
    return a.identifier.localeCompare(b.identifier);
  })[0];
}

// ===================================================================
// 4. MAIN EXPORT
// ===================================================================

/**
 * Assembles the planning meeting for the current month.
 *
 * Pure and side-effect free: it reads `leadership` and never writes to it. The de
 * jure record is the caller's to change through storytelling; what comes back is
 * only who sits down this month.
 */
export function assemblePlanningCouncil(
  leadership: EstateLeadership,
  roster: CharacterRecord,
  options: CouncilOptions = {}
): PlanningCouncil {
  const absent: PlanningCouncil['absent'] = [];
  const noteAbsent = (id: string, hero: Character | undefined) =>
    absent.push({ identifier: id, reason: hero ? 'disease' : 'missing' });

  const seats = leadership.council ?? [];

  // --- Step 1: can the de jure officers serve? ---
  const deJureMargrave = roster[leadership.margrave];
  const deJureBursar = roster[leadership.bursar];

  const margraveServes = canAttend(deJureMargrave);
  const bursarServes = canAttend(deJureBursar);

  if (!margraveServes) noteAbsent(leadership.margrave, deJureMargrave);
  if (!bursarServes) noteAbsent(leadership.bursar, deJureBursar);

  // --- Step 2: fill the empty chairs, council first ---
  const taken = new Set<string>([leadership.margrave, leadership.bursar]);
  const availableCandidates = () =>
    Object.values(roster).filter(h => canAttend(h) && !taken.has(h.identifier));

  let actingMargrave: Character | undefined = margraveServes ? deJureMargrave : undefined;
  if (!actingMargrave) {
    actingMargrave = chooseSuccessor(availableCandidates(), seats, COUNCIL_CONFIG.SUCCESSION.MARGRAVE);
    if (actingMargrave) taken.add(actingMargrave.identifier);
  }

  let actingBursar: Character | undefined = bursarServes ? deJureBursar : undefined;
  if (!actingBursar) {
    actingBursar = chooseSuccessor(availableCandidates(), seats, COUNCIL_CONFIG.SUCCESSION.BURSAR);
    if (actingBursar) taken.add(actingBursar.identifier);
  }

  // A hamlet with nobody able to hold the estate has larger problems than an agenda.
  if (!actingMargrave || !actingBursar) {
    console.error('[Council] No one is able to hold the estate; the meeting cannot be convened.');
    return {
      margrave: actingMargrave?.identifier ?? leadership.margrave,
      bursar: actingBursar?.identifier ?? leadership.bursar,
      council: [],
      advisors: [],
      margraveIsActing: !margraveServes,
      bursarIsActing: !bursarServes,
      absent,
    };
  }

  const margraveId = actingMargrave.identifier;
  const bursarId = actingBursar.identifier;

  // --- Step 3: which seated councillors attend AS councillors? ---
  // Anyone who stepped up now occupies a leadership chair and is not counted twice.
  const attendingCouncil: string[] = [];
  for (const id of seats) {
    if (id === margraveId || id === bursarId) continue;
    const hero = roster[id];
    if (!canAttend(hero)) {
      noteAbsent(id, hero);
      continue;
    }
    attendingCouncil.push(id);
  }

  // --- Step 4: how many advisors does the month warrant? ---
  const rosterSize = Object.keys(roster).length;
  const A = COUNCIL_CONFIG.ADVISORS;

  let target =
    rosterSize < A.ROSTER_FOR_FIRST_ADVISOR ? 0 :
    rosterSize < A.ROSTER_FOR_SECOND_ADVISOR ? 1 :
    A.BASE;

  const shortfall = Math.max(0, A.MIN_COUNCIL_PRESENCE - attendingCouncil.length);
  target = Math.min(target + shortfall, A.MAX);

  // --- Step 5: score and rank the candidates ---
  const excluded = new Set<string>([
    margraveId,
    bursarId,
    leadership.margrave, // the de jure holders are not summoned as advisors to their own estate
    leadership.bursar,
    ...seats,            // a seat-holder is never also an advisor
  ]);

  const ranked = Object.values(roster)
    .filter(h => !excluded.has(h.identifier) && isEligibleAdvisor(h))
    .map(hero => ({
      id: hero.identifier,
      score: calculateAdvisorScore(
        hero, roster, margraveId, bursarId, attendingCouncil, options.zodiac
      ),
    }))
    .sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id));

  target = Math.min(target, ranked.length);

  // --- Step 6: clustering nudge, plus or minus one chair ---
  // Guarded against target === 0. The old code indexed candidates[-1] here and threw
  // outright on any roster that produced no chairs — which included an 11-hero hamlet.
  if (target > 0) {
    const lastIndex = target - 1;

    if (target < A.MAX && ranked.length > target) {
      const lastScore = ranked[lastIndex].score;
      const bubbleScore = ranked[target].score;
      const gap = lastScore - bubbleScore;
      // A near-tie for the final chair: hear them both.
      if (gap >= 0 && gap <= Math.abs(lastScore) * A.INCLUSION_THRESHOLD) {
        target++;
      }
    } else if (target > 1) {
      const lastScore = ranked[lastIndex].score;
      const previousScore = ranked[lastIndex - 1].score;
      // A cliff below the last chair: leave it empty.
      if (previousScore - lastScore > Math.abs(previousScore) * A.EXCLUSION_THRESHOLD) {
        target--;
      }
    }
  }

  return {
    margrave: margraveId,
    bursar: bursarId,
    council: attendingCouncil,
    advisors: ranked.slice(0, target).map(c => c.id),
    margraveIsActing: !margraveServes,
    bursarIsActing: !bursarServes,
    absent,
  };
}

// ===================================================================
// 5. DOCTRINE
// ===================================================================

/**
 * How much each chair's opinion counts when the room's doctrines are merged.
 * The Margrave runs the estate; advisors are in the room on merit but have no
 * standing. Relative only — the annealer auto-calibrates its temperature from
 * the observed score landscape, so the absolute scale of the blend is free.
 */
const DOCTRINE_CLOUT = {
  MARGRAVE: 1.25,
  BURSAR: 1.1,
  COUNCILLOR: 1,
  ADVISOR: 0.85,
} as const;

/**
 * PROVISIONAL — merges everyone's doctrine into the single weight vector the
 * expedition planner takes. Replaces "whatever the Margrave thinks", which is
 * what ran before this existed.
 *
 * The one real decision encoded here: an ABSENT KEY IS AN ABSTENTION, not a
 * vote of zero. Each strategy is averaged over the clout of the attendees who
 * actually hold an opinion on it, so a signature weight of 10 arrives as ~10
 * however many other people are at the table. Averaging over the whole room
 * instead would dilute every personal weight toward zero as attendance grows,
 * which is precisely backwards — the fuller the table, the more personality
 * should be on display. Clout therefore arbitrates DISAGREEMENT rather than
 * volume: it only bites where two attendees weight the same strategy
 * differently, which in practice means the generic strategies, since a
 * character-specific scorer is only ever named by its own owner.
 *
 * Known to be too simple, in three ways, all deferred until there are enough
 * doctrines to see them misbehave:
 *
 *  1. NO CONSENSUS SCALING. One advisor's private obsession lands as hard as a
 *     unanimous conviction. Scaling by the share of clout that holds the
 *     opinion would fix it, but it would also systematically weaken every
 *     signature scorer (held by exactly one person, always) against the
 *     generic strategies (potentially held by all), so it needs a floor and
 *     the floor needs tuning against real rooms.
 *  2. NO FLOOR ON THE NON-NEGOTIABLES. The registry defaults still sit
 *     underneath this via defineWeights, but a doctrine that names
 *     minimizeLevelHardship overrides them downward, and level hardship is
 *     supposed to be the one thing no personality outvotes. Wants a
 *     max(blended, default) on a named set once any character actually has an
 *     opinion about it. None do yet.
 *  3. DOUBLE-COUNTING. A character-specific scorer that reuses its generic
 *     twin's terms will now be weighted alongside that twin and charge for the
 *     same thing twice — minimizeFactionRisk_hqclaimants opens with the same
 *     bloc sum as minimizeFactionRisk. New variants should be written as
 *     replacements rather than wrappers; the existing one wants revisiting.
 */
export function blendDoctrine(
  council: PlanningCouncil,
  roster: CharacterRecord
): StrategyWeights {
  const table: { ids: string[]; clout: number }[] = [
    { ids: [council.margrave], clout: DOCTRINE_CLOUT.MARGRAVE },
    { ids: [council.bursar], clout: DOCTRINE_CLOUT.BURSAR },
    { ids: council.council, clout: DOCTRINE_CLOUT.COUNCILLOR },
    { ids: council.advisors, clout: DOCTRINE_CLOUT.ADVISOR },
  ];

  // Keyed by raw string, not StrategyId: an unknown identifier is passed
  // through so defineWeights can warn about it by name. Silently dropping it
  // here would lose the only diagnostic a typo'd save file ever gets.
  const tally: Record<string, { weighted: number; clout: number }> = {};
  const counted = new Set<string>();

  for (const { ids, clout } of table) {
    for (const id of ids) {
      // Someone who stepped up holds two chairs; they vote once, at the
      // higher clout, because the table is walked in descending order.
      if (!id || counted.has(id)) continue;
      counted.add(id);

      const doctrine = roster[id]?.strategyWeights;
      if (!doctrine) continue;

      for (const [strategy, weight] of Object.entries(doctrine)) {
        if (typeof weight !== 'number' || !Number.isFinite(weight)) continue;
        const entry = tally[strategy] ?? (tally[strategy] = { weighted: 0, clout: 0 });
        entry.weighted += weight * clout;
        entry.clout += clout;
      }
    }
  }

  const blended: StrategyWeights = {};
  for (const [strategy, { weighted, clout }] of Object.entries(tally)) {
    if (clout > 0) blended[strategy as StrategyId] = weighted / clout;
  }
  return blended;
}