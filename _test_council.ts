// _test_council.ts

// Adjust the import path to match your project structure
import { electNewCouncil } from './server/services/townHall/council.js';
import { Character, CharacterRecord, EstateRoles, Stats, Status, Estate } from './shared/types/types.js';
import { loadEstate } from './server/fileOps.js';

const TEST_ESTATE_NAME = '_test_estate';

// ==================================
// 1. TEST DATA GENERATION HELPERS
// ==================================

/**
 * A factory function to create a partial character for our tests.
 * Fills in the minimum required fields to be compliant with the Character type
 * for the purposes of the election logic.
 */
function createBaseCharacter(
  id: string,
  name: string,
  level: number,
  authority: number,
  intelligence: number
): Character {
  // We only need to define the properties that electNewCouncil and its helpers actually use.
  // However, we must satisfy the required fields of the Character, Stats, and Status types.
  const partialCharacter = {
    identifier: id,
    name: name,
    heroClass: id, // Using id as a placeholder
    level: level,
    stats: {
      authority: authority,
      intelligence: intelligence,
      sociability: 5,
      // --- FIX: Added missing required properties for the Stats type ---
      strength: 5,
      agility: 5,
    } as Stats,
    status: {
      physical: 100,
      mental: 100,
      affliction: '',
      wounds: [],
      diseases: [],
      // --- FIX: Added missing required property for the Status type ---
      description: 'In good health.',
    } as Status,
    relationships: {},
    // Add other required top-level properties from Character with default values
    title: name,
    money: 0,
    description: '',
    history: '',
    summary: '',
    race: 'Human',
    gender: 'Unknown',
    religion: 'None',
    zodiac: 'None',
    traits: [],
    locations: { residence: [], workplaces: [], frequents: [] },
    appearance: { height: '', build: '', skinTone: '', hairColor: '', hairStyle: '', features: '' },
    clothing: { head: '', body: '', legs: '', accessories: '' },
    combat: { role: '', strengths: [], weaknesses: [] },
    magic: 'None',
    notes: [],
    tags: [],
  };

  // --- FIX: Use type assertion to tell TypeScript this partial object is sufficient for the test ---
  return partialCharacter as Character;
}

/**
 * Creates a generic "good weather" roster where everyone is fit for duty.
 */
function createHealthyRoster(): CharacterRecord {
  const roster: CharacterRecord = {};
  const characters = [
    createBaseCharacter('heiress', 'Heiress', 5, 10, 8),      // Original Margrave
    createBaseCharacter('kheir', 'Kheir', 5, 8, 10),          // Original Bursar
    createBaseCharacter('crusader', 'Crusader', 4, 9, 5),      // High authority candidate
    createBaseCharacter('plague_doctor', 'Plague Doctor', 4, 5, 9), // High intelligence candidate
    createBaseCharacter('highwayman', 'Highwayman', 3, 6, 6),
    createBaseCharacter('vestal', 'Vestal', 3, 7, 7),
    createBaseCharacter('bounty_hunter', 'Bounty Hunter', 2, 8, 4),
    createBaseCharacter('arbalest', 'Arbalest', 2, 4, 3),
    createBaseCharacter('jester', 'Jester', 1, 3, 2),
    createBaseCharacter('abomination', 'Abomination', 0, 3, 2),
  ];
  characters.forEach(c => roster[c.identifier] = c);
  return roster;
}

/**
 * A utility to display the results of an election in a readable format.
 */
function displayElectionResults(
    title: string,
    initialRoles: EstateRoles,
    finalRoles: EstateRoles,
    roster: CharacterRecord
) {
    console.group(title);
    console.log("----------------------------------------");

    console.log("Leadership Succession:");
    if (initialRoles.margrave === finalRoles.margrave) {
        console.log(`  - Margrave: ${roster[initialRoles.margrave]?.name} (Unchanged)`);
    } else {
        console.log(`  - SUCCESSION: ${roster[initialRoles.margrave]?.name} was replaced by ${roster[finalRoles.margrave]?.name} as Margrave.`);
    }

    if (initialRoles.bursar === finalRoles.bursar) {
        console.log(`  - Bursar:   ${roster[initialRoles.bursar]?.name} (Unchanged)`);
    } else {
        console.log(`  - SUCCESSION: ${roster[initialRoles.bursar]?.name} was replaced by ${roster[finalRoles.bursar]?.name} as Bursar.`);
    }
    
    console.log("\nFinal Privy Council:");
    // --- FIX: Check if council is defined and has members before accessing it ---
    if (!finalRoles.council || finalRoles.council.length === 0) {
        console.log("  >> The council is empty this month!");
    } else {
        finalRoles.council.forEach((id, index) => {
            const member = roster[id];
            console.log(`  ${index + 1}. ${member.name} (Lvl ${member.level}, Auth: ${member.stats.authority}, Int: ${member.stats.intelligence})`);
        });
    }
    console.log("----------------------------------------");
    console.groupEnd();
}


