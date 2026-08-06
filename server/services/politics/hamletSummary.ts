// server/services/politics/hamletSummary.ts
/**
 * @file The state of the hamlet as a whole, in one or two sentences.
 *
 * Everything else in this folder describes a GROUP. None of it can say whether
 * this is a place with factions or without them, whether power sits inside the
 * blocs or outside them, or whether people here generally get on. Those are facts
 * about the hamlet, not about anyone in it, and they set the frame everything
 * else is read against.
 *
 * This is also where a quiet month gets to be quiet. A hamlet with no cliques and
 * no unrest should produce one honest line and nothing more, rather than a report
 * padded out to look substantial.
 */

import { CharacterRecord, EstateLeadership } from '../../../shared/types/types';
import { NEUTRAL_AFFINITY } from '../../../shared/constants/relationships.js';
import type { CliqueProfile } from './cliqueMetrics.js';

export interface HamletSummary {
  rosterSize: number;
  /** Mean of recorded affinities only. Strangers are absent data, not neutral opinions. */
  meanAffinity: number;
  /** Share of recorded pairs where both directions are warm. */
  reciprocity: number;
  /** How many pairs have any recorded opinion at all, as a share of all possible pairs. */
  acquaintance: number;

  cliqueCount: number;
  /** Share of the roster belonging to at least one clique. */
  affiliatedShare: number;
  /** Share of the hamlet's authority held by heroes in no clique. */
  unaffiliatedAuthorityShare: number;
  /** The most authoritative hero belonging to no clique, if any. */
  strongestUnaffiliated: { identifier: string; authority: number } | null;

  /** Heroes holding office or a seat who belong to no clique. */
  unaffiliatedSeatHolders: string[];
}

export function summariseHamlet(
  roster: CharacterRecord,
  cliques: CliqueProfile[],
  leadership: EstateLeadership
): HamletSummary {
  const ids = Object.keys(roster);
  const size = ids.length;

  const recorded: number[] = [];
  let recordedPairs = 0;
  let warmBothWays = 0;

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const aToB = roster[ids[i]]?.relationships[ids[j]]?.affinity;
      const bToA = roster[ids[j]]?.relationships[ids[i]]?.affinity;
      if (typeof aToB === 'number') recorded.push(aToB);
      if (typeof bToA === 'number') recorded.push(bToA);
      if (typeof aToB !== 'number' && typeof bToA !== 'number') continue;

      recordedPairs++;
      if (
        typeof aToB === 'number' && typeof bToA === 'number' &&
        aToB > NEUTRAL_AFFINITY && bToA > NEUTRAL_AFFINITY
      ) {
        warmBothWays++;
      }
    }
  }

  const possiblePairs = (size * (size - 1)) / 2;
  const meanAffinity = recorded.length
    ? recorded.reduce((a, b) => a + b, 0) / recorded.length
    : NEUTRAL_AFFINITY;

  const affiliated = new Set<string>();
  for (const clique of cliques) for (const member of clique.members) affiliated.add(member);

  const totalAuthority = ids.reduce((sum, id) => sum + (roster[id]?.stats.authority ?? 0), 0);
  const unaffiliatedAuthority = ids
    .filter(id => !affiliated.has(id))
    .reduce((sum, id) => sum + (roster[id]?.stats.authority ?? 0), 0);

  let strongestUnaffiliated: HamletSummary['strongestUnaffiliated'] = null;
  for (const id of ids) {
    if (affiliated.has(id)) continue;
    const authority = roster[id]?.stats.authority ?? 0;
    if (!strongestUnaffiliated || authority > strongestUnaffiliated.authority) {
      strongestUnaffiliated = { identifier: id, authority };
    }
  }

  const seats = [leadership.margrave, leadership.bursar, ...(leadership.council ?? [])];
  const unaffiliatedSeatHolders = [...new Set(seats)]
    .filter(id => roster[id] && !affiliated.has(id));

  return {
    rosterSize: size,
    meanAffinity,
    reciprocity: recordedPairs > 0 ? warmBothWays / recordedPairs : 0,
    acquaintance: possiblePairs > 0 ? recordedPairs / possiblePairs : 0,
    cliqueCount: cliques.length,
    affiliatedShare: size > 0 ? affiliated.size / size : 0,
    unaffiliatedAuthorityShare: totalAuthority > 0 ? unaffiliatedAuthority / totalAuthority : 0,
    strongestUnaffiliated,
    unaffiliatedSeatHolders,
  };
}

/**
 * The summary as prose. Deliberately short — this is the frame, not the report.
 *
 * The unaffiliated-authority line is the one worth keeping even when everything
 * else is quiet: a hamlet where most of the power sits outside every bloc is one
 * bad month from having factions, and nothing else in the report can say so.
 */
export function describeHamlet(summary: HamletSummary, roster: CharacterRecord): string {
  const name = (id: string) => roster[id]?.name ?? id;
  const pct = (value: number) => `${Math.round(value * 100)}%`;
  const parts: string[] = [];

  if (summary.acquaintance === 0) {
    parts.push(
      `${summary.rosterSize} heroes, none of whom have formed a recorded opinion of ` +
      `another. Nothing has happened here yet.`
    );
    return parts.join(' ');
  }

  parts.push(
    `${summary.rosterSize} heroes. Where opinions exist they average ` +
    `${summary.meanAffinity.toFixed(1)} of 10, and ${pct(summary.acquaintance)} of ` +
    `possible pairs have formed one at all.`
  );

  if (summary.cliqueCount === 0) {
    parts.push(
      `Nobody here is close enough to anybody to form a bloc. There are no factions ` +
      `to speak of — only individuals.`
    );
  } else {
    parts.push(
      summary.cliqueCount === 1
        ? `One bloc has formed, holding ${pct(summary.affiliatedShare)} of the roster.`
        : `${summary.cliqueCount} blocs have formed, holding ` +
          `${pct(summary.affiliatedShare)} of the roster between them.`
    );
  }

  if (summary.unaffiliatedAuthorityShare >= 0.5 && summary.cliqueCount > 0) {
    parts.push(
      `${pct(summary.unaffiliatedAuthorityShare)} of the hamlet's authority belongs to ` +
      `no bloc at all` +
      (summary.strongestUnaffiliated
        ? `, the weightiest of it ${name(summary.strongestUnaffiliated.identifier)}.`
        : '.')
    );
  }

  // Only meaningful once blocs exist. With none, this trivially lists everyone
  // who holds a seat, which the leadership section already covers.
  if (summary.cliqueCount > 0 && summary.unaffiliatedSeatHolders.length > 0) {
    parts.push(
      `Holding a seat but belonging to no bloc: ` +
      `${summary.unaffiliatedSeatHolders.map(name).join(', ')}.`
    );
  }

  return parts.join(' ');
}