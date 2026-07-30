// server/services/buildPromptService.ts
import type {
  Bystander,
  Character,
  ContentLevel,
  ContentTag,
  Enemy,
  Estate,
  EstatePreferences,
  EventData,
  LocationData,
  NPC,
} from '../../../shared/types/types.js';
import { CONTENT_TAGS } from '../../../shared/types/types.js';

import StaticGameDataManager from '../../staticGameDataManager.js';
import { isDescendantOf } from '../game/locationService.js';
import { getZodiacForMonth, formatTimeSinceEvent } from '../game/calendarService.js';
import { generateWeatherDescription, generateWeatherChangeDescription } from '../game/weatherService.js';

const MAX_USER_INPUT_LENGTH = 10000;

const CONTENT_LABELS: Record<ContentTag, string> = {
  gore: 'Excessive gore',
  nudity: 'Nudity',
  sexualContent: 'Sexual content',
  infidelity: 'Infidelity',
  animalHarm: 'Animal harm',
  romanceMM: 'Romance M/M',
  romanceFF: 'Romance F/F',
  romanceMF: 'Romance M/F',
};

const LEVEL_LABELS: Record<ContentLevel, string> = {
  forbidden: 'Forbidden',
  restricted: 'Restricted',
  permitted: 'Permitted',
  emphasized: 'Emphasized',
};

