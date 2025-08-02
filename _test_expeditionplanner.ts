// _test_expeditionPlanner.ts

import { findOptimalArrangement, formatDebugInfoForConsole } from './server/services/townHall/expeditionPlanner.js';
import { StrategyWeights } from './server/services/townHall/expeditionStrategies/index.js';
import { Estate } from './shared/types/types.js';
import { loadEstate } from './server/fileOps.js';

const TEST_ESTATE_NAME = '_test_estate';

// A new helper to neatly display the results from the meta-optimizer
function displayOptimalResult(result: any, roster: any) {
    const totalParties = result.composition.length;
    const benchedParties = totalParties - result.activePartiesCount;

    console.log("\n========================================");
    console.log("==       OPTIMAL RESULT SUMMARY       ==");
    console.log("========================================");
    console.log(`Active Parties: ${result.activePartiesCount}`);
    console.log(`Benched Parties: ${benchedParties}`);
    console.log(`Best Average Party Score: ${result.score.toFixed(4)}`);
    console.log("----------------------------------------");

    if (result.debugInfo) {
        // The debug info contains the full breakdown, but let's just show the active parties.
        // We can create a filtered version for display.
        const activeDebugInfo = {
            ...result.debugInfo,
            parties: result.debugInfo.parties.slice(0, result.activePartiesCount),
        };
        // The stats are not part of the `findOptimalArrangement` return, so we pass null for now.
        // A future refactor could thread them through.
        formatDebugInfoForConsole(activeDebugInfo, roster, result.scoringStats); 
    }

    if (benchedParties > 0) {
        console.log("\n--- Benched Parties ---");
        const benched = result.composition.slice(result.activePartiesCount);
        benched.forEach((party, index) => {
            const memberDetails = party.map(id => {
                const char = roster[id];
                return char ? `${char.name} (Lvl ${char.level})` : 'Unknown Hero';
            }).join(', ');
            console.log(`Benched Party ${index + 1}: ${memberDetails}`);
        });
    }
}


async function runTests() {
  console.log(`--- Running Town Hall Composition Test Script on '${TEST_ESTATE_NAME}.json' ---`);

  // 1. LOAD THE TEST ESTATE
  console.log('Loading test estate data...');
  let testEstate: Estate;
  try {
    testEstate = await loadEstate(TEST_ESTATE_NAME);
  } catch (error) {
    console.error(`\nFATAL ERROR: Could not load test estate '${TEST_ESTATE_NAME}.json'.`);
    console.error('Please run "ts-node _test_setup.ts" first to generate it.\n');
    process.exit(1);
  }
  
  const roster = testEstate.characters;
  const availableHeroIds = Object.keys(roster);
  console.log(`Successfully loaded roster with ${availableHeroIds.length} heroes.`);

  // 2. RUN THE TEST SCENARIOS
  console.log("\n--- Running Test Scenarios ---");

  // --- TEST CASE 0: The Usual Plan (Level parity, synergies, affinity) ---
  /*console.log(`\n\n--- TEST CASE 0: The Usual Plan (Level parity, synergies, affinity) ---`);
  console.log("Expected: Very well balanced teams for level and synergies. May bench a team if it improves overall quality.");
  
  const balancedWeights: StrategyWeights = {
    minimizeLevelHardship: 10,
    maximizeGameplaySynergy: 2,
    maximizeAffinity: 3,
    balanceCondition: 10, // Give it some weight to see if it benches anyone
  };

  const balancedResult = await findOptimalArrangement(availableHeroIds, roster, balancedWeights);
  displayOptimalResult(balancedResult, roster);


  // --- TEST CASE 1: The General's Plan (Authority Distribution) ---
  console.log(`\n\n--- TEST CASE 1: The General's Plan (Authority Focus) ---`);
  console.log("Expected: High authority heroes should be spread across different teams.");
  
  const authorityFocusedWeights: StrategyWeights = {
      balanceAuthority: 20.0,
      minimizeLevelHardship: 5.0,
      maximizeAffinity: 1.0,
  };
  
  const authorityResult = await findOptimalArrangement(availableHeroIds, roster, authorityFocusedWeights);
  displayOptimalResult(authorityResult, roster);


  // --- TEST CASE 2: The Tactician's Plan (Gameplay Synergy Focus) ---
  console.log(`\n\n--- TEST CASE 2: The Tactician's Plan (Gameplay Synergy Focus) ---`);
  console.log("Expected: Parties should be built around core combos (Marking, Guarding, etc.).");

  const synergyFocusedWeights: StrategyWeights = {
    maximizeGameplaySynergy: 10.0, 
    minimizeLevelHardship: 5.0,
    maximizeAffinity: 2.0,
    balanceCondition: 1,
  };

  const synergyResult = await findOptimalArrangement(availableHeroIds, roster, synergyFocusedWeights);
  displayOptimalResult(synergyResult, roster);*/

  
  // --- TEST CASE 3: The Risk-Averse Plan (Condition Focus) ---
  console.log(`\n\n--- TEST CASE 3: The Risk-Averse Plan (Condition Focus) ---`);
  console.log("Expected: High chance of benching a team to isolate afflicted/stressed heroes.");

  const conditionFocusedWeights: StrategyWeights = {
    minimizeLevelHardship: 0.0,
    maximizeGameplaySynergy: 0.0,
    maximizeAffinity: 0.0,
    balanceCondition: 0.0, 
    maximizeSocialVitalitya_Zenith: 10,
  };

  const conditionResult = await findOptimalArrangement(availableHeroIds, roster, conditionFocusedWeights);
  displayOptimalResult(conditionResult, roster);
}

// Run the main test function
runTests();