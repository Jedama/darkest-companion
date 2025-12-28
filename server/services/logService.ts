// server/services/logService.ts
// File order:
// Imports → Constants → Types → Public API → Internals (normalization / selection / scoring) → Utilities

import type {
  Character,
  Estate,
  LogEntry,
  RelationshipLogEntry,
} from '../../shared/types/types.ts';

/* -------------------------------------------------------------------
 *  Constants (tune here)
 * ------------------------------------------------------------------- */

const GLUE_BUCKET_SIZE = 5;
const STAKES_BUCKET_SIZE = 5;

// Candidate rules
const GLUE_EXPIRY_OFFSETS = new Set([0, 1]); // expiryMonth = currentMonth (+0/+1)
const STAKES_MIN_EXPIRY_OFFSET = 2;          // expiryMonth >= currentMonth + 2

// Glue scoring (recency-heavy)
const GLUE_EXPIRY_PLUS1_BONUS = 10;
const GLUE_KIND_BONUS = { relationship: 6, character: 3, estate: 0 } as const;

// Breadth penalties (glue)
const GLUE_PENALTY_REPEAT_CHARACTER_LOG_OWNER = 80;
const GLUE_PENALTY_OWNER_ALREADY_IN_SELECTED_REL = 25;
const GLUE_PENALTY_REL_USES_ALREADY_USED_REL_CHAR = 120;

// Stakes scoring (importance-heavy)
const STAKES_RECENCY_MULTIPLIER = 0.05;
const STAKES_KIND_BONUS = { relationship: 40, character: 15, estate: 0 } as const;

// Breadth penalties (stakes) – softer than glue
const STAKES_PENALTY_REPEAT_CHARACTER_LOG_OWNER = 50;
const STAKES_PENALTY_OWNER_ALREADY_IN_SELECTED_REL = 15;
const STAKES_PENALTY_REL_USES_ALREADY_USED_REL_CHAR = 80;

// Optional: prevent returning the same exact log twice if it appears in multiple stores
const DEDUPE_ENABLED = true;

/* -------------------------------------------------------------------
 *  Types
 * ------------------------------------------------------------------- */

type UnifiedLog =
  | {
      kind: 'estate';
      month: number;
      beat: number;
      expiryMonth: number;
      entry: string;
      involvedCharacterIds: string[]; // empty for estate logs
      // stable key for dedupe
      key: string;
    }
  | {
      kind: 'character';
      ownerId: string;
      month: number;
      beat: number;
      expiryMonth: number;
      entry: string;
      involvedCharacterIds: string[]; // [ownerId]
      key: string;
    }
  | {
      kind: 'relationship';
      a: string; // sorted id
      b: string; // sorted id
      month: number;
      beat: number;
      expiryMonth: number;
      entry: string;
      involvedCharacterIds: string[]; // [a,b]
      key: string;
    };

type SelectionState = {
  selected: UnifiedLog[];
  selectedCharacterLogOwners: Set<string>;
  selectedRelationshipCharIds: Set<string>;
};

/* -------------------------------------------------------------------
 *  Public API
 * ------------------------------------------------------------------- */

/**
 * filterLogs
 * Returns ordered strings like:
 * "3 months ago: [log text]"
 *
 * Rules:
 * - Includes estate logs, character logs, and relationship logs where BOTH characters are among `characters`.
 * - Two buckets:
 *   - Glue: expiryMonth is currentMonth or currentMonth+1; pick GLUE_BUCKET_SIZE via recency-heavy scoring.
 *   - Stakes: expiryMonth >= currentMonth+2; pick STAKES_BUCKET_SIZE via importance-heavy scoring.
 */
