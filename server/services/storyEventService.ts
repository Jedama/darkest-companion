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
          if (idx === arr.length - 1) return `${acc}, and ${name}`; // Last name with ", and"
          return `${acc}, ${name}`; // Middle names with ","
        }, '');
      updatedSummary = updatedSummary.replaceAll('[Characters]', characterNames);
    }

    return updatedSummary;
  }

  // 1. Gather character data
  const involvedCharacters: Character[] = chosenCharacterIds.map(id => estate.characters[id]);

  // 2. Build [Instructions]
  const instructionsSection = `[Instructions]
You are Pandora Dantill, the Ancestor, a malignant spectral presence haunting your once-grand estate. Your curse compels you to observe but never interfere, and you take grim satisfaction in watching the struggles of those who seek to reclaim your domain.

Construct a vivid narrative vignette that:
Centers on a pivotal event: Describe a decisive moment where characters face conflict, danger, or a crucial decision that pushes them to their limits.
Drives meaningful consequences: Show how this moment shapes the relationships, fortunes, or fates of the characters, leaving a lasting impact on the narrative.
Fuels tension and stakes: Highlight the characters’ flaws, fears, and desires as they clash with each other and the horrors of the estate. Emphasize their inner struggles as much as external threats.
Maintains a grim and eerie tone: Incorporate unsettling or grotesque details, letting the atmosphere reflect the malevolence of the estate. Do not shy away from discomfort or tragedy.

Avoid:
Reintroducing the characters in every scene. Assume the reader knows their backgrounds and focus on their immediate actions, thoughts, and decisions.
Mentioning yourself or your observations. Let the story unfold as if the reader is directly witnessing it.
Overly harmonious resolutions. Allow moments of triumph, but temper them with sacrifice, loss, or lingering tension.
Cliffhangers or leaving the vignette unresolved. They must provide a satisfying conclusion while hinting at future conflicts.

Begin with a title in brackets, e.g., [].
`;

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
    charactersSection += `  - Clothing: Wears a ${char.clothing.body}, paired with ${char.clothing.legs}. On their head, they wear ${char.clothing.head}. Additional details include ${char.clothing.other}.\n`;

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

  // 5. Build [Event] section and replace placeholders
  const eventSummaryWithReplacements = replaceCharacterPlaceholders(event.summary, involvedCharacters);
  const eventSection = `[Event]
Title: "${event.title}"
Summary: ${eventSummaryWithReplacements}

`;

  // 6. Build [Modifiers] section (if any)
  let keywordsSection = '';
  if (event.keywords && event.keywords.length > 0) {
    keywordsSection = `[Modifiers]\n${event.keywords.join(', ')}\n\n`;
  }

  // 7. Combine everything
  const fullPrompt =
    instructionsSection +
    charactersSection +
    eventSection +
    keywordsSection;

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
