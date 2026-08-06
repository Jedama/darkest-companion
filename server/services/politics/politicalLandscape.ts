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

/**
 * A human-readable dump of everything the political layer currently knows.
 * Not prompt copy — deliberately verbose, with the raw numbers left in.
 */
export function debugPoliticalLandscape(estate: Estate): string {
  const roster = estate.characters;
  const lines: string[] = [];

  const started = Date.now();
  const cliques = findCliques(roster);
  const profiles = profileCliques(cliques, roster, estate.leadership);
  const elapsed = Date.now() - started;

  const rosterSize = Object.keys(roster).length;
  const gate = cliqueGate(roster);

  lines.push('='.repeat(72));
  lines.push(`POLITICAL LANDSCAPE — ${rosterSize} heroes, clique bar ${gate.toFixed(2)}, ${elapsed}ms`);
  lines.push('='.repeat(72));

  const name = (id: string) => {
    const hero = roster[id];
    return hero ? `${hero.name} (${id})` : id;
  };

  if (profiles.length === 0) {
    lines.push('');
    lines.push('No cliques. Nobody in this hamlet is close enough to anybody to form one.');
    lines.push('='.repeat(72));
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
          : `      ${relation.crossingTies} warm bond(s) cross between them`
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

  lines.push('');
  lines.push('='.repeat(72));
  return lines.join('\n');
}