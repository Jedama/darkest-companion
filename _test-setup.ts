// _test-setup.ts
import { saveEstate } from './server/fileOps.js';
import { loadCharacterTemplates, loadDefaultRelationships } from './server/templateLoader.js';
import { Estate, Character, CharacterRecord, Relationship } from './shared/types/types.js';

const TEST_ESTATE_NAME = '_test_estate';

/**
 * This script generates a comprehensive test estate file.
 * Run this whenever you need to create or update the test data.
 *
 * Usage: `ts-node _test_setup.ts`
 */
async function createTestEstate() {
  console.log('--- Generating Test Estate ---');

  // 1. Load all 36 character templates from your JSON files.
  console.log('Loading character templates...');
  const characterTemplates = await loadCharacterTemplates();
  console.log(`Loaded ${Object.keys(characterTemplates).length} character templates.`);

  // 2. Load the default relationship data.
  console.log('Loading default relationships...');
  const defaultRelationships = await loadDefaultRelationships();

  // 3. Create a new Estate and populate it with ALL characters.
  const testRoster: CharacterRecord = {};
  for (const id in characterTemplates) {
    const template = characterTemplates[id];
    
    // Create a complete character by merging template with default relationships
    const character: Character = {
      ...template,
      relationships: defaultRelationships[id] || {}, // Use default relationships or an empty object
    };
    testRoster[id] = character;
  }

  // 4. [CRITICAL STEP] Apply specific overrides for testing purposes.
  // This is where you can guarantee certain test conditions.
  console.log('Applying specific relationship overrides for testing...');

  // Ensure the Occultist/Arbalest rivalry exists
  if (testRoster['occultist'] && testRoster['arbalest']) {
    testRoster['occultist'].relationships['arbalest'] = { affinity: 1, dynamic: 'Rival', description: '' };
    testRoster['arbalest'].relationships['occultist'] = { affinity: 1, dynamic: 'Rival', description: '' };
  }

  // 5. Assemble the final Estate object.
  const testEstate: Estate = {
    estateName: TEST_ESTATE_NAME,
    money: 10000,
    month: 1,
    characters: testRoster,
  };

  // 6. Save the estate to a file.
  await saveEstate(testEstate);
  console.log(`\nSUCCESS: Test estate saved to 'data/estates/${TEST_ESTATE_NAME}.json'`);
}

// Run the setup function
createTestEstate().catch(error => {
  console.error("Failed to create test estate:", error);
  process.exit(1);
});