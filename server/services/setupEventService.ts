import { loadEstate } from '../fileOps';
import { Estate, EventData, LocationData } from '../../shared/types/types';
import { pickEventLocation } from './locationService';
import StaticGameDataManager from '../staticGameDataManager.js';

export interface SetupEventOptions {
  characterIds?: string[];
  eventId?: string;
  description?: string; // Currently unused, but prepared for future usage
}

/**
 * Resolves which event template to use.
 * If eventId is provided, looks it up. Otherwise, picks random.
 */
function resolveEvent(options: SetupEventOptions): EventData {
  const gameData = StaticGameDataManager.getInstance();
  const allEvents = gameData.getTownEvents();

  // 1. Specific Event Requested
  if (options.eventId) {
    const event = allEvents[options.eventId];
    if (!event) {
      throw new Error(`Requested event '${options.eventId}' not found in game data.`);
    }
    console.log(`Using specific event: ${event.identifier}`);
    return event;
  }

  // 2. Random Selection
  const eventIds = Object.keys(allEvents);
  if (eventIds.length === 0) {
    throw new Error('No event templates found in data/events.');
  }
  const randomId = eventIds[Math.floor(Math.random() * eventIds.length)];
  console.log(`Picked random event: ${allEvents[randomId].identifier}`);
  return allEvents[randomId];
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
): string[] {
  const allEstateCharIds = Object.keys(estate.characters);
  
  // 1. Determine Event Range
  const nrCharsRange: [number, number] = 
    (Array.isArray(event.nrChars) && event.nrChars.length === 2) 
      ? [event.nrChars[0], event.nrChars[1]] 
      : [1, 4];

  const minRequired = nrCharsRange[0];
  const maxAllowed = nrCharsRange[1];

  // 2. Start with User Selections
  let selected: string[] = [];
  
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
    console.warn(`Provided ${selected.length} characters, but event max is ${maxAllowed}. Truncating.`);
    selected = selected.slice(0, maxAllowed);
  }

  // 4. Determine Target Count
  // We pick a random number between min and max.
  // However, if the user specifically provided a valid number of people 
  // (e.g. range is 2-4, user provided 3), we should probably stick to 3 
  // OR we can still try to fill to 4?
  // Let's stick to the "Fill to Random Target" strategy.
  
  // Pick random size within range
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

  return selected;
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
  bystanders: Array<{characterId: string, connectionType: 'residence' | 'workplace' | 'frequent'}>;
}> {
  const gameData = StaticGameDataManager.getInstance();

  // 1. Load Estate
  const estate = await loadEstate(estateName);
  if (!estate) {
    throw new Error(`Estate '${estateName}' not found`);
  }

  // 2. Resolve Event (Specific or Random)
  const template = resolveEvent(options);

  // Clone to avoid mutating shared data
  const event: EventData = typeof structuredClone === 'function'
    ? structuredClone(template)
    : JSON.parse(JSON.stringify(template));

  // 3. Resolve Keywords
  const townKeywords = gameData.getTownKeywords();
  event.keywords = pickKeywords(event.keywords || [], townKeywords);

  // 4. Resolve Characters (Specific or Random)
  const chosenCharacterIds = resolveCharacters(estate, event, options);

  // 5. Resolve Location & Context
  let locations: LocationData[] = [];
  let npcs: string[] = [];
  let bystanders: Array<{characterId: string, connectionType: 'residence' | 'workplace' | 'frequent'}> = [];
  
  if (event.location) {
    const result = await pickEventLocation(
      event,
      chosenCharacterIds.map((id) => estate.characters[id]),
      estate
    );
    locations = result.locations;
    npcs = result.npcs;
    bystanders = result.bystanders;
  }

  return { event, chosenCharacterIds, locations, npcs, bystanders };
}