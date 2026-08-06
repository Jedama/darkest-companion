// server/services/politics/politicalLandscape.ts
/**
 * @file Assembles the political picture of a hamlet for the narrative writer.
 *
 * WORK IN PROGRESS. Only the clique layer exists so far; the given groups
 * (council, residences), the roster-level opening line and the relations
 * BETWEEN cliques are still to come. For now this renders a debug view so the
 * numbers can be eyeballed against a real save before any of it reaches a prompt.
 */

import type { Estate } from '../../../shared/types/types.js';
import { findCliques, cliqueGate } from './cliqueFinder.js';
import { profileCliques } from './cliqueMetrics.js';
import { relateCliques } from './cliqueRelations.js';
import { profileGivenGroups } from './givenGroups.js';
import { summariseHamlet, describeHamlet } from './hamletSummary.js';
import { profileHeroes } from './heroMetrics.js';

/**
 * The political landscape as prompt copy.
 *
 * Same content as the debug view minus the machinery: no timings, no internal
 * thresholds. The `<metric:name>` tags are KEPT deliberately — they tell the
 * writer these are measured facts rather than authored ones, which is the stance
 * we want taken toward them.
 */
export function buildPoliticalLandscapeSection(estate: Estate): string {
  return render(estate, { debug: false });
}

/**
 * A human-readable dump of everything the political layer currently knows.
 * Verbose, with timings and thresholds left in. For the console, not the prompt.
 */
export function debugPoliticalLandscape(estate: Estate): string {
  return render(estate, { debug: true });
}

function render(estate: Estate, options: { debug: boolean }): string {
  const roster = estate.characters;
  const lines: string[] = [];

  const started = Date.now();
  const cliques = findCliques(roster);
  const profiles = profileCliques(cliques, roster, estate.leadership);
  const elapsed = Date.now() - started;

  const rosterSize = Object.keys(roster).length;
  const gate = cliqueGate(roster);

  if (options.debug) {
    lines.push('='.repeat(72));
    lines.push(`POLITICAL LANDSCAPE — clique bar ${gate.toFixed(2)}, ${elapsed}ms`);
    lines.push('='.repeat(72));
  } else {
    lines.push(
      `Measured from the roster's relationships, not authored. A bloc is a group ` +
      `bonded above ${gate.toFixed(1)} of 10; the bracketed figure on each finding is ` +
      `how unusual it is, where higher is rarer. Absence of a finding means nothing ` +
      `remarkable was measured, not that nothing is happening.`
    );
  }
  lines.push('');
  lines.push(describeHamlet(summariseHamlet(roster, profiles, estate.leadership), roster));

  const name = (id: string) => {
    const hero = roster[id];
    return hero ? `${hero.name} (${id})` : id;
  };

  if (profiles.length === 0) {
    if (options.debug) {
      lines.push('');
      lines.push('='.repeat(72));
    }
    return lines.join('\n');
  }

  profiles.forEach((profile, i) => {
    const label = String.fromCharCode(65 + i); // A, B, C...
    lines.push('');
    lines.push(`--- Clique ${label} — ${profile.members.length} members ---`);
    for (const id of profile.members) lines.push(`      ${name(id)}`);
    lines.push(
      `    bonds average ${profile.meanBond.toFixed(2)} ` +
      `(bar ${profile.gate.toFixed(2)}, ceiling 10), ` +
      `cohesion ${profile.cohesion.toFixed(2)}, density ${profile.density.toFixed(2)}`
    );
    lines.push(
      `    weakest link: ${name(profile.weakestLink.a)} / ${name(profile.weakestLink.b)} ` +
      `at ${profile.weakestLink.bond.toFixed(2)}`
    );
    if (profile.hinge) {
      lines.push(
        `    held together by ${name(profile.hinge)} alone — without them it is not one group`
      );
    }

    if (profile.features.length === 0) {
      lines.push('    (nothing surprising about them beyond being close)');
    } else {
      lines.push('    notable:');
      for (const feature of profile.features) {
        lines.push(`      [${feature.bits.toFixed(1)} bits] ${feature.detail}   <${feature.metric}>`);
      }
    }
  });

  // --- how the cliques regard each other ---
  const relations = relateCliques(profiles, roster);
  if (relations.length > 0) {
    lines.push('');
    lines.push('--- Between the cliques ---');
    for (const relation of relations) {
      const A = String.fromCharCode(65 + relation.aIndex);
      const B = String.fromCharCode(65 + relation.bIndex);
      lines.push('');
      lines.push(`    ${A} <-> ${B}   (hamlet average ${relation.hamletMean.toFixed(1)})`);
      lines.push(`      ${A} regards ${B} at ${relation.aTowardB.toFixed(1)}`);
      lines.push(`      ${B} regards ${A} at ${relation.bTowardA.toFixed(1)}`);
      lines.push(
        relation.crossingTies === 0
          ? `      no warm bond crosses between them`
          : relation.crossingTies === 1
            ? `      a single warm bond crosses between them`
            : `      ${relation.crossingTies} warm bonds cross between them`
      );
      for (const loyalty of relation.dividedLoyalties) {
        const leansTo = loyalty.towardA > loyalty.towardB ? A : B;
        lines.push(
          `      ${name(loyalty.member)} sits in both — closer to ${leansTo} ` +
          `(${A} ${loyalty.towardA.toFixed(1)} / ${B} ${loyalty.towardB.toFixed(1)})`
        );
      }
    }
  }

  // --- standing groups: membership that persists, whoever marches ---
  const given = profileGivenGroups(roster, estate.leadership, profiles);
  if (given.length > 0) {
    lines.push('');
    lines.push('--- Standing groups ---');
    for (const group of given) {
      lines.push('');
      lines.push(`    ${group.label} (${group.members.length}): ${group.members.map(name).join(', ')}`);
      // Just the comparison. Naming the weakest pair here duplicated the feature
      // that names it below, and by design: the weakest pair is usually the story.
      lines.push(
        `      bonds average ${group.meanBond.toFixed(2)}; ` +
        `hamlet average ${group.expectedMeanBond.toFixed(2)}`
      );
      if (group.cliqueCapture) {
        lines.push(
          `      ${group.cliqueCapture.held} of its ${group.members.length} places belong to one clique ` +
          `(${group.cliqueCapture.members.map(name).join(', ')})`
        );
      }
      if (group.features.length === 0) {
        lines.push('      (nothing notable)');
      } else {
        for (const feature of group.features) {
          lines.push(`      [${feature.bits.toFixed(1)} bits] ${feature.detail}   <${feature.metric}>`);
        }
      }
    }
  }

  // --- individuals, for the facts no group can state ---
  const heroFindings = profileHeroes(roster, profiles);
  if (heroFindings.length > 0) {
    lines.push('');
    lines.push('--- Individuals ---');
    for (const finding of heroFindings) {
      lines.push(`      [${finding.bits.toFixed(1)} bits] ${finding.detail}   <${finding.metric}>`);
    }
  }

  if (options.debug) {
    lines.push('');
    lines.push('='.repeat(72));
  }
  return lines.join('\n');
}