// server/services/politics/statistics.ts
/**
 * @file The statistics every layer of the political model shares.
 *
 * Deliberately domain-free: nothing here knows what a hero or a hamlet is, and
 * nothing here should. That is what makes it testable with a handful of numbers.
 *
 * These lived in three copies across cliqueMetrics, givenGroups and heroMetrics,
 * and they had already drifted — heroMetrics' `empiricalTail` had lost the
 * two-tailed branch, so that layer silently could not ask a two-sided question.
 * Since politicalLandscape prints bits from all three layers in one list as
 * though they were commensurable, they need to come from one place.
 */

// ===================================================================
// SEEDED RANDOMNESS
// ===================================================================

/**
 * The whole political layer draws a few thousand random groups per size to build
 * its null distributions, so nothing it reports is quite reproducible under
 * Math.random. Seeding it means a given estate in a given month always reads the
 * same way — a surprising finding can be looked at twice, and a bug report can be
 * re-run.
 *
 * Note the consequence: re-running a review on the same save no longer produces
 * a slightly different reading. That is the point, but it is a behaviour change.
 */
let rngState = 0;

/** FNV-1a. Any string in, one well-mixed 32-bit integer out. */
function hashSeed(seed: string | number): number {
  const text = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Call once before a run of sampling. Everything downstream becomes deterministic. */
export function reseed(seed: string | number): void {
  rngState = hashSeed(seed);
}

/** mulberry32. Fast, seedable, and far better distributed than it has any right to be. */
export function random(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

reseed('unseeded');

// ===================================================================
// SUMMARY STATISTICS
// ===================================================================

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map(v => (v - m) ** 2)));
}

/** Surprise, in bits. 10 bits is roughly a one-in-a-thousand coincidence. */
export const bits = (p: number): number => -Math.log2(Math.max(p, 1e-12));

// ===================================================================
// SAMPLED TESTS
// ===================================================================

/**
 * Where `value` falls in a sorted sample, as a probability.
 *
 * MID-RANK: samples equal to the observed value count as half. Without it, a
 * metric with few distinct values reads as far rarer than it is — density is
 * exactly 1.00 for a large share of qualifying groups, and counting only
 * strictly-smaller samples made a perfectly ordinary trio look one-in-thousands.
 * Affinities are integers, so sampled values clump and this matters everywhere.
 *
 * DIRECTION: a two-tailed test asks "is this unusual either way" and costs exactly
 * one bit against a one-tailed test. That price is only worth paying for metrics
 * genuinely reported at both ends. Most are not — a fracture is only ever reported
 * when LARGE, a room only when COLD — and asking the wrong question was quietly
 * sinking real findings below the reporting floor: a pair at mutual contempt
 * scored 3.78 bits against a floor of 4 and vanished.
 *
 * CLAMP: a sample of N cannot resolve anything rarer than ~1/N, so the tail is
 * floored there rather than reporting a confidence the sample does not support.
 * Several findings clipping at that ceiling become indistinguishable, which is
 * why the metrics with clean closed forms (tags, stats, seats) do not use this
 * path at all.
 */
export function empiricalTail(
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

/** Random group of `size` drawn without replacement, from the seeded stream. */
export function randomGroup(ids: string[], size: number): string[] {
  const pool = [...ids];
  const picked: string[] = [];
  for (let i = 0; i < size && pool.length; i++) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picked;
}