import type { Estate, EventData, Character, NPC, LocationData, Bystander, Enemy } from '../../shared/types/types.ts';
import { compileNarrativeContext  } from './promptService.js';
import StaticGameDataManager from '../staticGameDataManager.js';

/**
 * compileStoryPrompt
 * Builds a string prompt in the format you described.
 *
 * For this first version, we'll just handle [Instructions], [Characters], [Event], and [Keywords].
 * We'll also inject minimal relationship data. You can expand it later with location, NPCs, enemies, etc.
 */
export async function compileStoryPrompt(
  estate: Estate, 
  event: EventData, 
  chosenCharacterIds: string[],
  locations: LocationData[],
  npcIds: string[],
  enemyIds: string[],
  bystanders: Bystander[] = []
): Promise<string> {

  // Function to replace placeholders like [Character ?] or [Characters] with corresponding names
  function replaceCharacterPlaceholders(description: string, characters: Character[]): string {
    let updatedDescription = description;

    // Replace specific [Character ?] placeholders
    characters.forEach((char, index) => {
      const placeholder = `[Character ${index + 1}]`;
      updatedDescription = updatedDescription.replaceAll(placeholder, char.name);
    });

    // Replace [Characters] placeholder with a properly formatted list of character names
    if (updatedDescription.includes('[Characters]')) {
      const characterNames = characters
        .map((char) => char.name)
        .reduce((acc, name, idx, arr) => {
          if (idx === 0) return name; // First name, no formatting needed
          if (idx === arr.length - 1) return `${acc} and ${name}`; // Last name with " and"
          return `${acc}, ${name}`; // Middle names with ","
        }, '');
      updatedDescription = updatedDescription.replaceAll('[Characters]', characterNames);
    }

    return updatedDescription;
  }

  function replaceEnemyPlaceholders(description: string, enemies: Enemy[]): string {
    let updatedDescription = description;

    // Replace specific [Enemy ?] placeholders
    enemies.forEach((enemy, index) => {
      const placeholder = `[Enemy ${index + 1}]`;
      updatedDescription = updatedDescription.replaceAll(placeholder, enemy.title);
    });

    // Replace [Enemies] placeholder with a properly formatted list of enemy titles
    if (updatedDescription.includes('[Enemies]')) {
      const enemyNames = enemies
        .map((e) => e.title)
        .reduce((acc, name, idx, arr) => {
          if (idx === 0) return name;
          if (idx === arr.length - 1) return `${acc} and ${name}`;
          return `${acc}, ${name}`;
        }, '');
      updatedDescription = updatedDescription.replaceAll('[Enemies]', enemyNames);
    }

    return updatedDescription;
  }

  // 1. Build [Instructions] and [Context] section using the prompt service
  const gameData = StaticGameDataManager.getInstance();

  const narrativeContextPayload = {
    month: estate.month,
    estateName: estate.estateName,
    instructions: gameData.getPromptStoryInstructions(),
    backstory: gameData.getPromptStoryBackstory(),
    zodiacs: gameData.getPromptZodiacSeasons(),
    scenarios: gameData.getPromptElapsedMonthText()
  };

  const narrativeContext = compileNarrativeContext(narrativeContextPayload);

  // 2. Gather character and data
  const involvedCharacters: Character[] = chosenCharacterIds.map(id => estate.characters[id]);
  const npcs: NPC[] = gameData.getNPCsByIds(npcIds);
  const enemies: Enemy[] = enemyIds
    .map((id) => gameData.getEnemyById(id))
    .filter((e): e is Enemy => !!e);

  // 3. Build [Characters] section
  //    For each character, gather description, stats, traits, status, notes, clothing, appearance, combat, and magic
  let charactersSection = `[Characters]\n`;
  for (const char of involvedCharacters) {
    charactersSection += `- ${char.name} (${char.title}):\n`;
    charactersSection += `  - Description: ${char.description}\n`;
    charactersSection += `  - History: ${char.history}\n`;
    charactersSection += `  - Stats: Strength: ${char.stats.strength}, Agility: ${char.stats.agility}, Intelligence: ${char.stats.intelligence}, Authority: ${char.stats.authority}, Sociability: ${char.stats.sociability}\n`;
    charactersSection += `  - Traits: ${char.traits.join(', ')}\n`;
    charactersSection += `  - Status: ${char.status.description}\n`;

    // Add appearance details
    charactersSection += `  - Appearance: A ${char.appearance.height}, ${char.appearance.build} individual with ${char.appearance.skinTone} skin. ${char.appearance.hairStyle} ${char.appearance.hairColor} hair frames their ${char.appearance.features}.\n`;

    // Add clothing details
    charactersSection += `  - Clothing: Wears a ${char.clothing.body}, paired with ${char.clothing.legs}. On their head, they wear ${char.clothing.head}. Additional details include ${char.clothing.accessories}.\n`;

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
let relationshipLines = '';
for (const charA of involvedCharacters) {
  for (const charB of involvedCharacters) {
    if (charA.identifier !== charB.identifier) {
      // Check if explicit relationship exists
      const rel = charA.relationships[charB.identifier];
      
      if (rel) {
        // Use explicit relationship
        relationshipLines += `${charA.title} → ${charB.title} (Affinity: ${rel.affinity}, Dynamic: ${rel.dynamic})\n  Description: ${rel.description}\n\n`;
      } else {
        // Use default relationship when none exists
        relationshipLines += `${charA.title} → ${charB.title} (Affinity: 3, Dynamic: Strangers)\n  Description: No meaningful interactions yet. Maintains distance and reservation, as survival here demands caution with everyone.\n\n`;
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

  // 6. Build NPC section
  let npcSection = '';
  if (npcs.length > 0) {
    npcSection = `[NPCs]\n`;
    for (const npc of npcs) {
      // Main header with name and title
      npcSection += `- ${npc.title} ${npc.name}\n`;
      
      // Indented description and history
      npcSection += `  ${npc.description}\n`;
      npcSection += `  ${npc.history}\n`;
      
      // Compact appearance and traits section
      const appearanceDetails = [
        npc.appearance.height,
        npc.appearance.build,
        npc.appearance.features
      ].filter(Boolean).join(', ');
      
      npcSection += `  Appearance: ${appearanceDetails}\n`;
      
      // Clothing as a single line
      const attire = [
        npc.clothing.head,
        npc.clothing.body,
        npc.clothing.legs,
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

  // 7. Build bystanders section
  let bystandersSection = '';
  if (bystanders.length > 0) {
    bystandersSection = `[Bystanders]\n`;
    
    for (const { identifier: characterId, connectionType } of bystanders) {
      const char = estate.characters[characterId];
      if (!char) continue;
      
      // Determine connection type text
      let connectionText = '';
      switch (connectionType) {
        case 'residence':
          connectionText = 'Resides at the event location';
          break;
        case 'workplace':
          connectionText = 'Works at the event location';
          break;
        case 'frequent':
          connectionText = 'Frequents the event location';
          break;
        case 'present':
          connectionText = 'Present at the event location';
          break;
      }
      
      // Check if this is a main event character
      if (chosenCharacterIds.includes(characterId)) {
        bystandersSection += `- ${char.name} (${char.title}) - ${connectionText}\n  *** Main character in this event. See full description above. ***\n\n`;
      } else {
        // Add compact character information for non-event characters
        bystandersSection += `- ${char.name} (${char.title}) - ${connectionText}\n`;
        bystandersSection += `  ${char.description}\n`;
        
        // Add a few key traits
        if (char.traits.length > 0) {
          bystandersSection += `  Notable traits: ${char.traits.slice(0, 3).join(', ')}\n`;
        }
        
        // Brief appearance description
        bystandersSection += `  Appearance: ${char.appearance.height}, ${char.appearance.build}, ${char.appearance.skinTone} skin, ${char.appearance.hairStyle} ${char.appearance.hairColor} hair\n\n`;
      }
    }
  }

  // 8. Build [Enemies] section (if any)
  let enemiesSection = '';
  if (enemies.length > 0) {
    enemiesSection = `[Enemies]\n`;

    for (const enemy of enemies) {
      enemiesSection += `- ${enemy.title}\n`;
      enemiesSection += `  - ${enemy.description}\n`;
      enemiesSection += `  - ${enemy.history}\n`;

      // Identity / flavor
      enemiesSection += `  - Race/Gender/Religion: ${enemy.race}, ${enemy.gender}, ${enemy.religion}\n`;

      // Stats & kit
      enemiesSection += `  - Stats: Strength: ${enemy.stats.strength}, Agility: ${enemy.stats.agility}, Intelligence: ${enemy.stats.intelligence}\n`;
      if (enemy.traits?.length) {
        enemiesSection += `  - Traits: ${enemy.traits.join(', ')}\n`;
      }
      if (enemy.equipment?.length) {
        enemiesSection += `  - Equipment: ${enemy.equipment.join(', ')}\n`;
      }

      // Appearance / clothing
      enemiesSection += `  - Appearance: ${enemy.appearance.height}, ${enemy.appearance.build}, ${enemy.appearance.skinTone} skin, ${enemy.appearance.hairStyle} ${enemy.appearance.hairColor} hair, ${enemy.appearance.features}\n`;
      enemiesSection += `  - Clothing: Head: ${enemy.clothing.head}; Body: ${enemy.clothing.body}; Legs: ${enemy.clothing.legs}; Accessories: ${enemy.clothing.accessories}\n`;

      // Combat / magic
      enemiesSection += `  - Combat: Role: ${enemy.combat.role}. Strengths: ${enemy.combat.strengths.join(', ')}. Weaknesses: ${enemy.combat.weaknesses.join(', ')}.\n`;
      if (enemy.magic) {
        enemiesSection += `  - Magic: ${enemy.magic}\n`;
      }

      enemiesSection += `\n`;
    }
  }

  // 9. Build [Event] section and replace placeholders
  let eventDescriptionWithReplacements = replaceCharacterPlaceholders(event.description, involvedCharacters);
  eventDescriptionWithReplacements = replaceEnemyPlaceholders(eventDescriptionWithReplacements, enemies);
  const eventSection = `[Event]
Title: "${event.title}"
Description: ${eventDescriptionWithReplacements}

`;

  // 9. Build [Modifiers] section (if any)
  let keywordsSection = '';
  if (event.keywords && event.keywords.length > 0) {
    keywordsSection = `[Modifiers]\n${event.keywords.join(', ')}\n\n`;
  }

  // 10. Combine everything
  const fullPrompt =
    narrativeContext  +
    eventSection +
    charactersSection +
    locationSection +
    npcSection +
    bystandersSection +
    enemiesSection +
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