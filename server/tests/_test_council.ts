// server/tests/_test_council.ts
//
// Self-executing, print-and-eyeball script (no assertions) against
// `assemblePlanningCouncil` and `blendDoctrine` (council.ts). Rewritten from
// scratch -- the previous version targeted `electNewCouncil`, a succession
// function that no longer exists. The current module doesn't do succession
// at all in the old sense: `leadership.margrave`/`.bursar` are de jure and
// never overwritten here. What this computes fresh every call is who's
// actually IN THE ROOM this month -- the de facto leader if the de jure one
// can't attend, which seated councillors showed up, and who gets called in
// as an advisor.

import { assemblePlanningCouncil, blendDoctrine, PlanningCouncil } from '../services/townHall/council.js';
import { Character, CharacterRecord, EstateLeadership, Estate, StrategyWeights } from '../../shared/types/types.js';
import { loadEstate } from '../fileOps.js';

const TEST_ESTATE_NAME = '_test_estate';

// ==================================
// 1. TEST DATA HELPERS
// ==================================

interface HeroSpec {
  id: string;
  name: string;
  level?: number;
  authority?: number;
  intelligence?: number;
  sociability?: number;
  zodiac?: string;
  diseases?: string[];
  affliction?: string;
  physical?: number;
  mental?: number;
  strategyWeights?: StrategyWeights;
}

/** Fills in the minimum a Character needs to be meaningful to council.ts. */
function createHero(spec: HeroSpec): Character {
  return {
    identifier: spec.id,
    title: spec.name,
    name: spec.name,
    description: '',
    summary: '',
    history: '',
    race: 'Human',
    gender: 'Unknown',
    religion: 'None',
    zodiac: spec.zodiac ?? 'None',
    traits: [],
    stats: {
      strength: 5,
      agility: 5,
      intelligence: spec.intelligence ?? 5,
      authority: spec.authority ?? 5,
      sociability: spec.sociability ?? 5,
    },
    equipment: [],
    appearance: { height: '', build: '', skinTone: '', hairColor: '', hairStyle: '', features: '' },
    clothing: { head: '', body: '', legs: '', accessories: '' },
    combat: { role: '', strengths: [], weaknesses: [] },
    magic: 'None',
    notes: [],
    tags: [],
    level: spec.level ?? 3,
    money: 0,
    status: {
      physical: spec.physical ?? 100,
      mental: spec.mental ?? 100,
      affliction: spec.affliction ?? '',
      description: 'In good health.',
      wounds: [],
      diseases: spec.diseases ?? [],
    },
    relationships: {},
    locations: { residence: [], workplaces: [], frequents: [] },
    strategyWeights: spec.strategyWeights ?? {},
  };
}

function createRoster(heroes: Character[]): CharacterRecord {
  const roster: CharacterRecord = {};
  for (const h of heroes) roster[h.identifier] = h;
  return roster;
}

function leadership(margrave: string, bursar: string, council: string[] = []): EstateLeadership {
  return { description: 'test leadership', margrave, bursar, council };
}

// ==================================
// 2. DISPLAY HELPERS
// ==================================

function displayCouncil(title: string, deJure: EstateLeadership, council: PlanningCouncil, roster: CharacterRecord) {
  const name = (id: string) => roster[id]?.name ?? `<unknown:${id}>`;

  console.group(title);
  console.log(`Margrave: ${name(council.margrave)}${council.margraveIsActing ? ` (ACTING for ${name(deJure.margrave)})` : ' (de jure)'}`);
  console.log(`Bursar:   ${name(council.bursar)}${council.bursarIsActing ? ` (ACTING for ${name(deJure.bursar)})` : ' (de jure)'}`);
  console.log(`Council:  ${council.council.length ? council.council.map(name).join(', ') : '(none attending)'}`);
  console.log(`Advisors: ${council.advisors.length ? council.advisors.map(name).join(', ') : '(none called in)'}`);
  console.log(`Absent:   ${council.absent.length ? council.absent.map(a => `${name(a.identifier)} (${a.reason})`).join(', ') : '(none)'}`);
  console.groupEnd();
}

