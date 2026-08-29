// server/services/planning/planningConsequencesService.ts
import type { Estate, Character } from '../../../shared/types/types.js';
import StaticGameDataManager from '../../staticGameDataManager.js';
import type { DialogueLine } from './planningService.js';

/**
 * Turns parsed dialogue back into the `identifier: text` transcript form —
 * the same shape parseDialogue consumed it from — so the consequences pass
 * reads the meeting the way it was actually spoken.
 */
export function formatDialogueTranscript(lines: DialogueLine[]): string {
  return lines.map(line => `${line.speaker}: ${line.text}`).join('\n');
}

/**
 * compilePlanningConsequencesPrompt
 * Builds a string that prompts the LLM to output strictly valid JSON
 * describing the consequences of a planning meeting, with no fluff.
 *
 * Mirrors compileConsequencesPrompt (consequencesEventService.ts): same
 * [Characters]/[Relationships] scaffolding, same instructions/format/examples
 * assembly, only the source material and prompt keys differ.
 */
export async function compilePlanningConsequencesPrompt(options: {
  estate: Estate;
  lines: DialogueLine[];
  attendeeIds: string[];
}): Promise<string> {
  const { estate, lines, attendeeIds } = options;

  const gameData = StaticGameDataManager.getInstance();
  const consequenceInstructions = gameData.getPrompt('planning.consequence.instructions');
  const consequenceFormat = gameData.getPrompt('planning.consequence.format');
  const consequenceExamples = gameData.getPrompt('planning.consequence.examples');

  // 1. Gather attendees
  const attendees: Character[] = attendeeIds
    .map((id) => estate.characters[id])
    .filter((c): c is Character => !!c);

  // 2. Build character context section
  let charactersSection = `[Characters]\n`;
  for (const char of attendees) {
    charactersSection += `  - [${char.identifier}] ${char.name} (${char.title}):\n`;
    charactersSection += `  - Description: ${char.description}\n`;
    charactersSection += `  - Stats: strength: ${char.stats.strength}, agility: ${char.stats.agility}, intelligence: ${char.stats.intelligence}, authority: ${char.stats.authority}, sociability: ${char.stats.sociability}\n`;
    charactersSection += `  - Traits: ${char.traits.join(', ')}\n`;
    charactersSection += `  - Status: Physical: ${char.status.physical}, Mental: ${char.status.mental}, Description: ${char.status.description}\n`;
    charactersSection += `  - Appearance: height: ${char.appearance.height}, build: ${char.appearance.build} skinTone: ${char.appearance.skinTone}, hairStyle: ${char.appearance.hairStyle}, hairColor: ${char.appearance.hairColor}, features: ${char.appearance.features}.\n`;
    charactersSection += `  - Clothing: headwear: ${char.clothing.head}, top: ${char.clothing.body}, pants: ${char.clothing.legs}, accesories: ${char.clothing.accessories}.\n`;

    if (char.notes.length > 0) {
      charactersSection += `  - Notes: ${char.notes.join('; ')}\n`;
    }
  }

  // 3. Add relationships section
  let relationshipLines = '';
  for (const charA of attendees) {
    for (const charB of attendees) {
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

  // 4. Construct the final prompt
  const prompt = `
    You are a system that outputs consequences in valid JSON. No extra text, no markdown.

    [Meeting Transcript]
    ${formatDialogueTranscript(lines)}

    ${charactersSection}

    ${consequenceInstructions}
    ${consequenceFormat}
    ${consequenceExamples}
  `.trim();

  return prompt;
}
