import { Character, CharacterRecord, EstateRoles } from '../../../shared/types/types';
import { isVirtue, isAffliction } from '../../../shared/constants/conditions';

// ===================================================================
// 0. CONFIGURATION
// ===================================================================

const ELECTION_CONFIG = {
  FITNESS_THRESHOLDS: {
    MIN_MENTAL: 25,
    MIN_PHYSICAL: 25,
},
COUNCIL_SEATS: {
    BASE_SEATS: 0,
    SEATS_PER_ROSTER_MEMBER: 12,
    MAX_SEATS: 5,
    MIN_SEATS: 1,
    MIN_ROSTER_FOR_COUNCIL: 10,
  }
};

// ===================================================================
// 1. HELPER FUNCTIONS & SCORE CALCULATORS
// ===================================================================

/**
 * Calculates a hero's "Readiness Modifier" based on their current health,
 * stress, and status. This acts as a multiplier on their core competence.
 * @param hero The character to evaluate.
 * @returns A multiplier, typically between 0.1 and 1.15.
 */
function getReadinessModifier(hero: Character): number {
  let modifier = 1.0;

  // Virtue Bonus for proven mental fortitude.
  if (isVirtue(hero.status.affliction)) {
    modifier += 0.15;
  }
  // Affliction Penalty for being a massive liability in deliberations.
  else if (isAffliction(hero.status.affliction)) {
    modifier -= 0.40;
  }

  // Health Penalty (linear, max -0.2)
  const missingHealthPercent = (100 - hero.status.physical) / 100;
  modifier -= missingHealthPercent * 0.2;

  // Stress Penalty (non-linear, skyrockets at high stress)
  const stressPercent = (100 - hero.status.mental) / 100;
  modifier -= Math.pow(stressPercent, 2.5);

  // Wound Penalty
  modifier -= (hero.status.wounds.length * 0.04);

  // Clamp the final modifier to prevent extreme results.
  return Math.max(0.15, modifier);
}

/**
 * Calculates a hero's "Weighted Roster Affinity," a measure of their
 * political capital within the Hamlet. Affinity with more influential
 * heroes (high authority/sociability) counts for more.
 * @param hero The candidate hero.
 * @param roster The full character roster.
 * @returns A weighted average affinity score.
 */
function getWeightedRosterAffinity(hero: Character, roster: CharacterRecord): number {
  let weightedAffinitySum = 0;
  let totalInfluence = 0;

  for (const otherHero of Object.values(roster)) {
    if (otherHero.identifier === hero.identifier) continue;

    const influenceWeight = 1 + (otherHero.stats.authority * 0.5) + (otherHero.stats.sociability * 0.2);
    const affinity = hero.relationships[otherHero.identifier]?.affinity ?? 3;

    weightedAffinitySum += affinity * influenceWeight;
    totalInfluence += influenceWeight;
  }

  // Return the weighted average, or a neutral score if there's no one else.
  return totalInfluence > 0 ? weightedAffinitySum / totalInfluence : 3;
}

/**
 * A shared utility to determine if a character is fit for leadership roles.
 * @param hero The character to check.
 * @returns {boolean} True if the hero is fit, false otherwise.
 */
const isFitForDuty = (hero: Character): boolean =>
  hero.status.diseases.length === 0 &&
  !isAffliction(hero.status.affliction) &&
  hero.status.mental >= ELECTION_CONFIG.FITNESS_THRESHOLDS.MIN_MENTAL &&
  hero.status.physical >= ELECTION_CONFIG.FITNESS_THRESHOLDS.MIN_PHYSICAL;

/**
 * Calculates the final "Council Score" for a hero, determining their
 * suitability for a seat on the Privy Council.
 */