export function filterLogs(estate: Estate, characters: Character[]): string[] {
  const currentMonth = estate.month;
  const includedIds = new Set(characters.map((c) => c.identifier));

  // 1) Normalize all logs into a single list
  let all = normalizeLogs(estate, includedIds);

  // 2) Optional dedupe (recommended because relationship logs are mirrored in storage)
  if (DEDUPE_ENABLED) {
    all = dedupeUnifiedLogs(all);
  }

  // 3) Partition into buckets
  const glueCandidates = all.filter((l) => isGlueCandidate(l, currentMonth));
  const stakesCandidates = all.filter((l) => isStakesCandidate(l, currentMonth));

  // 4) Select logs
  const glue = selectWithDynamicScoring(
    glueCandidates,
    GLUE_BUCKET_SIZE,
    (log, state) => scoreGlue(log, state, currentMonth)
  );

  const stakes = selectWithDynamicScoring(
    stakesCandidates,
    STAKES_BUCKET_SIZE,
    (log, state) => scoreStakes(log, state)
  );

  // 5) Order output
  // Glue should read like "what just happened": newest -> older.
  const glueOrdered = [...glue].sort((a, b) => recencyKey(b) - recencyKey(a));

  // Stakes should read like "what matters": longest-lasting -> then recency.
  const stakesOrdered = [...stakes].sort((a, b) =>
    (b.expiryMonth - a.expiryMonth) || (recencyKey(b) - recencyKey(a))
  );

  // 6) Format (no headings; caller can add headings if desired)
  const lines = [...glueOrdered, ...stakesOrdered].map((l) =>
    formatLogLine(currentMonth, l)
  );

  return lines;
}

/* -------------------------------------------------------------------
 *  Internals: normalization
 * ------------------------------------------------------------------- */

function normalizeLogs(estate: Estate, includedIds: Set<string>): UnifiedLog[] {
  const out: UnifiedLog[] = [];

  // Estate logs (global)
  if (estate.estateLogs?.length) {
    for (const e of estate.estateLogs) {
      const beat = (e as any).beat ?? 0;

      out.push({
        kind: 'estate',
        month: e.month,
        beat,
        expiryMonth: e.expiryMonth,
        entry: e.entry,
        involvedCharacterIds: [],
        key: makeEstateKey(e, beat),
      });
    }
  }

  // Character logs (only for included characters)
  if (estate.characterLogs) {
    for (const [ownerId, logs] of Object.entries(estate.characterLogs)) {
      if (!includedIds.has(ownerId)) continue;
      if (!logs?.length) continue;

      for (const l of logs) {
        const beat = (l as any).beat ?? 0;

        out.push({
          kind: 'character',
          ownerId,
          month: l.month,
          beat,
          expiryMonth: l.expiryMonth,
          entry: l.entry,
          involvedCharacterIds: [ownerId],
          key: makeCharacterKey(ownerId, l, beat),
        });
      }
    }
  }

  // Relationship logs: include only logs where BOTH characters are included.
  // Storage is mirrored (A has entry targeting B, and B has mirror targeting A),
  // so we normalize into a single relationship log with a sorted pair (a,b).
  if (estate.relationshipLogs) {
    for (const [ownerId, logs] of Object.entries(estate.relationshipLogs)) {
      if (!includedIds.has(ownerId)) continue;
      if (!logs?.length) continue;

      for (const r of logs as RelationshipLogEntry[]) {
        const targetId = r.target;
        if (!includedIds.has(targetId)) continue;

        const [a, b] = sortPair(ownerId, targetId);

        const beat = (r as any).beat ?? 0;

        out.push({
          kind: 'relationship',
          a,
          b,
          month: r.month,
          beat,
          expiryMonth: r.expiryMonth,
          entry: r.entry,
          involvedCharacterIds: [a, b],
          key: makeRelationshipKey(a, b, r, beat),
        });
      }
    }
  }

  return out;
}

/* -------------------------------------------------------------------
 *  Internals: bucketing
 * ------------------------------------------------------------------- */

function isGlueCandidate(log: UnifiedLog, currentMonth: number): boolean {
  const offset = log.expiryMonth - currentMonth;
  return GLUE_EXPIRY_OFFSETS.has(offset);
}

function isStakesCandidate(log: UnifiedLog, currentMonth: number): boolean {
  return log.expiryMonth >= currentMonth + STAKES_MIN_EXPIRY_OFFSET;
}

/* -------------------------------------------------------------------
 *  Internals: selection (greedy with dynamic penalties)
 * ------------------------------------------------------------------- */

function selectWithDynamicScoring(
  candidates: UnifiedLog[],
  limit: number,
  scorer: (log: UnifiedLog, state: SelectionState) => number
): UnifiedLog[] {
  const remaining = [...candidates];

  const state: SelectionState = {
    selected: [],
    selectedCharacterLogOwners: new Set<string>(),
    selectedRelationshipCharIds: new Set<string>(),
  };

  while (state.selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < remaining.length; i++) {
      const s = scorer(remaining[i], state);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }

    const picked = remaining.splice(bestIdx, 1)[0];
    state.selected.push(picked);

    // Update breadth tracking
    if (picked.kind === 'character') {
      state.selectedCharacterLogOwners.add(picked.ownerId);
    } else if (picked.kind === 'relationship') {
      state.selectedRelationshipCharIds.add(picked.a);
      state.selectedRelationshipCharIds.add(picked.b);
    }
  }

  return state.selected;
}

