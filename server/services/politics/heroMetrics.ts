// server/services/politics/heroMetrics.ts
/**
 * @file The two things about an individual that no group layer can say.
 *
 * Deliberately narrow. Most of what makes a hero interesting shows up through
 * the groups they sit in — a fault line at the Table names the person on either
 * side of it. Only facts that are true of a hero across the WHOLE hamlet belong
 * here, and there turned out to be two worth having:
 *
 *   POLARISING — opinion on them is split rather than merely low or high. The
 *   Table can report that two people quarrel; only this can report that the
 *   hamlet has taken sides over someone.
 *
 *   POWER WITHOUT STANDING — authority without regard and without a bloc. Someone
 *   who commands and is not liked, answering to nobody and owed nothing.
 *
 * DELIBERATELY OMITTED, and why:
 *
 *   The invisible (nobody has formed a view of them). Self-correcting: heroes
 *   march together every month and come back with opinions, so a hero is only
 *   invisible in their first weeks.
 *
 *   The regard gap (held higher than they hold others). It attaches to a
 *   character TYPE — the taciturn, the unfriendly-but-reliable — so it would name
 *   the same person every month and press the writer into repeating themselves.
 */

import { CharacterRecord } from '../../../shared/types/types.js';
import { hamletAffinities } from './roster.js';
import { bits, empiricalTail, mean, random, stdDev } from './statistics.js';
import type { CliqueFeature, CliqueProfile } from './cliqueMetrics.js';

const HERO_CONFIG = {
  SAMPLES: 3000,
  MIN_BITS: 4,

  /** Hero findings reported in total, across the whole roster. */
  MAX_FINDINGS: 3,

  /** Fewer recorded opinions than this and there is nothing to be confident about. */
  MIN_OPINIONS: 3,

  /** Shrinkage pseudo-count, as elsewhere: four opinions are not forty. */
  SHRINKAGE: 3,

  /**
   * Authority percentile a hero must clear before "power without standing" can
   * apply. Below it they are simply unpopular, which is not a political fact.
   */
  POWER_PERCENTILE: 0.6,

  /** Power without standing outranks a merely divisive figure. */
  POWER_WEIGHT: 1.4,
};

export interface HeroFinding extends CliqueFeature {
  identifier: string;
}

/**
 * Finds the heroes worth a line of their own.
 *
 * The null here is NOT other heroes — a roster of twelve cannot resolve anything
 * rarer than one-in-twelve, which is below the reporting floor before we start.
 * Instead, for a hero with n recorded opinions, we draw n opinions at random from
 * the hamlet's own pool and ask how their spread compares. That accounts for
 * sample size directly: a hero judged by three people has to be far more divisive
 * than one judged by thirty before either is worth reporting.
 */
