import { Character, CharacterRecord } from '../../../shared/types/types';

// ==================================
// 1. TYPE DEFINITIONS (Local to this service)
// ==================================

// Re-defining these here as they are specific to the output of this service.
// You can move them to your main types file if you prefer.
export type Party = string[];
export type Composition = Party[];

// ==================================
// 2. SCORING FUNCTIONS
// ==================================

/**
 * Calculates a simple affinity score for a single party.
 * @param party - An array of 4 character identifiers.
 * @param roster - The full record of all characters.
 * @returns A numerical score.
 */
function scorePartyByAffinity(party: Party, roster: CharacterRecord): number {
  let totalAffinity = 0;
  if (party.length < 2) {
    return 0;
  }

  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1Id = party[i];
      const char2Id = party[j];

      const char1 = roster[char1Id];
      const char2 = roster[char2Id];

      if (!char1 || !char2) continue;

      const affinity1to2 = char1.relationships[char2Id]?.affinity ?? 3;
      const affinity2to1 = char2.relationships[char1Id]?.affinity ?? 3;
      
      totalAffinity += affinity1to2 + affinity2to1;
    }
  }

  return totalAffinity;
}

/**
 * Calculates the total score for an entire composition of parties.
 * @param composition - An array of parties.
 * @param roster - The full record of all characters.
 * @returns The summed score of all parties.
 */
function scoreComposition(composition: Composition, roster: CharacterRecord): number {
    return composition.reduce((total, party) => {
        return total + scorePartyByAffinity(party, roster);
    }, 0);
}


// ==================================
// 3. THE OPTIMIZER
// ==================================

/**
 * Finds a high-scoring party composition using a "Stochastic Hill Climb" algorithm.
 * @param availableHeroes - An array of character identifiers to be sorted into teams.
 * @param roster - The full record of character data.
 * @param partySize - The desired size of each party (e.g., 4).
 * @param iterations - The number of optimization cycles to run.
 * @returns The best composition found.
 */
export function findAffinityComposition(
    availableHeroes: string[],
    roster: CharacterRecord,
    partySize: number = 4,
    iterations: number = 1000
): Composition {

    // --- Initial Random Guess ---
    const shuffledHeroes = [...availableHeroes].sort(() => Math.random() - 0.5);

    let bestComposition: Composition = [];
    for (let i = 0; i < shuffledHeroes.length; i += partySize) {
        bestComposition.push(shuffledHeroes.slice(i, i + partySize));
    }
    bestComposition = bestComposition.filter(party => party.length > 0);

    let bestScore = scoreComposition(bestComposition, roster);

    // --- Iterate and Improve ---
    for (let i = 0; i < iterations; i++) {
        const currentComposition = JSON.parse(JSON.stringify(bestComposition)) as Composition;
        
        if (currentComposition.length < 2) break;

        let party1Index = Math.floor(Math.random() * currentComposition.length);
        let party2Index = Math.floor(Math.random() * currentComposition.length);
        while (party1Index === party2Index) {
            party2Index = Math.floor(Math.random() * currentComposition.length);
        }

        const hero1Index = Math.floor(Math.random() * currentComposition[party1Index].length);
        const hero2Index = Math.floor(Math.random() * currentComposition[party2Index].length);

        const heroToSwap1 = currentComposition[party1Index][hero1Index];
        const heroToSwap2 = currentComposition[party2Index][hero2Index];

        currentComposition[party1Index][hero1Index] = heroToSwap2;
        currentComposition[party2Index][hero2Index] = heroToSwap1;

        const newScore = scoreComposition(currentComposition, roster);
        
        if (newScore > bestScore) {
            bestScore = newScore;
            bestComposition = currentComposition;
        }
    }

    return bestComposition;
}