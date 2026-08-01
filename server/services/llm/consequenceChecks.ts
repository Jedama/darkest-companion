// server/services/llm/consequenceChecks.ts
//
// Replaces the boolean returned by validateConsequences. Same rules, but every
// failure is described, and all of them are collected rather than bailing on
// the first — so one bad response tells you everything wrong with it.

import { LOG_TIMEFRAMES } from '../game/logService.js';
import type { CharacterRecord } from '../../../shared/types/types.js';
import type { CharacterConsequence, ConsequencesResult } from './llmResponseProcessor.js';

const STAT_KEYS = ['strength', 'agility', 'intelligence', 'authority', 'sociability'];

const STAT_DELTA_LIMIT = 5;
const STATUS_DELTA_LIMIT = 50;
const AFFINITY_DELTA_LIMIT = 5;

/**
 * Fields the consequences schema declares but applyConsequences does not yet
 * process. They are parsed, validated and then silently dropped.
 *
 * Move a key out of here the moment you write its processor, or the warning
 * turns into a lie.
 */
const UNIMPLEMENTED_KEYS = ['death', 'gain_trinket', 'lose_trinket'] as const;

/** Everything the schema knows about. Anything else is the model improvising. */
const KNOWN_KEYS = new Set<string>([
  'identifier',
  'add_log',
  'add_relationship_log',
  'update_description',
  'update_history',
  'update_stats',
  'update_status',
  'gain_traits',
  'lose_traits',
  'update_relationships',
  'update_appearance',
  'update_clothing',
  'gain_wound',
  'lose_wound',
  'gain_disease',
  'lose_disease',
  'gain_note',
  'lose_note',
  'gain_trinket',
  'lose_trinket',
  'update_money',
  'update_religion',
  'death',
]);

/**
 * Returns a list of problems. Empty means the response is usable.
 * Every message names the character it belongs to, so the list reads as a
 * report rather than a riddle.
 */
export function checkConsequences(
  update: ConsequencesResult,
  characters: CharacterRecord
): string[] {
  const problems: string[] = [];

  if (!update || !Array.isArray(update.characters)) {
    return ['response has no "characters" array'];
  }

  if (update.event_log) {
    if (!update.event_log.entry) problems.push('event_log has no entry text');
    if (!update.event_log.timeframe) {
      problems.push('event_log has no timeframe');
    } else if (!LOG_TIMEFRAMES.includes(update.event_log.timeframe)) {
      problems.push(`event_log timeframe "${update.event_log.timeframe}" is not a valid timeframe`);
    }
  }

  update.characters.forEach((char, index) => {
    const who = char?.identifier ?? `character at index ${index}`;

    if (!char?.identifier) {
      problems.push(`${who}: no identifier`);
      return;
    }

    if (!characters[char.identifier]) {
      problems.push(`${who}: not a character in this estate`);
      return;
    }

    if (char.add_log && !LOG_TIMEFRAMES.includes(char.add_log.timeframe)) {
      problems.push(`${who}: add_log timeframe "${char.add_log.timeframe}" is not valid`);
    }

    if (char.add_relationship_log) {
      const target = char.add_relationship_log.target;
      if (!target) {
        problems.push(`${who}: add_relationship_log has no target`);
      } else if (!characters[target]) {
        problems.push(`${who}: add_relationship_log targets unknown character "${target}"`);
      }
      if (!LOG_TIMEFRAMES.includes(char.add_relationship_log.timeframe)) {
        problems.push(
          `${who}: add_relationship_log timeframe "${char.add_relationship_log.timeframe}" is not valid`
        );
      }
    }

    if (char.update_stats) {
      for (const [key, value] of Object.entries(char.update_stats)) {
        if (!STAT_KEYS.includes(key)) {
          problems.push(`${who}: "${key}" is not a stat`);
          continue;
        }
        if (typeof value !== 'number') {
          problems.push(`${who}: stat ${key} is ${typeof value}, expected a number`);
          continue;
        }
        if (Math.abs(value) > STAT_DELTA_LIMIT) {
          problems.push(
            `${who}: stat ${key} changes by ${value}, limit is ±${STAT_DELTA_LIMIT}`
          );
        }
      }
    }

    if (char.update_status) {
      for (const key of ['physical', 'mental'] as const) {
        const value = char.update_status[key];
        if (value === undefined) continue;
        if (typeof value !== 'number') {
          problems.push(`${who}: status ${key} is ${typeof value}, expected a number`);
        } else if (Math.abs(value) > STATUS_DELTA_LIMIT) {
          problems.push(
            `${who}: status ${key} changes by ${value}, limit is ±${STATUS_DELTA_LIMIT}`
          );
        }
      }
    }

    if (char.update_relationships) {
      for (const rel of char.update_relationships) {
        if (!rel.target) {
          problems.push(`${who}: a relationship update has no target`);
          continue;
        }
        if (!characters[rel.target]) {
          problems.push(`${who}: relationship targets unknown character "${rel.target}"`);
          continue;
        }
        if (rel.target === char.identifier) {
          problems.push(`${who}: has a relationship with themselves`);
        }
        if (rel.affinity !== undefined && Math.abs(rel.affinity) > AFFINITY_DELTA_LIMIT) {
          problems.push(
            `${who}: affinity toward ${rel.target} changes by ${rel.affinity}, limit is ±${AFFINITY_DELTA_LIMIT}`
          );
        }
      }
    }
  });

  return problems;
}

/**
 * Logs any consequence field the model returned that nothing consumes yet —
 * either declared-but-unimplemented (death, trinkets) or entirely invented.
 *
 * Deliberately does NOT reject the response. These are notes to you about what
 * the model is reaching for, not errors.
 */
export function reportUnhandledConsequences(
  consequences: ConsequencesResult,
  label = 'consequences'
): string[] {
  const notes: string[] = [];

  for (const char of consequences.characters ?? []) {
    for (const key of Object.keys(char)) {
      if (!KNOWN_KEYS.has(key)) {
        notes.push(`${char.identifier}: unknown field "${key}" = ${summarize(char, key)}`);
      }
    }

    for (const key of UNIMPLEMENTED_KEYS) {
      if (char[key as keyof CharacterConsequence] !== undefined) {
        notes.push(`${char.identifier}: ${key} = ${summarize(char, key)} (not applied yet)`);
      }
    }
  }

  if (notes.length > 0) {
    console.warn(`[${label}] the model returned ${notes.length} field(s) nothing handles:`);
    notes.forEach((note) => console.warn(`  · ${note}`));
  }

  return notes;
}

function summarize(char: CharacterConsequence, key: string): string {
  const value = (char as unknown as Record<string, unknown>)[key];
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text && text.length > 120 ? `${text.slice(0, 120)}…` : String(text);
}