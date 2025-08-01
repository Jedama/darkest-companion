import { saveEstate } from './server/fileOps.js';
import { loadCharacterTemplates, loadDefaultRelationships } from './server/templateLoader.js';
import { Estate, Character, CharacterRecord, Relationship } from './shared/types/types.js';

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

// ==================================
// 2. MAIN SETUP SCRIPT
// ==================================

/**
 * This script generates a comprehensive and randomized test estate file.
 */
async function createTestEstate() {
  console.log('--- Generating Randomized Test Estate ---');

  // --- Phase 1: Load Base Templates ---
  console.log('[1/5] Loading character templates...');
  const characterTemplates = await loadCharacterTemplates();
  const defaultRelationships = await loadDefaultRelationships();
  console.log(`Loaded ${Object.keys(characterTemplates).length} character templates.`);

  // --- Phase 2: Initial Roster Population ---
  console.log('[2/5] Populating initial roster...');
  const testRoster: CharacterRecord = {};
  for (const id in characterTemplates) {
    const template = characterTemplates[id];
    testRoster[id] = {
      ...template,
      relationships: defaultRelationships[id] || {},
    };
  }

  // --- Phase 3: Procedural Level Generation ---
  console.log('[3/5] Procedurally assigning random levels...');
  for (const id in testRoster) {
      testRoster[id].level = getRandomizedLevel();
  }

  // --- Phase 4: Procedural Relationship Generation ---
  console.log('[4/5] Procedurally generating mutual relationships...');
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

  // --- Phase 5: Apply Specific Overrides ---
  console.log('[5/5] Applying specific overrides to guarantee test conditions...');
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