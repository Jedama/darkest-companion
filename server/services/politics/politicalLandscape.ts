// server/services/politics/politicalLandscape.ts
/**
 * @file Assembles the political picture of a hamlet for the narrative writer.
 *
 * The one entry point every route uses. Its signature deliberately matches the
 * section builders in buildPromptService — Estate in, string out — so callers
 * compose it identically and cannot tell the difference. What is behind it is
 * different in kind, though, and that is why it lives here rather than there:
 * the builders in buildPromptService PROJECT state the Estate already holds,
 * while this DERIVES facts that exist nowhere in the save. Nothing in the estate
 * knows there is a bloc, or that it holds three of five seats.
 *
 * The `<metric:name>` tags are KEPT deliberately — they tell the writer these are
 * measured facts rather than authored ones, which is the stance we want taken
 * toward them.
 */

import type { Estate } from '../../../shared/types/types.js';
import { cliqueGate } from './roster.js';
import { reseed } from './statistics.js';
import { findCliques } from './cliqueFinder.js';
import { profileCliques } from './cliqueMetrics.js';
import { relateCliques } from './cliqueRelations.js';
import { profileGivenGroups } from './givenGroups.js';
import { summariseHamlet, describeHamlet } from './hamletSummary.js';
import { profileHeroes } from './heroMetrics.js';

export function buildPoliticalLandscapeSection(
  estate: Estate,
  locationTitles: Record<string, string>
): string {
  // Every layer below draws thousands of random groups to build its nulls. Seed
  // once, here, so a given estate in a given month always reads the same way.
  reseed(`${estate.name}:${estate.time.month}`);

  const roster = estate.characters;
  const lines: string[] = [];

  const gate = cliqueGate(roster);
  const cliques = findCliques(roster);
  const profiles = profileCliques(cliques, roster, estate.leadership);

  const name = (id: string) => {
    const hero = roster[id];
    return hero ? `${hero.name} (${id})` : id;
  };

  lines.push(
    `Measured from the roster's relationships, not authored. A bloc is a group ` +
    `bonded above ${gate.toFixed(1)} of 10; the bracketed figure on each finding is ` +
    `how unusual it is, where higher is rarer. Absence of a finding means nothing ` +
    `remarkable was measured, not that nothing is happening.`
  );
  lines.push('');
  lines.push(describeHamlet(summariseHamlet(roster, profiles, estate.leadership), roster));

  // --- the cliques themselves ---
  //
  // Each section guards itself. This used to be one early return on an empty
  // clique list, which silently discarded the standing groups and the individuals
  // too — but a hamlet with no blocs still has a Table, still has shared rooms,
  // and can still have taken sides over someone. Those are precisely the months
  // where the other two layers are all there is.
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
  const given = profileGivenGroups(roster, estate.leadership, profiles, locationTitles);
  if (given.length > 0) {
    lines.push('');
    lines.push('--- Standing groups ---');
    for (const group of given) {
      lines.push('');
      lines.push(`    ${group.label} (${group.members.length}): ${group.members.map(name).join(', ')}`);
      // Just the comparison. Naming the weakest pair here duplicated the feature
      // that names it below, and by design: the weakest pair is usually the story.
      //
      // `expectedMeanBond` is what a RANDOM GROUP OF THIS SIZE averages, not the
      // hamlet mean — a better baseline, and the one the bits are actually scored
      // against. It was labelled "hamlet average" here, which put four different
      // hamlet averages in one document, two of them a different statistic.
      lines.push(
        `      bonds average ${group.meanBond.toFixed(2)}; ` +
        `a comparable group averages ${group.expectedMeanBond.toFixed(2)}`
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

  return lines.join('\n');
}