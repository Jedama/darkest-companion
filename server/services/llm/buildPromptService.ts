// server/services/buildPromptService.ts
import type {
  Bystander,
  Character,
  Enemy,
  Estate,
  EventData,
  LocationData,
  NPC,
} from '../../../shared/types/types.js';

import StaticGameDataManager from '../../staticGameDataManager.js';
import { isDescendantOf } from '../game/locationService.js';

const MAX_GUIDANCE_LENGTH = 1000;

/* -------------------------------------------------------------------
 *  Small helpers
 * ------------------------------------------------------------------- */

function getIndefiniteArticle(word: string): string {
  return /^[aeiou]/i.test(word.trim()) ? 'an' : 'a';
}

function formatListWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Replaces placeholders like [Character 1] and [Characters]
 */
function replaceCharacterPlaceholders(description: string, characters: Character[]): string {
  let updated = description;

  characters.forEach((char, index) => {
    updated = updated.replaceAll(`[Character ${index + 1}]`, char.name);
  });

  if (updated.includes('[Characters]')) {
    updated = updated.replaceAll('[Characters]', formatListWithAnd(characters.map((c) => c.name)));
  }

  return updated;
}

/**
 * Replaces placeholders like [Enemy 1] and [Enemies]
 */
function replaceEnemyPlaceholders(description: string, enemies: Enemy[]): string {
  let updated = description;

  enemies.forEach((enemy, index) => {
    updated = updated.replaceAll(`[Enemy ${index + 1}]`, enemy.title);
  });

  if (updated.includes('[Enemies]')) {
    let enemyText = '';

    if (enemies.length === 1) {
      const title = enemies[0].title;
      enemyText = `${getIndefiniteArticle(title)} ${title}`;
    } else {
      enemyText = formatListWithAnd(enemies.map((e) => e.title));
    }

    updated = updated.replaceAll('[Enemies]', enemyText);
  }

  return updated;
}

/**
 * Sanitizes user guidance input by removing control characters and limiting length.
 */
export function sanitizeGuidance(input: string): string {
  return input
    .replace(/\0/g, '')                    // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '') // other control chars
    .trim()
    .slice(0, MAX_GUIDANCE_LENGTH);
}

/* -------------------------------------------------------------------
 *  Section builders (pure-ish)
 * ------------------------------------------------------------------- */

export function buildCharactersSection(involvedCharacters: Character[]): string {
  const lines: string[] = [];
  lines.push(`[Characters]\n`);

  for (const char of involvedCharacters) {
    lines.push(`\n\n- ${char.name} (${char.title}):\n`);
    lines.push(`  - Description: ${char.description}\n`);
    lines.push(`  - History: ${char.history}\n`);
    lines.push(
      `  - Stats: Strength: ${char.stats.strength}, Agility: ${char.stats.agility}, Intelligence: ${char.stats.intelligence}, Authority: ${char.stats.authority}, Sociability: ${char.stats.sociability}\n`
    );
    lines.push(`  - Traits: ${char.traits.join(', ')}\n`);
    lines.push(`  - Status: ${char.status.description}\n`);

    lines.push(
      `  - Appearance: A ${char.appearance.height}, ${char.appearance.build} individual with ${char.appearance.skinTone} skin. ${char.appearance.hairStyle} ${char.appearance.hairColor} hair frames their ${char.appearance.features}.\n`
    );

    lines.push(
      `  - Clothing: Wears a ${char.clothing.body}, paired with ${char.clothing.legs}. On their head, they wear ${char.clothing.head}. Additional details include ${char.clothing.accessories}.\n`
    );

    lines.push(`  - Equipment: Carries ${char.equipment.join(', ')}.\n`);

    lines.push(
      `  - Combat: Fulfills the role of a ${char.combat.role}, excelling in ${char.combat.strengths.join(', ')}, but struggles with ${char.combat.weaknesses.join(', ')}.\n`
    );

    if (char.magic) lines.push(`  - Magic: ${char.magic}\n`);
    if (char.notes.length > 0) lines.push(`  - Notes: ${char.notes.join(', ')}\n`);
  }

  return lines.join('');
}

