// server/services/politics/cliqueMetrics.ts
/**
 * @file Turns a found clique into a ranked list of things worth saying about it.
 *
 * THE PROBLEM this solves: a clique has a dozen measurable properties on
 * incompatible scales. Tag concentration is a ratio, stat means are in points,
 * seats are a count. Asking whether "3 of 4 are Criminal" beats "authority
 * averages 8.7" is meaningless until both are expressed in the same unit.
 *
 * THE UNIT is surprise. For every property we ask: if this group had been
 * assembled at RANDOM from the roster, how unlikely would this value be? That
 * probability, as -log2(p), gives BITS — 10 bits is roughly a one-in-a-thousand
 * coincidence. Every metric lands on that one scale.
 *
 * Two ways of getting there, depending on the metric:
 *
 *   EXACT, where the maths is clean. Tags, race and seats are draws without
 *   replacement, so the hypergeometric distribution gives p directly. Stat means
 *   use the normal approximation to the sampling distribution of a mean.
 *
 *   SAMPLED, where no closed form exists. Density, fragility, authority spread
 *   and regard all depend on the shape of the affinity graph, so we draw a few
 *   thousand random groups of the same size, measure each, and read off where
 *   the real clique falls.
 *
 * WHAT IS DELIBERATELY NOT SCORED: cohesion. The clique finder maximises it, so
 * a found clique is extreme on cohesion by construction and its "surprise" would
 * be enormous and meaningless — textbook selection bias. Cohesion is the reason
 * the group exists, not an interesting feature of it, so it is reported raw.
 * Density and fragility are safe: the finder never optimises for them, so two
 * groups with identical cohesion can differ wildly on both.
 */

import { CharacterRecord, EstateLeadership } from '../../../shared/types/types';
import { NEUTRAL_AFFINITY } from '../../../shared/constants/relationships.js';
import { Clique, bondBetween, cliqueGate } from './cliqueFinder.js';

// ===================================================================
// CONFIGURATION
// ===================================================================

const METRIC_CONFIG = {
  /** Qualifying random groups wanted per clique size for the sampled metrics. */
  SAMPLES: 4000,

  /**
   * Cap on draws while hunting for qualifying groups. In a sparse hamlet almost
   * no random trio clears the gate, and we would otherwise spin forever.
   */
  MAX_DRAWS: 200_000,

  /** Below this many qualifying groups the null is too thin to trust; shape metrics are skipped. */
  MIN_QUALIFYING: 200,

  /**
   * Below this, a finding is a coincidence. 4 bits is about one-in-sixteen —
   * the sort of thing that happens somewhere in any roster every month.
   */
  MIN_BITS: 4,

  /** Features reported per clique, after ranking. */
  MAX_FEATURES: 4,

  /**
   * Shrinkage pseudo-count for the REGARD metrics only.
   *
   * A three-person clique in a large hamlet may have only a handful of recorded
   * outside opinions. Blending toward the roster mean stops four opinions being
   * treated as firmly as forty. Tags and stats need no such treatment: every
   * hero's tags and stats are always known.
   */
  REGARD_SHRINKAGE: 3,

  MIN_SHARERS: 2,

  /**
   * Multipliers applied to raw surprise, by metric family.
   *
   * Bits measure how UNLIKELY a fact is. They cannot measure how much it MATTERS.
   * Three of five offices in one clique was scoring below a shared personality
   * trait — statistically fair, politically absurd. Governance outranks
   * sociology, so it gets a thumb on the scale.
   *
   * Everything not listed sits at 1.0. Keep this table short: each entry is an
   * opinion, and bits are doing the real work.
   */
  WEIGHTS: {
    executiveCapture: 2.0,   // the sword and the purse in one set of hands
    seats: 1.75,
    authorityShare: 1.5,
    attitudeDelta: 1.25,
  } as Record<string, number>,
};

// ===================================================================
// TYPES
// ===================================================================

