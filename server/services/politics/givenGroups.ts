// server/services/politics/givenGroups.ts
/**
 * @file Groups nobody chose: the Table, and who shares a room.
 *
 * WHY THESE ARE DIFFERENT FROM CLIQUES. A clique is discovered by searching for
 * closeness, so its members like each other by definition and a fault line inside
 * one is mostly an artifact of where the search stopped. Membership here is
 * ASSIGNED — seats are granted through the affairs of the estate, rooms by the
 * quartermaster — so nobody was picked for compatibility and nobody can walk away.
 *
 * That flips which metrics matter. Cohesion is unremarkable; FRACTURE is the
 * finding. Four people who must keep meeting, two of whom cannot stand each
 * other, is a situation. And rooms are the strongest generator of all, because
 * co-location is guaranteed: everything else about a hamlet depends on who
 * marches where, but two people in a dormer will keep running into each other.
 *
 * It also makes the statistics cleaner. With cliques the null had to be
 * conditioned on qualifying groups, since the finder had selected for cohesion
 * and a naive comparison measured our own search. Nobody optimised the Table for
 * harmony, so a plain random-group null is honest here and the bits mean what
 * they say.
 */

import { CharacterRecord, EstateLeadership } from '../../../shared/types/types';
import { bondBetween } from './cliqueFinder.js';
import type { CliqueFeature, CliqueProfile } from './cliqueMetrics.js';

// ===================================================================
// CONFIGURATION
// ===================================================================

const GIVEN_CONFIG = {
  SAMPLES: 3000,

  /** Same floor as the clique features: below this it is a coincidence. */
  MIN_BITS: 4,

  MAX_FEATURES: 3,

  /**
   * The Table is always described — you always want to know how the people
   * running the estate get on. Rooms are only mentioned when something is wrong
   * in them: a harmonious dormer is not news, and fifteen bedrooms reporting
   * contentment would drown everything else.
   */
  ALWAYS_DESCRIBE_TABLE: true,

  /** Rooms with fewer than this many occupants are not a group at all. */
  MIN_ROOM_SIZE: 2,

  /**
   * Fixed score for roommates with nothing on the record between them, SCALED by
   * how much of the room that accounts for. Two people alone in a chamber who
   * have no recorded dealings is striking; two strangers in an eight-bed dorm is
   * a Tuesday.
   */
  STRANGER_BITS: 5,

  /**
   * Score band for a room that is simply pleasant. Deliberately below the floor
   * every earned finding must clear, so anything real outranks it — but spread
   * across a range rather than pinned to one value, so contented households at
   * least sort among themselves. A household at 9.3 is worth more than one at 8.0.
   */
  QUIET_BITS_MIN: 1.0,
  QUIET_BITS_MAX: 2.0,

  /** Residences printed, ranked by their strongest finding. */
  MAX_RESIDENCES: 4,
};

// ===================================================================
// TYPES
// ===================================================================

export type GivenGroupKind = 'table' | 'residence';

export interface OddOneOut {
  member: string;
  /** Their mean bond to the rest of the group. */
  meanBond: number;
  /** How far that sits below everyone else's average. */
  gap: number;
}

export interface GivenGroupProfile {
  kind: GivenGroupKind;
  key: string;
  label: string;
  members: string[];

  meanBond: number;
  /** Weakest bond against the group's own mean. High means a fault line. */
  fracture: number;
  /** Spread of bond strengths. High means camps rather than uniform lukewarmth. */
  internalSpread: number;
  /** The coldest pair inside the group, named. */
  weakestPair: { a: string; b: string; bond: number } | null;
  /** What a random group of this size averages — the comparison for meanBond. */
  expectedMeanBond: number;
  oddOneOut: OddOneOut | null;

  /** Table only: the largest share of seats held by a single clique. */
  cliqueCapture: { members: string[]; held: number } | null;

  features: CliqueFeature[];
}

// ===================================================================
// HELPERS
// ===================================================================

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map(v => (v - m) ** 2)));
}

const bits = (p: number): number => -Math.log2(Math.max(p, 1e-12));

