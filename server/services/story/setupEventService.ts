// server/services/setupEventService.ts
import StaticGameDataManager from '../../staticGameDataManager.js';
import { pickEventLocation } from '../game/locationService.js';
import { EVENTS_DIR } from '../../paths.js';

import type { Estate, EventData, EventLocationRequirements, LocationData, Bystander, FollowUpEvent } from '../../../shared/types/types';

// Constants
const MAX_SCENE_NPCS = 6;

// Module types
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

/* -------------------------------------------------------------------
 *  Helpers
 * ------------------------------------------------------------------- */

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

function validateNpcIds(npcIds: string[]): void {
  const gameData = StaticGameDataManager.getInstance();
  if (npcIds.length === 0) return;

  const missing = npcIds.filter((id) => !gameData.getNPCById(id));
  if (missing.length > 0) {
    throw new Error(`NPC IDs not found in game data: ${missing.join(', ')}`);
  }
}

function pickRandomSubset<T>(items: T[], count: number): T[] {
  if (count <= 0 || items.length === 0) return [];

  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy.slice(0, Math.min(count, copy.length));
}

function getRequiredCharacterIdsFromRoles(estate: Estate, event: EventData): string[] {
  const requiredRoles = Array.isArray(event.roles) ? event.roles : [];
  if (requiredRoles.length === 0) return [];

  const ids: string[] = [];

  for (const role of requiredRoles) {
    const value = (estate.leadership as any)[role];

    if (!value) {
      throw new Error(`Event '${event.identifier}' requires role '${role}', but estate.leadership.${role} is missing.`);
    }

    if (Array.isArray(value)) {
      // e.g. council: string[]
      ids.push(...value);
    } else if (typeof value === 'string') {
      ids.push(value);
    } else {
      throw new Error(`Estate role '${role}' has unexpected type.`);
    }
  }

  return dedupePreserveOrder(ids);
}