export interface CliqueFeature {
  /** Machine name, e.g. 'tag:Criminal' or 'stat:authority'. */
  metric: string;
  /** Human phrasing for the prompt. */
  detail: string;
  /** Surprise, in bits. The ranking key. */
  bits: number;
  observed: number;
  baseline: number;
}

export interface CliqueProfile {
  members: string[];
  /** Unscored, descriptive. See the file header for why cohesion is not ranked. */
  cohesion: number;
  meanBond: number;
  gate: number;
  density: number;
  weakestLink: { a: string; b: string; bond: number };
  /** Ranked, filtered, capped. */
  features: CliqueFeature[];
}

// ===================================================================
// SMALL STATISTICS
// ===================================================================

/** log(n!) table, so hypergeometric terms stay in range for any roster size. */
function logFactorials(upTo: number): number[] {
  const table = new Array(upTo + 1).fill(0);
  for (let i = 2; i <= upTo; i++) table[i] = table[i - 1] + Math.log(i);
  return table;
}

const bits = (p: number): number => -Math.log2(Math.max(p, 1e-12));

/** Normal upper tail, Abramowitz & Stegun 7.1.26. Two-tailed p is 2x this. */
function normalTail(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 - y);
}

/**
 * P(at least `observed` of the tagged appear in a random draw of `drawn`).
 * The exact question for "are there unusually many Criminals in this clique?"
 */
function hypergeometricTail(
  tagged: number, population: number, drawn: number, observed: number, lf: number[]
): number {
  const choose = (n: number, k: number) =>
    k < 0 || k > n ? -Infinity : lf[n] - lf[k] - lf[n - k];

  const denominator = choose(population, drawn);
  let total = 0;
  for (let i = observed; i <= Math.min(drawn, tagged); i++) {
    total += Math.exp(choose(tagged, i) + choose(population - tagged, drawn - i) - denominator);
  }
  return Math.min(1, total);
}

/**
 * Where `value` falls in a sorted sample, as a two-tailed probability.
 *
 * Uses MID-RANK: samples equal to the observed value count as half. Without it,
 * a metric with few distinct values reads as far rarer than it is — density is
 * exactly 1.00 for a large share of qualifying groups, and counting only
 * strictly-smaller samples made a perfectly ordinary trio look one-in-thousands.
 */
function empiricalTail(sorted: number[], value: number): number {
  let below = 0;
  let equal = 0;
  for (const sample of sorted) {
    if (sample < value) below++;
    else if (sample === value) equal++;
  }
  const midRank = (below + equal / 2) / sorted.length;
  const tail = Math.min(midRank, 1 - midRank);
  // A sample of N cannot resolve anything rarer than ~1/N. Clamp rather than
  // report a confidence the sample does not support — and note that several
  // findings clipping at the ceiling become indistinguishable, which is why the
  // metrics with clean closed forms (tags, stats, seats) do not use this path.
  return Math.max(tail * 2, 1 / sorted.length);
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map(v => (v - m) ** 2)));
}

// ===================================================================
// MEASUREMENTS
// ===================================================================

const STAT_KEYS = ['strength', 'agility', 'intelligence', 'authority', 'sociability'] as const;
type StatKey = (typeof STAT_KEYS)[number];

/** Everything the sampler measures, computed identically for real and random groups. */
interface GraphShape {
  density: number;
  /**
   * How far the weakest bond sits below the group's OWN mean.
   *
   * Measured against the group rather than the hamlet gate, because the drama is
   * in the CONTRAST. A clique averaging 8.5 with one bond at 5.1 has a bond about
   * to snap — but measured against the gate it reads as "every bond clears the
   * bar", which is true and useless.
   */
  fracture: number;
  authoritySpread: number;  // stdDev of authority within the group
  inwardRegard: number;     // how the rest of the hamlet regards them
  outwardRegard: number;    // how they regard the rest of the hamlet
  /** outward minus inward. Devotion to a hamlet that mistrusts them, or the reverse. */
  attitudeDelta: number;
}

