// services/consequencesEventService.ts
import type { Estate, Character } from '../../../shared/types/types';
import StaticGameDataManager from '../../staticGameDataManager.js';

/**
 * compileConsequencesPrompt
 * Builds a string that prompts the LLM to output strictly valid JSON
 * describing the consequences for each relevant character, with no fluff.
 */
export async function compileConsequencesPrompt(options: {
  estate: Estate;
  story: string;
  chosenCharacterIds: string[];
}): Promise<string> {
  const { estate, story, chosenCharacterIds } = options;

  const gameData = StaticGameDataManager.getInstance();
  const consequenceInstructions = gameData.getPrompt('story.consequence.instructions');
  const consequenceFormat = gameData.getPrompt('story.consequence.format');
  const consequenceExamples = gameData.getPrompt('story.consequence.examples');

  // 1. Gather characters
  const involvedCharacters: Character[] = chosenCharacterIds.map((id) => estate.characters[id]);

  // 2. Build character context section
  let charactersSection = `[Characters]\n`;
  for (const char of involvedCharacters) {
    charactersSection += `  - [${char.identifier}] ${char.name} (${char.title}):\n`;
    charactersSection += `  - Description: ${char.description}\n`;
    charactersSection += `  - Stats: strength: ${char.stats.strength}, agility: ${char.stats.agility}, intelligence: ${char.stats.intelligence}, authority: ${char.stats.authority}, sociability: ${char.stats.sociability}\n`;
    charactersSection += `  - Traits: ${char.traits.join(', ')}\n`;
    charactersSection += `  - Status: Physical: ${char.status.physical}, Mental: ${char.status.mental}, Description: ${char.status.description}\n`;
    charactersSection += `  - Appearance: height: ${char.appearance.height}, build: ${char.appearance.build} skinTone: ${char.appearance.skinTone}, hairStyle: ${char.appearance.hairStyle}, hairColor: ${char.appearance.hairColor}, features: ${char.appearance.features}.\n`;
    charactersSection += `  - Clothing: headwear: ${char.clothing.head}, top: ${char.clothing.body}, pants: ${char.clothing.legs}, accesories: ${char.clothing.accessories}.\n`;
    
    // Maybe add affliction here? If present

    if (char.notes.length > 0) {
      charactersSection += `  - Notes: ${char.notes.join(', ')}\n`;
    }
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

    ${charactersSection}

    ${consequenceInstructions}
    ${consequenceFormat}
    ${consequenceExamples}
  `.trim();

  return prompt;
}