export function profileHeroes(
  roster: CharacterRecord,
  cliques: CliqueProfile[]
): HeroFinding[] {
  const ids = Object.keys(roster);
  if (ids.length < 4) return [];

  // Every recorded opinion in the hamlet. Used as the null for REGARD, where the
  // question is how a hero's standing compares to the hamlet's general warmth.
  const pool = hamletAffinities(roster);
  if (pool.length < 6) return [];
  const hamletMean = mean(pool);

  /**
   * RESIDUALS: every opinion minus the mean opinion of the hero it concerns.
   *
   * This is the null for POLARISATION, and using the raw pool instead was a real
   * bug — that pool carries the TOTAL variance, which is how much heroes differ
   * from one another PLUS how much opinion varies within a hero. It is therefore
   * always wider than any individual's spread, and nobody could ever register as
   * divisive.
   *
   * Stripping each hero's own average leaves only within-hero variation: the
   * spread you would expect about someone nobody has taken sides over.
   */
  const residuals: number[] = [];
  for (const subject of ids) {
    const about: number[] = [];
    for (const viewer of ids) {
      if (viewer === subject) continue;
      const view = roster[viewer]?.relationships[subject]?.affinity;
      if (typeof view === 'number') about.push(view);
    }
    if (about.length < 2) continue;
    const subjectMean = mean(about);
    for (const value of about) residuals.push(value - subjectMean);
  }
  if (residuals.length < 6) return [];

  const affiliated = new Set<string>();
  for (const clique of cliques) for (const member of clique.members) affiliated.add(member);

  const authorities = ids.map(id => roster[id]?.stats.authority ?? 0).sort((a, b) => a - b);
  const authorityCutoff =
    authorities[Math.floor(authorities.length * HERO_CONFIG.POWER_PERCENTILE)] ?? 0;

  // Null distributions cached by opinion count, since heroes share sample sizes.
  const nullByCount = new Map<number, { spread: number[]; regard: number[] }>();
  const nullFor = (count: number) => {
    const cached = nullByCount.get(count);
    if (cached) return cached;

    const spread: number[] = [];
    const regard: number[] = [];
    for (let i = 0; i < HERO_CONFIG.SAMPLES; i++) {
      // Polarisation against within-hero variation...
      const residualDraw: number[] = [];
      for (let j = 0; j < count; j++) {
        residualDraw.push(residuals[Math.floor(random() * residuals.length)]);
      }
      spread.push(stdDev(residualDraw));

      // ...and standing against the hamlet's opinions at large.
      const regardDraw: number[] = [];
      for (let j = 0; j < count; j++) regardDraw.push(pool[Math.floor(random() * pool.length)]);
      const k = HERO_CONFIG.SHRINKAGE;
      regard.push((count * mean(regardDraw) + k * hamletMean) / (count + k));
    }
    spread.sort((a, b) => a - b);
    regard.sort((a, b) => a - b);
    const built = { spread, regard };
    nullByCount.set(count, built);
    return built;
  };

  const findings: HeroFinding[] = [];

  for (const id of ids) {
    const hero = roster[id];
    if (!hero) continue;

    // How the rest of the hamlet regards them.
    const opinions: number[] = [];
    for (const other of ids) {
      if (other === id) continue;
      const view = roster[other]?.relationships[id]?.affinity;
      if (typeof view === 'number') opinions.push(view);
    }
    if (opinions.length < HERO_CONFIG.MIN_OPINIONS) continue;

    const nulls = nullFor(opinions.length);
    const spread = stdDev(opinions);
    const k = HERO_CONFIG.SHRINKAGE;
    const regard = (opinions.length * mean(opinions) + k * hamletMean) / (opinions.length + k);

    // --- POLARISING ---
    const spreadBits = bits(empiricalTail(nulls.spread, spread, 'high'));
    if (spreadBits >= HERO_CONFIG.MIN_BITS) {
      const warmest = Math.max(...opinions);
      const coldest = Math.min(...opinions);
      findings.push({
        identifier: id,
        metric: 'hero:polarising',
        detail:
          `the hamlet is divided over ${hero.name} — opinions of them run from ` +
          `${coldest} to ${warmest} across ${opinions.length} who have formed one`,
        bits: spreadBits,
        observed: spread,
        baseline: mean(nulls.spread),
      });
    }

    // --- POWER WITHOUT STANDING ---
    // Authority is on the character sheet and can never be news on its own. What
    // makes it a political fact is the company it keeps: no bloc, no goodwill.
    const powerful = hero.stats.authority >= authorityCutoff;
    if (powerful && !affiliated.has(id)) {
      const regardBits = bits(empiricalTail(nulls.regard, regard, 'low')) * HERO_CONFIG.POWER_WEIGHT;
      if (regardBits >= HERO_CONFIG.MIN_BITS) {
        findings.push({
          identifier: id,
          metric: 'hero:powerWithoutStanding',
          detail:
            `${hero.name} carries authority ${hero.stats.authority} and belongs to no bloc, ` +
            `and the hamlet regards them at ${regard.toFixed(1)} against ${hamletMean.toFixed(1)}`,
          bits: regardBits,
          observed: regard,
          baseline: hamletMean,
        });
      }
    }
  }

  // One finding per hero, then the loudest few overall — otherwise a single
  // divisive figure could take every slot.
  const bestPerHero = new Map<string, HeroFinding>();
  for (const finding of findings.sort((a, b) => b.bits - a.bits)) {
    if (!bestPerHero.has(finding.identifier)) bestPerHero.set(finding.identifier, finding);
  }

  return [...bestPerHero.values()]
    .sort((a, b) => b.bits - a.bits)
    .slice(0, HERO_CONFIG.MAX_FINDINGS);
}