function measureShape(
  members: string[], roster: CharacterRecord, ids: string[], gate: number, rosterMean: number
): GraphShape {
  const inGroup = new Set(members);

  let abovePairs = 0;
  let pairs = 0;
  let weakest = Infinity;
  let bondSum = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const bond = bondBetween(members[i], members[j], roster);
      pairs++;
      bondSum += bond;
      if (bond >= gate) abovePairs++;
      if (bond < weakest) weakest = bond;
    }
  }
  const groupMean = pairs ? bondSum / pairs : gate;

  const inward: number[] = [];
  const outward: number[] = [];
  for (const member of members) {
    for (const other of ids) {
      if (inGroup.has(other)) continue;
      const theirView = roster[other]?.relationships[member]?.affinity;
      const ourView = roster[member]?.relationships[other]?.affinity;
      if (typeof theirView === 'number') inward.push(theirView);
      if (typeof ourView === 'number') outward.push(ourView);
    }
  }

  // Shrinkage: a handful of recorded opinions is not the same evidence as forty.
  const shrink = (values: number[]) => {
    const k = METRIC_CONFIG.REGARD_SHRINKAGE;
    return values.length ? (values.length * mean(values) + k * rosterMean) / (values.length + k) : rosterMean;
  };

  const inwardRegard = shrink(inward);
  const outwardRegard = shrink(outward);

  return {
    density: pairs ? abovePairs / pairs : 0,
    fracture: pairs ? groupMean - weakest : 0,
    authoritySpread: stdDev(members.map(m => roster[m]?.stats.authority ?? 0)),
    inwardRegard,
    outwardRegard,
    attitudeDelta: outwardRegard - inwardRegard,
  };
}

/** Random group of `size` drawn without replacement. */
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
 * Scores each clique's incidental properties and returns the surprising ones,
 * ranked. Leadership is optional; without it, seat-holding is simply not measured.
 */
