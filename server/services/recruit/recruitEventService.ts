// server/services/storyEventService.ts
// File order:
// Imports → small helpers → section builders → compileStoryPrompt → utilities

import type {
  Bystander,
  Character,
  Estate,
  EventData,
  LocationData
} from '../../../shared/types/types.js';

import {
    buildBystandersSection,
    buildCharactersSection,
    buildEventSection,
    buildLocationSection,
    buildLogsSection,
    buildRecruitKeywordsSection,
    buildRelationshipSection,
    buildUserGuidanceSection 
} from '../llm/buildPromptService.js';

import { compileRecruitContext } from '../llm/promptService.js';
import { filterLogs } from '../game/logService.js';
import StaticGameDataManager from '../../staticGameDataManager.js';

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
  const fullPrompt =
    narrativeContext +
    buildEventSection(event, involvedCharacters) +
    buildCharactersSection(involvedCharacters) +
    buildRelationshipSection(involvedCharacters) +
    buildLocationSection(estate, locations) +
    buildBystandersSection(estate, bystanders, chosenCharacterIds) +
    buildLogsSection(filteredLogs) +
    buildRecruitKeywordsSection(keywords) +
    buildUserGuidanceSection(estate.preferences?.guidance);

  console.log(fullPrompt);
  return fullPrompt;
}

export async function compileRecruitConsequencesPrompt(options: {
  estate: Estate;
  story: string;
  chosenCharacterIds: string[];
  keywords: string[];
}): Promise<string> {
  const { estate, story, chosenCharacterIds } = options;

  const gameData = StaticGameDataManager.getInstance();
  const consequenceInstructions = gameData.getPrompt('recruit.consequence.instructions');
  const consequenceFormat = gameData.getPrompt('recruit.consequence.format');
  const consequenceExamples = gameData.getPrompt('recruit.consequence.examples');

  // 1. Gather characters
const involvedCharacters: Character[] = chosenCharacterIds.map((id) => estate.characters[id]);

const margraveId = estate.roles.margrave;
const bursarId = estate.roles.bursar;

const establishedCharacters: Character[] = involvedCharacters.filter(
  (char) => char.identifier === margraveId || char.identifier === bursarId
);

const remainingCharacters = involvedCharacters.filter(
  (char) => char.identifier !== margraveId && char.identifier !== bursarId
);

if (remainingCharacters.length !== 1) {
  throw new Error(
    `Expected exactly one recruited character, but found ${remainingCharacters.length}`
  );
}

const recruitedCharacter: Character = remainingCharacters[0];

  // 2. Build character context section
  let charactersSection = `[New Recruit]\n`;
  
  charactersSection += `  - [${recruitedCharacter.identifier}] ${recruitedCharacter.name} (${recruitedCharacter.title}):\n`;
  charactersSection += `  - Description: ${recruitedCharacter.description}\n`;
  charactersSection += `  - History: ${recruitedCharacter.history}\n`
  charactersSection += `  - Stats: strength: ${recruitedCharacter.stats.strength}, agility: ${recruitedCharacter.stats.agility}, intelligence: ${recruitedCharacter.stats.intelligence}, authority: ${recruitedCharacter.stats.authority}, sociability: ${recruitedCharacter.stats.sociability}\n`;
  charactersSection += `  - Traits: ${recruitedCharacter.traits.join(', ')}\n`;
  charactersSection += `  - Status: Physical: ${recruitedCharacter.status.physical}, Mental: ${recruitedCharacter.status.mental}, Description: ${recruitedCharacter.status.description}\n`;
  charactersSection += `  - Equipment: ${recruitedCharacter.equipment.join(', ')}\n`;
  charactersSection += `  - Appearance: height: ${recruitedCharacter.appearance.height}, build: ${recruitedCharacter.appearance.build} skinTone: ${recruitedCharacter.appearance.skinTone}, hairStyle: ${recruitedCharacter.appearance.hairStyle}, hairColor: ${recruitedCharacter.appearance.hairColor}, features: ${recruitedCharacter.appearance.features}.\n`;
  charactersSection += `  - Clothing: headwear: ${recruitedCharacter.clothing.head}, top: ${recruitedCharacter.clothing.body}, pants: ${recruitedCharacter.clothing.legs}, accesories: ${recruitedCharacter.clothing.accessories}.\n`;
  
  // Maybe add affliction here? If present

  if (recruitedCharacter.notes.length > 0) {
    charactersSection += `  - Notes: ${recruitedCharacter.notes.join(', ')}\n`;
  }

  charactersSection += `\n\n[Previously Established Characters]\n`

  for (const char of establishedCharacters) {
    charactersSection += `  - [${char.identifier}] ${char.name} (${char.title}):\n`;
    charactersSection += `  - Summary: ${char.summary}\n\n`;
  }
  

  // 3. Add relationships section
  let relationshipLines = '';
  for (const charA of involvedCharacters) {
    for (const charB of involvedCharacters) {
      if (charA.identifier !== charB.identifier) {
        const rel = charA.relationships[charB.identifier];
        if (rel) {
          relationshipLines += `${charA.identifier} → ${charB.identifier} (Affinity: ${rel.affinity}, Dynamic: ${rel.dynamic}, Description: ${rel.description})\n`;
        }
      }
    }
  }
  if (relationshipLines) {
    charactersSection += `\n[Relationships]\n${relationshipLines}`;
  }

  // 4. Construct the final prompt using the template from consequenceData
  const prompt = `
    You are a system that outputs consequences in valid JSON. No extra text, no markdown.

    [Story Context]
    ${story}

    [User-provided character modifiers]
    These are the quirks/personality modifiers that the user supplied for the recruit. 
    Don't mindlessly add them, but if they're present in the story, use them to inform your consequence choices.

    ${charactersSection}

    ${consequenceInstructions}
    ${consequenceFormat}
    ${consequenceExamples}
  `.trim();

  return prompt;
}