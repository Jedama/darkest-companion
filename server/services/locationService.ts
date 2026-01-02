import { Estate, Character, EventData, LocationData, Bystander } from '../../shared/types/types';
import StaticGameDataManager from '../staticGameDataManager.js';

const TOWN_SCOPE_ROOT = "hamlet";
const STOP_ROOTS = new Set(["hamlet", "estate", "kingdom"]);

interface ProcessedLocation {
  baseScore: number;
  sharedCount: number;
}

/**
 * In-place Fisher–Yates shuffle to randomize an array.
 */
function shuffleInPlace<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Determines the type of connection a character has to a specific location.
 * Returns 'residence', 'workplace', 'frequent', or null if no connection exists.
 */
function getConnectionToLocation(
  character: Character,
  locationId: string
): Exclude<Bystander['connectionType'], 'present'> | null {
  // Priority: residence > workplace > frequent
  if (character.locations.residence.includes(locationId)) return 'residence';
  if (character.locations.workplaces.includes(locationId)) return 'workplace';
  if (character.locations.frequents.includes(locationId)) return 'frequent';
  return null;
}

/**
 * True if `locationId` is a descendant of `ancestorId` (ancestor can be parent, grandparent, etc).
 * Returns false if the chain breaks (missing parent in map).
 */
function isDescendantOf(
  locationId: string,
  ancestorId: string,
  locationMap: Map<string, LocationData>
): boolean {
  let current = locationMap.get(locationId);
  const guard = new Set<string>(); // prevents loops

  while (current?.parent) {
    if (guard.has(current.identifier)) return false;
    guard.add(current.identifier);

    if (current.parent === ancestorId) return true;

    current = locationMap.get(current.parent);
  }

  return false;
}

/**
 * Gets all parent locations (LocationData objects) up to but not including the 'hamlet' location.
 * Assumes `location.parent` is the identifier of the parent.
 */
function getLocationParents(
  location: LocationData, 
  locationMap: Map<string, LocationData>
): LocationData[] {
  console.log(`\nFinding parents for location: ${location.identifier}`);
  const parents: LocationData[] = [];

  let current = location;
  while (current?.parent && !STOP_ROOTS.has(current.parent)) {
    const parentLoc = locationMap.get(current.parent);
    if (!parentLoc) {
      console.warn(`Parent location "${current.parent}" not found`);
      break;
    }
    console.log(`Found parent: ${parentLoc.identifier}`);
    parents.push(parentLoc);
    current = parentLoc;
  }

  return parents;
}

/**
 * Returns the location objects a character might occupy (residence, workplace, frequents)
 * based on the event's character index rules.
 */
function getCharacterLocations(
  char: Character,
  charIndex: number,
  event: EventData,
  locationMap: Map<string, LocationData>
): LocationData[] {
  console.log(`\nGetting locations for ${char.name} (index: ${charIndex})`);
  const locationSet = new Set<LocationData>();

  // If this character is included among 'residence' participants, add residence locations
  if (event.location.residence.includes(charIndex + 1)) {
    console.log(`Adding residence locations: ${char.locations.residence.join(', ')}`);
    char.locations.residence.forEach(locId => {
      const locObj = locationMap.get(locId);
      if (locObj) {
        locationSet.add(locObj);
      } else {
        console.warn(`Residence location "${locId}" not found in location map`);
      }
    });
  }

  // If this character is included among 'workplaces' participants, add workplace locations
  if (event.location.workplaces.includes(charIndex + 1)) {
    console.log(`Adding workplace locations: ${char.locations.workplaces.join(', ')}`);
    char.locations.workplaces.forEach(locId => {
      const locObj = locationMap.get(locId);
      if (locObj) {
        locationSet.add(locObj);
      } else {
        console.warn(`Workplace location "${locId}" not found in location map`);
      }
    });
  }

  // If this character is included among 'frequents' participants, add frequented locations
  if (event.location.frequents.includes(charIndex + 1)) {
    console.log(`Adding frequented locations: ${char.locations.frequents.join(', ')}`);
    char.locations.frequents.forEach(locId => {
      const locObj = locationMap.get(locId);
      if (locObj) {
        locationSet.add(locObj);
      } else {
        console.warn(`Frequent location "${locId}" not found in location map`);
      }
    });
  }

  const result = Array.from(locationSet);
  console.log(
    `Final locations for ${char.name}: ${result.map(l => l.identifier).join(', ')}`
  );
  return result;
}

/**
 * Pick up to `count` unique locations from the given score map, weighted by score.
 * The first pick is considered the "main" pick by the caller.
 *
 * Throws if it cannot produce `count` unique picks.
 */