const PLANNING_NOTABLE = {
  MENTAL_BELOW: 50,
  PHYSICAL_BELOW: 25,
};

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
export function sanitizeUserInput(input: string): string {
  return input
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .slice(0, MAX_USER_INPUT_LENGTH);
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

/**
 * A dossier of the people at the planning meeting. Unlike buildCharactersSection,
 * this omits appearance, clothing, and combat detail: nobody is being depicted
 * here, only heard. What matters is how they speak, what they want, and what
 * state they walked in with.
 *
 * `roles` maps identifier -> the seat they hold ('Margrave', 'Bursar', 'Council').
 */
export function buildCharactersSectionPlanning(
  attendees: Character[],
  roles: Record<string, string> = {}
): string {
  if (!attendees.length) return 'No one attends the meeting.';
 
  const lines: string[] = [];
 
  for (const char of attendees) {
    const seat = roles[char.identifier] ? ` — ${roles[char.identifier]}` : '';
    lines.push(`\n- [${char.identifier}] ${char.name}, the ${char.title}${seat}\n`);
    lines.push(`  - Summary: ${char.summary}\n`);
    lines.push(`  - Traits: ${char.traits.join(', ')}\n`);
    lines.push(`  - Authority: ${char.stats.authority}, Sociability: ${char.stats.sociability}\n`);
 
    const condition: string[] = [`Health ${char.status.physical}`, `Resolve ${char.status.mental}`];
    if (char.status.affliction) condition.push(`Condition: ${char.status.affliction}`);
    if (char.status.wounds.length) condition.push(`Wounds: ${char.status.wounds.join('; ')}`);
    if (char.status.diseases.length) condition.push(`Diseases: ${char.status.diseases.join('; ')}`);
 
    lines.push(`  - State: ${char.status.description} (${condition.join(', ')})\n`);
 
    if (char.notes.length) {
      lines.push(`  - Manner: ${char.notes.join(' ')}\n`);
    }
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

/**
 * Everyone in the Hamlet who is NOT at the meeting. These are the people being
 * discussed. Condition is only listed when it is notable — an unlisted hero is
 * fit and unremarkable, which keeps the troubled ones visible in a long roster.
 */
export function buildAbsentRosterSection(estate: Estate, attendeeIds: string[]): string {
  const present = new Set(attendeeIds);
  const absent = Object.values(estate.characters).filter(c => !present.has(c.identifier));
 
  if (!absent.length) return 'Every member of the Hamlet is present at the meeting.';
 
  const lines: string[] = [];
  lines.push(
    'Only heroes in poor condition have their state listed. Any hero without one is hale and untroubled.\n'
  );
 
  for (const char of absent) {
    lines.push(`\n- [${char.identifier}] ${char.name}, the ${char.title}: ${char.summary}`);
 
    const flags: string[] = [];
    const hurt =
      char.status.mental < PLANNING_NOTABLE.MENTAL_BELOW ||
      char.status.physical < PLANNING_NOTABLE.PHYSICAL_BELOW;
 
    if (hurt) flags.push(`Health ${char.status.physical}, Resolve ${char.status.mental}`);
    if (char.status.affliction) flags.push(`Condition: ${char.status.affliction}`);
    if (char.status.wounds.length) flags.push(`Wounds: ${char.status.wounds.join('; ')}`);
    if (char.status.diseases.length) flags.push(`Diseases: ${char.status.diseases.join('; ')}`);
 
    if (flags.length) {
      lines.push(`\n  - State: ${char.status.description} (${flags.join(', ')})`);
    }
  }
 
  return lines.join('') + '\n';
}

export function buildLocationSection(
  estate: Estate,
  locations: LocationData[],
  mainLocationIds: string[] = []
): string {
  if (!locations?.length) return '';

  const descFor = (loc: LocationData) =>
    loc.restored && estate.restoredLocations?.includes(loc.identifier)
      ? loc.restored
      : loc.description;

  // Fall back to "first location is the main one" if no ids are supplied,
  // so any existing callers keep working unchanged.
  const mainIds = new Set(mainLocationIds.length ? mainLocationIds : [locations[0].identifier]);

  const mains = locations.filter(l => mainIds.has(l.identifier));
  const surrounding = locations.filter(l => !mainIds.has(l.identifier));

  const lines: string[] = [`[Location]\n`];

  if (mains.length > 1) {
    lines.push(`This scene unfolds across ${mains.length} locations at once — cut between them.\n\n`);
    mains.forEach((loc, i) => {
      lines.push(`Main Location ${i + 1}: ${loc.title}\n`);
      lines.push(`Description: ${descFor(loc)}\n\n`);
    });
  } else {
    lines.push(`Title: ${mains[0].title}\n`);
    lines.push(`Description: ${descFor(mains[0])}\n\n`);
  }

  if (surrounding.length) {
    lines.push(`Surrounding Locations:\n`);
    for (const loc of surrounding) {
      lines.push(`- ${loc.title}: ${descFor(loc)}\n`);
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
  const cleaned = sanitizeUserInput(guidance);
  if (!cleaned) return '';
  return (
    `[User Guidance]\n` +
    `The following is the player's custom request for how you should write/respond:\n` +
    `${cleaned}\n\n`
  );
}

export function buildContentPreferencesSection(prefs?: EstatePreferences): string {
  if (!prefs?.content) return '';
  const lines = CONTENT_TAGS.map(
    (tag) => `${CONTENT_LABELS[tag]}: ${LEVEL_LABELS[prefs.content![tag] ?? 'permitted']}`
  );
  return `[Content Preferences]\n${lines.join('\n')}\n\n`;
}

export function buildUserInputSection(context?: string, description?: string): string {
  const parts: string[] = [];

  if (context) {
    parts.push(
      `[Event Information]\n` +
      `The following is additional information specific to this type of event:\n` +
      `${sanitizeUserInput(context)}\n`
    );
  }

  if (description) {
    parts.push(
      `[Player Description]\n` +
      `The following is the player's account of what happened or how they want the scene to unfold. ` +
      `Use it as the basis for your narration, but maintain character consistency and tone.\n` +
      `${sanitizeUserInput(description)}\n`
    );
  }

  if (parts.length === 0) return '';
  return parts.join('\n') + '\n';
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

export function buildLeadershipSection(estate: Estate): string {
  const lines: string[] = [];

  const roles = ['margrave', 'bursar'] as const;
  const roleDescriptions: Record<string, string> = {
    margrave: 'Commander of the estate\'s military efforts. Decides expedition rosters, marching orders, and tactical priorities. First authority in any crisis.',
    bursar: 'Manager of the estate\'s finances. Decides pay, compensation, and how much of the expedition spoils the hamlet keeps.',
  };
  
  lines.push(estate.leadership.description);
  lines.push('');

  for (const roleId of roles) {
    const holderId = estate.leadership[roleId];
    const holder = estate.characters[holderId];
    const holderName = holder ? `${holder.title} (${holderId})` : holderId;
    const title = roleId.charAt(0).toUpperCase() + roleId.slice(1);

    lines.push(`${title}: ${holderName}`);
    lines.push(`  ${roleDescriptions[roleId]}`);
  }

  if (estate.leadership.council?.length) {
    const councilNames = estate.leadership.council
      .map(id => {
        const char = estate.characters[id];
        return char ? `${char.title} (${id})` : id;
      });
    lines.push(`Council: ${councilNames.join(', ')}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Compiles the full context prompt for the LLM from pre-loaded data.
 */
export function compileNarrativeContext(estate: Estate, gameData: StaticGameDataManager): string {
  
  const zodiac = getZodiacForMonth(estate.time.month);

  // Weather descriptions
  const weatherDesc = generateWeatherDescription(estate.weather.current);
  const weatherChange = generateWeatherChangeDescription(estate.weather.previous, estate.weather.current);
  const timeFrame = estate.time.beat === 0 ? 'Since yesterday, ' : 'Since the last story, ';
  const dayOpener = estate.time.beat === 0 ? 'This is the first event of the day, set the stage with the season, weather, and location.' : '';

  const backstory = gameData.getPrompt('game.backstory').replaceAll('${estateName}', estate.name);

  // Use a simple template literal with placeholders
  return `
    [Instructions]
${gameData.getPrompt('story.instructions')}

    [Context]
${backstory}

NARRATOR'S ROLE:
You are the malevolent ghost of Pandoros ${estate.name}, the Ancestor, now bound to the Heart of Darkness. You narrate the Descendants' seemingly hopeless quest to cleanse the Estate, knowing that their efforts may unwittingly serve your own dark purpose.

PRESENT DAY:
It is the month of ${zodiac.name}. ${zodiac.text}
The current weather is ${weatherDesc}. ${weatherChange ? timeFrame + weatherChange : ''}.
${dayOpener}
${formatTimeSinceEvent(estate.time.month + 1)} have passed since the Ancestor's suicide and monsters assailed the Hamlet. 

    
  `;

}

export function compileRecruitContext(estate: Estate, gameData: StaticGameDataManager, recruitTitle?: string): string {
  
  const zodiac = getZodiacForMonth(estate.time.month);
  const backstory = gameData.getPrompt('game.backstory').replaceAll('${estateName}', estate.name);
  const title = recruitTitle || '${characterTitle}';

  // Use a simple template literal with placeholders
  return `
    [Instructions]
${gameData.getPrompt('recruit.instructions')}

    [Context]
${backstory}

NARRATOR'S ROLE:
You are the ${title}. Narrate this scene from your first-person, present-time perspective, revealing your internal thoughts, impressions, and judgments as the event unfolds. Speak and think as ${title} would.

PRESENT DAY:
It is the month of ${zodiac.name}. ${zodiac.text}
${formatTimeSinceEvent(estate.time.month)} have passed since the Heir and Heiress begun the quest to reclaim the Estate.

    
  `;

}

/**
 * Context header for the planning meeting. Mirrors compileNarrativeContext, but
 * pulls the planning instructions and backstory, and frames the passage of time
 * around the meeting itself rather than a story beat.
 */
export function compilePlanningContext(estate: Estate, gameData: StaticGameDataManager): string {
  const zodiac = getZodiacForMonth(estate.time.month);
 
  const weatherDesc = generateWeatherDescription(estate.weather.current);
  const weatherChange = generateWeatherChangeDescription(estate.weather.previous, estate.weather.current);
 
  const backstory = gameData.getPrompt('game.backstory').replaceAll('${estateName}', estate.name);

  const rosterSize = Object.keys(estate.characters).length;
  const maxTeams = Math.max(1, Math.floor(rosterSize / 4));
  const minTeams = 1;
  
  return `
    [Instructions]
${gameData.getPrompt('planning.instructions')}
 
    [Context]
${backstory}

NARRATOR'S ROLE:
You are writing a scene of pure dialogue. There is no narrator and no prose. Everything the reader learns comes from what these people say to one another.
 
PRESENT DAY:
It is the month of ${zodiac.name}. ${zodiac.text}
The current weather is ${weatherDesc}. ${weatherChange ? 'Since last month, ' + weatherChange : ''}.
${formatTimeSinceEvent(estate.time.month)} have passed since the Heir and Heiress begun the quest to reclaim the Estate.
The month has just turned, and the leadership has gathered as it does at the start of every month.
Between ${minTeams} and ${maxTeams} teams of four will be sent out this month.
 
  `;
 
}