function calculateCouncilScore(
  hero: Character,
  roster: CharacterRecord,
  margrave: Character,
  bursar: Character
): number {
  // Hard disqualifier: A diseased hero cannot attend the council.
  if (hero.status.diseases.length > 0) {
    return -Infinity;
  }

  // Foundational Score: The hero's core competence.
  const foundationalScore = (hero.stats.authority * 3) + (hero.stats.intelligence * 2) + hero.level;

  // Readiness Modifier: Their current fitness for duty.
  const readiness = getReadinessModifier(hero);

  // Political Acumen: Their relationships with leadership and the roster.
  const diarchyAffinity = ((margrave.relationships[hero.identifier]?.affinity ?? 3) + (bursar.relationships[hero.identifier]?.affinity ?? 3)) / 2;
  const weightedRosterAffinity = getWeightedRosterAffinity(hero, roster);
  const politicalScore = (diarchyAffinity * 1.5) + weightedRosterAffinity;

  // Final score combines core competence (adjusted for readiness) with political skill.
  return (foundationalScore * readiness) + politicalScore;
}

// ===================================================================
// 2. SUCCESSION LOGIC
// ===================================================================

/**
 * Checks if the Margrave or Bursar are incapacitated and appoints replacements.
 * This function prioritizes fit leaders but will choose the "least unfit"
 * candidate if no one is fully qualified, preventing a power vacuum.
 */
function handleSuccession(currentRoles: EstateRoles, roster: CharacterRecord): EstateRoles {
    const activeRoles = { ...currentRoles };
    const rosterAsArray = Object.values(roster);

    // --- Margrave Succession ---
    const originalMargrave = roster[currentRoles.margrave];
    if (originalMargrave && !isFitForDuty(originalMargrave)) {
        // Find candidates who are NOT the current leaders and ARE fit for duty.
        const fitCandidates = rosterAsArray.filter(h =>
            h.identifier !== originalMargrave.identifier &&
            h.identifier !== currentRoles.bursar &&
            isFitForDuty(h)
        );

        if (fitCandidates.length > 0) {
            // A fit successor exists. Appoint the best one.
            fitCandidates.sort((a, b) => {
                if (a.stats.authority !== b.stats.authority) return b.stats.authority - a.stats.authority;
                return b.level - a.level;
            });
            activeRoles.margrave = fitCandidates[0].identifier;
        }
        // If fitCandidates is empty, this block is skipped. The unfit Margrave remains.
    }

    // --- Bursar Succession (runs *after* potential Margrave change) ---
    const originalBursar = roster[currentRoles.bursar];
    if (originalBursar && !isFitForDuty(originalBursar)) {
        // Find candidates who are NOT the original bursar, NOT the CURRENT margrave, and ARE fit.
        const fitCandidates = rosterAsArray.filter(h =>
            h.identifier !== originalBursar.identifier &&
            h.identifier !== activeRoles.margrave && // Uses the *new* margrave
            isFitForDuty(h)
        );
        
        if (fitCandidates.length > 0) {
            // A fit successor exists. Appoint the best one.
            fitCandidates.sort((a, b) => {
                if (a.stats.intelligence !== b.stats.intelligence) return b.stats.intelligence - a.stats.intelligence;
                return b.level - a.level;
            });
            activeRoles.bursar = fitCandidates[0].identifier;
        }
        // If fitCandidates is empty, this block is skipped. The unfit Bursar remains.
    }
  
    return activeRoles;
}
  
// ===================================================================
// 3. MAIN EXPORTED FUNCTION
// ===================================================================

/**
 * Manages the monthly election of the Hamlet's Privy Council.
 * This function handles succession for incapacitated leaders and then selects
 * council members based on a robust scoring system. In cases of widespread
 * illness where no one is qualified, the council will be empty for the month.
 */
