// _test_setup.ts
import { saveEstate } from './server/fileOps.js';
import StaticGameDataManager from './server/staticGameDataManager.js';
import { 
  Estate,  
  Character,
  CharacterRecord,
  CharacterTemplate,
  CharacterStatus
} from './shared/types/types.js';
import { AFFLICTIONS, VIRTUES, ConditionType } from './shared/constants/conditions.js';

const TEST_ESTATE_NAME = '_test_estate';

// ==================================
// 1. PROCEDURAL GENERATION HELPERS
// ==================================

/**
 * Generates a random level with a skew towards lower levels.
 * Uses Math.pow() to create a non-linear distribution.
 * @returns A level between 0 and 6.
 */
function getRandomizedLevel(): number {
  const maxLevel = 6;
  // A higher exponent (e.g., 3) skews more heavily towards 0. 2.5 is a good starting point.
  const skewFactor = 2.5; 
  const randomValue = Math.random(); // 0.0 to 1.0
  const skewedValue = Math.pow(randomValue, skewFactor);
  return Math.floor(skewedValue * (maxLevel + 1));
}

/**
 * Generates a random affinity score approximating a bell curve.
 * @param mean - The desired center of the distribution (e.g., 4).
 * @param stdDev - The standard deviation, controlling the spread.
 * @returns A clamped affinity score between 0 and 10.
 */
function generateBellCurveAffinity(mean: number = 4, stdDev: number = 1.5): number {
    // Box-Muller transform approximation for a normal distribution
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    
    // Scale to our mean and standard deviation
    num = num * stdDev + mean;
    
    // Clamp the result to be within the 0-10 range and round it
    return Math.round(Math.max(0, Math.min(10, num)));
}

/**
 * Generates a random health or mental stat, skewed heavily towards being healthy.
 * @returns A number between 0 and 100.
 */
function generateSkewedStat(): number {
    // Math.pow(Math.random(), 0.3) creates a curve where most values are high (close to 1.0)
    // and very few are low.
    const skewedRandom = Math.pow(Math.random(), 0.35);
    return Math.floor(skewedRandom * 101);
}

/**
 * Creates a full Character instance from a template, adding default dynamic data.
 * @param template The character blueprint to use.
 * @param gameData The static data manager instance.
 * @returns A full Character object ready for gameplay.
 */
function createCharacterFromTemplate(
  template: CharacterTemplate, 
  gameData: StaticGameDataManager
): Character {
  const defaultStatus: CharacterStatus = {
    physical: 100,
    mental: 100,
    affliction: "",
    description: "In good health and high spirits",
    wounds: [],
    diseases: [],
  };

  return {
    ...template,
    level: 0,
    money: 0,
    status: defaultStatus,
    relationships: gameData.getDefaultRelationshipsForCharacter(template.identifier),
    locations: gameData.getRandomizedLocationsForCharacter(template.identifier),
    strategyWeights: gameData.getStrategiesForCharacter(template.identifier),
  };
}

// ==================================
// 2. MAIN SETUP SCRIPT
// ==================================

/**
 * This script generates a comprehensive and randomized test estate file.
 */
