import { loadEstate } from '../fileOps';
import { Estate, EventData, LocationData, Bystander, Enemy } from '../../shared/types/types';
import { pickEventLocation } from './locationService';
import StaticGameDataManager from '../staticGameDataManager.js';

export interface SetupEventOptions {
  eventId?: string;
  characterIds?: string[];
  enemyIds?: string[];
  description?: string; // Currently unused, but prepared for future usage
}

export interface ResolvedCharacters {
  chosenCharacterIds: string[];
  overflowCharacterIds: string[]; // only from user input that was truncated
}

/**
 * Removes duplicate IDs from an array while preserving the original order.
 * @param ids - Array of string IDs, possibly with duplicates
 * @returns New array with duplicates removed, original order preserved
 */
function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of ids) {
    // Trim whitespace
    const id = raw.trim();

    // Ignore empty strings
    if (!id) continue;

    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
}

function validateEnemyIds(enemyIds: string[]): void {
  const gameData = StaticGameDataManager.getInstance();
  if (enemyIds.length === 0) return;

  const missing = enemyIds.filter((id) => !gameData.getEnemyById(id));
  if (missing.length > 0) {
    throw new Error(`Enemy IDs not found in game data: ${missing.join(', ')}`);
  }
}

/**
 * Extracts the number of characters range from an event.
 */
function getNrCharsRange(event: EventData): [number, number] {
  return (Array.isArray(event.characterCount) && event.characterCount.length === 2)
    ? [event.characterCount[0], event.characterCount[1]]
    : [1, 4];
}

/**
 * Resolves which event template to use.
 * If eventId is provided, looks it up. Otherwise, picks random.
 */
function resolveEvent(options: SetupEventOptions): EventData {
  const gameData = StaticGameDataManager.getInstance();
  
  const requestedCount = options.characterIds?.length ?? 0;
  const filterCount = Math.min(requestedCount, 4);
  
  // 1. Specific Event Requested
  if (options.eventId) {
    const event = gameData.getEventById(options.eventId);
    if (!event) {
      throw new Error(`Requested event '${options.eventId}' not found in game data.`);
    }
    console.log(`Using specific event: ${event.identifier}`);
    return event;
  }

  // 2. Random Selection
  const townEvents = gameData.getTownEvents();
  let eventIds = Object.keys(townEvents);
  if (eventIds.length === 0) {
    throw new Error('No event templates found in data/events.');
  }

  // Filter by Compatibility with Requested Character Count
  if (requestedCount > 0) {
    const compatible = eventIds.filter((id) => {
      const ev = townEvents[id];
      const [, maxAllowed] = getNrCharsRange(ev);
      return maxAllowed >= filterCount;
    });

    // If no events that support the requested count of characters was found, throw error
    if (compatible.length === 0) {
      throw new Error(
        `No compatible town events found for requested character count ${filterCount}.`
      );
    }

    eventIds = compatible;
  }


  const randomId = eventIds[Math.floor(Math.random() * eventIds.length)];
  console.log(`Picked random event: ${townEvents[randomId].identifier}`);
  return townEvents[randomId];
}

/**
 * Resolves participants.
 * 1. Starts with specific IDs provided by the user.
 * 2. Calculates a random target size based on the event range [min, max].
 * 3. Fills remaining slots with random characters from the estate.
 */
