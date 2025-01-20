import { Character, EventData, LocationData } from '../../shared/types/types';

interface LocationScores {
    [locationId: string]: number;
}

interface ProcessedLocation {
    baseScore: number;
    sharedCount: number;
}

/**
 * Gets all parent locations up to but not including 'hamlet'
 */
function getLocationParents(locationId: string, locations: LocationData[]): string[] {
    console.log(`\nFinding parents for location: ${locationId}`);
    const parents: string[] = [];
    let current = locations.find(l => l.identifier === locationId);
    
    while (current?.parent && current.parent !== 'hamlet') {
        console.log(`Found parent: ${current.parent}`);
        parents.push(current.parent);
        const lastParent = current.parent; // Store the last known parent
        current = locations.find(l => l.identifier === current!.parent);
        if (!current) {
            console.warn(`Parent location ${lastParent} not found`);
            break;
        }
    }
    return parents;
}

function getCharacterLocations(char: Character, charIndex: number, event: EventData): string[] {
    console.log(`\nGetting locations for ${char.name} (index: ${charIndex})`);
    const locations: Set<string> = new Set();
    
    if (event.location.residence.includes(charIndex + 1)) {
        console.log(`Adding residence locations: ${char.locations.residence.join(', ')}`);
        char.locations.residence.forEach(loc => locations.add(loc));
    }
    if (event.location.workplaces.includes(charIndex + 1)) {
        console.log(`Adding workplace locations: ${char.locations.workplaces.join(', ')}`);
        char.locations.workplaces.forEach(loc => locations.add(loc));
    }
    if (event.location.frequents.includes(charIndex + 1)) {
        console.log(`Adding frequented locations: ${char.locations.frequents.join(', ')}`);
        char.locations.frequents.forEach(loc => locations.add(loc));
    }
    
    const result = Array.from(locations);
    console.log(`Final locations for ${char.name}: ${result.join(', ')}`);
    return result;
}

export function scoreLocations(
    event: EventData,
    characters: Character[],
    locations: LocationData[]
): LocationScores {
    console.log('\n=== Starting Location Scoring ===');
    const processedLocations: Map<string, ProcessedLocation> = new Map();
    const BASE_SCORE = 15;
    const DEFAULT_SCORE = 40;
    const SHARED_MULTIPLIER = 2.25;
    const PARENT_MULTIPLIER = 0.3;

    console.log(`Constants: BASE_SCORE=${BASE_SCORE}, SHARED_MULTIPLIER=${SHARED_MULTIPLIER}, PARENT_MULTIPLIER=${PARENT_MULTIPLIER}`);
    console.log(`Parent locations ${event.location.allowParentLocations ? 'are' : 'are not'} allowed`);
    console.log(`Allow all locations: ${event.location.allowAll ? 'Yes' : 'No'}`);

    // If allowAll is set, treat every location as part of the default locations
    let defaultLocations = [...event.location.default];
    if (event.location.allowAll) {
        defaultLocations = locations.map(loc => loc.identifier);
        console.log('allowAll is set, including all locations as default.');
    }

    // Initialize default locations with base scores
    console.log('\nProcessing default locations:');
    defaultLocations.forEach(loc => {
        console.log(`\nDefault location: ${loc}`);
        processedLocations.set(loc, { baseScore: DEFAULT_SCORE, sharedCount: 0 });
        console.log(`Set base score: ${DEFAULT_SCORE}`);
    });

    // Process each character's locations
    console.log('\nProcessing character locations:');
    characters.forEach((char, index) => {
        console.log(`\nProcessing character: ${char.name}`);
        const charLocations = getCharacterLocations(char, index, event);
        const processedForChar = new Set<string>();

        charLocations.forEach(loc => {
            if (!processedForChar.has(loc)) {
                processedForChar.add(loc);
                const existing = processedLocations.get(loc);
                
                if (existing) {
                    existing.baseScore += BASE_SCORE;
                    existing.sharedCount++;
                    console.log(`Location ${loc}: Added base score (new total: ${existing.baseScore}) and incremented shared count to ${existing.sharedCount}`);
                } else {
                    processedLocations.set(loc, { 
                        baseScore: BASE_SCORE, 
                        sharedCount: 1 
                    });
                    console.log(`Location ${loc}: Set initial base score ${BASE_SCORE} and shared count 1`);
                }

                // Process parents only if allowed
                if (event.location.allowParentLocations) {
                    const parents = getLocationParents(loc, locations);
                    let parentScore = BASE_SCORE;
                    parents.forEach(parent => {
                        parentScore *= PARENT_MULTIPLIER;
                        const existingParent = processedLocations.get(parent);
                        
                        if (existingParent) {
                            if (!processedForChar.has(parent)) {
                                existingParent.baseScore += parentScore;
                                existingParent.sharedCount++;
                                processedForChar.add(parent);
                                console.log(`Parent ${parent}: Added score ${parentScore} (total: ${existingParent.baseScore}) and incremented shared count to ${existingParent.sharedCount}`);
                            } else {
                                console.log(`Parent ${parent}: Already processed for this character`);
                            }
                        } else {
                            processedLocations.set(parent, {
                                baseScore: parentScore,
                                sharedCount: 1
                            });
                            processedForChar.add(parent);
                            console.log(`Parent ${parent}: Set initial score ${parentScore} and shared count 1`);
                        }
                    });
                } else {
                    console.log('Skipping parent locations as they are not allowed for this event');
                }
            }
        });
    });

    // Calculate final scores
    console.log('\nCalculating final scores:');
    const finalScores: LocationScores = {};
    processedLocations.forEach((data, loc) => {
        // Only apply multiplier when shared by multiple characters (shared count > 1)
        const multiplier = data.sharedCount > 1 ? Math.pow(SHARED_MULTIPLIER, data.sharedCount - 1) : 1;
        finalScores[loc] = data.baseScore * multiplier;
        console.log(`${loc}:`);
        console.log(`  Base Score: ${data.baseScore}`);
        console.log(`  Shared Count: ${data.sharedCount}`);
        console.log(`  Multiplier: ${multiplier}`);
        console.log(`  Final Score: ${finalScores[loc]}`);
    });

    return finalScores;
}

export function pickWeightedLocation(scores: LocationScores): string {
    console.log('\n=== Picking Weighted Location ===');
    const locations = Object.keys(scores);
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    console.log(`Total score across all locations: ${totalScore}`);
    
    let random = Math.random() * totalScore;
    console.log(`Random value: ${random}`);
    
    for (const location of locations) {
        console.log(`${location}: score ${scores[location]}`);
        random -= scores[location];
        console.log(`Remaining random value: ${random}`);
        if (random <= 0) {
            console.log(`Selected location: ${location}`);
            return location;
        }
    }
    
    console.log(`Falling back to first location: ${locations[0]}`);
    return locations[0];
}

export async function pickEventLocation(
    event: EventData,
    characters: Character[],
    locations: LocationData[]
): Promise<string> {
    const scores = scoreLocations(event, characters, locations);
    return pickWeightedLocation(scores);
}