// ==================================
// 2. MAIN TEST RUNNER
// ==================================

async function runTests() {
  console.log("\n========================================");
  console.log("==    RUNNING COUNCIL ELECTION TEST   ==");
  console.log("========================================");

  const initialRoles: EstateRoles = {
      margrave: 'heiress',
      bursar: 'kheir',
      council: [],
  };

  // --- TEST CASE 1: Good Weather Scenario ---
  const healthyRoster = createHealthyRoster();
  const goodWeatherResult = electNewCouncil({ ...initialRoles }, healthyRoster);
  displayElectionResults("✅ TEST 1: Good Weather Scenario", initialRoles, goodWeatherResult, healthyRoster);


  // --- TEST CASE 2: The Plague Scenario (Everyone is Sick) ---
  const plagueRoster = createHealthyRoster();
  for (const id in plagueRoster) {
    // --- FIX: Use simple strings for diseases ---
    plagueRoster[id].status.diseases.push("Crimson Curse");
  }
  const plagueResult = electNewCouncil({ ...initialRoles }, plagueRoster);
  displayElectionResults("✅ TEST 2: The Plague Scenario (Everyone Sick)", initialRoles, plagueResult, plagueRoster);


  // --- TEST CASE 3: Leadership Crisis ---
  const crisisRoster = createHealthyRoster();
  crisisRoster['heiress'].status.diseases.push("The Red Plague");
  crisisRoster['kheir'].status.physical = 10;
  
  const crisisResult = electNewCouncil({ ...initialRoles }, crisisRoster);
  displayElectionResults("✅ TEST 3: Leadership Crisis Scenario", initialRoles, crisisResult, crisisRoster);


  // --- TEST CASE 4: Thinning Ranks (Some Unfit Candidates) ---
  const thinningRoster = createHealthyRoster();
  thinningRoster['crusader'].status.affliction = 'masochistic';
  thinningRoster['plague_doctor'].status.diseases.push("The Fits");
  
  const thinningResult = electNewCouncil({ ...initialRoles }, thinningRoster);
  displayElectionResults("✅ TEST 4: Thinning Ranks Scenario", initialRoles, thinningResult, thinningRoster);

  // --- TEST CASE 5: Early Game Roster (Too Small for Council) ---
  // Expected: No council is formed because the roster size is below the configured threshold.
  const earlyGameRoster: CharacterRecord = {
    'heiress': createBaseCharacter('heiress', 'Heiress', 1, 10, 8),
    'kheir': createBaseCharacter('kheir', 'Kheir', 1, 8, 10),
    'crusader': createBaseCharacter('crusader', 'Crusader', 0, 7, 3),
    'highwayman': createBaseCharacter('highwayman', 'Highwayman', 0, 5, 5),
  };
  const earlyGameResult = electNewCouncil({ ...initialRoles }, earlyGameRoster);
  displayElectionResults("✅ TEST 5: Early Game (Roster Too Small)", initialRoles, earlyGameResult, earlyGameRoster);


  // --- TEST CASE 6: Live Roster from `_test_estate.json` ---
  // Expected: The election runs successfully on the complex, randomized data from the test file.
  let liveEstate: Estate;
  try {
    liveEstate = await loadEstate(TEST_ESTATE_NAME);
    console.log(`\nSuccessfully loaded '${TEST_ESTATE_NAME}.json' with ${Object.keys(liveEstate.characters).length} heroes for live test.`);
    
    const liveRoster = liveEstate.characters;
    const liveInitialRoles = liveEstate.roles;

    const liveResult = electNewCouncil({ ...liveInitialRoles }, liveRoster);
    displayElectionResults("✅ TEST 6: Live Roster from `_test_estate.json`", liveInitialRoles, liveResult, liveRoster);

  } catch (error) {
    console.warn(`\n⚠️  SKIPPING TEST 6: Could not load test estate '${TEST_ESTATE_NAME}.json'.`);
    console.warn('   Run "ts-node _test_setup.ts" to generate it, then run this test again.');
  }
}

runTests().catch(error => {
  console.error("\nAn unexpected error occurred during the test run:", error);
  process.exit(1);
});