import { findBestComposition } from './server/services/townHall/expeditionPlanner';
import { STRATEGY_REGISTRY, StrategyWeights } from './server/services/townHall/expeditionStrategies';
import { CharacterRecord, Estate } from './shared/types/types';
import { loadEstate } from './server/fileOps.js';

const TEST_ESTATE_NAME = '_test_estate';

// ==================================
// HELPER FUNCTIONS FOR TESTING
// ==================================

const localScorers = {
  minimizeLevelHardship: (target: any, roster: CharacterRecord): number => {
    const party = target as string[];
    const levels = party.map(id => roster[id]?.level ?? 0);
    const maxLevel = Math.max(...levels);
    let missionLevelTier = 0;
    if (maxLevel >= 5) missionLevelTier = 5;
    else if (maxLevel >= 3) missionLevelTier = 3;
    else missionLevelTier = 0;
    let hardship = 0;
    for (const level of levels) {
        const h = missionLevelTier - level;
        if (h > 0) hardship += Math.pow(h, 3);
    }
    return hardship;
  },
  maximizeAffinity: (target: any, roster: CharacterRecord): number => {
    const party = target as string[];
    let score = 0;
    for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) {
        const c1 = roster[party[i]], c2 = roster[party[j]];
        score += (c1.relationships[party[j]]?.affinity ?? 3) + (c2.relationships[party[i]]?.affinity ?? 3);
    }
    return score;
  },
  maximizePeakAffinity: (target: any, roster: CharacterRecord): number => {
    const party = target as string[];
    let score = 0;
    for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) {
        const c1 = roster[party[i]], c2 = roster[party[j]];
        score += Math.pow(c1.relationships[party[j]]?.affinity ?? 3, 2);
        score += Math.pow(c2.relationships[party[i]]?.affinity ?? 3, 2);
    }
    return score;
  },
  minimizeDiscord: (target: any, roster: CharacterRecord): number => {
    const party = target as string[];
    let score = 0;
    const MAX_AFFINITY = 10;
    for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) {
        const c1 = roster[party[i]], c2 = roster[party[j]];
        score += Math.pow(MAX_AFFINITY - (c1.relationships[party[j]]?.affinity ?? 3), 2);
        score += Math.pow(MAX_AFFINITY - (c2.relationships[party[i]]?.affinity ?? 3), 2);
    }
    return score;
  },
  balanceAuthority: (target: any, roster: CharacterRecord): number => {
    const composition = target as string[][];
    if (composition.length < 2) return 0;
    const lps = composition.map(party => {
        if (party.length === 0) return 0;
        const auths = party.map(id => roster[id]?.stats.authority ?? 0).sort((a,b)=>b-a);
        return (auths[0] ?? 0) + (0.4 * (auths[1] ?? 0));
    });
    const mean = lps.reduce((a,b)=>a+b,0) / lps.length;
    const variance = lps.map(v=>Math.pow(v-mean,2)).reduce((a,b)=>a+b,0) / lps.length;
    return Math.sqrt(variance);
  }
};

const displayComposition = (title: string, composition: string[][], roster: CharacterRecord) => {
    console.log(title);
    
    // Calculate and display composition-wide scores first
    const compositionScores = STRATEGY_REGISTRY
      .filter(s => s.scope === 'composition')
      .map(strategy => {
        const scorer = localScorers[strategy.identifier];
        // The check 'scorer' is what protects against missing keys.
        const score = scorer ? scorer(composition, roster) : 'N/A';
        return `${strategy.name}: ${typeof score === 'number' ? score.toFixed(2) : score}`;
      }).join(' | ');
    if (compositionScores) console.log(`  Composition-Wide Scores -> ${compositionScores}`);

    composition.forEach((party, index) => {
        const memberDetails = party.map(id => `${roster[id]?.name} (L${roster[id]?.level}/A${roster[id]?.stats.authority})`).join(', ');
        console.log(`\n  Party ${index + 1}: ${memberDetails}`);
        
        const partyScores = STRATEGY_REGISTRY
          .filter(s => s.scope === 'party')
          .map(strategy => {
            const scorer = localScorers[strategy.identifier];
            const score = scorer ? scorer(party, roster) : 'N/A';
            return `${strategy.name}: ${typeof score === 'number' ? score.toFixed(2) : score}`;
        }).join(' | ');

        console.log(`    - Party Scores -> ${partyScores}`);
    });
};

// ==================================
// 3. RUN THE SERVICE FUNCTION WITH DIFFERENT WEIGHTS
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

  // --- TEST CASE 1: The General's Plan (Authority Distribution) ---
  console.log(`\n--- TEST CASE 1: The General's Plan (Authority Focus) ---`);
  console.log("Expected: High authority heroes should be spread across different teams.");
  const authorityFocusedWeights: StrategyWeights = {
      balanceAuthority: 20.0,
      minimizeLevelHardship: 5.0,
      maximizeAffinity: 1.0,
  };
  const authorityFocusedComposition = findBestComposition(availableHeroIds, roster, authorityFocusedWeights);
  displayComposition("Final Composition (Authority Focus):", authorityFocusedComposition, roster);

  // --- TEST CASE 2: The Tactician's Plan (Gameplay Synergy Focus) ---
  console.log(`\n\n--- TEST CASE 2: The Tactician's Plan (Gameplay Synergy Focus) ---`);
  console.log("Expected: Parties should be built around core combos (Marking, Guarding, etc.).");
  const synergyFocusedWeights: StrategyWeights = {
      // Assuming you've added the synergy scorer to your registry
      maximizeGameplaySynergy: 20.0, 
      minimizeLevelHardship: 10.0,
      maximizeAffinity: 2.0,
  };

  const synergyFocusedComposition = findBestComposition(availableHeroIds, roster, synergyFocusedWeights);
  displayComposition("Final Composition (Synergy Focus):", synergyFocusedComposition, roster);
}

// Run the main test function
runTests();