function displayDoctrine(title: string, weights: StrategyWeights) {
  console.group(title);
  const rows = Object.entries(weights).map(([id, w]) => ({
    Strategy: id,
    'Blended Weight': typeof w === 'number' ? parseFloat(w.toFixed(3)) : w,
  }));
  if (rows.length === 0) {
    console.log('(no opinions on the table)');
  } else {
    console.table(rows);
  }
  console.groupEnd();
}

// ==================================
// 3. MAIN TEST RUNNER
// ==================================

async function runTests() {
  console.log("\n========================================");
  console.log("==   RUNNING COUNCIL ASSEMBLY TESTS   ==");
  console.log("========================================\n");

  // --- TEST CASE 1: The Ordinary Month ---
  // Expected: both de jure officers attend, the two seated councillors attend
  // as councillors (2 meets MIN_COUNCIL_PRESENCE, so no shortfall advisors),
  // and roster size 10 (8-15 band) calls in 1 base advisor.
  {
    const roster = createRoster([
      createHero({ id: 'heiress', name: 'Heiress', level: 5, authority: 10, intelligence: 8 }),
      createHero({ id: 'kheir', name: 'Kheir', level: 5, authority: 8, intelligence: 10 }),
      createHero({ id: 'crusader', name: 'Crusader', level: 4, authority: 9, intelligence: 5 }),
      createHero({ id: 'vestal', name: 'Vestal', level: 3, authority: 7, intelligence: 7 }),
      createHero({ id: 'plague_doctor', name: 'Plague Doctor', level: 4, authority: 5, intelligence: 9 }),
      createHero({ id: 'highwayman', name: 'Highwayman', level: 3, authority: 6, intelligence: 6 }),
      createHero({ id: 'bounty_hunter', name: 'Bounty Hunter', level: 2, authority: 8, intelligence: 4 }),
      createHero({ id: 'arbalest', name: 'Arbalest', level: 2, authority: 4, intelligence: 3 }),
      createHero({ id: 'jester', name: 'Jester', level: 1, authority: 3, intelligence: 2 }),
      createHero({ id: 'abomination', name: 'Abomination', level: 0, authority: 3, intelligence: 2 }),
    ]);
    const deJure = leadership('heiress', 'kheir', ['crusader', 'vestal']);
    const result = assemblePlanningCouncil(deJure, roster);
    displayCouncil('TEST 1: The Ordinary Month', deJure, result, roster);
  }

  // --- TEST CASE 2: The Margrave Falls Ill ---
  // Expected: Heiress is absent (disease), marked ACTING. Successor prefers the
  // sitting council: 'crusader' (seated, modest stats) should be chosen over
  // 'abomination' (not seated, much higher raw stats) -- the institution
  // promotes from within.
  {
    const roster = createRoster([
      createHero({ id: 'heiress', name: 'Heiress', level: 5, authority: 10, intelligence: 8, diseases: ['Crimson Curse'] }),
      createHero({ id: 'kheir', name: 'Kheir', level: 5, authority: 8, intelligence: 10 }),
      createHero({ id: 'crusader', name: 'Crusader', level: 3, authority: 5, intelligence: 3 }),
      createHero({ id: 'abomination', name: 'Abomination', level: 6, authority: 10, intelligence: 10 }),
    ]);
    const deJure = leadership('heiress', 'kheir', ['crusader']);
    const result = assemblePlanningCouncil(deJure, roster);
    displayCouncil('TEST 2: The Margrave Falls Ill', deJure, result, roster);
    console.log(`  -> succeeded by council incumbent, not the stronger outsider: ${result.margrave === 'crusader' ? 'YES' : 'NO (got ' + result.margrave + ')'}\n`);
  }

  // --- TEST CASE 3: Twin Crisis ---
  // Expected: both chairs vacant simultaneously, filled by two DIFFERENT heroes
  // (the `taken` set prevents one hero from holding both).
  {
    const roster = createRoster([
      createHero({ id: 'heiress', name: 'Heiress', level: 5, authority: 10, intelligence: 8, diseases: ['Crimson Curse'] }),
      createHero({ id: 'kheir', name: 'Kheir', level: 5, authority: 8, intelligence: 10, diseases: ['The Fits'] }),
      createHero({ id: 'crusader', name: 'Crusader', level: 4, authority: 7, intelligence: 4 }),
      createHero({ id: 'vestal', name: 'Vestal', level: 4, authority: 4, intelligence: 7 }),
    ]);
    const deJure = leadership('heiress', 'kheir', ['crusader', 'vestal']);
    const result = assemblePlanningCouncil(deJure, roster);
    displayCouncil('TEST 3: Twin Crisis', deJure, result, roster);
    console.log(`  -> distinct successors: ${result.margrave !== result.bursar ? 'YES' : 'NO (both ' + result.margrave + ')'}\n`);
  }

  // --- TEST CASE 4: No One Left to Hold the Estate ---
  // Expected: every candidate diseased -> the meeting cannot be convened.
  // council.ts logs its own error; the result falls back to the de jure ids
  // with empty council/advisors rather than throwing.
  {
    const roster = createRoster([
      createHero({ id: 'heiress', name: 'Heiress', diseases: ['Crimson Curse'] }),
      createHero({ id: 'kheir', name: 'Kheir', diseases: ['The Fits'] }),
      createHero({ id: 'crusader', name: 'Crusader', diseases: ['The Runs'] }),
    ]);
    const deJure = leadership('heiress', 'kheir', ['crusader']);
    const result = assemblePlanningCouncil(deJure, roster);
    displayCouncil('TEST 4: No One Left to Hold the Estate', deJure, result, roster);
    console.log(`  -> degraded gracefully (no throw), council/advisors empty: ${result.council.length === 0 && result.advisors.length === 0 ? 'YES' : 'NO'}\n`);
  }

  // --- TEST CASE 5: A Young Hamlet ---
  // Expected: roster size 4 is below ROSTER_FOR_FIRST_ADVISOR (8), so the base
  // advisor target is 0 -- but with no council at all, the MIN_COUNCIL_PRESENCE
  // shortfall rule should still summon some advisors to fill the room.
  {
    const roster = createRoster([
      createHero({ id: 'heiress', name: 'Heiress', level: 1, authority: 10, intelligence: 8 }),
      createHero({ id: 'kheir', name: 'Kheir', level: 1, authority: 8, intelligence: 10 }),
      createHero({ id: 'crusader', name: 'Crusader', level: 0, authority: 7, intelligence: 3 }),
      createHero({ id: 'highwayman', name: 'Highwayman', level: 0, authority: 5, intelligence: 5 }),
    ]);
    const deJure = leadership('heiress', 'kheir', []);
    const result = assemblePlanningCouncil(deJure, roster);
    displayCouncil('TEST 5: A Young Hamlet (no council seated)', deJure, result, roster);
  }

  // --- TEST CASE 6: The Stars Favour Someone ---
  // No relationships are defined between any of these candidates, so standing
  // (leadership + roster affinity) is the same constant for all of them and
  // ranking is driven purely by competence = authority*3 + intelligence*2 +
  // level. With intelligence and level held at 0, that's just authority*3.
  //
  // 6 candidates, roster size 8 (1 base advisor) + no council seated
  // (shortfall of 2) => target 3 chairs, no clustering bump (the gap between
  // 3rd and 4th place is too wide to trigger it). So WITHOUT the bonus the
  // top 3 by authority (8, 7, 6) get in and 'd_candidate' (authority 5, 4th
  // place) is left out.
  //
  // Expected: with the reigning sign matching 'd_candidate', her score is
  // multiplied by 1.25 and should overtake 3rd place, bumping 'c_candidate'
  // out in her favour -- the same 3 chairs, a different occupant.
  {
    const roster = createRoster([
      createHero({ id: 'heiress', name: 'Heiress', level: 5, authority: 10, intelligence: 8 }),
      createHero({ id: 'kheir', name: 'Kheir', level: 5, authority: 8, intelligence: 10 }),
      createHero({ id: 'a_candidate', name: 'Candidate A', level: 0, authority: 8, intelligence: 0 }),
      createHero({ id: 'b_candidate', name: 'Candidate B', level: 0, authority: 7, intelligence: 0 }),
      createHero({ id: 'c_candidate', name: 'Candidate C', level: 0, authority: 6, intelligence: 0 }),
      createHero({ id: 'd_candidate', name: 'Candidate D', level: 0, authority: 5, intelligence: 0, zodiac: 'The Cauldron' }),
      createHero({ id: 'e_candidate', name: 'Candidate E', level: 0, authority: 4, intelligence: 0 }),
      createHero({ id: 'f_candidate', name: 'Candidate F', level: 0, authority: 3, intelligence: 0 }),
    ]);
    const deJure = leadership('heiress', 'kheir', []);
    const without = assemblePlanningCouncil(deJure, roster);
    const withZodiac = assemblePlanningCouncil(deJure, roster, { zodiac: 'The Cauldron' });
    displayCouncil('TEST 6a: The Stars Favour Someone -- no reigning sign', deJure, without, roster);
    displayCouncil('TEST 6b: The Stars Favour Someone -- reigning sign: The Cauldron', deJure, withZodiac, roster);
    const flipped = !without.advisors.includes('d_candidate') && withZodiac.advisors.includes('d_candidate');
    console.log(`  -> Candidate D bumped in by the bonus, displacing someone: ${flipped ? 'YES' : 'NO'}\n`);
  }

  // --- TEST CASE 7: Blending the Room's Doctrine ---
  // Expected: 'maximizeCommandClarity_heiress' is the Heiress's alone (nobody
  // else names it) and should arrive close to her own 10, not diluted by table
  // size. 'minimizeLevelHardship' is named by both Heiress (clout 1.25) and
  // Kheir (clout 1.1) at different weights, so it should land at their
  // clout-weighted average: (20*1.25 + 10*1.1) / (1.25+1.1) ~= 15.32.
  {
    const roster = createRoster([
      createHero({ id: 'heiress', name: 'Heiress', level: 5, authority: 10, intelligence: 8,
        strategyWeights: { maximizeCommandClarity_heiress: 10, minimizeLevelHardship: 20 } }),
      createHero({ id: 'kheir', name: 'Kheir', level: 5, authority: 8, intelligence: 10,
        strategyWeights: { minimizeLevelHardship: 10 } }),
      createHero({ id: 'crusader', name: 'Crusader', level: 4, authority: 7, intelligence: 5,
        strategyWeights: { maximizeAffinity: 5 } }),
    ]);
    const deJure = leadership('heiress', 'kheir', ['crusader']);
    const council = assemblePlanningCouncil(deJure, roster);
    const blended = blendDoctrine(council, roster);
    displayCouncil('TEST 7: Blending the Room\'s Doctrine -- attendees', deJure, council, roster);
    displayDoctrine('TEST 7: Blended weights', blended);
  }

  // --- TEST CASE 8: Live Roster from `_test_estate.json` ---
  console.log('\n--- TEST 8: Live Roster from `_test_estate.json` ---');
  const liveEstate: Estate | undefined = await loadEstate(TEST_ESTATE_NAME);
  if (!liveEstate) {
    console.warn(`  SKIPPING: could not load '${TEST_ESTATE_NAME}.json'. Run "npx tsx tests/_test_setup.ts" first.`);
  } else {
    console.log(`  Loaded ${Object.keys(liveEstate.characters).length} heroes for the live smoke test.`);
    const council = assemblePlanningCouncil(liveEstate.leadership, liveEstate.characters);
    displayCouncil('TEST 8: Live Roster', liveEstate.leadership, council, liveEstate.characters);
    const blended = blendDoctrine(council, liveEstate.characters);
    displayDoctrine('TEST 8: Live Roster -- blended doctrine', blended);
  }
}

runTests().catch(error => {
  console.error("\nAn unexpected error occurred during the test run:", error);
  process.exit(1);
});