/* -------------------------------------------------------------------
 *  Resolvers
 * ------------------------------------------------------------------- */

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
  const townEvents = gameData.getEventsByCategory('town');
  let eventIds = Object.keys(townEvents);
  if (eventIds.length === 0) {
    throw new Error(`No event templates found in ${EVENTS_DIR}.`);
  }

  // Filter by Compatibility with Requested Character Count
  if (requestedCount > 0) {
    const compatible = eventIds.filter((id) => {
      const ev = townEvents[id];
      const [, maxAllowed] = ev.characterCount;
      return maxAllowed >= filterCount;
    });

    if (compatible.length === 0) {
      throw new Error(`No compatible town events found for requested character count ${filterCount}.`);
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

  // If event doesn't specify characterCount, just use user input (if any) without random filling
  if (!event.characterCount?.length) {
    const ids = options.characterIds ?? [];
    if (ids.length === 0) {
      throw new Error(`Event '${event.identifier}' has no characterCount and no characters were provided.`);
    }
    return { chosenCharacterIds: ids, overflowCharacterIds: [] };
  }

  const allEstateCharIds = Object.keys(estate.characters);

  // 1. Determine Event Range
  const [minRequired, maxAllowed] = event.characterCount;

  const requiredByRoleIds = getRequiredCharacterIdsFromRoles(estate, event);

  // 2. Start with User Selections
  let selected: string[] = [...requiredByRoleIds];
  let overflowCharacterIds: string[] = [];

  // If roles already exceed max, overflow extras
  if (selected.length > maxAllowed) {
    overflowCharacterIds = selected.slice(maxAllowed);
    selected = selected.slice(0, maxAllowed);
  }

  // 3. Add user selections (if any)
  if (options.characterIds && options.characterIds.length > 0) {
    // Validate they exist
    const missing = options.characterIds.filter((id) => !allEstateCharIds.includes(id));
    if (missing.length > 0) {
      throw new Error(`Requested character IDs not found in estate: ${missing.join(', ')}`);
    }

    // Add user IDs after required, preserving order and avoiding duplicates
    selected = dedupePreserveOrder([...selected, ...options.characterIds]);
  }

   // 4. Truncate if too many for this specific event
  if (selected.length > maxAllowed) {
    const extras = selected.slice(maxAllowed);
    overflowCharacterIds = dedupePreserveOrder([...overflowCharacterIds, ...extras]);
    selected = selected.slice(0, maxAllowed);
  }

  // 5. Determine finalCharacterCount
  let finalCharacterCount =
    Math.floor(Math.random() * (maxAllowed - minRequired + 1)) + minRequired;

  // Ensure finalCharacterCount isn't smaller than what the user explicitly asked for
  if (selected.length > finalCharacterCount) {
    finalCharacterCount = selected.length;
  }

  // 6. Fill with Random Characters
  const remainingSlots = finalCharacterCount - selected.length;

  if (remainingSlots > 0) {
    // Filter out characters already selected
    const pool = allEstateCharIds.filter((id) => !selected.includes(id));

    if (pool.length < remainingSlots) {
      throw new Error(
        `Not enough spare characters in estate to fill event. Needed ${remainingSlots}, have ${pool.length}.`
      );
    }

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Add the top N from the pool
    const fillers = pool.slice(0, remainingSlots);
    selected = [...selected, ...fillers];
  }

  return { chosenCharacterIds: selected, overflowCharacterIds };
}

/**
 * NPC priority:
 * 1) event.npcs (never trimmed unless they exceed MAX)
 * 2) location NPCs
 * 3) random NPCs from ALL town NPCs (excluding already chosen)
 */
function resolveEventNpcs(params: {
  eventNpcIds: string[];
  locationNpcIds: string[];
  randomCount: number;
  townNpcPoolIds: string[];
}): string[] {
  const { eventNpcIds, locationNpcIds, randomCount, townNpcPoolIds } = params;

  const eventNpcs = dedupePreserveOrder(eventNpcIds);
  if (eventNpcs.length > MAX_SCENE_NPCS) {
    throw new Error(
      `Event specifies ${eventNpcs.length} NPCs, which exceeds MAX_SCENE_NPCS (${MAX_SCENE_NPCS}).`
    );
  }

  // 1) Event NPCs first
  let final = [...eventNpcs];

  // 2) Add location NPCs next (up to cap)
  const locationNpcs = dedupePreserveOrder(locationNpcIds).filter((id) => !final.includes(id));
  const slotsAfterEvent = MAX_SCENE_NPCS - final.length;
  if (slotsAfterEvent > 0) {
    final = [...final, ...locationNpcs.slice(0, slotsAfterEvent)];
  }

  // 3) Random from ALL town NPCs (excluding already chosen)
  const slotsAfterLocation = MAX_SCENE_NPCS - final.length;
  const randomSlots = Math.min(Math.max(0, randomCount), slotsAfterLocation);
  if (randomSlots > 0) {
    const pool = dedupePreserveOrder(townNpcPoolIds).filter((id) => !final.includes(id));
    const randomPicks = pickRandomSubset(pool, randomSlots);
    final = [...final, ...randomPicks];
  }

  // Validate final NPC IDs
  validateNpcIds(final);

  return final;
}

/**
 * Combines event and town keywords.
 */
export function pickKeywords(eventKeywords: string[], townKeywords: string[]): string[] {

  // If event has no keywords, don't pick anything
  if (eventKeywords.length === 0)
    return [];

  // Create weighted pool: event keywords appear 3x each
  const weightedPool: string[] = [
    ...eventKeywords,
    ...eventKeywords,
    ...eventKeywords, // Event keywords 3x more likely
    ...townKeywords
  ];

  // Remove duplicates while preserving weight effect
  const combined = Array.from(new Set(weightedPool));

  // Shuffle
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  // Take first 4 unique keywords
  const chosen: string[] = [];
  const seen = new Set<string>();

  for (const kw of combined) {
    if (!seen.has(kw)) {
      chosen.push(kw);
      seen.add(kw);
      if (chosen.length === 4) break;
    }
  }

  // Still guarantee at least one event keyword
  const eventKeywordsSet = new Set(eventKeywords);
  const hasEventKeyword = chosen.some((kw) => eventKeywordsSet.has(kw));
  if (!hasEventKeyword && eventKeywords.length > 0) {
    const randomEventKeyword = eventKeywords[Math.floor(Math.random() * eventKeywords.length)];
    chosen[chosen.length - 1] = randomEventKeyword;
  }

  return chosen;
}

/* -------------------------------------------------------------------
 *  Main orchestrator
 * ------------------------------------------------------------------- */

export async function setupEvent(
  estate: Estate,
  options: SetupEventOptions = {}
): Promise<{
  event: EventData;                 // template, unmodified
  chosenCharacterIds: string[];
  locations: LocationData[];
  npcs: string[];
  enemies: string[];
  bystanders: Bystander[];
  keywords: string[];
}> {
  const gameData = StaticGameDataManager.getInstance();

  const dedupedCharacterIds = options.characterIds
    ? dedupePreserveOrder(options.characterIds)
    : undefined;

  const userEnemyIds = options.enemyIds ? dedupePreserveOrder(options.enemyIds) : [];

  const normalizedOptions: SetupEventOptions = {
    ...options,
    characterIds: dedupedCharacterIds,
  };

  // 2. Resolve Event Template (Specific or Random)
  const event = resolveEvent(normalizedOptions); // <-- NO CLONE, NO MUTATION

  // 2a. Enemies (already separate)
  const eventEnemyIds = Array.isArray(event.enemies)
    ? dedupePreserveOrder(event.enemies)
    : [];

  const enemies = eventEnemyIds.length > 0 ? eventEnemyIds : userEnemyIds;
  validateEnemyIds(enemies);

  // 3. Resolve Keywords
  const keywords = pickKeywords(event.keywords || [], gameData.getTownKeywords());

  // 4. Resolve Characters
  const { chosenCharacterIds, overflowCharacterIds } =
    resolveCharacters(estate, event, normalizedOptions);

  // 5. Resolve Location + NPCs + Bystanders
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
    bystanders = result.bystanders;

    const eventNpcIds = Array.isArray(event.npcs) ? dedupePreserveOrder(event.npcs) : [];
    const locationNpcIds = Array.isArray(result.npcs) ? dedupePreserveOrder(result.npcs) : [];
    const randomCount = Number.isInteger(event.randomNPCs) ? Math.max(0, event.randomNPCs!) : 0;

    const townNpcPoolIds = Object.keys(gameData.getNPCsByCategory('town'));

    npcs = resolveEventNpcs({
      eventNpcIds,
      locationNpcIds,
      randomCount,
      townNpcPoolIds
    });
  }

  return { event, chosenCharacterIds, locations, npcs, enemies, bystanders, keywords };
}

