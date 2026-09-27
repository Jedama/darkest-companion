// server/tests/_test_triage.ts
//
// Self-executing PASS/FAIL checks for the triage strategies:
// maximizeTriageOdds (genericStrategies.ts) and maximizeTriageOdds_arsonist
// (characterStrategies.ts). No save file needed -- every roster is built here.
//
// Heroes are built to an exact heroFitness value (stress only, full health,
// no affliction or disease), and every case is brute-forced: 8 heroes, all 35
// ways to split them into two parties of 4. Expected figures are from the
// spec, which quotes raw scorer output to three decimals.

import { Character, CharacterRecord } from '../../shared/types/types.js';
import { heroFitness } from '../services/townHall/fitness.js';
import type { Composition } from '../services/townHall/expeditionPlanner.js';
import {
  heroSurvival,
  partyOdds,
  triageGate,
  scoreCompositionByTriageOdds,
} from '../services/townHall/expeditionStrategies/genericStrategies.js';
import { scoreCompositionByTriageOdds_arsonist } from '../services/townHall/expeditionStrategies/characterStrategies.js';

// ==================================
// 1. HELPERS
// ==================================

type Tag = 'Criminal' | 'Immoral' | 'Just' | 'Child';
const TAG_CODES: Record<string, Tag> = { C: 'Criminal', I: 'Immoral', J: 'Just', K: 'Child' };

/** Inverts heroFitness's stress term: STRESS_EXPONENT is 1.8 in fitness.ts. */
function mentalForFitness(fitness: number): number {
  return 100 - 100 * Math.pow(1 - fitness, 1 / 1.8);
}

function createHero(id: string, fitness: number, tags: Tag[] = []): Character {
  return {
    identifier: id,
    title: id,
    name: id,
    description: '',
    summary: '',
    history: '',
    race: 'Human',
    gender: 'Unknown',
    religion: 'None',
    zodiac: 'None',
    traits: [],
    stats: { strength: 5, agility: 5, intelligence: 5, authority: 5, sociability: 5 },
    equipment: [],
    appearance: { height: '', build: '', skinTone: '', hairColor: '', hairStyle: '', features: '' },
    clothing: { head: '', body: '', legs: '', accessories: '' },
    combat: { role: '', strengths: [], weaknesses: [] },
    magic: 'None',
    notes: [],
    tags,
    level: 3,
    money: 0,
    status: {
      physical: 100,
      mental: mentalForFitness(fitness),
      affliction: '',
      description: '',
      wounds: [],
      diseases: [],
    },
    relationships: {},
    locations: { residence: [], workplaces: [], frequents: [] },
    strategyWeights: {},
  };
}

/**
 * Builds a roster from compact specs like '1.00J' or '0.30CI'. Ids are
 * positional (h0..h7) so identical specs stay distinct heroes.
 */
function buildRoster(specs: string[]): { roster: CharacterRecord; ids: string[] } {
  const roster: CharacterRecord = {};
  const ids: string[] = [];
  specs.forEach((spec, i) => {
    const match = /^([\d.]+)([A-Z]*)$/.exec(spec);
    if (!match) throw new Error(`bad hero spec: ${spec}`);
    const id = `h${i}`;
    roster[id] = createHero(id, parseFloat(match[1]), [...match[2]].map(c => TAG_CODES[c]));
    ids.push(id);
  });
  return { roster, ids };
}

/** Every way to split 8 heroes into two unordered parties of 4. */
function allSplits(ids: string[]): Composition[] {
  const splits: Composition[] = [];
  const rest = ids.slice(1);
  const choose = (start: number, picked: string[]) => {
    if (picked.length === 3) {
      const a = [ids[0], ...picked];
      splits.push([a, ids.filter(id => !a.includes(id))]);
      return;
    }
    for (let i = start; i < rest.length; i++) choose(i + 1, [...picked, rest[i]]);
  };
  choose(0, []);
  return splits;
}

type Scorer = (composition: Composition, roster: CharacterRecord) => number;

function rank(roster: CharacterRecord, ids: string[], scorer: Scorer) {
  return allSplits(ids)
    .map(composition => ({ composition, score: scorer(composition, roster) }))
    .sort((a, b) => b.score - a.score);
}

/** Order-free identity of a split, for comparing arrangements. */
function splitKey(composition: Composition): string {
  return composition.map(p => [...p].sort().join(',')).sort().join(' | ');
}

/** The split described by two lists of positions into the roster. */
function splitOf(ids: string[], a: number[], b: number[]): Composition {
  return [a.map(i => ids[i]), b.map(i => ids[i])];
}

function approx(a: number, b: number, eps = 5e-4): boolean {
  return Math.abs(a - b) < eps;
}

