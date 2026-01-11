// server/services/storyEventService.ts
// File order:
// Imports → small helpers → section builders → compileStoryPrompt → utilities

import type {
  Bystander,
  Character,
  Enemy,
  Estate,
  EventData,
  LocationData,
  NPC,
} from '../../../shared/types/types.js';

import { 
  buildBystandersSection,
  buildCharactersSection,
  buildEnemiesSection,
  buildEventSection,
  buildKeywordsSection,
  buildLocationSection,
  buildLogsSection,
  buildNPCSection,
  buildRelationshipSection,
  buildUserGuidanceSection 
} from '../llm/buildPromptService.js';

import { compileNarrativeContext } from '../llm/promptService.js';
import { filterLogs } from '../game/logService.js';
import StaticGameDataManager from '../../staticGameDataManager.js';

/* -------------------------------------------------------------------
 *  Main export
 * ------------------------------------------------------------------- */

/**
 * compileStoryPrompt
 * Builds a string prompt.
 */
export async function compileStoryPrompt(
  estate: Estate,
  event: EventData,
  chosenCharacterIds: string[],
  locations: LocationData[],
  npcIds: string[],
  enemyIds: string[],
  bystanders: Bystander[] = [],
  keywords: string[] = []
): Promise<string> {
  const gameData = StaticGameDataManager.getInstance();

  const narrativeContext = compileNarrativeContext(estate, gameData);

  // Gather data
  const involvedCharacters: Character[] = chosenCharacterIds.map((id) => estate.characters[id]);
  const npcs: NPC[] = npcIds.map((id) => gameData.getNPCById(id)).filter((npc): npc is NPC => !!npc);
  const enemies: Enemy[] = enemyIds
    .map((id) => gameData.getEnemyById(id))
    .filter((e): e is Enemy => !!e);

  // Filter logs to only those involving chosen characters
  const filteredLogs = filterLogs(estate, involvedCharacters);

  // Build sections (order is narrative-driven)
  const charactersSection =
    buildCharactersSection(involvedCharacters) + buildRelationshipSection(involvedCharacters);

  const fullPrompt =
    narrativeContext +
    buildEventSection(event, involvedCharacters, enemies) +
    charactersSection +
    buildLocationSection(estate, locations) +
    buildNPCSection(npcs) +
    buildBystandersSection(estate, bystanders, chosenCharacterIds) +
    buildEnemiesSection(enemies) +
    buildLogsSection(filteredLogs) +
    buildKeywordsSection(keywords) +
    buildUserGuidanceSection(estate.preferences?.guidance);

  console.log(fullPrompt);
  return fullPrompt;
}