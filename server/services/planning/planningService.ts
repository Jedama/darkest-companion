// server/services/planning/planningService.ts
// File order:
// Imports → types → attendance → compileDeliberationPrompt → parsing

import type { Character, Estate } from '../../../shared/types/types.js';

import {
  buildAbsentRosterSection,
  buildAllLogsSection,
  buildCharactersSectionPlanning,
  buildContentPreferencesSection,
  buildLeadershipSection,
  buildNarrativesSection,
  buildRelationshipSection,
  buildUserGuidanceSection,
  compilePlanningContext,
} from '../llm/buildPromptService.js';

import StaticGameDataManager from '../../staticGameDataManager.js';

/* -------------------------------------------------------------------
 *  Types
 * ------------------------------------------------------------------- */

export type PlanningSeat = 'Margrave' | 'Bursar' | 'Council';

export interface PlanningAttendee {
  character: Character;
  seat: PlanningSeat;
}

export interface DialogueLine {
  speaker: string; // character identifier
  text: string;
}

/* -------------------------------------------------------------------
 *  Attendance
 * ------------------------------------------------------------------- */

/**
 * Determines who sits at the planning meeting: the Margrave, the Bursar, and
 * the sitting council.
 *
 * TODO: the council is currently whatever `estate.leadership.council` holds.
 * Elections, ousting and political manoeuvring will eventually decide this.
 */
export function getPlanningAttendees(estate: Estate): PlanningAttendee[] {
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

  add(estate.leadership.margrave, 'Margrave');
  add(estate.leadership.bursar, 'Bursar');
  for (const id of estate.leadership.council ?? []) add(id, 'Council');

  return attendees;
}

/* -------------------------------------------------------------------
 *  Main export
 * ------------------------------------------------------------------- */

/**
 * compileDeliberationPrompt
 * Builds the prompt for phase one of the planning cycle: the council's
 * discussion, before any teams are assembled. Output is plain dialogue.
 */
export function compileDeliberationPrompt(estate: Estate): string {
  const gameData = StaticGameDataManager.getInstance();

  const attendees = getPlanningAttendees(estate);
  const attendeeCharacters = attendees.map(a => a.character);
  const attendeeIds = attendees.map(a => a.character.identifier);

  const seats: Record<string, string> = {};
  for (const { character, seat } of attendees) {
    seats[character.identifier] = seat;
  }

  const prompt = `
    ${compilePlanningContext(estate, gameData)}

    [Leadership]
    ${buildLeadershipSection(estate)}

    [Attendees]
    ${buildCharactersSectionPlanning(attendeeCharacters, seats)}

    ${buildRelationshipSection(attendeeCharacters)}

    [Absent Roster]
    ${buildAbsentRosterSection(estate, attendeeIds)}

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
 */
export function parseDialogue(response: string, attendeeIds: string[]): DialogueLine[] {
  const valid = new Set(attendeeIds);
  const lines: DialogueLine[] = [];

  for (const raw of response.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const separator = line.indexOf(':');
    if (separator === -1) {
      console.warn(`[Planning] Dropping line with no speaker: "${line.slice(0, 60)}"`);
      continue;
    }

    const speaker = line.slice(0, separator).trim().toLowerCase();
    const text = line.slice(separator + 1).trim();

    if (!valid.has(speaker)) {
      console.warn(`[Planning] Dropping line from unknown speaker '${speaker}'.`);
      continue;
    }
    if (!text) continue;

    lines.push({ speaker, text });
  }

  return lines;
}