let failures = 0;
function check(label: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

// ==================================
// 2. TESTS
// ==================================

function testHelpers() {
  console.log('\n--- Helpers ---');

  const fitnessCurve = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];
  const expectedSurvival = [0.982, 0.961, 0.917, 0.832, 0.690, 0.500, 0.310, 0.168, 0.083, 0.039, 0.018];
  const heroes = fitnessCurve.map((f, i) => createHero(`s${i}`, f));
  check('test heroes land on their intended fitness',
    heroes.every((h, i) => approx(heroFitness(h), fitnessCurve[i], 1e-9)));
  check('heroSurvival matches the spec table',
    heroes.every((h, i) => approx(heroSurvival(h), expectedSurvival[i])));

  const odds = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1.0];
  const expectedGate = [0.018, 0.039, 0.119, 0.310, 0.500, 0.690, 0.881, 0.961, 0.982];
  check('triageGate matches the spec table',
    odds.every((o, i) => approx(triageGate(o), expectedGate[i])));

  const { roster, ids } = buildRoster(['1.00', '0.70', '0.40', '0.90']);
  const forward = partyOdds(ids, roster);
  const reversed = partyOdds([...ids].reverse(), roster);
  check('partyOdds is order-independent', approx(forward, reversed, 1e-12));
  check('partyOdds skips a missing hero rather than zeroing the party',
    partyOdds([...ids, 'nobody'], roster) === forward);
}

function testGeneric() {
  console.log('\n--- maximizeTriageOdds (generic) ---');

  const cases: { name: string; specs: string[]; best: number; worst: number }[] = [
    { name: 'all 1.00', specs: Array(8).fill('1.00'), best: 1.938, worst: 1.938 },
    { name: 'mild spread', specs: ['1.00', '0.95', '0.90', '0.85', '0.80', '0.75', '0.70', '0.65'], best: 1.588, worst: 1.482 },
    { name: 'one wreck', specs: ['1.00', '0.95', '0.90', '0.90', '0.85', '0.80', '0.80', '0.15'], best: 0.981, worst: 0.917 },
    { name: 'two weak links', specs: ['1.00', '1.00', '1.00', '1.00', '1.00', '1.00', '0.30', '0.30'], best: 0.991, worst: 0.123 },
    { name: 'broadly battered', specs: ['0.90', '0.80', '0.75', '0.70', '0.60', '0.55', '0.45', '0.35'], best: 0.786, worst: 0.121 },
    { name: 'grim', specs: ['0.70', '0.65', '0.60', '0.55', '0.50', '0.45', '0.40', '0.35'], best: 0.152, worst: 0.058 },
  ];

  const ranked: Record<string, { ids: string[]; results: ReturnType<typeof rank> }> = {};
  for (const c of cases) {
    const { roster, ids } = buildRoster(c.specs);
    const results = rank(roster, ids, scoreCompositionByTriageOdds);
    ranked[c.name] = { ids, results };
    const best = results[0].score;
    const worst = results[results.length - 1].score;
    check(`${c.name}: best ${best.toFixed(3)} / worst ${worst.toFixed(3)} (spec ${c.best} / ${c.worst})`,
      approx(best, c.best) && approx(worst, c.worst));
  }

  // All-healthy is an exact tie: triage silent.
  const healthy = ranked['all 1.00'].results;
  check('all healthy: every arrangement scores exactly the same',
    healthy.every(r => r.score === healthy[0].score));

  // Mild spread prefers BALANCE, and the sorted split is the very worst.
  const mild = ranked['mild spread'];
  check('mild spread: best is the balanced [1.00 .90 .80 .65] | [.95 .85 .75 .70]',
    splitKey(mild.results[0].composition) === splitKey(splitOf(mild.ids, [0, 2, 4, 7], [1, 3, 5, 6])));
  check('mild spread: the sorted [1.00 .95 .90 .85] | [.80 .75 .70 .65] is the worst',
    splitKey(mild.results[mild.results.length - 1].composition) === splitKey(splitOf(mild.ids, [0, 1, 2, 3], [4, 5, 6, 7])));

  // Two weak links prefers CONCENTRATION.
  const weak = ranked['two weak links'];
  const weakBest = weak.results[0].composition;
  check('two weak links: best puts both 0.30s together',
    weakBest.some(p => p.includes(weak.ids[6]) && p.includes(weak.ids[7])));

  // Broadly battered sorts cleanly: top four together, bottom four written off.
  const battered = ranked['broadly battered'];
  check('broadly battered: best is top four | bottom four',
    splitKey(battered.results[0].composition) === splitKey(splitOf(battered.ids, [0, 1, 2, 3], [4, 5, 6, 7])));

  // The grim roster prefers balance: nothing to buy by writing a team off.
  const grim = ranked['grim'];
  check('grim: best is [.70 .65 .60 .55] | [.50 .45 .40 .35] at 0.152',
    splitKey(grim.results[0].composition) === splitKey(splitOf(grim.ids, [0, 1, 2, 3], [4, 5, 6, 7])));
}