/**
 * Mid-rank position of `value` within a sorted sample, as a probability.
 *
 * `direction` matters more than it looks. A TWO-tailed test asks "is this unusual
 * either way", and costs exactly one bit of significance compared to a one-tailed
 * test. That price is only worth paying when we genuinely report both ends.
 *
 * Most metrics here have a settled interest direction — we only ever report a
 * fracture that is LARGE, a room that is COLD, a member who is FAR outside. Asking
 * a two-tailed question about a one-directional claim is simply the wrong test,
 * and it was quietly costing real findings: a pair at mutual contempt scored 3.78
 * bits against a floor of 4 and vanished.
 *
 * Mid-rank also matters because affinities are integers, so sampled values clump —
 * counting ties as half avoids treating a common value as a rarity.
 */
function empiricalTail(
  sorted: number[], value: number, direction: 'high' | 'low' | 'both' = 'both'
): number {
  let below = 0;
  let equal = 0;
  for (const sample of sorted) {
    if (sample < value) below++;
    else if (sample === value) equal++;
  }
  const midRank = (below + equal / 2) / sorted.length;

  const tail =
    direction === 'high' ? 1 - midRank
    : direction === 'low' ? midRank
    : Math.min(midRank, 1 - midRank) * 2;

  return Math.max(tail, 1 / sorted.length);
}

/**
 * FALLBACK ONLY. Real labels come from locationService via `locationTitles`,
 * which reads the authored title and qualifies it with its outermost ancestor.
 *
 * This exists so the module stays free of StaticGameDataManager and can be
 * tested with a bare roster. It reverses the identifier's segments to match the
 * real labels' innermost-first order: `dower_house__rosewood_chamber` becomes
 * `Rosewood Chamber, Dower House`.
 */
function labelFromIdentifier(identifier: string): string {
  return identifier
    .split('__')
    .map(part =>
      part
        .split('_')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    )
    .reverse()
    .join(', ');
}

interface GroupShape {
  meanBond: number;
  fracture: number;
  internalSpread: number;
  oddGap: number;
  /** Pairs with no recorded relationship in either direction. */
  strangerPairs: number;
  /** The widest gap between the two directions of any pair — unrequited feeling. */
  maxAsymmetry: number;
  asymmetricPair: { a: string; b: string; aToB: number; bToA: number } | null;
  weakestPair: { a: string; b: string; bond: number } | null;
}

function measureGroup(members: string[], roster: CharacterRecord): GroupShape {
  const bonds: number[] = [];
  const perMember = new Map<string, number[]>(members.map(m => [m, []]));
  let strangerPairs = 0;
  let weakestPair: GroupShape['weakestPair'] = null;
  let maxAsymmetry = 0;
  let asymmetricPair: GroupShape['asymmetricPair'] = null;

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const bond = bondBetween(members[i], members[j], roster);
      bonds.push(bond);
      perMember.get(members[i])!.push(bond);
      perMember.get(members[j])!.push(bond);

      const known =
        typeof roster[members[i]]?.relationships[members[j]]?.affinity === 'number' ||
        typeof roster[members[j]]?.relationships[members[i]]?.affinity === 'number';
      if (!known) strangerPairs++;

      if (!weakestPair || bond < weakestPair.bond) {
        weakestPair = { a: members[i], b: members[j], bond };
      }

      // Unrequited feeling: one holds the other far higher than they are held.
      const aToB = roster[members[i]]?.relationships[members[j]]?.affinity;
      const bToA = roster[members[j]]?.relationships[members[i]]?.affinity;
      if (typeof aToB === 'number' && typeof bToA === 'number') {
        const gap = Math.abs(aToB - bToA);
        if (gap > maxAsymmetry) {
          maxAsymmetry = gap;
          asymmetricPair = { a: members[i], b: members[j], aToB, bToA };
        }
      }
    }
  }

  if (bonds.length === 0) {
    return {
      meanBond: 0, fracture: 0, internalSpread: 0, oddGap: 0,
      strangerPairs: 0, weakestPair: null, maxAsymmetry: 0, asymmetricPair: null,
    };
  }

  const groupMean = mean(bonds);
  const memberMeans = members.map(m => ({ member: m, value: mean(perMember.get(m)!) }));
  memberMeans.sort((a, b) => a.value - b.value);

  // How far the least-integrated member sits below everyone else's average.
  // Meaningless in a pair — with one bond, both members have the same mean.
  const oddGap =
    members.length >= 3
      ? mean(memberMeans.slice(1).map(m => m.value)) - memberMeans[0].value
      : 0;

  return {
    meanBond: groupMean,
    fracture: groupMean - Math.min(...bonds),
    internalSpread: stdDev(bonds),
    oddGap,
    strangerPairs,
    weakestPair,
    maxAsymmetry,
    asymmetricPair,
  };
}