async function createTestEstate() {
  console.log('--- Generating Randomized Test Estate ---');

  // --- Phase 1: Load Base Templates ---
  console.log('[1/6] Loading character templates...');
  const gameData = StaticGameDataManager.getInstance();
  await gameData.initialize(); // This loads everything we need!

  const characterTemplates = gameData.getCharacterTemplates();
  console.log(`Loaded ${Object.keys(characterTemplates).length} character templates.`);

  // --- Phase 2: Initial Roster Population ---
  console.log('[2/6] Populating initial roster from templates...');
  const testRoster: CharacterRecord = {};
  for (const id in characterTemplates) {
    const template = characterTemplates[id];
    // Create a complete character with default values
    testRoster[id] = createCharacterFromTemplate(template, gameData);
  }

  // --- Phase 3: Procedural Level Generation ---
  console.log('[3/6] Procedurally assigning random levels...');
  for (const id in testRoster) {
      testRoster[id].level = getRandomizedLevel();
  }

  // --- Phase 4: Procedural Relationship Generation ---
  console.log('[4/6] Procedurally generating mutual relationships...');
  const characterIds = Object.keys(testRoster);
  for (let i = 0; i < characterIds.length; i++) {
    for (let j = i + 1; j < characterIds.length; j++) {
      const charAId = characterIds[i];
      const charBId = characterIds[j];
      const charA = testRoster[charAId];
      const charB = testRoster[charBId];

      // Only create relationships if one doesn't already exist from the defaults
      if (!charA.relationships[charBId] && !charB.relationships[charAId]) {
        const affinityAtoB = generateBellCurveAffinity(4, 1.5);
        
        // The other person's affinity is based on the first, with a little variance.
        const variance = Math.random() < 0.5 ? 1 : -1;
        let affinityBtoA = affinityAtoB + variance;
        // Clamp it to ensure it stays within bounds
        affinityBtoA = Math.max(0, Math.min(10, affinityBtoA));

        charA.relationships[charBId] = { affinity: affinityAtoB, dynamic: 'Acquaintance', description: '' };
        charB.relationships[charAId] = { affinity: affinityBtoA, dynamic: 'Acquaintance', description: '' };
      }
    }
  }

  // --- Phase 5: Procedural Health, Stress, and Condition Generation ---
  console.log('[5/6] Procedurally assigning health, stress, and conditions...');
  const afflictionKeys = Object.keys(AFFLICTIONS) as (keyof typeof AFFLICTIONS)[];
  const virtueKeys = Object.keys(VIRTUES) as (keyof typeof VIRTUES)[];

  for (const id in testRoster) {
    const hero = testRoster[id];
    hero.status.physical = generateSkewedStat();
    hero.status.mental = generateSkewedStat();

    // Reset affliction before assigning a new one
    hero.status.affliction = ""; 

    // Let's create a chance-based system for conditions.
    const roll = Math.random(); // A roll from 0.0 to 1.0

    if (roll < 0.15) { // 15% chance to get an affliction
      const randomIndex = Math.floor(Math.random() * afflictionKeys.length);
      hero.status.affliction = afflictionKeys[randomIndex] as ConditionType;
      // If afflicted, their mental state should be poor.
      hero.status.mental = Math.min(hero.status.mental, Math.floor(Math.random() * 40));
    } else if (roll < 0.22) { // 7% chance to get a virtue (15% to 22%)
      const randomIndex = Math.floor(Math.random() * virtueKeys.length);
      hero.status.affliction = virtueKeys[randomIndex] as ConditionType;
      // If virtuous, their mental state should be excellent.
      hero.status.mental = 100;
    }
    // Otherwise (78% of the time), they have no specific named condition.
  }

  // --- Phase 6: Apply Specific Overrides ---
  console.log('[6/6] Applying specific overrides to guarantee test conditions...');
  // This ensures that no matter what the random generation does, we have our key test cases.
  if (testRoster['occultist'] && testRoster['arbalest']) {
    testRoster['occultist'].relationships['arbalest'] = { affinity: 1, dynamic: 'Rival', description: '' };
    testRoster['arbalest'].relationships['occultist'] = { affinity: 1, dynamic: 'Rival', description: '' };
  }

  // --- Final Assembly and Save ---
  const testEstate: Estate = {
    estateName: TEST_ESTATE_NAME,
    money: 10000,
    month: 1,
    roles: {
      margrave: 'heiress',
      bursar: 'kheir',
    },
    characters: testRoster,
  };

  await saveEstate(testEstate);
  console.log(`\nSUCCESS: Randomized test estate saved to 'data/estates/${TEST_ESTATE_NAME}.json'`);
}

// Run the setup function
createTestEstate().catch(error => {
  console.error("Failed to create test estate:", error);
  process.exit(1);
});