function testArsonist() {
  console.log('\n--- maximizeTriageOdds_arsonist ---');

  // Test 1: sorts the write-off team by desert, at a cost. The generic can't
  // tell the healthy heroes apart, so it ties every split that puts the two
  // 0.30s together; the Arsonist has one clear favourite among them.
  {
    const { roster, ids } = buildRoster(['1.00J', '1.00J', '1.00', '1.00', '1.00CI', '1.00CI', '0.30J', '0.30']);
    const arsonist = rank(roster, ids, scoreCompositionByTriageOdds_arsonist);
    const expected = splitOf(ids, [0, 1, 2, 3], [4, 5, 6, 7]);
    check(`T1: Arsonist's best ${arsonist[0].score.toFixed(3)} (spec 1.404) is [J J . .] | [CI CI 0.30J 0.30]`,
      approx(arsonist[0].score, 1.404) && splitKey(arsonist[0].composition) === splitKey(expected));
    check('T1: ...and it is his unique best', arsonist[1].score < arsonist[0].score - 1e-9);
    const generic = rank(roster, ids, scoreCompositionByTriageOdds);
    check('T1: the generic is indifferent between that split and its own best (0.991)',
      approx(scoreCompositionByTriageOdds(expected, roster), generic[0].score, 1e-9) && approx(generic[0].score, 0.991));
  }

  // Test 2: inert when fitness alone decides -- same pick, different totals.
  {
    const { roster, ids } = buildRoster(['0.90J', '0.80', '0.75CI', '0.70', '0.60C', '0.55J', '0.45I', '0.35']);
    const generic = rank(roster, ids, scoreCompositionByTriageOdds);
    const arsonist = rank(roster, ids, scoreCompositionByTriageOdds_arsonist);
    check('T2: both pick the same split',
      splitKey(generic[0].composition) === splitKey(arsonist[0].composition));
    check(`T2: totals ${generic[0].score.toFixed(3)} generic (spec 0.786), ${arsonist[0].score.toFixed(3)} Arsonist (spec 1.066)`,
      approx(generic[0].score, 0.786) && approx(arsonist[0].score, 1.066));
  }

  // Test 3: breaks up the sacrifice rather than doom a child.
  {
    const { roster, ids } = buildRoster(['1.00', '1.00', '1.00CI', '1.00', '0.30K', '0.30C', '0.90', '0.90']);
    const generic = rank(roster, ids, scoreCompositionByTriageOdds);
    const arsonist = rank(roster, ids, scoreCompositionByTriageOdds_arsonist);
    check(`T3: generic best ${generic[0].score.toFixed(3)} (spec 0.991) is [1.00 x4] | [0.30K 0.30C 0.90 0.90]`,
      approx(generic[0].score, 0.991) &&
      splitKey(generic[0].composition) === splitKey(splitOf(ids, [0, 1, 2, 3], [4, 5, 6, 7])));
    check(`T3: Arsonist best ${arsonist[0].score.toFixed(3)} (spec 0.116) is [1.00 1.00 1.00 0.90] | [1.00CI 0.30C 0.30K 0.90]`,
      approx(arsonist[0].score, 0.116) &&
      arsonist[0].composition.some(p => [2, 4, 5].every(i => p.includes(ids[i]))));
  }
}

function testStructural() {
  console.log('\n--- Structural ---');

  const { roster, ids } = buildRoster(['0.30C', '0.30I', '0.30J', '0.30K', '1.00', '1.00', '1.00', '1.00']);

  check('both return 0 for a single party',
    scoreCompositionByTriageOdds([ids.slice(0, 4)], roster) === 0 &&
    scoreCompositionByTriageOdds_arsonist([ids.slice(0, 4)], roster) === 0);
  check('both return 0 for no parties',
    scoreCompositionByTriageOdds([], roster) === 0 && scoreCompositionByTriageOdds_arsonist([], roster) === 0);

  // With no Criminal/Immoral/Just/Child anywhere, desert is 1 and the
  // Arsonist's formula reduces exactly to the generic.
  const untagged = buildRoster(['1.00', '0.95', '0.90', '0.15', '0.85', '0.30', '0.80', '0.30']);
  check('Arsonist equals the generic on every split when nobody carries a judged tag',
    allSplits(untagged.ids).every(c =>
      approx(scoreCompositionByTriageOdds_arsonist(c, untagged.roster), scoreCompositionByTriageOdds(c, untagged.roster), 1e-12)));

  // His own Criminal/Immoral never count: him in a doomed party scores the
  // same as a tagless hero of equal fitness in his place.
  const withHim: CharacterRecord = { ...roster, arsonist: createHero('arsonist', 1.0, ['Criminal', 'Immoral']) };
  const withStranger: CharacterRecord = { ...roster, stranger: createHero('stranger', 1.0) };
  const doomed = [ids[0], ids[1], ids[2]];
  const healthy = ids.slice(4);
  check("the Arsonist's own tags never affect desert",
    approx(
      scoreCompositionByTriageOdds_arsonist([[...doomed, 'arsonist'], healthy], withHim),
      scoreCompositionByTriageOdds_arsonist([[...doomed, 'stranger'], healthy], withStranger),
      1e-12));
}

// ==================================
// 3. RUN
// ==================================

console.log('\n========================================');
console.log('==       RUNNING TRIAGE TESTS         ==');
console.log('========================================');
testHelpers();
testGeneric();
testArsonist();
testStructural();
console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}\n`);
