import type { Estate, EventData, Character } from '../../shared/types/types.ts';

/**
 * compileStoryPrompt
 * Builds a string prompt in the format you described.
 *
 * For this first version, we’ll just handle [Instructions], [Characters], [Event], and [Keywords].
 * We’ll also inject minimal relationship data. You can expand it later with location, NPCs, enemies, etc.
 */
export function compileStoryPrompt(
  estate: Estate, 
  event: EventData, 
  chosenCharacterIds: string[]
): string {

  // Function to replace placeholders like [Character ?] with corresponding names
  function replaceCharacterPlaceholders(summary: string, characters: Character[]): string {
    let updatedSummary = summary;
    characters.forEach((char, index) => {
      const placeholder = `[Character ${index + 1}]`;
      updatedSummary = updatedSummary.replaceAll(placeholder, char.name);
    });
    return updatedSummary;
  }

  // 1. Gather character data
  const involvedCharacters: Character[] = chosenCharacterIds.map(id => estate.characters[id]);

  // 2. Build [Instructions]
  const instructionsSection = `[Instructions]
You are a narrative generator. Use the information below to produce a narrative describing the given event, incorporating the given keywords. Incorporate character personalities, relationships, and traits.

`;

  // 3. Build [Characters] section
  //    For each character, gather summary, stats, traits, status, notes...
  let charactersSection = `[Characters]\n`;
  for (const char of involvedCharacters) {
    charactersSection += `- ${char.name} (${char.title}):\n`;
    charactersSection += `  - Summary: ${char.summary}\n`;
    charactersSection += `  - Stats: Strength: ${char.stats.strength}, Agility: ${char.stats.agility}, Intelligence: ${char.stats.intelligence}, Authority: ${char.stats.authority}, Sociability: ${char.stats.sociability}\n`;
    charactersSection += `  - Traits: ${char.traits.join(', ')}\n`;
    charactersSection += `  - Status: ${char.status.description}\n`;
    if (char.notes.length > 0) {
      charactersSection += `  - Notes: ${char.notes.join(', ')}\n`;
    }
    charactersSection += `\n`;
  }

  // 4. Build relationship lines
  //    Only include relationships between the chosen characters for now
  let relationshipLines = '';
  for (const charA of involvedCharacters) {
    for (const charB of involvedCharacters) {
      if (charA.identifier !== charB.identifier) {
        const rel = charA.relationships[charB.identifier];
        if (rel) {
          relationshipLines += `${charA.title} → ${charB.title} (Affinity: ${rel.affinity}, Dynamic: ${rel.dynamic})\n  Description: ${rel.description}\n\n`;
        }
      }
    }
  }
  if (relationshipLines) {
    charactersSection += relationshipLines;
  }

  // 5. Build [Event] section and replace placeholders
  const eventSummaryWithReplacements = replaceCharacterPlaceholders(event.summary, involvedCharacters);
  const eventSection = `[Event]
Title: "${event.title}"
Summary: ${eventSummaryWithReplacements}

`;

  // 6. Build [Keywords] section (if any)
  let keywordsSection = '';
  if (event.keywords && event.keywords.length > 0) {
    keywordsSection = `[Keywords]\n${event.keywords.join(', ')}\n\n`;
  }

  // 7. Combine everything
  const fullPrompt =
    instructionsSection +
    charactersSection +
    eventSection +
    keywordsSection;

  return fullPrompt;
}
