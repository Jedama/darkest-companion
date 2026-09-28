// server/tests/_test_role_ambiguity.ts
//
// Self-executing PASS/FAIL checks for minimizeRoleAmbiguity
// (scorePartyByRoleAmbiguity, genericStrategies.ts). Uses the real character
// templates for the spec's verification table and distribution, and made-up
// heroes where the roster has no example (only two heroes fill exactly one
// role, and both are pure damage).

import { CharacterRecord } from '../../shared/types/types.js';
import StaticGameDataManager from '../staticGameDataManager.js';
import { createCharacterFromTemplate } from '../services/game/characterService.js';
import { scorePartyByRoleAmbiguity } from '../services/townHall/expeditionStrategies/genericStrategies.js';

const UNFILLED_PENALTY = 3.5;

let failures = 0;
function check(label: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

function approx(a: number, b: number, eps = 5e-4): boolean {
  return Math.abs(a - b) < eps;
}

/** Every ordering of a small array. */
function orderings<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    orderings([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]));
}

/** A hero that only carries the given tags; enough for this scorer. */
function taggedHero(id: string, tags: string[]) {
  const gameData = StaticGameDataManager.getInstance();
  const template = Object.values(gameData.getCharacterTemplates())[0];
  return { ...createCharacterFromTemplate(template), identifier: id, tags };
}

async function run() {
  const gameData = StaticGameDataManager.getInstance();
  await gameData.initialize();

  const roster: CharacterRecord = {};
  for (const [id, template] of Object.entries(gameData.getCharacterTemplates())) {
    roster[id] = createCharacterFromTemplate(template);
  }
  const ids = Object.keys(roster);

  console.log('\n========================================');
  console.log('==     RUNNING ROLE AMBIGUITY TESTS   ==');
  console.log('========================================');

  // --- Spec verification table (real roster) ---
  console.log('\n--- Verification table ---');
  const table: { party: string[]; score: number; note: string }[] = [
    { party: ['zenith', 'mambo', 'tempest', 'resonant'], score: 4.585, note: '24 readings: total mush' },
    { party: ['man_at_arms', 'vestal', 'highwayman', 'occultist'], score: 2.585, note: '6 readings' },
    { party: ['crusader', 'plague_doctor', 'arbalest', 'jester'], score: 2.0, note: '4 readings' },
    { party: ['rampart', 'vestal', 'fawn', 'occultist'], score: 1.0, note: '2 readings: the Fawn pins it down' },
    { party: ['fawn', 'grave_robber', 'vestal', 'man_at_arms'], score: UNFILLED_PENALTY, note: 'two pure DMG: unfilled' },
  ];
  for (const row of table) {
    const missing = row.party.filter(id => !roster[id]);
    if (missing.length) {
      check(`${row.party.join(', ')}: heroes missing from roster (${missing.join(', ')})`, false);
      continue;
    }
    const score = scorePartyByRoleAmbiguity(row.party, roster);
    check(`${row.party.join(', ')} -> ${score.toFixed(3)} (spec ${row.score}; ${row.note})`, approx(score, row.score));
  }

  // --- Structural ---
  console.log('\n--- Structural ---');

  const specialists: CharacterRecord = {
    def: taggedHero('def', ['Tank']),
    sup: taggedHero('sup', ['Healer']),
    dmg: taggedHero('dmg', ['Burner']),
    ctl: taggedHero('ctl', ['Stunner']),
  };
  check('four heroes with one distinct role each score 0 (determined)',
    scorePartyByRoleAmbiguity(['def', 'sup', 'dmg', 'ctl'], specialists) === 0);

  // Every party containing both pure-DMG heroes, whoever the other two are.
  const others = ids.filter(id => id !== 'fawn' && id !== 'grave_robber');
  let pairs = 0;
  let allUnfilled = true;
  for (let i = 0; i < others.length; i++) {
    for (let j = i + 1; j < others.length; j++) {
      pairs++;
      const score = scorePartyByRoleAmbiguity(['fawn', 'grave_robber', others[i], others[j]], roster);
      if (score !== UNFILLED_PENALTY) allUnfilled = false;
    }
  }
  check(`two pure-DMG heroes always score UNFILLED_PENALTY (${pairs} parties)`, allUnfilled);

  const sample = ['rampart', 'vestal', 'fawn', 'occultist'];
  const baseline = scorePartyByRoleAmbiguity(sample, roster);
  check('order-independent within a party (all 24 orderings)',
    orderings(sample).every(p => scorePartyByRoleAmbiguity(p, roster) === baseline));

  check('returns 0 for a party of 3', scorePartyByRoleAmbiguity(['vestal', 'fawn', 'occultist'], roster) === 0);
  check('returns 0 for a party of 5',
    scorePartyByRoleAmbiguity(['rampart', 'vestal', 'fawn', 'occultist', 'crusader'], roster) === 0);

  const heroesWithoutRole = ids.filter(id =>
    scorePartyByRoleAmbiguity([id, 'def', 'sup', 'ctl'], { ...roster, ...specialists }) === UNFILLED_PENALTY &&
    scorePartyByRoleAmbiguity([id, 'def', 'sup', 'dmg'], { ...roster, ...specialists }) === UNFILLED_PENALTY &&
    scorePartyByRoleAmbiguity([id, 'def', 'dmg', 'ctl'], { ...roster, ...specialists }) === UNFILLED_PENALTY &&
    scorePartyByRoleAmbiguity([id, 'sup', 'dmg', 'ctl'], { ...roster, ...specialists }) === UNFILLED_PENALTY);
  check(`no hero in the roster lacks a role (found: ${heroesWithoutRole.join(', ') || 'none'})`,
    heroesWithoutRole.length === 0);

  // --- Distribution over random parties (loose bounds: it's a sample) ---
  console.log('\n--- Distribution, 8000 random parties ---');
  const N = 8000;
  const scores: number[] = [];
  for (let n = 0; n < N; n++) {
    const pool = [...ids];
    const party: string[] = [];
    for (let k = 0; k < 4; k++) party.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    scores.push(scorePartyByRoleAmbiguity(party, roster));
  }
  const unfilled = scores.filter(s => s === UNFILLED_PENALTY).length / N;
  const determined = scores.filter(s => s === 0).length / N;
  const mean = scores.reduce((a, b) => a + b, 0) / N;
  const sorted = scores.filter(s => s !== UNFILLED_PENALTY).sort((a, b) => a - b);
  const medianReadings = Math.round(Math.pow(2, sorted[Math.floor(sorted.length / 2)]));
  console.log(`  unfilled ${(unfilled * 100).toFixed(1)}%, determined ${(determined * 100).toFixed(1)}%, ` +
    `median ${medianReadings} readings (filled parties), mean score ${mean.toFixed(3)}`);
  check('unfilled around 5% (spec 5.0%)', unfilled > 0.035 && unfilled < 0.07);
  check('determined rare but reachable, around 2% (spec 2.0%)', determined > 0.01 && determined < 0.035);
  check('mean score around 2.65 (spec 2.646)', mean > 2.55 && mean < 2.75);

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}\n`);
}

run().catch(error => {
  console.error('\nAn unexpected error occurred during the test run:', error);
  process.exit(1);
});