function resolveCharacters(
  estate: Estate,
  event: EventData,
  options: SetupEventOptions
): ResolvedCharacters {
  const allEstateCharIds = Object.keys(estate.characters);
  
  // 1. Determine Event Range
  const nrCharsRange = getNrCharsRange(event);

  const minRequired = nrCharsRange[0];
  const maxAllowed = nrCharsRange[1];

  // 2. Start with User Selections
  let selected: string[] = [];
  let overflowCharacterIds: string[] = [];
  
  if (options.characterIds && options.characterIds.length > 0) {
    // Validate they exist
    const missing = options.characterIds.filter(id => !allEstateCharIds.includes(id));
    if (missing.length > 0) {
      throw new Error(`Requested character IDs not found in estate: ${missing.join(', ')}`);
    }
    selected = [...options.characterIds];
  }

  // 3. Truncate if User provided too many for this specific event
  if (selected.length > maxAllowed) {
    overflowCharacterIds = selected.slice(maxAllowed);   // capture extras
    selected = selected.slice(0, maxAllowed);            // keep participants
  }

  // 4. Determine Target Count
  let targetCount = Math.floor(
    Math.random() * (maxAllowed - minRequired + 1)
  ) + minRequired;

  // Ensure target count isn't smaller than what the user explicitly asked for
  // (e.g. range 1-4, user provided 3, random rolled 2 -> force it to 3)
  if (selected.length > targetCount) {
    targetCount = selected.length;
  }

  // 5. Fill with Random Characters
  const needed = targetCount - selected.length;

  if (needed > 0) {
    // Filter out characters already selected
    const pool = allEstateCharIds.filter(id => !selected.includes(id));

    if (pool.length < needed) {
      throw new Error(`Not enough spare characters in estate to fill event. Needed ${needed}, have ${pool.length}.`);
    }

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Add the top N from the pool
    const fillers = pool.slice(0, needed);
    selected = [...selected, ...fillers];
  }

  return { chosenCharacterIds: selected, overflowCharacterIds };
}

/**
 * Combines event and town keywords.
 */
export function pickKeywords(
  eventKeywords: string[],
  townKeywords: string[]
): string[] {
  const combined = Array.from(new Set([...eventKeywords, ...townKeywords]));
  
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  
  let chosen = combined.slice(0, 4);
  
  const eventKeywordsSet = new Set(eventKeywords);
  if (eventKeywords.length > 0) {
    const hasEventKeyword = chosen.some((kw) => eventKeywordsSet.has(kw));
    if (!hasEventKeyword) {
      const randomEventKeyword =
      eventKeywords[Math.floor(Math.random() * eventKeywords.length)];
      chosen[chosen.length - 1] = randomEventKeyword;
    }
  }
  
  return chosen;
}

/**
 * Main Orchestrator
 */
export async function setupEvent(
  estateName: string, 
  options: SetupEventOptions = {}
): Promise<{
  event: EventData;
  chosenCharacterIds: string[];
  locations: LocationData[];
  npcs: string[];
  enemies: string[];
  bystanders: Bystander[];
}> {
  const gameData = StaticGameDataManager.getInstance();

  // Dedup characterIds (order-preserving)
  const dedupedCharacterIds = options.characterIds
    ? dedupePreserveOrder(options.characterIds)
    : undefined;

  const userEnemyIds = options.enemyIds
    ? dedupePreserveOrder(options.enemyIds)
    : [];

  const normalizedOptions: SetupEventOptions = {
    ...options,
    characterIds: dedupedCharacterIds
  };

  // 1. Load Estate
  const estate = await loadEstate(estateName);
  if (!estate) {
    throw new Error(`Estate '${estateName}' not found`);
  }

  // 2. Resolve Event (Specific or Random)
  const template = resolveEvent(normalizedOptions);

  // Clone to avoid mutating shared data
  const event: EventData = typeof structuredClone === 'function'
    ? structuredClone(template)
    : JSON.parse(JSON.stringify(template));

  // 2a. Validate Enemy IDs if provided
  const eventEnemyIds = Array.isArray(event.enemies)
    ? dedupePreserveOrder(event.enemies)
    : [];

    const enemies = eventEnemyIds.length > 0 ? eventEnemyIds : userEnemyIds;

  validateEnemyIds(enemies);
  
  // 3. Resolve Keywords
  const townKeywords = gameData.getTownKeywords();
  event.keywords = pickKeywords(event.keywords || [], townKeywords);

  // 4. Resolve Characters (Specific or Random)
  const { chosenCharacterIds, overflowCharacterIds } =
  resolveCharacters(estate, event, normalizedOptions);

  // 5. Resolve Location & Context
  let locations: LocationData[] = [];
  let npcs: string[] = [];
  let bystanders: Bystander[] = [];

  if (event.location) {
    const result = await pickEventLocation(
      event,
      chosenCharacterIds.map((id) => estate.characters[id]),
      overflowCharacterIds.map((id) => estate.characters[id]),
      estate
    );

    locations = result.locations;
    npcs = result.npcs;
    bystanders = result.bystanders;
  }

  return { event, chosenCharacterIds, locations, npcs, enemies, bystanders };
}