/* -------------------------------------------------------------------
 *  Internals: scoring
 * ------------------------------------------------------------------- */

function scoreGlue(log: UnifiedLog, state: SelectionState, currentMonth: number): number {
  const base = recencyKey(log);

  const expiryBonus =
    log.expiryMonth === currentMonth + 1 ? GLUE_EXPIRY_PLUS1_BONUS : 0;

  const kindBonus = GLUE_KIND_BONUS[log.kind];

  const penalty = computeBreadthPenalty(log, state, {
    repeatOwner: GLUE_PENALTY_REPEAT_CHARACTER_LOG_OWNER,
    ownerInRel: GLUE_PENALTY_OWNER_ALREADY_IN_SELECTED_REL,
    relCharRepeat: GLUE_PENALTY_REL_USES_ALREADY_USED_REL_CHAR,
  });

  return base + expiryBonus + kindBonus - penalty;
}

function scoreStakes(log: UnifiedLog, state: SelectionState): number {
  const importance = log.expiryMonth * 1000;

  const recencyBonus = recencyKey(log) * STAKES_RECENCY_MULTIPLIER;

  const kindBonus = STAKES_KIND_BONUS[log.kind];

  const penalty = computeBreadthPenalty(log, state, {
    repeatOwner: STAKES_PENALTY_REPEAT_CHARACTER_LOG_OWNER,
    ownerInRel: STAKES_PENALTY_OWNER_ALREADY_IN_SELECTED_REL,
    relCharRepeat: STAKES_PENALTY_REL_USES_ALREADY_USED_REL_CHAR,
  });

  return importance + recencyBonus + kindBonus - penalty;
}

function computeBreadthPenalty(
  log: UnifiedLog,
  state: SelectionState,
  weights: { repeatOwner: number; ownerInRel: number; relCharRepeat: number }
): number {
  // Estate logs: no involved character IDs; don't penalize for breadth.
  if (log.kind === 'estate') return 0;

  if (log.kind === 'character') {
    const owner = log.ownerId;
    let p = 0;

    if (state.selectedCharacterLogOwners.has(owner)) p += weights.repeatOwner;
    if (state.selectedRelationshipCharIds.has(owner)) p += weights.ownerInRel;

    return p;
  }

  // Relationship log
  const usesA = state.selectedRelationshipCharIds.has(log.a);
  const usesB = state.selectedRelationshipCharIds.has(log.b);

  return (usesA || usesB) ? weights.relCharRepeat : 0;
}

/* -------------------------------------------------------------------
 *  Internals: utilities
 * ------------------------------------------------------------------- */

function recencyKey(log: UnifiedLog): number {
  // Month dominates; beat breaks ties within month.
  // Assumes beat increments monotonically with story generation.
  return log.month * 1000 + log.beat;
}

function formatLogLine(currentMonth: number, log: UnifiedLog): string {
  const monthsAgo = Math.max(0, currentMonth - log.month);
  return `${monthsAgo} months ago: ${log.entry}`;
}

function dedupeUnifiedLogs(logs: UnifiedLog[]): UnifiedLog[] {
  const seen = new Set<string>();
  const out: UnifiedLog[] = [];

  for (const l of logs) {
    if (seen.has(l.key)) continue;
    seen.add(l.key);
    out.push(l);
  }

  return out;
}

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// Stable-ish keys (structure-only; avoids reading/modifying entry text)
function makeEstateKey(e: LogEntry, beat: number): string {
  return `estate|m:${e.month}|b:${beat}|x:${e.expiryMonth}|t:${e.entry}`;
}

function makeCharacterKey(ownerId: string, l: LogEntry, beat: number): string {
  return `char|o:${ownerId}|m:${l.month}|b:${beat}|x:${l.expiryMonth}|t:${l.entry}`;
}

function makeRelationshipKey(a: string, b: string, r: RelationshipLogEntry, beat: number): string {
  // Pair is sorted already; target/origin don't matter.
  return `rel|p:${a}:${b}|m:${r.month}|b:${beat}|x:${r.expiryMonth}|t:${r.entry}`;
}