function pickMultipleWeightedLocations(
  scores: Map<LocationData, number>,
  count: number
): LocationData[] {
  // Normalize weird input: treat <= 1 as "just pick one"
  if (count <= 1) {
    return [pickWeightedLocation(scores)];
  }

  // We'll build picks here
  const picks: LocationData[] = [];
  const pickedIds = new Set<string>();

  // Make a mutable copy we can remove from between picks
  const remaining = new Map(scores);

  while (picks.length < count) {
    // If we've run out of candidates before hitting the target, fail loudly
    if (remaining.size === 0) {
      throw new Error(
        `multipleLocations=${count} but only ${picks.length} unique eligible location(s) were available`
      );
    }

    // Pick one from what's left
    const next = pickWeightedLocation(remaining);

    // Defensive: even though we remove picks, keep this guard in case of future edits
    if (pickedIds.has(next.identifier)) {
      // If we somehow picked a duplicate, remove it and try again
      remaining.delete(next);
      continue;
    }

    // Record pick
    picks.push(next);
    pickedIds.add(next.identifier);

    // Remove from remaining so we cannot pick it again
    remaining.delete(next);
  }

  return picks;
}

/**
 * Score all possible locations for the given event and characters,
 * returning a Map of LocationData → final numeric score.
 */
export function scoreLocations(
  event: EventData,
  characters: Character[]
): Map<LocationData, number> {
  console.log('\n=== Starting Location Scoring ===');

  const gameData = StaticGameDataManager.getInstance();
  const allLocations = gameData.getAllLocations();
  const locationMap = gameData.getLocationMap();

  // Keep track of intermediate scores & usage counts
  const processedLocations = new Map<LocationData, ProcessedLocation>();

  // Constants
  const BASE_SCORE = 15;
  const DEFAULT_SCORE = 40;
  const SHARED_MULTIPLIER = 2.25;
  const PARENT_MULTIPLIER = 0.3;

  console.log(`Constants: BASE_SCORE=${BASE_SCORE}, SHARED_MULTIPLIER=${SHARED_MULTIPLIER}, PARENT_MULTIPLIER=${PARENT_MULTIPLIER}`);
  console.log(`Parent locations ${event.location.allowParentLocations ? 'are' : 'are not'} allowed`);
  console.log(`Allow all locations: ${event.location.allowAll ? 'Yes' : 'No'}`);

  // If allowAll is set, treat every location as part of the default
  let defaultLocations: LocationData[] = [];
  if (event.location.allowAll) {
    defaultLocations = allLocations.filter((loc) => {
      if (loc.identifier === TOWN_SCOPE_ROOT) return false;          // exclude "hamlet"
      if (loc.parent === TOWN_SCOPE_ROOT) return false;             // exclude districts (direct children)
      return isDescendantOf(loc.identifier, TOWN_SCOPE_ROOT, locationMap); // include deeper descendants
    });
  } else {
    // Otherwise, map event.location.default (which are IDs) to actual objects
    defaultLocations = event.location.default
      .map(locId => locationMap.get(locId))
      .filter((loc): loc is LocationData => !!loc); // ensure we remove undefined
  }

  // 1) Initialize default locations with base scores
  for (const loc of defaultLocations) {
    processedLocations.set(loc, { baseScore: DEFAULT_SCORE, sharedCount: 0 });
  }

  // 2) Process each character's known/potential locations
  characters.forEach((char, charIndex) => {
    const charLocations = getCharacterLocations(char, charIndex, event, locationMap);
    const processedForChar = new Set<LocationData>();

    for (const loc of charLocations) {
      if (!processedForChar.has(loc)) {
        processedForChar.add(loc);

        // Update base score & shared count
        const existing = processedLocations.get(loc);
        if (existing) {
          existing.baseScore += BASE_SCORE;
          existing.sharedCount++;
        } else {
          processedLocations.set(loc, { baseScore: BASE_SCORE, sharedCount: 1 });
        }

        // Process parents only if allowed
        if (event.location.allowParentLocations) {
          let parentScore = BASE_SCORE;
          const parents = getLocationParents(loc, locationMap);

          for (const parentLoc of parents) {
            if (!processedForChar.has(parentLoc)) {
              parentScore *= PARENT_MULTIPLIER;
              const existingParent = processedLocations.get(parentLoc);

              if (existingParent) {
                existingParent.baseScore += parentScore;
                existingParent.sharedCount++;
              } else {
                processedLocations.set(parentLoc, {
                  baseScore: parentScore,
                  sharedCount: 1
                });
              }

              processedForChar.add(parentLoc);
            } else {
              console.log(`Parent ${parentLoc.identifier}: Already processed for this character`);
            }
          }
        } else {
          // console.log('Skipping parent locations as they are not allowed for this event');
        }
      }
    }
  });

  // 3) Calculate final numeric scores from our processed data
  const finalScores = new Map<LocationData, number>();

  for (const [loc, data] of processedLocations) {
    // If multiple characters share it, apply a multiplier
    const multiplier = data.sharedCount > 1
      ? Math.pow(SHARED_MULTIPLIER, data.sharedCount - 1)
      : 1;
    const finalScore = data.baseScore * multiplier;
    finalScores.set(loc, finalScore);
  }

  return finalScores;
}