/** The subset of GroupShape that is compared against a sampled null. */
type SampledKey = 'meanBond' | 'fracture' | 'internalSpread' | 'oddGap' | 'maxAsymmetry';
type SampledShape = Record<SampledKey, number[]>;

function randomGroup(ids: string[], size: number): string[] {
  const pool = [...ids];
  const picked: string[] = [];
  for (let i = 0; i < size && pool.length; i++) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}

// ===================================================================
// MAIN EXPORT
// ===================================================================

/**
 * Profiles the Table and every shared residence.
 *
 * `cliques` is optional and used only to detect capture of the Table.
 * `locationTitles` lets a caller supply real names; without it, identifiers are
 * prettified.
 */
export function profileGivenGroups(
  roster: CharacterRecord,
  leadership: EstateLeadership,
  cliques: CliqueProfile[] = [],
  locationTitles: Record<string, string> = {}
): GivenGroupProfile[] {
  const ids = Object.keys(roster);
  if (ids.length < 2) return [];

  // --- null distributions, one per group size ---
  const nullBySize = new Map<number, SampledShape>();
  const nullFor = (size: number) => {
    const cached = nullBySize.get(size);
    if (cached) return cached;

    const collected: SampledShape = {
      meanBond: [], fracture: [], internalSpread: [], oddGap: [], maxAsymmetry: [],
    };
    for (let i = 0; i < GIVEN_CONFIG.SAMPLES; i++) {
      const shape = measureGroup(randomGroup(ids, size), roster);
      for (const key of Object.keys(collected) as SampledKey[]) {
        collected[key].push(shape[key]);
      }
    }
    for (const key of Object.keys(collected) as SampledKey[]) {
      collected[key].sort((a, b) => a - b);
    }
    nullBySize.set(size, collected);
    return collected;
  };

  const name = (id: string) => roster[id]?.name ?? id;

  const build = (
    kind: GivenGroupKind, key: string, label: string, rawMembers: string[]
  ): GivenGroupProfile | null => {
    const members = [...new Set(rawMembers)].filter(m => roster[m]);
    if (members.length < 2) return null;

    const shape = measureGroup(members, roster);
    const nulls = nullFor(members.length);
    const features: CliqueFeature[] = [];

    /**
     * The authored dynamic strings between two heroes, as ` (X / Y)`.
     * Better prompt material than any number we compute — "Murderous Contempt"
     * says what an affinity of 2 cannot.
     */
    const dynamicsBetween = (a: string, b: string): string => {
      const forward = roster[a]?.relationships[b]?.dynamic;
      const backward = roster[b]?.relationships[a]?.dynamic;
      const parts = [forward, backward].filter(Boolean);
      return parts.length ? ` (${parts.join(' / ')})` : '';
    };

    const add = (
      metric: string, detail: string, observed: number, key2: SampledKey,
      direction: 'high' | 'low' | 'both' = 'high'
    ) => {
      const b = bits(empiricalTail(nulls[key2], observed, direction));
      if (b >= GIVEN_CONFIG.MIN_BITS) {
        features.push({ metric, detail, bits: b, observed, baseline: mean(nulls[key2]) });
      }
    };

    /**
     * For findings whose value is narrative rather than statistical. Two people
     * sharing a room who have never spoken is not SURPRISING — in a large hamlet
     * most pairs are strangers — but it is a standing invitation for something to
     * happen, and the writer should know. Given a fixed modest score so it ranks
     * below anything genuinely unusual without vanishing.
     */
    const addFixed = (metric: string, detail: string, fixedBits: number, observed: number) => {
      features.push({ metric, detail, bits: fixedBits, observed, baseline: 0 });
    };

    // A room full of friends is not news, and worse, it is usually CONFOUNDED:
    // roommates tend to be authored close and then housed together, so warmth
    // there is the estate's own design read back to us. Discord is the finding —
    // nobody chose to share a room with someone they cannot stand, and neither
    // of them can leave. The Table is different: how well the people running the
    // estate get on is worth knowing in either direction.
    const warmerThanChance = shape.meanBond >= mean(nulls.meanBond);
    const small = members.length <= 3;

    if (kind === 'table' || !warmerThanChance) {
      const who = small ? members.map(name).join(' and ') : `they`;
      const flavour = members.length === 2 ? dynamicsBetween(members[0], members[1]) : '';
      add(
        'given:meanBond',
        warmerThanChance
          ? `${who} get on better than chance would have it — bonds average ${shape.meanBond.toFixed(1)} against ${mean(nulls.meanBond).toFixed(1)}${flavour}`
          : `${who} are cold toward one another — bonds average ${shape.meanBond.toFixed(1)} against ${mean(nulls.meanBond).toFixed(1)}${flavour}`,
        shape.meanBond, 'meanBond',
        // The Table is reported warm OR cold, so both tails are live. Rooms only
        // ever report coldness, so asking about the warm tail wastes a bit.
        kind === 'table' ? 'both' : 'low'
      );
    }

    // Fracture and spread need at least three people; a pair has a single bond,
    // and its "weakest link" is simply the bond itself.
    if (members.length >= 3) {
      if (shape.weakestPair) {
        add(
          'given:fracture',
          `the fault line is ${name(shape.weakestPair.a)} and ${name(shape.weakestPair.b)}, ` +
          `whose bond sits ${shape.fracture.toFixed(1)} below the group's average` +
          dynamicsBetween(shape.weakestPair.a, shape.weakestPair.b),
          shape.fracture, 'fracture'
        );
      }
      add(
        'given:internalSpread',
        `it divides into camps rather than sharing one mood — bonds range from ` +
        `${Math.min(...members.flatMap((m, i) => members.slice(i + 1).map(o => bondBetween(m, o, roster)))).toFixed(1)} to ` +
        `${Math.max(...members.flatMap((m, i) => members.slice(i + 1).map(o => bondBetween(m, o, roster)))).toFixed(1)}`,
        shape.internalSpread, 'internalSpread'
      );
    }

    if (kind === 'residence') {
      const pairs = (members.length * (members.length - 1)) / 2;

      if (shape.strangerPairs > 0) {
        // Scaled by how much of the room is silence, so a pair alone in a chamber
        // outranks two unacquainted people in a crowded dormitory.
        const share = pairs > 0 ? shape.strangerPairs / pairs : 0;
        addFixed(
          'given:strangersUnderOneRoof',
          members.length === 2
            ? `${name(members[0])} and ${name(members[1])} share this room, and nothing has passed between them that the estate has recorded`
            : `${shape.strangerPairs} of the ${pairs} pairs sharing this room have nothing recorded between them`,
          GIVEN_CONFIG.STRANGER_BITS * share,
          shape.strangerPairs
        );
      } else if (warmerThanChance) {
        // Reported, but faintly. Roommates who get on is the expected case and is
        // usually the estate's own housing choices read back — worth a line only
        // when there is nothing louder to say.
        // Scaled by how far above the hamlet's average the household sits, as a
        // fraction of the distance to the top of the scale.
        const expected = mean(nulls.meanBond);
        const headroom = Math.max(1e-6, 10 - expected);
        const warmth = Math.min(1, Math.max(0, (shape.meanBond - expected) / headroom));
        const quietBits =
          GIVEN_CONFIG.QUIET_BITS_MIN +
          warmth * (GIVEN_CONFIG.QUIET_BITS_MAX - GIVEN_CONFIG.QUIET_BITS_MIN);

        addFixed(
          'given:quietHousehold',
          `${small ? members.map(name).join(' and ') : 'they'} keep an easy household — ` +
          `bonds average ${shape.meanBond.toFixed(1)}` +
          (members.length === 2 ? dynamicsBetween(members[0], members[1]) : ''),
          quietBits,
          shape.meanBond
        );
      }
    }

    if (shape.asymmetricPair) {
      const pair = shape.asymmetricPair;
      const forward = roster[pair.a]?.relationships[pair.b]?.dynamic;
      const backward = roster[pair.b]?.relationships[pair.a]?.dynamic;
      const dynamics = [forward, backward].filter(Boolean).join(' / ');
      add(
        'given:asymmetry',
        `${name(pair.a)} and ${name(pair.b)} do not see each other alike — ` +
        `${pair.aToB} against ${pair.bToA}` + (dynamics ? ` (${dynamics})` : ''),
        shape.maxAsymmetry, 'maxAsymmetry'
      );
    }

    let oddOneOut: OddOneOut | null = null;
    if (members.length >= 3) {
      const perMember = members.map(m => ({
        member: m,
        value: mean(members.filter(o => o !== m).map(o => bondBetween(m, o, roster))),
      }));
      perMember.sort((a, b) => a.value - b.value);
      oddOneOut = {
        member: perMember[0].member,
        meanBond: perMember[0].value,
        gap: mean(perMember.slice(1).map(p => p.value)) - perMember[0].value,
      };
      add(
        'given:oddOneOut',
        `${name(oddOneOut.member)} (${oddOneOut.member}) is the least integrated — ${oddOneOut.gap.toFixed(1)} below the rest`,
        shape.oddGap, 'oddGap'
      );
    }

    // Capture: does one clique hold a majority of this group? Only meaningful
    // for the Table, where it means a bloc controls the estate's decisions.
    let cliqueCapture: GivenGroupProfile['cliqueCapture'] = null;
    if (kind === 'table' && cliques.length > 0) {
      for (const clique of cliques) {
        const held = clique.members.filter(m => members.includes(m)).length;
        if (held >= 2 && held > (cliqueCapture?.held ?? 0)) {
          cliqueCapture = { members: clique.members, held };
        }
      }
    }

    features.sort((a, b) => b.bits - a.bits);

    return {
      kind, key, label, members,
      meanBond: shape.meanBond,
      fracture: shape.fracture,
      internalSpread: shape.internalSpread,
      weakestPair: shape.weakestPair,
      expectedMeanBond: mean(nulls.meanBond),
      oddOneOut,
      cliqueCapture,
      features: features.slice(0, GIVEN_CONFIG.MAX_FEATURES),
    };
  };

  const profiles: GivenGroupProfile[] = [];

  // --- the Table: both offices and every seated councillor ---
  const table = [leadership.margrave, leadership.bursar, ...(leadership.council ?? [])];
  const tableProfile = build('table', 'table', 'The Table', table);
  if (tableProfile && (GIVEN_CONFIG.ALWAYS_DESCRIBE_TABLE || tableProfile.features.length > 0)) {
    profiles.push(tableProfile);
  }

  // --- residences ---
  const byRoom = new Map<string, string[]>();
  for (const hero of Object.values(roster)) {
    for (const room of hero.locations?.residence ?? []) {
      const occupants = byRoom.get(room) ?? [];
      occupants.push(hero.identifier);
      byRoom.set(room, occupants);
    }
  }

  const residences: GivenGroupProfile[] = [];
  for (const [room, occupants] of byRoom) {
    if (occupants.length < GIVEN_CONFIG.MIN_ROOM_SIZE) continue;
    const profile = build(
      'residence', room, locationTitles[room] ?? labelFromIdentifier(room), occupants
    );
    // Rooms earn their line or stay silent. Contentment is not news.
    if (profile && profile.features.length > 0) residences.push(profile);
  }

  // Rank rooms by their strongest finding and keep only the loudest few. A
  // hamlet with fifteen bedrooms would otherwise bury everything else.
  residences.sort((a, b) => (b.features[0]?.bits ?? 0) - (a.features[0]?.bits ?? 0));
  profiles.push(...residences.slice(0, GIVEN_CONFIG.MAX_RESIDENCES));

  return profiles;
}