export function buildRelationshipSection(involvedCharacters: Character[]): string {
  const lines: string[] = [];
  lines.push(`\n[Relationships]\n`);

  for (const charA of involvedCharacters) {
    for (const charB of involvedCharacters) {
      if (charA.identifier === charB.identifier) continue;

      const rel = charA.relationships[charB.identifier];

      if (rel) {
        lines.push(
          `${charA.title} → ${charB.title} (Affinity: ${rel.affinity}, Dynamic: ${rel.dynamic})\n  Description: ${rel.description}\n\n`
        );
      } else {
        lines.push(
          `${charA.title} → ${charB.title} (Affinity: 3, Dynamic: Strangers)\n  Description: No meaningful interactions yet. Maintains distance and reservation, as survival here demands caution with everyone.\n\n`
        );
      }
    }
  }

  return lines.length ? lines.join('') : '';
}

export function buildLocationSection(estate: Estate, locations: LocationData[]): string {
  if (!locations?.length) return '';

  const primary = locations[0];
  const isPrimaryRestored = primary.restored && estate.restoredLocations?.includes(primary.identifier);
  const primaryDescription = isPrimaryRestored ? primary.restored : primary.description;

  const lines: string[] = [];
  lines.push(`[Location]\n`);
  lines.push(`Title: ${primary.title}\n`);
  lines.push(`Description: ${primaryDescription}\n\n`);

  if (locations.length > 1) {
    lines.push(`Surrounding Locations:\n`);
    for (let i = 1; i < locations.length; i++) {
      const loc = locations[i];
      const isRestored = loc.restored && estate.restoredLocations?.includes(loc.identifier);
      const desc = isRestored ? loc.restored : loc.description;
      lines.push(`- ${loc.title}: ${desc}\n`);
    }
  }

  lines.push('\n');
  return lines.join('');
}

export function buildNPCSection(npcs: NPC[]): string {
  if (!npcs.length) return '';

  const lines: string[] = [];
  lines.push(`[NPCs]\n`);

  for (const npc of npcs) {
    lines.push(`- ${npc.title} ${npc.name}\n`);
    lines.push(`  ${npc.description}\n`);
    lines.push(`  ${npc.history}\n`);

    const appearanceDetails = [npc.appearance.height, npc.appearance.build, npc.appearance.features]
      .filter(Boolean)
      .join(', ');
    lines.push(`  Appearance: ${appearanceDetails}\n`);

    const attire = [npc.clothing.head, npc.clothing.body, npc.clothing.legs, npc.clothing.accessories]
      .filter(Boolean)
      .join(', ');
    lines.push(`  Attire: ${attire}\n`);

    if (npc.traits.length > 0) {
      lines.push(`  Notable Traits: ${npc.traits.join(', ')}\n`);
    }

    lines.push('\n');
  }

  return lines.join('');
}

export function buildBystandersSection(
  estate: Estate,
  bystanders: Bystander[],
  chosenCharacterIds: string[]
): string {
  if (!bystanders.length) return '';

  const lines: string[] = [];
  lines.push(`[Bystanders]\n`);

  for (const { identifier: characterId, connectionType } of bystanders) {
    const char = estate.characters[characterId];
    if (!char) continue;

    const connectionText =
      connectionType === 'residence'
        ? 'Resides at the event location'
        : connectionType === 'workplace'
          ? 'Works at the event location'
          : connectionType === 'frequent'
            ? 'Frequents the event location'
            : 'Present at the event location';

    if (chosenCharacterIds.includes(characterId)) {
      lines.push(
        `- ${char.name} (${char.title}) - ${connectionText}\n  *** Main character in this event. See full description above. ***\n\n`
      );
      continue;
    }

    lines.push(`- ${char.name} (${char.title}) - ${connectionText}\n`);
    lines.push(`  ${char.description}\n`);

    if (char.traits.length > 0) {
      lines.push(`  Notable traits: ${char.traits.slice(0, 3).join(', ')}\n`);
    }

    lines.push(
      `  Appearance: ${char.appearance.height}, ${char.appearance.build}, ${char.appearance.skinTone} skin, ${char.appearance.hairStyle} ${char.appearance.hairColor} hair\n\n`
    );
  }

  return lines.join('');
}

