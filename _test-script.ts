import { findBestComposition, StrategyWeights } from './server/services/townHall/expeditionPlanner.ts';
import { Character, CharacterRecord } from './shared/types/types';

// ==================================
// 0. MOCK FACTORY (Unchanged)
// ==================================

function createMockCharacter(partialChar: Partial<Character> & { identifier: string }): Character {
    const baseCharacter: Character = {
        identifier: '', title: '', name: '', level: 0, money: 0, description: '', history: '',
        summary: '', race: 'Human', gender: 'Male', religion: 'None', zodiac: 'Leo', traits: [],
        status: { physical: 100, mental: 100, affliction: '', description: '', wounds: [], diseases: [] },
        stats: { strength: 5, agility: 5, intelligence: 5, authority: 5, sociability: 5 },
        locations: { residence: [], workplaces: [], frequents: [] },
        appearance: { height: '', build: '', skinTone: '', hairColor: '', hairStyle: '', features: '' },
        clothing: { head: '', body: '', legs: '', accessories: '' },
        combat: { role: 'Damage', strengths: [], weaknesses: [] },
        magic: 'None', notes: [], relationships: {},
    };
    const finalRelationships = { ...baseCharacter.relationships, ...partialChar.relationships };
    return { ...baseCharacter, ...partialChar, relationships: finalRelationships };
}

console.log("--- Running Town Hall Composition Test Script ---");

// ==================================
// 1. SETUP MOCK DATA (Expanded)
// ==================================
console.log("Setting up expanded mock character data...");

// --- VETERAN HEROES (Level 3+) ---
const veteranCrusader = createMockCharacter({ identifier: 'vet_crusader', name: 'Reynauld', level: 4, relationships: { vet_highwayman: { affinity: 9, dynamic: '', description: '' }, rookieBountyHunter: { affinity: 9, dynamic: '', description: '' } } });
const veteranHighwayman = createMockCharacter({ identifier: 'vet_highwayman', name: 'Dismas', level: 3, relationships: { vet_crusader: { affinity: 9, dynamic: '', description: '' } } });
const loneWolfLeper = createMockCharacter({ identifier: 'lone_leper', name: 'Baldwin', level: 3 }); // High level, no strong relationships

// --- APPRENTICE HEROES (Level 0-2) ---
// An established, high-affinity team
const apprenticeVestal = createMockCharacter({ identifier: 'app_vestal', name: 'Junia', level: 2, relationships: { app_plague_doctor: { affinity: 8, dynamic: '', description: '' }, app_hellion: { affinity: 7, dynamic: '', description: '' } } });
const apprenticePlagueDoctor = createMockCharacter({ identifier: 'app_plague_doctor', name: 'Paracelsus', level: 1, relationships: { app_vestal: { affinity: 8, dynamic: '', description: '' } } });
const apprenticeHellion = createMockCharacter({ identifier: 'app_hellion', name: 'Boudica', level: 2, relationships: { app_vestal: { affinity: 7, dynamic: '', description: '' } } });

// A pair of rivals who shouldn't be together, but are decent level
const rivalOccultist = createMockCharacter({ identifier: 'rival_occultist', name: 'Alhazred', level: 2, relationships: { rival_arbalest: { affinity: 1, dynamic: '', description: '' } } });
const rivalArbalest = createMockCharacter({ identifier: 'rival_arbalest', name: 'Missandei', level: 2, relationships: { rival_occultist: { affinity: 1, dynamic: '', description: '' } } });

// Rookies (Level 0)
const rookieGraveRobber = createMockCharacter({ identifier: 'rook_graverobber', name: 'Audrey', level: 0 });
const rookieJester = createMockCharacter({ identifier: 'rook_jester', name: 'Sarmenti', level: 0 });
const rookieBountyHunter = createMockCharacter({ identifier: 'rook_bountyhunter', name: 'Tardif', level: 0, relationships: { vet_crusader: { affinity: 8, dynamic: '', description: '' } } });
const rookieHoundmaster = createMockCharacter({ identifier: 'rook_houndmaster', name: 'William', level: 0 });

const allCharacters: Character[] = [
    veteranCrusader, veteranHighwayman, loneWolfLeper,
    apprenticeVestal, apprenticePlagueDoctor, apprenticeHellion,
    rivalOccultist, rivalArbalest,
    rookieGraveRobber, rookieJester, rookieBountyHunter, rookieHoundmaster
];

const roster: CharacterRecord = {};
allCharacters.forEach(char => roster[char.identifier] = char);
const availableHeroIds = allCharacters.map(char => char.identifier);

// ==================================
// 2. HELPER FUNCTIONS FOR TESTING
// ==================================

// These functions are simplified versions from your service for local testing/display
const getPartyAffinityScore = (party: string[], roster: CharacterRecord): number => {
    let score = 0;
    for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) {
        const c1 = roster[party[i]], c2 = roster[party[j]];
        score += (c1.relationships[party[j]]?.affinity ?? 3) + (c2.relationships[party[i]]?.affinity ?? 3);
    }
    return score;
};

const getPartyLevelPenalty = (party: string[], roster: CharacterRecord): number => {
    const levels = party.map(id => roster[id]?.level ?? 0);
    const maxLevel = Math.max(...levels);
    let missionLevelTier = 0;
    if (maxLevel >= 5) missionLevelTier = 5;
    else if (maxLevel >= 3) missionLevelTier = 3;
    else missionLevelTier = 0; // Apprentice missions (Lvl 0-2)
    let hardship = 0;
    for (const level of levels) {
        const h = missionLevelTier - level;
        if (h > 0) hardship += Math.pow(h, 3);
    }
    return hardship;
};

const displayComposition = (title: string, composition: string[][], roster: CharacterRecord) => {
    console.log(title);
    composition.forEach((party, index) => {
        const affinityScore = getPartyAffinityScore(party, roster);
        const levelPenalty = getPartyLevelPenalty(party, roster);
        const memberDetails = party.map(id => `${roster[id]?.name} (L${roster[id]?.level})`).join(', ');
        
        console.log(`  Party ${index + 1}: ${memberDetails}`);
        console.log(`    - Raw Affinity Score: ${affinityScore.toFixed(2)} | Raw Level Penalty: ${levelPenalty.toFixed(2)}`);
    });
};

// ==================================
// 3. RUN THE SERVICE FUNCTION
// ==================================

console.log(`\n--- TEST CASE 1: Prioritizing Level Cohesion Heavily ---`);
console.log("Expected: Veterans (L3+) should be grouped together. Apprentices (L0-2) should form other teams.");

const levelFocusedWeights: Partial<StrategyWeights> = {
    levelCohesion: 15.0, // Level penalty is 15x more important than affinity
    affinity: 1.0,
};

const levelFocusedComposition = findBestComposition(availableHeroIds, roster, levelFocusedWeights);
displayComposition("Final Composition (Level Focus):", levelFocusedComposition, roster);


console.log(`\n\n--- TEST CASE 2: Prioritizing Affinity Heavily ---`);
console.log("Expected: May create level-mismatched teams to group high-affinity pairs, like putting a rookie with the L4 Crusader if it improves the score.");

const affinityFocusedWeights: Partial<StrategyWeights> = {
    levelCohesion: 1.0,
    affinity: 15.0,
};

const affinityFocusedComposition = findBestComposition(availableHeroIds, roster, affinityFocusedWeights);
displayComposition("Final Composition (Affinity Focus):", affinityFocusedComposition, roster);