export function profileCliques(
  cliques: Clique[],
  roster: CharacterRecord,
  leadership?: EstateLeadership
): CliqueProfile[] {
  const ids = Object.keys(roster);
  const gate = cliqueGate(roster);
  const lf = logFactorials(ids.length + 1);

  const recorded: number[] = [];
  for (const hero of Object.values(roster)) {
    for (const rel of Object.values(hero.relationships)) {
      if (typeof rel?.affinity === 'number') recorded.push(rel.affinity);
    }
  }
  const rosterMean = recorded.length ? mean(recorded) : NEUTRAL_AFFINITY;

  // --- roster-wide reference values, computed once ---
  const tagCounts = new Map<string, number>();
  const bump = (key: string) => tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
  for (const hero of Object.values(roster)) {
    for (const tag of hero.tags) bump(`tag:${tag}`);
    bump(`race:${hero.race}`);
    // Synthesised so a mixed group of outsiders registers even when no single
    // race clears the bar alone.
    if (hero.race.toLowerCase() !== 'human') bump('race:nonhuman');
  }

  const statMean = {} as Record<StatKey, number>;
  const statSd = {} as Record<StatKey, number>;
  for (const key of STAT_KEYS) {
    const values = Object.values(roster).map(h => h.stats[key]);
    statMean[key] = mean(values);
    statSd[key] = stdDev(values);
  }

  const seats = new Set<string>(
    leadership ? [leadership.margrave, leadership.bursar, ...(leadership.council ?? [])] : []
  );
  const totalAuthority = Object.values(roster).reduce((sum, h) => sum + h.stats.authority, 0);

  // --- sampled null distributions, one per distinct clique size ---
  //
  // CONDITIONED on qualifying as a clique. This matters more than it looks.
  //
  // The finder maximises MEAN bond, and mean bond correlates strongly with
  // MINIMUM bond, so a found clique compared against all random groups looks
  // miraculously unfractured — the first version of this scored "every bond
  // clears the bar" at 12 bits on a perfectly ordinary trio.
  //
  // The honest question is not "is this unusual among all groups of three" but
  // "among groups that COULD have been a clique, is this one unusually dense, or
  // unusually cracked?" So the null is drawn from qualifying groups only.
  const nullBySize = new Map<number, Record<keyof GraphShape, number[]> | null>();
  const nullFor = (size: number) => {
    if (nullBySize.has(size)) return nullBySize.get(size)!;

    const collected: Record<keyof GraphShape, number[]> = {
      density: [], fracture: [], authoritySpread: [],
      inwardRegard: [], outwardRegard: [], attitudeDelta: [],
    };

    let qualifying = 0;
    let draws = 0;
    while (qualifying < METRIC_CONFIG.SAMPLES && draws < METRIC_CONFIG.MAX_DRAWS) {
      draws++;
      const group = randomGroup(ids, size);

      // Same gate the finder applies: mean bond must exceed it.
      let sum = 0;
      let pairs = 0;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          sum += bondBetween(group[i], group[j], roster);
          pairs++;
        }
      }
      if (pairs === 0 || sum / pairs <= gate) continue;

      qualifying++;
      const shape = measureShape(group, roster, ids, gate, rosterMean);
      for (const key of Object.keys(collected) as (keyof GraphShape)[]) collected[key].push(shape[key]);
    }

    if (qualifying < METRIC_CONFIG.MIN_QUALIFYING) {
      console.info(
        `[Politics] Only ${qualifying} random groups of ${size} clear the clique bar; ` +
        `shape metrics are unreliable at this roster size and will be skipped.`
      );
      nullBySize.set(size, null);
      return null;
    }

    for (const key of Object.keys(collected) as (keyof GraphShape)[]) collected[key].sort((a, b) => a - b);
    nullBySize.set(size, collected);
    return collected;
  };

  // --- profile each clique ---
  return cliques.map(clique => {
    const members = clique.members;
    const size = members.length;
    const features: CliqueFeature[] = [];
    const add = (f: CliqueFeature) => {
      const family = f.metric.split(':')[0];
      const weight = METRIC_CONFIG.WEIGHTS[family] ?? METRIC_CONFIG.WEIGHTS[f.metric] ?? 1;
      const weighted = { ...f, bits: f.bits * weight };
      if (weighted.bits >= METRIC_CONFIG.MIN_BITS) features.push(weighted);
    };

    // 1. Tags, race, and the synthesised non-human category. Exact.
    const localCounts = new Map<string, number>();
    for (const id of members) {
      const hero = roster[id];
      if (!hero) continue;
      for (const tag of hero.tags) localCounts.set(`tag:${tag}`, (localCounts.get(`tag:${tag}`) ?? 0) + 1);
      localCounts.set(`race:${hero.race}`, (localCounts.get(`race:${hero.race}`) ?? 0) + 1);
      if (hero.race.toLowerCase() !== 'human') {
        localCounts.set('race:nonhuman', (localCounts.get('race:nonhuman') ?? 0) + 1);
      }
    }
    // Who holds each attribute, so identical member sets can be merged and the
    // odd one out can be named.
    const holders = new Map<string, string[]>();
    for (const id of members) {
      const hero = roster[id];
      if (!hero) continue;
      const attributes = [
        ...hero.tags.map(t => `tag:${t}`),
        `race:${hero.race}`,
        ...(hero.race.toLowerCase() !== 'human' ? ['race:nonhuman'] : []),
      ];
      for (const key of attributes) {
        const list = holders.get(key) ?? [];
        list.push(id);
        holders.set(key, list);
      }
    }

    interface TagFinding { key: string; label: string; count: number; inRoster: number; bits: number; memberKey: string; }
    const tagFindings: TagFinding[] = [];

    for (const [key, count] of localCounts) {
      if (count < METRIC_CONFIG.MIN_SHARERS) continue;
      const inRoster = tagCounts.get(key) ?? 0;
      tagFindings.push({
        key,
        label: key.startsWith('tag:') ? key.slice(4) : key.slice(5),
        count,
        inRoster,
        bits: bits(hypergeometricTail(inRoster, ids.length, size, count, lf)),
        memberKey: (holders.get(key) ?? []).slice().sort().join('|'),
      });
    }

    // MERGE findings resting on exactly the same people. Two siblings who share
    // Drunkard and Weak are ONE fact — that they are siblings — and printing it
    // twice at identical scores wastes both slots.
    const byMembers = new Map<string, TagFinding[]>();
    for (const finding of tagFindings) {
      const bucket = byMembers.get(finding.memberKey) ?? [];
      bucket.push(finding);
      byMembers.set(finding.memberKey, bucket);
    }

    for (const bucket of byMembers.values()) {
      bucket.sort((a, b) => b.bits - a.bits);
      const head = bucket[0];
      // Cap the merged list, and carry only labels that would have been worth
      // reporting ALONE. Otherwise the merge smuggles in the uninteresting: three
      // humans in a mostly-human hamlet is about one bit and says nothing, but it
      // rides along for free on whatever member set it happens to share.
      const alsoShared = bucket
        .slice(1)
        .filter(f => f.bits >= METRIC_CONFIG.MIN_BITS)
        .map(f => f.label);
      const shown = alsoShared.slice(0, 3);
      const remainder = alsoShared.length - shown.length;

      let detail = `${head.count} of ${size} are ${head.label}, against ${head.inRoster} of ${ids.length} in the hamlet`;
      if (shown.length) {
        detail += ` — the same ${head.count} also share ${shown.join(', ')}`;
        if (remainder > 0) detail += ` and ${remainder} more`;
      }

      // Name the odd one out when everyone but a single member shares it: "3 of 4
      // are Criminal; the fourth is the Vestal" is a better sentence for free.
      if (head.count === size - 1) {
        const held = new Set(holders.get(head.key) ?? []);
        const outsider = members.find(m => !held.has(m));
        if (outsider) {
          const hero = roster[outsider];
          detail += `; the odd one out is ${hero ? hero.name : outsider} (${outsider})`;
        }
      }

      add({
        metric: head.key,
        detail,
        bits: head.bits,
        observed: head.count / size,
        baseline: head.inRoster / ids.length,
      });
    }

    // 2. Stat means. Normal approximation to the sampling distribution of a mean.
    for (const key of STAT_KEYS) {
      if (statSd[key] === 0) continue;
      const observed = mean(members.map(m => roster[m]?.stats[key] ?? 0));
      const z = (observed - statMean[key]) / (statSd[key] / Math.sqrt(size));
      add({
        metric: `stat:${key}`,
        detail: `${key} averages ${observed.toFixed(1)}, against ${statMean[key].toFixed(1)} in the hamlet`,
        bits: bits(2 * normalTail(z)),
        observed,
        baseline: statMean[key],
      });
    }

    // 3. Seats held. Exact — a draw from the roster, of which some hold chairs.
    if (seats.size > 0) {
      const held = members.filter(m => seats.has(m)).length;
      if (held >= 1) {
        add({
          metric: 'seats',
          detail: `holds ${held} of the hamlet's ${seats.size} seats of office`,
          bits: bits(hypergeometricTail(seats.size, ids.length, size, held, lf)),
          observed: held,
          baseline: (seats.size * size) / ids.length,
        });
      }
    }

    // 3b. Executive capture: the sword AND the purse, in one set of hands.
    //     A raw seat count flattens this — three council chairs is a voting bloc,
    //     Margrave plus Bursar is control of the estate. Exact: the probability
    //     that a random group of this size contains two SPECIFIC heroes.
    if (leadership) {
      const holdsMargrave = members.includes(leadership.margrave);
      const holdsBursar = members.includes(leadership.bursar);
      if (holdsMargrave && holdsBursar && ids.length >= size && size >= 2) {
        const choose = (n: number, k: number) =>
          k < 0 || k > n ? -Infinity : lf[n] - lf[k] - lf[n - k];
        const p = Math.exp(choose(ids.length - 2, size - 2) - choose(ids.length, size));
        add({
          metric: 'executiveCapture',
          detail: `holds both the sword and the purse — the Margrave and the Bursar sit in this group`,
          bits: bits(p),
          observed: 2,
          baseline: 0,
        });
      }
    }

    // 4. Share of the hamlet's authority. Compared against an equally-sized
    //    group of average heroes, which is what `size / rosterSize` represents.
    const heldAuthority = members.reduce((sum, m) => sum + (roster[m]?.stats.authority ?? 0), 0);
    const authorityShare = totalAuthority > 0 ? heldAuthority / totalAuthority : 0;
    const expectedShare = size / ids.length;
    if (statSd.authority > 0) {
      const z =
        (heldAuthority - size * statMean.authority) / (statSd.authority * Math.sqrt(size));
      add({
        metric: 'authorityShare',
        detail: `commands ${(authorityShare * 100).toFixed(0)}% of the hamlet's authority with ${(expectedShare * 100).toFixed(0)}% of its people`,
        bits: bits(2 * normalTail(z)),
        observed: authorityShare,
        baseline: expectedShare,
      });
    }

    // 5. Graph-shaped metrics. No closed form, so measured against sampled groups.
    const shape = measureShape(members, roster, ids, gate, rosterMean);
    const nulls = nullFor(size);
    // Labels compare against the SAMPLED baseline — what a typical group that
    // could have been a clique scores — because that is what the bits measure.
    // Printing the hamlet-wide mean here instead was quietly showing one
    // comparison while scoring a different one.
    const shapeLabels: Record<keyof GraphShape, (v: number, typical: number) => string> = {
      density: v => `bonds run ${v >= 0.99 ? 'through every pair' : `through only ${(v * 100).toFixed(0)}% of pairs`}`,
      fracture: (v, t) =>
        `its weakest bond sits ${v.toFixed(1)} below the group's own average, where a comparable group averages ${t.toFixed(1)} — a fault line`,
      authoritySpread: (v, t) => `authority within it varies by ${v.toFixed(1)}, against ${t.toFixed(1)} for a comparable group`,
      inwardRegard: (v, t) => `the hamlet regards them at ${v.toFixed(1)}, where a comparable group draws ${t.toFixed(1)}`,
      outwardRegard: (v, t) => `they regard the hamlet at ${v.toFixed(1)}, where a comparable group gives ${t.toFixed(1)}`,
      attitudeDelta: (v, t) =>
        (v > 0
          ? `they think better of the hamlet than it does of them, by ${v.toFixed(1)}`
          : `the hamlet thinks better of them than they do of it, by ${(-v).toFixed(1)}`) +
        ` (a comparable group sits at ${t.toFixed(1)})`,
    };
    for (const key of nulls ? (Object.keys(shapeLabels) as (keyof GraphShape)[]) : []) {
      const p = empiricalTail(nulls![key], shape[key]);
      const typical = mean(nulls![key]);
      add({
        metric: `shape:${key}`,
        detail: shapeLabels[key](shape[key], typical),
        bits: bits(p),
        observed: shape[key],
        baseline: mean(nulls![key]),
      });
    }

    features.sort((a, b) => b.bits - a.bits);

    return {
      members,
      cohesion: clique.cohesion,
      meanBond: clique.meanBond,
      gate,
      density: clique.density,
      weakestLink: clique.weakestLink,
      features: features.slice(0, METRIC_CONFIG.MAX_FEATURES),
    };
  });
}