export function buildEnemiesSection(enemies: Enemy[]): string {
  if (!enemies.length) return '';

  const lines: string[] = [];
  lines.push(`[Enemies]\n`);

  for (const enemy of enemies) {
    lines.push(`- ${enemy.title}\n`);
    lines.push(`  - ${enemy.description}\n`);
    lines.push(`  - ${enemy.history}\n`);

    lines.push(`  - Race/Gender/Religion: ${enemy.race}, ${enemy.gender}, ${enemy.religion}\n`);

    lines.push(
      `  - Stats: Strength: ${enemy.stats.strength}, Agility: ${enemy.stats.agility}, Intelligence: ${enemy.stats.intelligence}\n`
    );

    if (enemy.traits?.length) lines.push(`  - Traits: ${enemy.traits.join(', ')}\n`);
    if (enemy.equipment?.length) lines.push(`  - Equipment: ${enemy.equipment.join(', ')}\n`);

    lines.push(
      `  - Appearance: ${enemy.appearance.height}, ${enemy.appearance.build}, ${enemy.appearance.skinTone} skin, ${enemy.appearance.hairStyle} ${enemy.appearance.hairColor} hair, ${enemy.appearance.features}\n`
    );
    lines.push(
      `  - Clothing: Head: ${enemy.clothing.head}; Body: ${enemy.clothing.body}; Legs: ${enemy.clothing.legs}; Accessories: ${enemy.clothing.accessories}\n`
    );

    lines.push(
      `  - Combat: Role: ${enemy.combat.role}. Strengths: ${enemy.combat.strengths.join(', ')}. Weaknesses: ${enemy.combat.weaknesses.join(', ')}.\n`
    );
    if (enemy.magic) lines.push(`  - Magic: ${enemy.magic}\n`);

    lines.push(`\n`);
  }

  return lines.join('');
}

export function buildEventSection(event: EventData, involvedCharacters: Character[], enemies?: Enemy[]): string {
  let desc = replaceCharacterPlaceholders(event.description, involvedCharacters);
  if (enemies) desc = replaceEnemyPlaceholders(desc, enemies);

  return `[Event]
Title: "${event.title}"
Description: ${desc}

`;
}

export function buildLogsSection(logs: string[]): string {
  if (!logs || logs.length === 0) return '';

  const lines: string[] = [];
  lines.push(`[Recent Events]\n`);
  lines.push(
    `The following are notable past events involving the characters. ` +
    `They are provided for narrative continuity and context.\n\n`
  );

  for (const log of logs) {
    lines.push(`- ${log}\n`);
  }

  lines.push('\n');
  return lines.join('');
}

export function buildKeywordsSection(keywords: string[]): string {
  if (!keywords?.length) return '';
  return `[Keywords]\n${keywords.join(', ')}\n\n`;
}

export function buildRecruitKeywordsSection(keywords: string[]): string {
  if (!keywords?.length) return '';
  if (keywords.length == 1 && keywords[0].trim() === 'None') return '';
  
  return `  [Modifiers]
  -The file for the new character is a template and should be adapted based on the personality traits the user provides in this section.
  -Modify their personality, backstory, and or physical details to fit the keywords. Their equipment can not be changed.
  -Show the new character's quirks and personality through storytelling. This is your main task.
  \nUser-provided modifiers: ${keywords.join(', ')}\n\n`;
}

export function buildUserGuidanceSection(guidance?: string): string {
  if (!guidance) return '';

  const cleaned = sanitizeGuidance(guidance);
  if (!cleaned) return '';

  return (
    `[User Guidance]\n` +
    `The following is the player's custom request for how you should write/respond:\n` +
    `${cleaned}\n\n`
  );
}


