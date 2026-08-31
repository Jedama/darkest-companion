// server/services/planning/planningService.ts
// File order:
// Imports → types → attendance → compileDeliberationPrompt → parsing

import type { Character, Estate } from '../../../shared/types/types.js';

import {
  buildAbsentRosterSection,
  buildAllLogsSection,
  buildCharactersSectionPlanning,
  buildConditionGlossarySection,
  buildContentPreferencesSection,
  buildPlanningLeadershipSection,
  buildNarrativesSection,
  buildRelationshipSection,
  buildUserGuidanceSection,
  compilePlanningContext,
} from '../llm/buildPromptService.js';

import StaticGameDataManager from '../../staticGameDataManager.js';
import { assemblePlanningCouncil, PlanningCouncil } from '../townHall/council.js';
import { getZodiacForMonth } from '../game/calendarService.js';

/* -------------------------------------------------------------------
 *  Types
 * ------------------------------------------------------------------- */

export type PlanningSeat = 'Margrave' | 'Bursar' | 'Council' | 'Advisor';

export interface PlanningAttendee {
  character: Character;
  seat: PlanningSeat;
}

export interface DialogueLine {
  speaker: string; // canonical character identifier, as keyed in estate.characters
  text: string;
  /** Sprite pose for this line, added by a later posing pass. See planningPosingService.ts. */
  pose?: string;
}

/* -------------------------------------------------------------------
 *  Attendance
 * ------------------------------------------------------------------- */

/**
 * Turns an assembled council into attendee records, preserving speaking order:
 * leadership, then the seated council, then the advisors.
 */
function seatAttendees(assembled: PlanningCouncil, estate: Estate): PlanningAttendee[] {
  const attendees: PlanningAttendee[] = [];
  const seen = new Set<string>();

  const add = (id: string | undefined, seat: PlanningSeat) => {
    if (!id || seen.has(id)) return;
    const character = estate.characters[id];
    if (!character) {
      console.warn(`[Planning] Attendee '${id}' (${seat}) not found in roster; skipping.`);
      return;
    }
    attendees.push({ character, seat });
    seen.add(id);
  };

  add(assembled.margrave, 'Margrave');
  add(assembled.bursar, 'Bursar');
  for (const id of assembled.council) add(id, 'Council');
  for (const id of assembled.advisors) add(id, 'Advisor');

  for (const { identifier, reason } of assembled.absent) {
    console.info(`[Planning] '${identifier}' holds a chair but cannot attend (${reason}).`);
  }

  return attendees;
}

/* -------------------------------------------------------------------
 *  Main export
 * ------------------------------------------------------------------- */

/**
 * preparePlanningMeeting
 *
 * The single entry point for phase one of the planning cycle. Assembles the room
 * ONCE and derives everything else from that one assembly — attendees, the prompt,
 * and the identifiers `parseDialogue` will validate against.
 *
 * Assembling twice would be a quiet correctness bug: succession and the zodiac
 * bonus both depend on roster state, and two independent assemblies have no
 * guarantee of agreeing. A prompt that seats the Aesthete while the parser only
 * accepts the Cook silently drops every line he speaks.
 */
export function preparePlanningMeeting(estate: Estate): {
  council: PlanningCouncil;
  attendees: PlanningAttendee[];
  attendeeIds: string[];
  prompt: string;
} {
  const zodiac = getZodiacForMonth(estate.time.month);
  const council = assemblePlanningCouncil(estate.leadership, estate.characters, {
    zodiac: zodiac.name,
  });

  const attendees = seatAttendees(council, estate);
  const attendeeIds = attendees.map(a => a.character.identifier);
  const prompt = compileDeliberationPrompt(estate, council, attendees);

  return { council, attendees, attendeeIds, prompt };
}

/**
 * compileDeliberationPrompt
 * Builds the prompt for phase one of the planning cycle: the council's discussion,
 * before any teams are assembled. Output is plain dialogue.
 *
 * Takes an already-assembled council rather than assembling its own — see
 * preparePlanningMeeting for why.
 */
export function compileDeliberationPrompt(
  estate: Estate,
  council: PlanningCouncil,
  attendees: PlanningAttendee[] = seatAttendees(council, estate)
): string {
  const gameData = StaticGameDataManager.getInstance();

  const attendeeCharacters = attendees.map(a => a.character);
  const attendeeIds = attendees.map(a => a.character.identifier);

  const seats: Record<string, string> = {};
  for (const { character, seat } of attendees) {
    seats[character.identifier] = seat;
  }

  const prompt = `
    ${compilePlanningContext(estate, gameData)}

    [The Table]
    ${buildPlanningLeadershipSection(estate, council)}

    [Attendees]
    ${buildCharactersSectionPlanning(attendeeCharacters, seats)}

    ${buildRelationshipSection(attendeeCharacters)}

    [Absent Roster]
    ${buildAbsentRosterSection(estate, attendeeIds)}

    [Condition Glossary]
    ${buildConditionGlossarySection(estate, attendeeIds)}

    [Active Narratives]
    ${buildNarrativesSection(estate)}

    [Logs]
    ${buildAllLogsSection(estate)}

    ${buildContentPreferencesSection(estate.preferences)}
    ${buildUserGuidanceSection(estate.preferences?.guidance)}
  `.trim();

  return prompt;
}

/* -------------------------------------------------------------------
 *  Parsing
 * ------------------------------------------------------------------- */

/**
 * parseDialogue
 * Splits a plain-text dialogue response into speaker/text pairs. Lines are of
 * the form `identifier: spoken words`. Anything that does not name a known
 * attendee is dropped — a mis-attributed line is worse than a missing one.
 *
 * Speakers are matched CASE-INSENSITIVELY but reported CANONICALLY. The model
 * echoes back whatever casing it likes, while `estate.characters` is keyed by the
 * exact identifier. Matching on a lowercased copy and then emitting that copy
 * would trade one silent failure for another: the line parses, and every
 * downstream `estate.characters[line.speaker]` lookup misses.
 */
export function parseDialogue(response: string, attendeeIds: string[]): DialogueLine[] {
  const canonical = new Map<string, string>();
  for (const id of attendeeIds) canonical.set(id.toLowerCase(), id);

  const lines: DialogueLine[] = [];

  for (const raw of response.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const separator = line.indexOf(':');
    if (separator === -1) {
      console.warn(`[Planning] Dropping line with no speaker: "${line.slice(0, 60)}"`);
      continue;
    }

    const spoken = line.slice(0, separator).trim();
    const text = line.slice(separator + 1).trim();

    const speaker = canonical.get(spoken.toLowerCase());
    if (!speaker) {
      console.warn(`[Planning] Dropping line from unknown speaker '${spoken}'.`);
      continue;
    }
    if (!text) continue;

    lines.push({ speaker, text });
  }

  return lines;
}