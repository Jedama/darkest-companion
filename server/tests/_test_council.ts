// server/tests/_test_council.ts
//
// Self-executing, mostly print-and-eyeball script against
// `assemblePlanningCouncil` and `blendDoctrine` (council.ts). Rewritten from
// scratch -- the previous version targeted `electNewCouncil`, a succession
// function that no longer exists. The current module doesn't do succession
// at all in the old sense: `leadership.margrave`/`.bursar` are de jure and
// never overwritten here. What this computes fresh every call is who's
// actually IN THE ROOM this month -- the de facto leader if the de jure one
// can't attend, which seated councillors showed up, and who gets called in
// as an advisor. The doctrine-blending cases (TEST 7, and the scale check
// in TEST 8) print PASS/FAIL checks.

import { assemblePlanningCouncil, blendDoctrine, PlanningCouncil } from '../services/townHall/council.js';
import { Character, CharacterRecord, EstateLeadership, Estate, StrategyWeights } from '../../shared/types/types.js';
import { loadEstate } from '../fileOps.js';
import StaticGameDataManager from '../staticGameDataManager.js';
import { analyzeComposition, generateScoringStatistics } from '../services/townHall/expeditionPlanner.js';
import { generateDefaultWeights } from '../services/townHall/expeditionStrategies/strategyRegistry.js';
import { isStrategyId } from '../../shared/constants/strategies.js';
import type { StrategyId } from '../../shared/constants/strategies.js';

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

// Checks print PASS/FAIL rather than throwing, so one miss doesn't hide the rest.
function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps * Math.max(1, Math.abs(b));
}

function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

function expectWeights(label: string, actual: StrategyWeights, expected: StrategyWeights) {
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  const wrong = [...keys].filter(k => !approx(actual[k as StrategyId] ?? NaN, expected[k as StrategyId] ?? NaN));
  check(`${label}: matches the expected table${wrong.length ? ` (mismatched: ${wrong.join(', ')})` : ''}`,
    wrong.length === 0);
}

function sumOf(weights: StrategyWeights, keys: string[]): number {
  return keys.reduce((sum, k) => sum + (weights[k as StrategyId] ?? 0), 0);
}

/** A hand-built room, bypassing assemblePlanningCouncil's advisor selection. */
function room(margrave: string, bursar: string, council: string[] = [], advisors: string[] = []): PlanningCouncil {
  return { margrave, bursar, council, advisors, margraveIsActing: false, bursarIsActing: false, absent: [] };
}

// ==================================
// 3. MAIN TEST RUNNER
// ==================================

