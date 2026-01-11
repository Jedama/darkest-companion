// server/services/storyEventService.ts
// File order:
// Imports → small helpers → section builders → compileStoryPrompt → utilities

import type {
  Bystander,
  Character,
  Estate,
  EventData,
  LocationData
} from '../../shared/types/types.ts';

import {
    buildBystandersSection,
    buildCharactersSection,
    buildEventSection,
    buildLocationSection,
    buildLogsSection,
    buildRecruitKeywordsSection,
    buildUserGuidanceSection 
} from './buildPromptService.js';

import { compileRecruitContext } from './promptService.js';
import { filterLogs } from './logService.js';
import StaticGameDataManager from '../staticGameDataManager.js';

/* -------------------------------------------------------------------
 *  Main export
 * ------------------------------------------------------------------- */

/**
 * compileStoryPrompt
 * Builds a string prompt.
 */
export async function compileRecruitPrompt(
  estate: Estate,
  event: EventData,
  chosenCharacterIds: string[],
  locations: LocationData[],
  bystanders: Bystander[] = [],
  keywords: string[] = []
): Promise<string> {
  const gameData = StaticGameDataManager.getInstance();

  const narrativeContext = compileRecruitContext(estate, gameData);

  // Gather data
  const involvedCharacters: Character[] = chosenCharacterIds.map((id) => estate.characters[id]);

  // Filter logs to only those involving chosen characters
  const filteredLogs = filterLogs(estate, involvedCharacters);

  // Build sections (order is narrative-driven)
  const charactersSection =
    buildCharactersSection(involvedCharacters);

  const fullPrompt =
    narrativeContext +
    buildEventSection(event, involvedCharacters) +
    charactersSection +
    buildLocationSection(estate, locations) +
    buildBystandersSection(estate, bystanders, chosenCharacterIds) +
    buildLogsSection(filteredLogs) +
    buildRecruitKeywordsSection(keywords) +
    buildUserGuidanceSection(estate.preferences?.guidance);

  console.log(fullPrompt);
  return fullPrompt;
}