// Add these to server/services/llm/buildPromptService.ts

/* -------------------------------------------------------------------
 *  Review prompt builders
 * ------------------------------------------------------------------- */

export function buildCharacterRosterSection(estate: Estate): string {
  const lines: string[] = [];

  for (const [id, char] of Object.entries(estate.characters)) {
    lines.push(`- ${char.title} (${id}), ${char.name}: ${char.summary}`);
  }

  return lines.length ? lines.join('\n') : 'No characters in the hamlet.';
}

export function buildNarrativesSection(estate: Estate): string {
  const narratives = estate.narratives;

  if (!narratives?.length) return 'No active narratives.';

  return narratives
    .map((narrative, i) => `${i + 1}. ${narrative}`)
    .join('\n\n');
}

function formatTimeAgo(currentMonth: number, currentDay: number, logMonth: number, logDay: number): string {
  const totalCurrentDays = currentMonth * 30 + currentDay;
  const totalLogDays = logMonth * 30 + logDay;
  const daysAgo = Math.max(0, totalCurrentDays - totalLogDays);
  
  const monthsAgo = Math.floor(daysAgo / 30);
  const remainingDays = daysAgo % 30;
  
  if (monthsAgo > 0 && remainingDays > 0) return `${monthsAgo} months, ${remainingDays} days ago`;
  if (monthsAgo > 0) return `${monthsAgo} months ago`;
  if (remainingDays > 0) return `${remainingDays} days ago`;
  return 'today';
}

export function buildAllLogsSection(estate: Estate): string {
  const sections: string[] = [];
  const { month: curMonth, day: curDay } = estate.time;

  if (estate.estateLogs?.length) {
    const lines = estate.estateLogs
      .map(log => `- ${formatTimeAgo(curMonth, curDay, log.month, log.day)}: ${log.entry}`);
    sections.push(`Estate Logs:\n${lines.join('\n')}`);
  }

  if (estate.characterLogs) {
    const charSections: string[] = [];

    for (const [charId, logs] of Object.entries(estate.characterLogs)) {
      if (!logs.length) continue;
      const char = estate.characters[charId];
      if (!char) continue;

      const logLines = logs.map(log => `  - ${formatTimeAgo(curMonth, curDay, log.month, log.day)}: ${log.entry}`);
      charSections.push(`${char.title} (${charId}):\n${logLines.join('\n')}`);
    }

    if (charSections.length) {
      sections.push(`Character Logs:\n${charSections.join('\n\n')}`);
    }
  }

  if (estate.relationshipLogs) {
    const relSections: string[] = [];

    for (const [charId, logs] of Object.entries(estate.relationshipLogs)) {
      if (!logs.length) continue;
      const char = estate.characters[charId];
      if (!char) continue;

      const logLines = logs.map(log => {
        const targetChar = estate.characters[log.target];
        const targetName = targetChar ? targetChar.title : log.target;
        return `  - ${formatTimeAgo(curMonth, curDay, log.month, log.day)} (with ${targetName}): ${log.entry}`;
      });
      relSections.push(`${char.title} (${charId}):\n${logLines.join('\n')}`);
    }

    if (relSections.length) {
      sections.push(`Relationship Logs:\n${relSections.join('\n\n')}`);
    }
  }

  return sections.length ? sections.join('\n\n') : 'No logs for this period.';
}

export function buildLocationSummarySection(): string {
  const gameData = StaticGameDataManager.getInstance();
  const allLocations = gameData.getAllLocations();
  const locationMap = gameData.getLocationMap();

  const TOWN_SCOPE_ROOT = "hamlet";

  const lines = allLocations
    .filter(loc => {
      if (!loc.summary) return false;
      if (loc.identifier === TOWN_SCOPE_ROOT) return false;
      if (loc.parent === TOWN_SCOPE_ROOT) return false;
      return isDescendantOf(loc.identifier, TOWN_SCOPE_ROOT, locationMap);
    })
    .map(loc => `- ${loc.summary}`);

  return lines.length ? lines.join('\n') : 'No locations available.';
}