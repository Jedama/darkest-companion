// test_expeditionPlanner.ts

import { 
    findBestComposition, 
    formatDebugInfoForConsole 
} from './server/services/townHall/expeditionPlanner';
import { StrategyWeights } from './server/services/townHall/expeditionStrategies';
import { Estate } from './shared/types/types';
import { loadEstate } from './server/fileOps.js';

const TEST_ESTATE_NAME = '_test_estate';

// ==================================
// The old helper functions (localScorers, displayComposition) are no longer needed!
// The new `formatDebugInfoForConsole` provides a much better and more accurate output.
// ==================================

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
  console.log(`\n\n--- TEST CASE 0: The Usual Plan (Level parity, synergies, affinity) ---`);
  console.log("Expected: Very well balanced teams for level and synergies.");
  console.log("Check the output table for a high negative contribution from the 'Authority distribution' strategy (since it's a 'minimize' strategy).");
  
  const balancedWeights: StrategyWeights = {
    minimizeLevelHardship: 5,
    maximizeGameplaySynergy: 2,
    maximizeAffinity: 2.0
  };

  // findBestComposition now returns an object with the composition and debug info
  const balancedResult = findBestComposition(availableHeroIds, roster, balancedWeights);
  
  // Use our new, powerful formatting function to display the results
  formatDebugInfoForConsole(balancedResult.debugInfo, roster, balancedResult.scoringStats);

  // --- TEST CASE 1: The General's Plan (Authority Distribution) ---
  console.log(`\n\n--- TEST CASE 1: The General's Plan (Authority Focus) ---`);
  console.log("Expected: High authority heroes should be spread across different teams.");
  
  const authorityFocusedWeights: StrategyWeights = {
      balanceAuthority: 20.0,
      minimizeLevelHardship: 5.0,
      maximizeAffinity: 1.0,
  };
  
  // findBestComposition now returns an object with the composition and debug info
  const authorityResult = findBestComposition(availableHeroIds, roster, authorityFocusedWeights);
  
  // Use our new, powerful formatting function to display the results
  formatDebugInfoForConsole(authorityResult.debugInfo, roster, authorityResult.scoringStats);


  // --- TEST CASE 2: The Tactician's Plan (Gameplay Synergy Focus) ---
  console.log(`\n\n--- TEST CASE 2: The Tactician's Plan (Gameplay Synergy Focus) ---`);
  console.log("Expected: Parties should be built around core combos (Marking, Guarding, etc.).");
  console.log("Check the output tables for high positive contributions from the 'Tactical Synergy' strategy.");

  const synergyFocusedWeights: StrategyWeights = {
      maximizeGameplaySynergy: 20.0, 
      minimizeLevelHardship: 10.0,
      maximizeAffinity: 2.0,
  };

  const synergyResult = findBestComposition(availableHeroIds, roster, synergyFocusedWeights);
  
  // Display the detailed analysis for this scenario
  formatDebugInfoForConsole(synergyResult.debugInfo, roster, synergyResult.scoringStats);
  
  
  // --- TEST CASE 3: The Custom Plan (Custom Focus) ---
  console.log(`\n\n--- TEST CASE 3: The Custom Plan (Custom Focus) ---`);
  console.log("Expected: Parties should be formed based on the current thing being tested.");
  console.log("Check the output tables for whatever is being tested.");

  const affinityFocusedWeights: StrategyWeights = {
    maximizeAffinity: 2.0,
    maximizePeakAffinity: 1.0,
    minimizeLevelHardship: 10.0,
    maximizeCommandClarity_Heiress: 5.0
  };

  const affinityResult = findBestComposition(availableHeroIds, roster, affinityFocusedWeights);
  
  // Display the detailed analysis for this scenario
  formatDebugInfoForConsole(affinityResult.debugInfo, roster, affinityResult.scoringStats);
}

// Run the main test function
runTests();