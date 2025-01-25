import type { Estate, EventData, Character, NPC, LocationData } from '../../shared/types/types.ts';
import { getInstructionsText, getContextText } from './narrativeData';
import { loadNPCsByIds } from '../templateLoader';

/**
 * compileStoryPrompt
 * Builds a string prompt in the format you described.
 *
 * For this first version, we’ll just handle [Instructions], [Characters], [Event], and [Keywords].
 * We’ll also inject minimal relationship data. You can expand it later with location, NPCs, enemies, etc.
 */
export async function compileStoryPrompt(
  estate: Estate, 
  event: EventData, 
  chosenCharacterIds: string[],
  locations: LocationData[],
  npcIds: string[]
): Promise<string> {

  // Function to replace placeholders like [Character ?] or [Characters] with corresponding names
  function replaceCharacterPlaceholders(summary: string, characters: Character[]): string {
    let updatedSummary = summary;

    // Replace specific [Character ?] placeholders
    characters.forEach((char, index) => {
      const placeholder = `[Character ${index + 1}]`;
      updatedSummary = updatedSummary.replaceAll(placeholder, char.name);
    });

    // Replace [Characters] placeholder with a properly formatted list of character names
    if (updatedSummary.includes('[Characters]')) {
      const characterNames = characters
        .map((char) => char.name)
        .reduce((acc, name, idx, arr) => {
          if (idx === 0) return name; // First name, no formatting needed
          if (idx === arr.length - 1) return `${acc} and ${name}`; // Last name with " and"
          return `${acc}, ${name}`; // Middle names with ","
        }, '');
      updatedSummary = updatedSummary.replaceAll('[Characters]', characterNames);
    }

    return updatedSummary;
  }

  // 1. Gather character and data
  const involvedCharacters: Character[] = chosenCharacterIds.map(id => estate.characters[id]);
  const npcs: NPC[] = await loadNPCsByIds(npcIds);

  // 2. Build [Instructions] and [Context]
  const instructionsSection = getInstructionsText();

  const contextSection = getContextText(estate.month, estate.estateName);

  // 3. Build [Characters] section
  //    For each character, gather summary, stats, traits, status, notes, clothing, appearance, combat, and magic
  let charactersSection = `[Characters]\n`;
  for (const char of involvedCharacters) {
    charactersSection += `- ${char.name} (${char.title}):\n`;
    charactersSection += `  - Summary: ${char.summary}\n`;
    charactersSection += `  - History: ${char.history}\n`;
    charactersSection += `  - Stats: Strength: ${char.stats.strength}, Agility: ${char.stats.agility}, Intelligence: ${char.stats.intelligence}, Authority: ${char.stats.authority}, Sociability: ${char.stats.sociability}\n`;
    charactersSection += `  - Traits: ${char.traits.join(', ')}\n`;
    charactersSection += `  - Status: ${char.status.description}\n`;

    // Add appearance details
    charactersSection += `  - Appearance: A ${char.appearance.height}, ${char.appearance.build} individual with ${char.appearance.skinTone} skin. ${char.appearance.hairStyle} ${char.appearance.hairColor} hair frames their ${char.appearance.features}.\n`;

    // Add clothing details
    charactersSection += `  - Clothing: Wears a ${char.clothing.top}, paired with ${char.clothing.pants}. On their head, they wear ${char.clothing.headwear}. Additional details include ${char.clothing.accessories}.\n`;

    // Add combat details
    charactersSection += `  - Combat: Fulfills the role of a ${char.combat.role}, excelling in ${char.combat.strengths.join(', ')}, but struggles with ${char.combat.weaknesses.join(', ')}.\n`;

    // Add magic details, if any
    if (char.magic) {
      charactersSection += `  - Magic: ${char.magic}\n`;
    }

    // Add notes, if any
    if (char.notes.length > 0) {
      charactersSection += `  - Notes: ${char.notes.join(', ')}\n`;
    }
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

  // 5. Build [Location] section (if any)
  let locationSection = '';
  if (locations && locations.length > 0) {
    // Extract the primary location (first in the list)
    const primaryLocation = locations[0];
    const isRestored = primaryLocation.restored && estate.restoredLocations?.includes(primaryLocation.identifier);
    const description = isRestored ? primaryLocation.restored : primaryLocation.description;

    // Build the primary location section
    locationSection += `[Location]
Title: ${primaryLocation.title}
Description: ${description}

`;

    // Add surrounding locations if there are more
    if (locations.length > 1) {
      locationSection += `Surrounding Locations:\n`;
      for (let i = 1; i < locations.length; i++) {
        const surroundingLocation = locations[i];
        const isRestored = surroundingLocation.restored && estate.restoredLocations?.includes(surroundingLocation.identifier);
        const surroundingDescription = isRestored ? surroundingLocation.restored : surroundingLocation.description;

        locationSection += `- ${surroundingLocation.title}: ${surroundingDescription}\n`;
      }
    }
  }

  // 6. Load NPCs by ID
  let npcSection = '';
  if (npcs.length > 0) {
    npcSection = `[NPCs]\n`;
    for (const npc of npcs) {
      // Main header with name and title
      npcSection += `- ${npc.title} ${npc.name}\n`;
      
      // Indented summary
      npcSection += `  ${npc.summary}\n`;
      
      // Compact appearance and traits section
      const appearanceDetails = [
        npc.appearance.height,
        npc.appearance.build,
        npc.appearance.features
      ].filter(Boolean).join(', ');
      
      npcSection += `  Appearance: ${appearanceDetails}\n`;
      
      // Clothing as a single line
      const attire = [
        npc.clothing.headwear,
        npc.clothing.top,
        npc.clothing.pants,
        npc.clothing.accessories
      ].filter(Boolean).join(', ');
      npcSection += `  Attire: ${attire}\n`;
      
      // Traits as a single line
      if (npc.traits.length > 0) {
        npcSection += `  Notable Traits: ${npc.traits.join(', ')}\n`;
      }
      
      // Add spacing between NPCs
      npcSection += '\n';
    }
  }

  // 7. Build [Event] section and replace placeholders
  const eventSummaryWithReplacements = replaceCharacterPlaceholders(event.summary, involvedCharacters);
  const eventSection = `[Event]
Title: "${event.title}"
Summary: ${eventSummaryWithReplacements}

`;

  // 8. Build [Modifiers] section (if any)
  let keywordsSection = '';
  if (event.keywords && event.keywords.length > 0) {
    keywordsSection = `[Modifiers]\n${event.keywords.join(', ')}\n\n`;
  }

  // 9. Combine everything
  const fullPrompt =
    instructionsSection +
    contextSection +
    charactersSection +
    locationSection +
    eventSection +
    npcSection +
    keywordsSection;

  console.log(fullPrompt);

  return fullPrompt;
}

/**
 * Extracts the title from a story response
 * @param storyText - The full story text returned by the LLM
 * @returns Object containing the extracted title and the story body
 */
export function separateStoryTitle(storyText: string): { title: string; body: string } {
  // Match text within first set of square brackets
  const titleMatch = storyText.match(/^\[(.*?)\]/);
  
  if (!titleMatch) {
    // If no title found, return empty string as title and full text as body
    return {
      title: '',
      body: storyText.trim()
    };
  }

  // Return both title (without brackets) and remaining text
  return {
    title: titleMatch[1].trim(),
    body: storyText.substring(titleMatch[0].length).trim()
  };
}
