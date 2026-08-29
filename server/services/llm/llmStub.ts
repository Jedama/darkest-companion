// server/services/llm/llmStub.ts
//
// Canned responses for LLM_MODE=stub. Everything they produce is prefixed
// DEBUG so a stubbed run is never mistaken for a real one in a save file.
//
// These deliberately go through the real parser, the real validators and the
// real apply/save path — so if a fixture here is wrong, you'll get exactly the
// same 502 a bad model response would give. That's the point: it means the
// stub tests the pipeline, not just itself.
//
// Fixtures are wrapped in ``` fences on purpose, to exercise extractJsonText.

import type { Estate } from '../../../shared/types/types.js';

/** Names the kind of call being made, which selects a fixture. */
export type LlmLabel =
  | 'story'
  | 'consequences'
  | 'recruit story'
  | 'recruit consequences'
  | 'review'
  | 'dungeon summary'
  | 'planning deliberation'
  | 'planning posing'
  | 'planning consequences'
  | 'unknown';

/** Infers the label from the request path, so routes need not pass one. */
export function inferLabel(path: string | undefined): LlmLabel {
  if (!path) return 'unknown';
  if (path.endsWith('/events/consequences')) return 'consequences';
  if (path.endsWith('/events/story')) return 'story';
  if (path.endsWith('/events/recruit')) return 'recruit story';
  if (path.endsWith('/review')) return 'review';
  if (path.endsWith('/dungeon/summary')) return 'dungeon summary';
  if (path.endsWith('/planning/deliberate')) return 'planning deliberation';
  if (path.endsWith('/planning/consequences')) return 'planning consequences';
  return 'unknown';
}

/** Best-effort guess at whom a fixture should talk about. */
function subjectsFrom(estate: Estate, body: any): string[] {
  const fromBody: string[] =
    (Array.isArray(body?.chosenCharacterIds) && body.chosenCharacterIds) ||
    (Array.isArray(body?.attendeeIds) && body.attendeeIds) ||
    (body?.characterId ? [body.characterId] : []);

  const known = fromBody.filter((id) => estate.characters[id]);
  if (known.length > 0) return known;

  // Fall back to whoever is actually on the roster, so consequences fixtures
  // always name characters that pass validation.
  return Object.keys(estate.characters).slice(0, 2);
}

function fence(json: unknown): string {
  return '```json\n' + JSON.stringify(json, null, 2) + '\n```';
}

/* ------------------------------------------------------------------ *
 *  Fixtures
 * ------------------------------------------------------------------ */

function storyFixture(subjects: string[]): string {
  const cast = subjects.length > 0 ? subjects.join(', ') : 'nobody in particular';
  return [
    '[DEBUG: A Perfectly Ordinary Evening]',
    '',
    'DEBUG: This is a stubbed story. No tokens were spent producing it.',
    '',
    `DEBUG: The cast for this event was ${cast}. They stood around, said little of`,
    'consequence, and went to bed at a reasonable hour.',
    '',
    'DEBUG: End of stubbed story.',
  ].join('\n');
}

function consequencesFixture(subjects: string[], flavour: string): string {
  const characters = subjects.map((identifier, index) => {
    const entry: Record<string, unknown> = {
      identifier,
      add_log: {
        entry: `DEBUG: ${flavour} log entry for ${identifier}.`,
        timeframe: 'short_term',
      },
      update_status: { physical: -2, mental: -1 },
      update_stats: { strength: 1 },
    };

    // Exercise the relationship path too, when there is someone to point at.
    const target = subjects[index + 1];
    if (target) {
      entry.update_relationships = [
        { target, affinity: 1, description: `DEBUG: mildly warmer towards ${target}.` },
      ];
      entry.add_relationship_log = {
        target,
        entry: `DEBUG: ${identifier} and ${target} shared a stubbed moment.`,
        timeframe: 'short_term',
      };
      entry.add_party_intent = {
        target,
        score: 2,
        reason: `DEBUG: ${flavour} stub — wants ${target} along next time.`,
      };
    }

    return entry;
  });

  return fence({ characters });
}

function reviewFixture(): string {
  return fence({
    estate_log: {
      entry: 'DEBUG: A stubbed month passed. Nothing of note occurred.',
      timeframe: 'mid_term',
    },
    // Empty on purpose: an invented narrative shape would fail applyReview.
    // Add fixtures here once you want to exercise narrative handling.
    narratives: [],
  });
}

function dungeonSummaryFixture(): string {
  return fence({
    headline: 'DEBUG: The party returned, stubbed and unharmed.',
    // The route reconciles any shortfall into the town share, so an empty
    // split simply hands the whole purse to the estate.
    characters: [],
    town: 0,
    bursar: 0,
  });
}

function planningFixture(estate: Estate, subjects: string[]): string {
  const speakers = subjects.length > 0 ? subjects : Object.keys(estate.characters).slice(0, 2);
  return speakers
    .map((id) => `${id}: DEBUG: I have nothing useful to add, this being a stub.`)
    .join('\n');
}

/** Mirrors planningFixture's speaker count exactly, so every tagged index has a matching line. */
function posingFixture(estate: Estate, subjects: string[]): string {
  const speakers = subjects.length > 0 ? subjects : Object.keys(estate.characters).slice(0, 2);
  const poses = ['neutral', 'happy', 'sad', 'angry', 'surprised'];
  const tags = speakers.map((_, index) => ({ index, pose: poses[index % poses.length] }));
  return fence(tags);
}

/* ------------------------------------------------------------------ *
 *  Entry point
 * ------------------------------------------------------------------ */

export function stubResponse(label: LlmLabel, estate: Estate, body: any): string {
  const subjects = subjectsFrom(estate, body);

  switch (label) {
    case 'story':
      return storyFixture(subjects);
    case 'recruit story':
      return storyFixture(subjects);
    case 'consequences':
      return consequencesFixture(subjects, 'event');
    case 'recruit consequences':
      return consequencesFixture(subjects, 'arrival');
    case 'review':
      return reviewFixture();
    case 'dungeon summary':
      return dungeonSummaryFixture();
    case 'planning deliberation':
      return planningFixture(estate, subjects);
    case 'planning posing':
      return posingFixture(estate, subjects);
    case 'planning consequences':
      return consequencesFixture(subjects, 'planning');
    default:
      return 'DEBUG: stubbed response for an unrecognised call.';
  }
}

/** What LLM_MODE=garbage returns: plausible-looking, definitively unparseable. */
export function garbageResponse(label: LlmLabel): string {
  return `Certainly! Here is the ${label} you asked for:\n\n{ "characters": [ { "identifier": `;
}