/**
 * Given a Map<LocationData, number> with scores, pick one location at random,
 * weighted by its score.
 */
export function pickWeightedLocation(scores: Map<LocationData, number>): LocationData {
  // Convert the Map into arrays for iteration
  const entries = Array.from(scores.entries());
  const totalScore = entries.reduce((sum, [, score]) => sum + score, 0);

  let random = Math.random() * totalScore;

  for (const [location, score] of entries) {
    random -= score;
    if (random <= 0) {
      console.log(`Selected location: ${location.identifier}`);
      return location;
    }
  }

  // Fallback if something goes off (unlikely)
  console.log(`Falling back to first location: ${entries[0][0].identifier}`);
  return entries[0][0];
}

/**
 * Gather up to `limit` random children for the given location.
 */
function getRandomChildren(location: LocationData, locationMap: Map<string, LocationData>, limit: number, excludeId?: string): LocationData[] {
  if (!location.children || location.children.length === 0) return [];
  const children = location.children
    .filter(childId => childId !== excludeId)
    .map(childId => locationMap.get(childId))
    .filter((child): child is LocationData => !!child);

  shuffleInPlace(children);

  return children.sort(() => Math.random() - 0.5).slice(0, limit);
}

/**
 * Builds a list of surrounding locations and collects NPCs.
 * - Includes the picked location.
 * - Its parents (up to "hamlet").
 * - Its children (up to 4).
 * - Its parent's children (up to 6 total locations).
 * Returns both the locations and the gathered NPCs.
 */
function getSurroundingLocationsAndNPCs(
  pickedLocation: LocationData,
  locationMap: Map<string, LocationData>
): { locations: LocationData[]; npcs: string[] } {
  const result: LocationData[] = [];
  const addedIds = new Set<string>();
  const npcSet = new Set<string>();

  // Add the picked location first
  result.push(pickedLocation);
  addedIds.add(pickedLocation.identifier);

  // Add NPCs from the picked location
  if (pickedLocation.npcs) {
    pickedLocation.npcs.forEach((npc) => npcSet.add(npc));
  }

  // Add parents up to "hamlet" (or other stop roots if outside town)
  let current = pickedLocation;
  while (current?.parent && !STOP_ROOTS.has(current.parent)) {
    const parent = locationMap.get(current.parent);
    if (!parent || addedIds.has(parent.identifier)) break;

    result.push(parent);
    addedIds.add(parent.identifier);

    // Add NPCs from the parent location
    if (parent.npcs) {
      parent.npcs.forEach((npc) => npcSet.add(npc));
    }

    current = parent;
  }

  // Add up to 4 children of the picked location
  const children = getRandomChildren(pickedLocation, locationMap, 4);
  children.forEach((child) => {
    if (!addedIds.has(child.identifier)) {
      result.push(child);
      addedIds.add(child.identifier);
    }
  });

  // If fewer than 6 locations, add parent's children (excluding the picked location)
  if (result.length < 6 && pickedLocation.parent) {
    const parent = locationMap.get(pickedLocation.parent);
    if (parent) {
      const parentChildren = getRandomChildren(parent, locationMap, 6 - result.length, pickedLocation.identifier);
      parentChildren.forEach((child) => {
        if (!addedIds.has(child.identifier)) {
          result.push(child);
          addedIds.add(child.identifier);
        }
      });
    }
  }

  return { locations: result.slice(0, 6), npcs: Array.from(npcSet) }; // Ensure at most 6 locations
}

/**
 * Picks multiple locations for an event based on scoring.
 */
function pickMultipleLocations(event: EventData, characters: Character[]): LocationData[] {
  const scores = scoreLocations(event, characters);
  const desiredCount = Math.max(1, event.location.multipleLocations ?? 1);
  return pickMultipleWeightedLocations(scores, desiredCount);
}

/**
 * Merges extra picked locations into the surrounding locations list,
 * ensuring no duplicates and preserving order.
 */