export function electNewCouncil(currentRoles: EstateRoles, roster: CharacterRecord): EstateRoles {
  // Step 1: Handle emergency successions to determine the active leaders.
  // If no fit replacements are found, the original (unfit) leaders will remain.
  const activeRoles = handleSuccession(currentRoles, roster);
  const margrave = roster[activeRoles.margrave];
  const bursar = roster[activeRoles.bursar];

  // Defend against a completely empty roster or missing leaders.
  if (!margrave || !bursar) {
      console.error("Cannot elect council: Margrave or Bursar is missing from the roster.");
      activeRoles.council = [];
      return activeRoles;
  }

  // Step 2: Determine the base number of council seats.
  const rosterSize = Object.keys(roster).length;
  if (rosterSize < ELECTION_CONFIG.COUNCIL_SEATS.MIN_ROSTER_FOR_COUNCIL) {
      // The community is too small and informal. The leaders rule by decree.
      activeRoles.council = [];
      return activeRoles;
  }
  const baseSeats = ELECTION_CONFIG.COUNCIL_SEATS.BASE_SEATS + Math.floor(rosterSize / ELECTION_CONFIG.COUNCIL_SEATS.SEATS_PER_ROSTER_MEMBER);
  let finalSeats = Math.min(baseSeats, ELECTION_CONFIG.COUNCIL_SEATS.MAX_SEATS);

  // Step 3: Score all potential candidates.
  const originalLeaderIds = [currentRoles.margrave, currentRoles.bursar];

  const potentialCandidates = Object.values(roster)
  .filter(h => 
      h.identifier !== margrave.identifier &&   // Exclude the CURRENT Margrave
      h.identifier !== bursar.identifier &&     // Exclude the CURRENT Bursar
      !originalLeaderIds.includes(h.identifier) // Also exclude the ORIGINAL leaders
  )
  .map(hero => ({
    id: hero.identifier,
    score: calculateCouncilScore(hero, roster, margrave, bursar)
  }));

  // Step 4: Filter out DISQUALIFIED candidates. This is the key to handling mass illness.
  const qualifiedCandidates = potentialCandidates
    .filter(c => c.score > -Infinity)
    .sort((a, b) => b.score - a.score);

  // If there are no qualified candidates, the council is empty for the month. This is the intended outcome.
  if (qualifiedCandidates.length === 0) {
    activeRoles.council = [];
    return activeRoles;
  }
  
  // The number of seats cannot exceed the number of available, qualified candidates.
  finalSeats = Math.min(finalSeats, qualifiedCandidates.length);

  // Step 5: Apply clustering logic to potentially adjust seat count by +/- 1.
  const lastSeatIndex = finalSeats - 1;

  // Check for an "inclusion" case (+1 seat) if the next candidate is "on the bubble".
  // This can only happen if there is a next candidate and we are below the max seat count.
  if (finalSeats < ELECTION_CONFIG.COUNCIL_SEATS.MAX_SEATS && qualifiedCandidates.length > lastSeatIndex + 1) {
    const lastAppointeeScore = qualifiedCandidates[lastSeatIndex].score;
    const bubbleCandidateScore = qualifiedCandidates[lastSeatIndex + 1].score;
    const inclusionGap = lastAppointeeScore - bubbleCandidateScore;
    
    // Threshold is a small percentage of the last appointee's score (e.g., 5%).
    // Using 0.05 directly, but a config variable would be better.
    const inclusionThreshold = lastAppointeeScore * 0.05;

    // If the gap is very small, the bubble candidate also gets a seat.
    if (inclusionGap >= 0 && inclusionGap <= inclusionThreshold) {
      finalSeats++;
    }
  } 
  // If no one was added, check for an "exclusion" case (-1 seat).
  // This can only happen if we have more than the minimum number of seats.
  else if (finalSeats > ELECTION_CONFIG.COUNCIL_SEATS.MIN_SEATS && qualifiedCandidates.length > lastSeatIndex) {
    const lastAppointeeScore = qualifiedCandidates[lastSeatIndex].score;
    const penultimateAppointeeScore = qualifiedCandidates[lastSeatIndex - 1].score;
    const exclusionGap = penultimateAppointeeScore - lastAppointeeScore;

    // Threshold is a large percentage of the penultimate appointee's score (e.g., 20%).
    const exclusionThreshold = penultimateAppointeeScore * 0.20;

    // If there's a huge drop-off in quality for the last seat, we leave it empty.
    if (exclusionGap > exclusionThreshold) {
      finalSeats--;
    }
  }
  
  // Step 6: Appoint the final council members from the qualified list.
  activeRoles.council = qualifiedCandidates.slice(0, finalSeats).map(c => c.id);
  
  return activeRoles;
}