async function runTests() {
  // Doctrines are static game data, read the same way the planning route does.
  const gameData = StaticGameDataManager.getInstance();
  await gameData.initialize();

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
  // blendDoctrine SUMS each attendee's personal complete vector (registry
  // defaults overlaid with their own doctrine), with clout as the coefficient.
  // Councils are built by hand so the chairs are exactly what each case says;
  // assemblePlanningCouncil would call in advisors of its own.
  // Clout: Margrave 1.25, Bursar 1.1, Councillor 1.0, Advisor 0.85.
  {
    const heiressDoctrine: StrategyWeights = {
      maximizeCommandClarity_heiress: 10,
      minimizeLiabilityExposure: 6.5,
      minimizeTacticalNonsense: 3,
      minimizeDiscord: 3,
    };
    // Hypothetical -- used for this test only.
    const arsonistDoctrine: StrategyWeights = {
      minimizeChildVulnerability: 12,
      minimizeChildVulnerability_arsonist: 9,
      minimizeTacticalNonsense: 8,
      minimizeLevelHardship: 5,
    };
    // blendDoctrine only needs a doctrine lookup, not heroes. Anyone absent
    // from this map (blank_bursar, blank_c1, blank_c2) has no doctrine.
    const doctrines: Record<string, StrategyWeights> = {
      heiress: heiressDoctrine,
      arsonist: arsonistDoctrine,
      zero_margrave: { minimizeLevelHardship: 0 },
    };
    const doctrineOf = (id: string) => doctrines[id];

    // --- 7A: Heiress as Margrave, one profile-less Bursar. Total clout 2.35.
    const caseA = blendDoctrine(room('heiress', 'blank_bursar'), doctrineOf);
    displayDoctrine('TEST 7A: Heiress + profile-less Bursar', caseA);
    expectWeights('7A', caseA, {
      minimizeLevelHardship: 35.25,
      minimizeMarchingUnfitness: 35.25,
      honorPartyIntents: 18.8,
      maximizeCommandClarity_heiress: 12.5,
      minimizeLiabilityExposure: 8.125,
      maximizeAffinity: 7.05,
      minimizeTacticalNonsense: 3.75,
      minimizeDiscord: 3.75,
      maximizeGameplaySynergy: 2.35,
    });
    check('7A: every value strictly positive', Object.values(caseA).every(w => (w ?? 0) > 0));

    // --- 7B: as A, plus two profile-less Councillors. Total clout 4.35.
    // Silent attendees vote for the institution and nothing else: the
    // defaulted strategies grow by exactly 2 x default, personal ones don't move.
    const caseB = blendDoctrine(room('heiress', 'blank_bursar', ['blank_c1', 'blank_c2']), doctrineOf);
    displayDoctrine('TEST 7B: as 7A plus two profile-less Councillors', caseB);
    const defaults = generateDefaultWeights();
    const silentOnlyAddDefaults = Object.keys({ ...caseA, ...caseB }).every(key => {
      const id = key as StrategyId;
      const delta = (caseB[id] ?? 0) - (caseA[id] ?? 0);
      return approx(delta, 2 * (defaults[id] ?? 0));
    });
    check('7B: silent Councillors add exactly 2x the defaults, nothing else', silentOnlyAddDefaults);
    const floorB = sumOf(caseB, Object.keys(defaults).filter(k => defaults[k as StrategyId] > 0));
    check(`7B: institutional floor = 182.7 (got ${floorB.toFixed(3)})`, approx(floorB, 182.7));

    // --- 7C: Heiress as Margrave, the hypothetical Arsonist as Bursar.
    const caseC = blendDoctrine(room('heiress', 'arsonist'), doctrineOf);
    displayDoctrine('TEST 7C: Heiress + Arsonist', caseC);
    expectWeights('7C', caseC, {
      minimizeMarchingUnfitness: 35.25,
      // The dissenter drags the floor down by his standing and no further:
      // 15*1.25 + 5*1.1. Not 5, and not 35.25.
      minimizeLevelHardship: 24.25,
      honorPartyIntents: 18.8,
      minimizeChildVulnerability: 13.2,
      // Two holders compound: 3*1.25 + 8*1.1. The old average gave ~5.7.
      minimizeTacticalNonsense: 12.55,
      maximizeCommandClarity_heiress: 12.5,
      minimizeChildVulnerability_arsonist: 9.9,
      minimizeLiabilityExposure: 8.125,
      maximizeAffinity: 7.05,
      minimizeDiscord: 3.75,
      maximizeGameplaySynergy: 2.35,
    });

    // --- 7D: An empty council returns {} so defineWeights supplies bare defaults.
    const empty = blendDoctrine(room('', ''), doctrineOf);
    check('7D: empty council returns {}', Object.keys(empty).length === 0);

    // --- 7E: Someone holding two chairs contributes one copy, at the higher clout.
    const doubled = blendDoctrine(room('heiress', 'blank_bursar', ['blank_bursar']), doctrineOf);
    check('7E: two-chair holder counted once, at Bursar clout',
      approx(doubled.minimizeLevelHardship ?? 0, 35.25));

    // --- 7F: Zero is a real vote. A lone Margrave who zeroes a defaulted
    // strategy must come out at 0 -- not missing, or defineWeights would
    // quietly refill it with the default 15.
    const zeroed = blendDoctrine(room('zero_margrave', ''), doctrineOf);
    check('7F: lone zero vote survives as an explicit 0',
      'minimizeLevelHardship' in zeroed && zeroed.minimizeLevelHardship === 0);
    const zeroOutvoted = blendDoctrine(room('zero_margrave', 'blank_bursar'), doctrineOf);
    check('7F: zero vote only removes its own copy (15 * 1.1 = 16.5)',
      approx(zeroOutvoted.minimizeLevelHardship ?? 0, 16.5));
  }

  // --- TEST CASE 9: The real doctrines (defaultCharacterStrategies.json) ---
  // Read the same way the planning route reads them.
  {
    console.log('\n--- TEST 9: The real doctrines ---');
    const realDoctrineOf = (id: string) => gameData.getCharacterDoctrine(id);
    const defaults = generateDefaultWeights();

    // Every id in every doctrine must be a real strategy, or defineWeights
    // warns and silently drops the weight.
    const unknown = Object.keys(gameData.getCharacterTemplates()).flatMap(id =>
      Object.keys(realDoctrineOf(id)).filter(key => !isStrategyId(key)).map(key => `${id}.${key}`));
    check(`9: no unknown strategy ids in any doctrine (${unknown.join(', ') || 'none'})`, unknown.length === 0);

    // Personal mass: the new opinions only (strategies with no default).
    const personalMass = (id: string) => Object.entries(realDoctrineOf(id))
      .filter(([key]) => (defaults[key as StrategyId] ?? 0) === 0)
      .reduce((sum, [, w]) => sum + (w ?? 0), 0);
    check(`9: personal mass -- Arsonist ${personalMass('arsonist')} (spec 28.5), Heiress ${personalMass('heiress')} (spec 22.5)`,
      personalMass('arsonist') === 28.5 && personalMass('heiress') === 22.5);

    // The Arsonist alone, as Margrave (clout 1.25): his seven entries plus the
    // defaults, all at his clout. Affinity is an explicit 0, not missing.
    const alone = blendDoctrine(room('arsonist', ''), realDoctrineOf);
    displayDoctrine('TEST 9: Arsonist alone, as Margrave', alone);
    expectWeights('9: Arsonist alone', alone, {
      minimizeChildVulnerability_arsonist: 12.5,
      minimizeRoleAmbiguity: 10,
      maximizeTriageOdds_arsonist: 10,
      minimizeTacticalNonsense: 3.125,
      minimizeMarchingUnfitness: 11.25,   // 9 x 1.25, not 15 x 1.25
      honorPartyIntents: 5,
      maximizeAffinity: 0,
      minimizeLevelHardship: 18.75,
      maximizeGameplaySynergy: 1.25,
    });
    check('9: maximizeAffinity is present at exactly 0', 'maximizeAffinity' in alone && alone.maximizeAffinity === 0);

    // Heiress as Margrave, Arsonist as Bursar: tactical nonsense compounds,
    // 3 x 1.25 + 2.5 x 1.1 = 6.5, rather than averaging to 2.75.
    const both = blendDoctrine(room('heiress', 'arsonist'), realDoctrineOf);
    displayDoctrine('TEST 9: Heiress (Margrave) + Arsonist (Bursar)', both);
    check(`9: minimizeTacticalNonsense compounds to 6.5 (got ${both.minimizeTacticalNonsense})`,
      approx(both.minimizeTacticalNonsense ?? 0, 6.5));
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
    const blended = blendDoctrine(council, (id) => gameData.getCharacterDoctrine(id));
    displayDoctrine('TEST 8: Live Roster -- blended doctrine', blended);

    // Scale invariance. Summing inflates the absolute weights with attendance;
    // that must not matter to the planner. Score a fixed composition against
    // fixed stats with the blend at x1 and x3: every score should scale by
    // exactly 3, so no comparison between compositions can flip. (Asserting
    // on findOptimalArrangement's pick instead would be flaky -- the annealer
    // is unseeded.)
    const heroes = Object.keys(liveEstate.characters).slice(0, 8);
    if (heroes.length === 8) {
      const composition = [heroes.slice(0, 4), heroes.slice(4, 8)];
      const stats = generateScoringStatistics(heroes, liveEstate.characters, 4, 500);
      const scaled: StrategyWeights = {};
      for (const [id, w] of Object.entries(blended)) scaled[id as StrategyId] = (w ?? 0) * 3;
      const base = { ...generateDefaultWeights(), ...blended };
      const triple = { ...generateDefaultWeights(), ...scaled };
      const s1 = analyzeComposition(composition, liveEstate.characters, base, stats, 0.5);
      const s3 = analyzeComposition(composition, liveEstate.characters, triple, stats, 0.5);
      check(`8: tripling every weight triples the score (${s1.finalScore.toFixed(3)} -> ${s3.finalScore.toFixed(3)})`,
        approx(s3.finalScore, 3 * s1.finalScore));
    }
  }
}

runTests().catch(error => {
  console.error("\nAn unexpected error occurred during the test run:", error);
  process.exit(1);
});