function mergeExtraPickedLocations(
  surroundingLocations: LocationData[],
  pickedLocations: LocationData[]
): LocationData[] {
  const eventLocations: LocationData[] = [...surroundingLocations];
  const seen = new Set(eventLocations.map(l => l.identifier));

  // Keep the main location + normal surrounding list as-is, then append extras if missing
  for (let i = 1; i < pickedLocations.length; i++) {
    const extra = pickedLocations[i];
    if (!seen.has(extra.identifier)) {
      eventLocations.push(extra);
      seen.add(extra.identifier);
    }
  }
  return eventLocations;
}

/**
 * Builds a list of bystanders for the event location.
 * Prioritizes participants first, then fills with overflow (client-supplied ids above event character limit) and locals.
 */
function buildBystanders(
  mainLocationId: string,
  participants: Character[],
  overflowCharacters: Character[],
  estate: Estate,
  locations: LocationData[]
): Bystander[] {
  const participantIdSet = new Set(participants.map(c => c.identifier));

  const participantBystanders = getParticipantBystanders(participants, mainLocationId);
  const nonParticipantBystanders = getNonParticipantBystanders(
    mainLocationId,
    overflowCharacters,
    estate,
    locations,
    participantIdSet
  );

  return [...participantBystanders, ...nonParticipantBystanders];
}

function getParticipantBystanders(participants: Character[], mainLocationId: string): Bystander[] {
  const result: Bystander[] = [];
  for (const p of participants) {
    const conn = getConnectionToLocation(p, mainLocationId);
    if (conn) result.push({ identifier: p.identifier, connectionType: conn });
  }
  return result;
}

/**
 * Gathers non-participant bystanders from overflow characters and locals.
 */
function getNonParticipantBystanders(
  mainLocationId: string,
  overflowCharacters: Character[],
  estate: Estate,
  locations: LocationData[],
  participantIdSet: Set<string>
): Bystander[] {
  const MAX = 4;
  const result: Bystander[] = [];
  const added = new Set<string>();

  // Overflow first
  for (const oc of overflowCharacters) {
    if (result.length >= MAX) break;
    const id = oc.identifier;
    if (participantIdSet.has(id) || added.has(id)) continue;

    const conn = getConnectionToLocation(oc, mainLocationId);
    result.push({ identifier: id, connectionType: conn ?? "present" });
    added.add(id);
  }

  // Then locals (random order)
  if (result.length < MAX) {
    const connected = findCharactersConnectedToLocations(estate, locations)
      .filter(b => !participantIdSet.has(b.identifier) && !added.has(b.identifier));

    shuffleInPlace(connected);

    for (const c of connected) {
      if (result.length >= MAX) break;
      result.push(c);
      added.add(c.identifier);
    }
  }

  return result;
}

/**
 * Orchestrates the whole process: Score all locations and pick one.
 * Returns the chosen LocationData object and surrounding locations with NPCs.
 */
export function pickEventLocation(
  event: EventData,
  characters: Character[],
  overflowCharacters: Character[],
  estate: Estate
): Promise<{ 
  locations: LocationData[]; 
  npcs: string[]; 
  bystanders: Bystander[];
}> {
  const locationMap = StaticGameDataManager.getInstance().getLocationMap();

  const pickedLocations = pickMultipleLocations(event, characters);
  const mainLocation = pickedLocations[0];

  const { locations: baseLocations, npcs } = getSurroundingLocationsAndNPCs(
    mainLocation,
    locationMap
  );

  const locations = mergeExtraPickedLocations(baseLocations, pickedLocations);
  const mainLocationId = locations[0]?.identifier;

  const bystanders = mainLocationId
    ? buildBystanders(mainLocationId, characters, overflowCharacters, estate, locations)
    : [];

  return Promise.resolve({ locations, npcs, bystanders });
}

/**
 * Finds all characters in the estate who are connected to any of the given locations.
 * Connection types include residence, workplace, frequent. 
 * (This actually only cares about the first location in the array for now.)
 */
export function findCharactersConnectedToLocations(
  estate: Estate,
  locations: LocationData[]
): Bystander[] {
  // Only use the first location in the array (your current behavior)
  const locationId = locations.length > 0 ? locations[0].identifier : null;
  if (!locationId) return [];

  const connections: Bystander[] = [];

  for (const [characterId, character] of Object.entries(estate.characters)) {
    // Priority: residence > workplace > frequent
    if (character.locations.residence.includes(locationId)) {
      connections.push({ identifier: characterId, connectionType: "residence" });
      continue;
    }

    if (character.locations.workplaces.includes(locationId)) {
      connections.push({ identifier: characterId, connectionType: "workplace" });
      continue;
    }

    if (character.locations.frequents.includes(locationId)) {
      connections.push({ identifier: characterId, connectionType: "frequent" });
      continue;
    }
  }

  return connections;
}