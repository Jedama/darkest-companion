// server/tests/_test_expeditionPlanner.ts
//
// Self-executing, print-and-eyeball script (no assertions) against the live
// `_test_estate.json` fixture. Run `npx tsx tests/_test_setup.ts` first if it
// doesn't exist yet.
//
// Benching is decided entirely by fitness.ts, from hero condition alone,
// before any of these weights are consulted — none of the scenarios below
// choose how MANY parties go out. What the weights decide is who fills the
// parties that do: the annealer is free to swap an unfit or badly-served
// hero into a trailing (unscored) party if doing so raises the active
// parties' score, so a doctrine can still push a specific hero toward the
// bench even though it never controls the bench count itself.

import { findOptimalArrangement, formatDebugInfoForConsole, OptimalArrangementResult } from '../services/townHall/expeditionPlanner.js';
import { StrategyWeights } from '../services/townHall/expeditionStrategies/index.js';
import { Estate, CharacterRecord } from '../../shared/types/types.js';
import { loadEstate } from '../fileOps.js';

const TEST_ESTATE_NAME = '_test_estate';

// A helper to neatly display the results from the meta-optimizer
function displayOptimalResult(result: OptimalArrangementResult, roster: CharacterRecord) {
    const totalParties = result.composition.length;
    const benchedParties = totalParties - result.activePartiesCount;

    console.log("\n========================================");
    console.log("==       OPTIMAL RESULT SUMMARY       ==");
    console.log("========================================");
    console.log(`Active Parties: ${result.activePartiesCount}`);
    console.log(`Benched Parties: ${benchedParties}`);
    console.log(`Best Average Party Score: ${result.score.toFixed(4)}`);
    console.log("----------------------------------------");

    if (result.debugInfo && result.scoringStats) {
        // The debug info contains the full breakdown, but let's just show the active parties.
        // We can create a filtered version for display.
        const activeDebugInfo = {
            ...result.debugInfo,
            parties: result.debugInfo.parties.slice(0, result.activePartiesCount),
        };
        formatDebugInfoForConsole(activeDebugInfo, roster, result.scoringStats);
    }

    if (benchedParties > 0) {
        console.log("\n--- Benched Parties ---");
        const benched = result.composition.slice(result.activePartiesCount);
        benched.forEach((party, index) => {
            const memberDetails = party.map(id => {
                const char = roster[id];
                if (!char) return 'Unknown Hero';
                const flags = char.tags.includes('Child') ? ', Child' : '';
                return `${char.name} (Lvl ${char.level}${flags})`;
            }).join(', ');
            console.log(`Benched Party ${index + 1}: ${memberDetails}`);
        });
    }
}


async function runTests() {
  console.log(`--- Running Town Hall Composition Test Script on '${TEST_ESTATE_NAME}.json' ---`);

  // 1. LOAD THE TEST ESTATE
  console.log('Loading test estate data...');
  const testEstate: Estate | undefined = await loadEstate(TEST_ESTATE_NAME);
  if (!testEstate) {
    console.error(`\nFATAL ERROR: Could not load test estate '${TEST_ESTATE_NAME}.json'.`);
    console.error('Please run "npx tsx tests/_test_setup.ts" first to generate it.\n');
    process.exit(1);
    return;
  }

  const roster = testEstate.characters;
  const availableHeroIds = Object.keys(roster);
  console.log(`Successfully loaded roster with ${availableHeroIds.length} heroes.`);

  // 2. RUN THE TEST SCENARIOS
  console.log("\n--- Running Test Scenarios ---");

  // --- TEST CASE 0: The Usual Plan (Level parity, synergies, affinity, fitness) ---
  console.log(`\n\n--- TEST CASE 0: The Usual Plan (Level parity, synergies, affinity, fitness) ---`);
  console.log("Expected: Well balanced teams for level and synergies. Unfit heroes (heavy stress/wounds/afflictions/disease) should cluster in the benched parties over the active ones.");

  const balancedWeights: StrategyWeights = {
    minimizeLevelHardship: 10,
    maximizeGameplaySynergy: 2,
    maximizeAffinity: 3,
    minimizeMarchingUnfitness: 15, // registry default — the estate's top priority
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
    minimizeMarchingUnfitness: 1,
  };

  const synergyResult = await findOptimalArrangement(availableHeroIds, roster, synergyFocusedWeights);
  displayOptimalResult(synergyResult, roster);


  // --- TEST CASE 3: The Martyr's Plan (Dedicated Protector Focus) ---
  console.log(`\n\n--- TEST CASE 3: The Martyr's Plan (Dedicated Protector Focus) ---`);
  console.log("Expected: snor_rasp (the Martyr), when present, should be grouped with the wards she can actually protect -- her scorer reads her own affinity to her party, not raw stats.");

  const martyrFocusedWeights: StrategyWeights = {
    minimizeLevelHardship: 0.0,
    maximizeGameplaySynergy: 0.0,
    maximizeAffinity: 0.0,
    minimizeMarchingUnfitness: 0.0,
    maximizeDedicatedProtector_snor_rasp: 10,
  };

  const martyrResult = await findOptimalArrangement(availableHeroIds, roster, martyrFocusedWeights);
  displayOptimalResult(martyrResult, roster);


  // --- TEST CASE 4: The Hamlet's Duty (Child Vulnerability Focus) ---
  console.log(`\n\n--- TEST CASE 4: The Hamlet's Duty (Child Vulnerability Focus) ---`);
  console.log("Expected: any child in an active party should be paired with real escort (Guarder/Tank/Healer); an unescorted child is a strong candidate to end up in a benched party instead.");

  const childFocusedWeights: StrategyWeights = {
    minimizeLevelHardship: 5.0,
    minimizeMarchingUnfitness: 10,
    minimizeChildVulnerability: 20,
  };

  const childResult = await findOptimalArrangement(availableHeroIds, roster, childFocusedWeights);
  displayOptimalResult(childResult, roster);


  // --- TEST CASE 5: Keegan's Ledger (Arsonist's Child Vulnerability) ---
  console.log(`\n\n--- TEST CASE 5: Keegan's Ledger (Arsonist's Child Vulnerability) ---`);
  console.log("Expected: if the Arsonist and any child are both available, the optimizer should keep them out of the same active party -- his presence penalty (2.5x flat demand) heavily outweighs anything escort can buy back.");

  const arsonistFocusedWeights: StrategyWeights = {
    minimizeLevelHardship: 5.0,
    minimizeMarchingUnfitness: 10,
    minimizeChildVulnerability_arsonist: 20,
  };

  const arsonistResult = await findOptimalArrangement(availableHeroIds, roster, arsonistFocusedWeights);
  displayOptimalResult(arsonistResult, roster);
}

runTests().catch(error => {
  console.error("\nAn unexpected error occurred during the test run:", error);
  process.exit(1);
});