/* -------------------------------------------------------------------
 *  Follow-up events
 * ------------------------------------------------------------------- */

/**
 * Translates a follow-up's single `location` field into the EventLocationRequirements
 * that pickEventLocation expects.
 * - A named location is seeded as the sole default candidate, so it's picked as-is.
 * - "any" lets the participants' own residences/workplaces/haunts drive the pick;
 *   shared spots score highest. Characters always receive locations at creation, so
 *   the score map can't come back empty — no allowAll backstop needed.
 */
function buildFollowUpLocation(followUp: FollowUpEvent): EventLocationRequirements {
  if (followUp.location && followUp.location !== 'any') {
    return { default: [followUp.location], residence: [], workplaces: [], frequents: [] };
  }

  const allIndices = followUp.characters.map((_, i) => i + 1);
  return { default: [], residence: allIndices, workplaces: allIndices, frequents: allIndices };
}

/**
 * Wraps a follow-up in a minimal synthetic EventData. compileStoryPrompt is typed on
 * EventData and reads title/description, so this is the bridge. characterCount pins to
 * the exact participant count (no fill), and there are no keywords/enemies/roles.
 */
function buildFollowUpEventData(followUp: FollowUpEvent): EventData {
  const count = followUp.characters.length;
  const slug = followUp.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  return {
    identifier: `followup__${slug || 'untitled'}`,
    title: followUp.title,
    type: 'town',
    description: followUp.description,
    characterCount: [count, count],
    keywords: [],
    location: buildFollowUpLocation(followUp),
  };
}

/**
 * setupFollowUpEvent
 * Sibling to setupEvent for a fully-specified follow-up. Skips event/character
 * resolution (both are already decided) and reuses pickEventLocation for the
 * location, bystanders, and surrounding NPCs. Returns the same shape as setupEvent
 * so the route and compileStoryPrompt downstream are unchanged.
 */
export async function setupFollowUpEvent(
  estate: Estate,
  followUp: FollowUpEvent
): Promise<{
  event: EventData;
  chosenCharacterIds: string[];
  locations: LocationData[];
  npcs: string[];
  enemies: string[];
  bystanders: Bystander[];
  keywords: string[];
}> {
  const chosenCharacterIds = [...followUp.characters];

  // takeFollowUpEvent prunes follow-ups with missing characters before this is
  // ever called, but guard anyway since this is exported.
  const missing = chosenCharacterIds.filter((id) => !estate.characters[id]);
  if (missing.length > 0) {
    throw new Error(`Follow-up "${followUp.title}" references missing characters: ${missing.join(', ')}`);
  }

  const event = buildFollowUpEventData(followUp);
  const characters = chosenCharacterIds.map((id) => estate.characters[id]);

  const { locations, npcs, bystanders } = await pickEventLocation(
    event,
    characters,
    [], // no overflow for follow-ups
    estate
  );

  return {
    event,
    chosenCharacterIds,
    locations,
    npcs: npcs.slice(0, MAX_SCENE_NPCS),
    enemies: [],
    bystanders,
    keywords: [],
  };
}