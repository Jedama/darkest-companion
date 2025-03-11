import { Estate, Character, EventData, LocationData } from '../../shared/types/types';
import StaticGameDataManager from '../staticGameDataManager.js';

interface ProcessedLocation {
  baseScore: number;
  sharedCount: number;
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
  while (current?.parent && current.parent !== 'hamlet') {
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
    defaultLocations = [...allLocations];
    console.log('allowAll is set, including all locations as default.');
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
function getRandomChildren(location: LocationData, locationMap: Map<string, LocationData>, limit: number): LocationData[] {
  if (!location.children || location.children.length === 0) return [];
  const children = location.children
    .map(childId => locationMap.get(childId))
    .filter((child): child is LocationData => !!child);
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

  // Add parents up to "hamlet"
  let current = pickedLocation;
  while (current?.parent && current.parent !== "hamlet") {
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
      const parentChildren = getRandomChildren(parent, locationMap, 6 - result.length);
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
 * Orchestrates the whole process: Score all locations and pick one.
 * Returns the chosen LocationData object and surrounding locations with NPCs.
 */
export function pickEventLocation(
  event: EventData,
  characters: Character[],
  estate: Estate
): Promise<{ 
  locations: LocationData[]; 
  npcs: string[]; 
  bystanders: Array<{characterId: string, connectionType: 'residence' | 'workplace' | 'frequent'}>
}> {
  // Get the location map from our static data manager
  const locationMap = StaticGameDataManager.getInstance().getLocationMap();
  
  // 1) Score all possible locations
  const scores = scoreLocations(event, characters);
  
  // 2) Pick one location with a weighted random approach
  const pickedLocation = pickWeightedLocation(scores);
  
  // 3) Gather surrounding locations and NPCs
  const { locations: surroundingLocations, npcs } = getSurroundingLocationsAndNPCs(
    pickedLocation, 
    locationMap
  );

  // 4) Find characters connected to these locations
  const charIds = characters.map(c => c.identifier);
  const bystanders = findCharactersConnectedToLocations(estate, surroundingLocations);
  
  // If there are more than 5 bystanders, limit to a random 5
  let limitedBystanders = bystanders;
  if (bystanders.length > 5) {
    // Fisher-Yates shuffle
    for (let i = bystanders.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bystanders[i], bystanders[j]] = [bystanders[j], bystanders[i]];
    }
    limitedBystanders = bystanders.slice(0, 5);
  }

  return Promise.resolve({ 
    locations: surroundingLocations, 
    npcs, 
    bystanders: limitedBystanders 
  });
}

export function findCharactersConnectedToLocations(
  estate: Estate,
  locations: LocationData[]
): Array<{characterId: string, connectionType: 'residence' | 'workplace' | 'frequent'}> {
  // Only use the first location in the array
  const locationId = locations.length > 0 ? locations[0].identifier : null;
  const connections: Array<{characterId: string, connectionType: 'residence' | 'workplace' | 'frequent'}> = [];
  
  // Return empty array if no locations provided
  if (!locationId) return connections;
  
  // Loop through all characters in the estate
  Object.entries(estate.characters).forEach(([characterId, character]) => {
    // Check residence connections
    for (const locId of character.locations.residence) {
      if (locId === locationId) {
        connections.push({ characterId, connectionType: 'residence' });
        break; // Only add once for residence
      }
    }
    
    // Check workplace connections
    for (const locId of character.locations.workplaces) {
      if (locId === locationId) {
        connections.push({ characterId, connectionType: 'workplace' });
        break; // Only add once for workplaces
      }
    }
    
    // Check frequent connections
    for (const locId of character.locations.frequents) {
      if (locId === locationId) {
        connections.push({ characterId, connectionType: 'frequent' });
        break; // Only add once for frequents
      }
    }
  });
  
  return connections;
}