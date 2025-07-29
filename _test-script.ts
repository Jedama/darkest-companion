import { findAffinityComposition } from './server/services/townHall/expeditionPlanner.ts';
import { Character, CharacterRecord } from './shared/types/types';

// ==================================
// 0. MOCK FACTORY
// ==================================

/**
 * Creates a complete, type-safe Character object for testing.
 * It takes a Partial<Character> and merges it with a complete
 * default object, satisfying all of TypeScript's type requirements.
 * @param partialChar - The properties you want to override for this specific mock.
 * @returns A full Character object.
 */
function createMockCharacter(partialChar: Partial<Character> & { identifier: string }): Character {
    const baseCharacter: Character = {
        identifier: '',
        title: '',
        name: '',
        level: 0,
        money: 0,
        description: '',
        history: '',
        summary: '',
        race: 'Human',
        gender: 'Male',
        religion: 'None',
        zodiac: 'Leo',
        traits: [],
        status: { physical: 100, mental: 100, affliction: '', description: '', wounds: [], diseases: [] },
        stats: { strength: 5, agility: 5, intelligence: 5, authority: 5, sociability: 5 },
        locations: { residence: [], workplaces: [], frequents: [] },
        appearance: { height: '', build: '', skinTone: '', hairColor: '', hairStyle: '', features: '' },
        clothing: { head: '', body: '', legs: '', accessories: '' },
        combat: { role: 'Damage', strengths: [], weaknesses: [] },
        magic: 'None',
        notes: [],
        relationships: {},
    };

    // Deep merge relationships to avoid overwriting the whole object
    const finalRelationships = {
        ...baseCharacter.relationships,
        ...partialChar.relationships
    };

    return {
        ...baseCharacter,
        ...partialChar,
        relationships: finalRelationships,
    };
}


console.log("--- Running Town Hall Composition Test Script ---");

// ==================================
// 1. SETUP MOCK DATA (Now Type-Safe)
// ==================================
console.log("Setting up mock character data...");

// The "Clique": High affinity with each other.
const vestal = createMockCharacter({ identifier: 'vestal', name: 'Junia', relationships: { plague_doctor: { affinity: 8, dynamic: '', description: '' }, grave_robber: { affinity: 7, dynamic: '', description: '' } } });
const plague_doctor = createMockCharacter({ identifier: 'plague_doctor', name: 'Paracelsus', relationships: { vestal: { affinity: 8, dynamic: '', description: '' }, grave_robber: { affinity: 7, dynamic: '', description: '' } } });
const grave_robber = createMockCharacter({ identifier: 'grave_robber', name: 'Audrey', relationships: { plague_doctor: { affinity: 7, dynamic: '', description: '' }, vestal: { affinity: 7, dynamic: '', description: '' } } });

// The "Rivals": Low affinity with each other, but okay with others.
const occultist = createMockCharacter({ identifier: 'occultist', name: 'Alhazred', relationships: { crusader: { affinity: 1, dynamic: '', description: '' }, vestal: { affinity: 2, dynamic: '', description: '' } } });
const crusader = createMockCharacter({ identifier: 'crusader', name: 'Reynauld', relationships: { occultist: { affinity: 1, dynamic: '', description: '' }, highwayman: { affinity: 9, dynamic: '', description: '' } } });
const highwayman = createMockCharacter({ identifier: 'highwayman', name: 'Dismas', relationships: { crusader: { affinity: 9, dynamic: '', description: '' } } });

// The "Loners": Neutral affinity with most.
const leper = createMockCharacter({ identifier: 'leper', name: 'Baldwin' });
const arbalest = createMockCharacter({ identifier: 'arbalest', name: 'Missandei' });


const allCharacters: Character[] = [
    vestal, plague_doctor, grave_robber, 
    occultist, crusader, highwayman,
    leper, arbalest
];

const roster: CharacterRecord = {};
allCharacters.forEach(char => {
    roster[char.identifier] = char;
});

const availableHeroIds = allCharacters.map(char => char.identifier);

console.log(`\nTesting with a roster of ${availableHeroIds.length} heroes.`);
console.log("Expected outcome: The algorithm should try to group (Vestal, Plague Doctor, Grave Robber) and (Crusader, Highwayman).\n");

// ==================================
// 2. RUN THE SERVICE FUNCTION
// ==================================

const getScore = (composition: string[][], roster: CharacterRecord): number => {
    let totalScore = 0;
    for (const party of composition) {
        for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) {
            const c1 = roster[party[i]], c2 = roster[party[j]];
            totalScore += (c1.relationships[party[j]]?.affinity ?? 3) + (c2.relationships[party[i]]?.affinity ?? 3);
        }
    }
    return totalScore;
};

const displayComposition = (title: string, composition: string[][], roster: CharacterRecord) => {
    console.log(title);
    const totalScore = getScore(composition, roster);
    composition.forEach((party, index) => {
        const partyScore = getScore([party], roster);
        const memberNames = party.map(id => roster[id]?.name ?? 'Unknown').join(', ');
        console.log(`  Party ${index + 1} (Score: ${partyScore.toFixed(2)}): ${memberNames}`);
    });
    console.log(`Total Score: ${totalScore.toFixed(2)}`);
};


// --- Generate a random composition first to see the baseline ---
const randomComposition = findAffinityComposition(availableHeroIds, roster, 4, 0); // 0 iterations = random
displayComposition("--- Initial Random Composition ---", randomComposition, roster);

// --- Run the actual optimizer ---
console.log("\n--- Running Optimizer... ---");
const finalComposition = findAffinityComposition(availableHeroIds, roster, 4, 2000); // 2000 iterations for a good result

// ==================================
// 3. DISPLAY RESULTS
// ==================================
console.log("");
displayComposition("--- Final Optimized Composition ---", finalComposition, roster);

if (getScore(finalComposition, roster) > getScore(randomComposition, roster)) {
    console.log("\nSUCCESS: The optimized score is higher than the random score.");
} else {
    console.log("\nNOTE: The optimized score is not higher than the random score. This can happen by chance if the random start was already very good. Try running again.");
}