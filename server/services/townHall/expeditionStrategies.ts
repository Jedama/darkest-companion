// server/services/townHall/expeditionStrategies.ts
import { CharacterRecord } from '../../../shared/types/types';
import { Party, Composition } from './expeditionPlanner';

// ==================================
// UTILITY/HELPER FUNCTIONS
// ==================================

/**
 * Counts how many members of a party have a specific tag.
 */
function countTag(party: Party, roster: CharacterRecord, tag: string): number {
  if (!party || party.length === 0) return 0;
  return party.reduce((count, id) => count + (roster[id]?.tags.includes(tag) ? 1 : 0), 0);
}

// ==================================
// GENERIC SCORING PATTERN HELPERS (NEW)
// ==================================

/**
 * Scores "A+B" synergies that stack. Rewards having a base pair, with additional
 * bonuses for more of each tag. Ideal for "enabler + keystone" combos.
 * (e.g., Marker + MarkSynergy)
 */
function calculateStackingPairSynergy(
    party: Party, roster: CharacterRecord, 
    tagA: string, tagB: string, 
    baseScore: number, bonusPerA: number, bonusPerB: number
): number {
    const countA = countTag(party, roster, tagA);
    const countB = countTag(party, roster, tagB);

    if (countA === 0 || countB === 0) {
        return 0;
    }

    // Score for the base pair, plus bonus for each *additional* member.
    const score = baseScore 
                + (bonusPerA * (countA - 1)) 
                + (bonusPerB * (countB - 1));
    return score;
}

/**
 * Scores a simple one-to-one pair synergy. The score is applied for each
 * unique pair of (A, B) that can be formed. Handles positive and negative scores.
 * 
 * This implementation uses a greedy matching algorithm to ensure a hero cannot
 * be paired with themselves, and that each hero is only used in one pair.
 * (e.g., Frontline + Backline)
 */
function calculateExactPairsSynergy(
  party: Party, roster: CharacterRecord, 
  tagA: string, tagB: string, 
  scorePerPair: number
): number {
  // This function is for A+B pairs. For A+A pairs, use calculateStackingTagSynergy.
  if (tagA === tagB) {
    // Self-pairing is not what this function is for, to avoid ambiguity.
    return 0;
  }

  // 1. Get the lists of individual heroes with each tag.
  const heroesA = party.filter(id => roster[id]?.tags.includes(tagA));
  const heroesB = party.filter(id => roster[id]?.tags.includes(tagB));

  // No need to proceed if one of the lists is empty.
  if (heroesA.length === 0 || heroesB.length === 0) {
    return 0;
  }

  // 2. Use a Set for the pool of "B" partners for efficient lookup and deletion.
  const availablePartnersB = new Set(heroesB);
  let successfulPairs = 0;

  // 3. Iterate through each "A" hero and try to find a valid, unused partner.
  for (const heroA of heroesA) {
    let foundPartner = null;
    for (const partnerB of availablePartnersB) {
      // The crucial check: A hero cannot be paired with themself.
      if (heroA !== partnerB) {
        foundPartner = partnerB;
        break; // Found a valid partner, stop searching for this heroA.
      }
    }

    if (foundPartner) {
      successfulPairs++;
      // Remove the used partner from the pool so they can't be paired again.
      availablePartnersB.delete(foundPartner);
    }
  }

  return successfulPairs * scorePerPair;
}

/**
 * Scores a 1-to-1 paired synergy, such as a 'Guarder' protecting a 'Frail' hero.
 *
 * This function correctly handles the edge case where a hero has both tags
 * (e.g., 'Guarder' and 'Frail') and cannot be paired with themself.
 *
 * The number of pairs is limited by the count of the less numerous tag. However,
 * when the counts are equal, heroes with both tags reduce the number of possible pairs.
 *
 * @param scorePerPair - The score applied for each successful pair.
 */
function calculateSimplePairSynergy(
  party: Party, roster: CharacterRecord,
  tagA: string, tagB: string,
  scorePerPair: number
): number {
  if (tagA === tagB) {
    // This function is for A+B pairs. A+A stacking has a different pattern.
    return 0;
  }

  // We need the actual hero lists to check for overlaps.
  const heroesA = party.filter(id => roster[id]?.tags.includes(tagA));
  const heroesB = party.filter(id => roster[id]?.tags.includes(tagB));

  const countA = heroesA.length;
  const countB = heroesB.length;

  if (countA === 0 || countB === 0) {
    return 0;
  }

  let successfulPairs: number;

  // The logic diverges based on whether the pools are of equal size.
  if (countA !== countB) {
    // If one group is larger, there is a "surplus" of potential partners.
    // This surplus guarantees that every hero in the smaller group can find
    // a unique partner that is not themself.
    // Therefore, the number of pairs is simply the size of the smaller group.
    successfulPairs = Math.min(countA, countB);
  } else {
    // If the counts are equal (e.g., 3 Guarders and 3 Frail), we have a problem
    // if a hero belongs to both groups. They consume a "slot" from each pool.
    //
    // Example: H1(G), H2(G,F), H3(F). Here counts are not equal (2 G, 2 F).
    // Let's use H1(G), H2(G,F), H3(F), H4(G) -> 3 Guarders, 2 Frail. min is 2 pairs. Correct.
    //
    // Example for this block: H1(G), H2(G,F), H3(F), H4(F).
    // Now we have 2 Guarders {H1, H2} and 3 Frail {H2, H3, H4}. min is 2 pairs.
    // H1 can guard H3. H2 can guard H4. 2 pairs. Correct.
    //
    // The ONLY problematic case is when counts are equal.
    // Example: H1(G, F), H2(G), H3(F). countA = 2, countB = 2.
    // H2 must guard H3 (or vice-versa). H1 is left over and cannot guard itself.
    // Only 1 pair is possible.
    
    // Count heroes that exist in both lists. These are the ones who can't self-pair.
    const heroesWithBothTags = heroesA.filter(id => heroesB.includes(id)).length;
    
    // When counts are equal, each hero with both tags effectively prevents one pair from forming.
    successfulPairs = countA - heroesWithBothTags;
  }

  return successfulPairs * scorePerPair;
}

/**
 * Scores a combinatorial synergy where each hero with tagA provides a bonus
 * for every hero with tagB.
 *
 * Use case: "Each 'Dancer' benefits from every 'Flexible', granting a bonus."
 *
 * This implementation avoids self-synergy (a hero with both tags does not
 * grant a bonus to themselves).
 */
function calculateCombinatorialSynergy(
  party: Party, roster: CharacterRecord,
  tagA: string, tagB: string,
  scorePerInteraction: number
): number {
  if (tagA === tagB) {
    // This pattern doesn't make sense for A+A. That would be n*(n-1) interactions.
    // Use a different function for that specific case if needed.
    return 0;
  }

  const heroesA = party.filter(id => roster[id]?.tags.includes(tagA));
  const heroesB = party.filter(id => roster[id]?.tags.includes(tagB));

  if (heroesA.length === 0 || heroesB.length === 0) {
    return 0;
  }
  
  // Calculate the total possible interactions by multiplication.
  const totalInteractions = heroesA.length * heroesB.length;

  // Now, subtract the self-interactions.
  // A self-interaction occurs if a hero has both tagA and tagB.
  const heroesWithBothTags = heroesA.filter(id => heroesB.includes(id));
  const selfInteractions = heroesWithBothTags.length;

  const validInteractions = totalInteractions - selfInteractions;

  return validInteractions * scorePerInteraction;
}

/**
 * Scores "wolfpack" synergies where having more of the same tag is good (or bad).
 * A base score is awarded when a `requiredCount` is met, with bonuses for each
 * member beyond that count.
 * (e.g., Dancer Troupe, Positional Gridlock)
 */
function calculateStackingTagSynergy(
    party: Party, roster: CharacterRecord, 
    tag: string, 
    baseScore: number, bonusPerAdditional: number, requiredCount: number = 2
): number {
    const count = countTag(party, roster, tag);

    if (count < requiredCount) {
        return 0;
    }

    const score = baseScore + (bonusPerAdditional * (count - requiredCount));
    return score;
}


// ==================================
// GAMEPLAY SYNERGY SCORING
// ==================================

function scorePartyByGameplaySynergy(party: Party, roster: CharacterRecord): number {
    let score = 0;

    // --- KEYSTONE + ENABLER SYNERGIES (A + B Stacking) ---
    score += calculateStackingPairSynergy(party, roster, 'Marker', 'MarkSynergy', 30, 5, 15);
    score += calculateStackingPairSynergy(party, roster, 'Blighter', 'BlightSynergy', 25, 5, 10);
    score += calculateStackingPairSynergy(party, roster, 'Bleeder', 'BleedSynergy', 25, 5, 10);
    score += calculateStackingPairSynergy(party, roster, 'Stunner', 'StunSynergy', 25, 5, 10);
    // Stunners buy time for Setup heroes to do their thing.
    score += calculateStackingPairSynergy(party, roster, 'Stunner', 'Setup', 20, 10, 5);

    // --- SIMPLE PAIR SYNERGIES (One-to-One relationships) ---
    score += calculateSimplePairSynergy(party, roster, 'Guarder', 'Frail', 40);
    score += calculateSimplePairSynergy(party, roster, 'Riposter', 'Healer', 15);
    // A flexible hero in a dance troupe is a nice bonus.
    score += calculateCombinatorialSynergy(party, roster, 'Dancer', 'Flexible', 10);
    
    // --- WOLFPACK SYNERGIES (More of the same is good) ---
    score += calculateStackingTagSynergy(party, roster, 'Dancer', 5, 20, 2);

    // --- ANTI-SYNERGIES (using the same helpers with negative scores) ---
    score += calculateSimplePairSynergy(party, roster, 'Dancer', 'Immobile', -40);
    score += calculateSimplePairSynergy(party, roster, 'Guarder', 'Hider', -15);

    // Positional gridlock
    score += calculateStackingTagSynergy(party, roster, 'Frontline', -50, -25, 3);
    score += calculateStackingTagSynergy(party, roster, 'Backline', -40, -20, 3);
    
    score += calculateStackingTagSynergy(party, roster, 'Weak', -60, -30, 2); // The Pillow Fort
    
    // Stress still needs custom logic as it's a bit more complex.
    const selfStressCount = countTag(party, roster, 'SelfStress');
    const stressHealerCount = countTag(party, roster, 'StressHealer');
    if (selfStressCount > 0 && stressHealerCount === 0) score -= 40 * selfStressCount;
    if (selfStressCount > stressHealerCount) score -= 50 * (selfStressCount - stressHealerCount);
    
    return score;
}

// ==================================
// PARTY SCORING FUNCTIONS
// ==================================

function scorePartyByLevelPenalty(party: Party, roster: CharacterRecord): number {
  if (party.length === 0) return 0;
  const levels = party.map(id => roster[id]?.level ?? 0);
  const maxLevel = Math.max(...levels);
  let missionLevelTier = 0;
  if (maxLevel >= 5) missionLevelTier = 5;
  else if (maxLevel >= 3) missionLevelTier = 3;
  else missionLevelTier = 0;
  let totalHardship = 0;
  for (const level of levels) {
    let hardship = missionLevelTier - level;
    if (hardship < 0) hardship = 0; // No penalty for being overleveled
    totalHardship += Math.pow(hardship, 1.5);
  }

  return totalHardship;
}

function scorePartyByAffinity(party: Party, roster: CharacterRecord): number {
  let totalAffinity = 0;
  if (party.length < 2) return 0;
  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1 = roster[party[i]];
      const char2 = roster[party[j]];
      if (!char1 || !char2) continue;
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? 3;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? 3;
      totalAffinity += affinity1to2 + affinity2to1;
    }
  }
  return totalAffinity;
}

function scorePartyByPeakAffinity(party: Party, roster: CharacterRecord): number {
  let totalPeakAffinity = 0;
  if (party.length < 2) return 0;
  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1 = roster[party[i]];
      const char2 = roster[party[j]];
      if (!char1 || !char2) continue;
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? 3;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? 3;
      // Fixed: Apply power to each relationship individually, not their sum.
      totalPeakAffinity += Math.pow(affinity1to2, 1.25) + Math.pow(affinity2to1, 1.25);
    }
  }
  return totalPeakAffinity;
}

function scorePartyByDiscordPenalty(party: Party, roster: CharacterRecord): number {
  let totalDiscord = 0;
  if (party.length < 2) return 0;
  const MAX_AFFINITY = 10;
  for (let i = 0; i < party.length; i++) {
    for (let j = i + 1; j < party.length; j++) {
      const char1 = roster[party[i]];
      const char2 = roster[party[j]];
      if (!char1 || !char2) continue;
      const affinity1to2 = char1.relationships[party[j]]?.affinity ?? 3;
      const affinity2to1 = char2.relationships[party[i]]?.affinity ?? 3;
      totalDiscord += Math.pow(MAX_AFFINITY - affinity1to2, 1.25);
      totalDiscord += Math.pow(MAX_AFFINITY - affinity2to1, 1.25);
    }
  }
  return totalDiscord;
}

function maximizeCommandClarity(party: Party, roster: CharacterRecord): number {
  if (party.length < 2) return 0;

  const partyLevels = party.map(id => roster[id]?.level ?? 0);
  const maxLevelInParty = Math.max(...partyLevels);

  // STEP 1: Calculate "Standard" Effective Authority Score (EAS)
  const partyWithEAS = party.map(id => {
    const hero = roster[id];
    let bonus = 0;

    // Objective Qualifications:
    if (hero.tags.includes('Leader')) bonus += 3;
    if (hero.tags.includes('Strategist')) bonus += 2; 

    // Objective Penalties:
    if (hero.tags.includes('Unstable')) bonus -= 3;
    if (hero.tags.includes('Child')) bonus -= 2; // Children are seen as less reliable

    // Experience Factor: Punishes inexperience relative to the team's best.
    const levelDeficit = maxLevelInParty - hero.level;
    bonus -= levelDeficit; // Each level below the max is a -1 EAS penalty.

    const eas = hero.stats.authority + bonus;
    return { id, eas, hero };
  }).sort((a, b) => b.eas - a.eas);

  const leader1 = partyWithEAS[0];
  const leader2 = partyWithEAS[1];

  // STEP 2: Calculate Potential Score (Balanced View)
  const scoreA = leader1.eas * 2; // Moderate weight on leader's power
  const primaryGap = leader1.eas - leader2.eas;
  const scoreB = Math.log(primaryGap + 1) * 5; // Moderate weight on the gap
  const potentialScore = scoreA + scoreB;

  // STEP 3: Calculate Total Pressure Score (Reasonable)
  let totalPressureScore = 0;
  for (let i = 1; i < partyWithEAS.length; i++) {
    const subordinate = partyWithEAS[i];
    const gap_to_leader = leader1.eas - subordinate.eas;
    const riskFactor = 1 / (gap_to_leader + 0.5);

    // Reasonable Neutral Point: Basic respect is the baseline.
    const affinity_to_leader = subordinate.hero.relationships[leader1.id]?.affinity ?? 3;
    let affinityModifier = affinity_to_leader - 6;

    // An Abrasive subordinate adds significant pressure, independent of their loyalty.
    if (subordinate.hero.tags.includes('Abrasive')) {
      affinityModifier -= 1.5; // She finds this trait exceptionally grating.
    }

    totalPressureScore += (riskFactor * affinityModifier * 5);
  }

  // STEP 4: Convert to Cohesion Factor (More sensitive to internal strife)
  const cohesionFactor = 1 + (totalPressureScore / 25); // Smaller denominator = more swing

  // STEP 5: Final Score
  return potentialScore * cohesionFactor;
}

function scorePartyByChildGuardianship(party: Party, roster: CharacterRecord): number {
  let score = 0;

  // The presence of a Child enables the potential for a score.
  if (countTag(party, roster, 'Child') === 0) {
    return 0;
  }

  // Grant bonuses based on the best available protector for each child.
  score += calculateSimplePairSynergy(party, roster, 'Child', 'Guarder', 8);
  if (score == 0) {
    // If no Guarder, check for a Tank.
    score += calculateSimplePairSynergy(party, roster, 'Child', 'Tank', 3);
  }
  score += calculateSimplePairSynergy(party, roster, 'Child', 'Healer', 2);

  return score;
}

/**
 * Calculates a total liability exposure score for a given party.
 * A lower score is better. The goal is to create a balanced party where
 * character weaknesses are mitigated by the strengths of their companions.
 *
 * A score of 0 for any single liability indicates it has been fully handled.
 * A score approaching 20 indicates a serious, unaddressed problem.
 */
function minimizeLiabilityExposure(party: Party, roster: CharacterRecord): number {
  let totalRiskScore = 0;
  if (party.length === 0) return 0;

  const partyHeroes = party.map(id => roster[id]);

  // ===================================================================
  // SECTION 1: INDIVIDUAL RISK ASSESSMENT (Loop through each hero)
  // ===================================================================
  for (const hero of partyHeroes) {
    const otherHeroes = partyHeroes.filter(h => h.identifier !== hero.identifier);

    // --- Liability: Unstable (Subtractive Model) ---
    if (hero.tags.includes('Unstable')) {
      let containmentScore = 0;
      for (const stabilizer of otherHeroes) {
        const affinity = stabilizer.relationships[hero.identifier]?.affinity ?? 3;
        const healerBonus = stabilizer.tags.includes('StressHealer') ? 8 : 0;
        containmentScore += stabilizer.stats.authority + (stabilizer.stats.strength * 0.5) + affinity + healerBonus;
      }
      const risk = Math.max(0, 80 - (containmentScore * 2.5));
      totalRiskScore += risk;
    }

    // --- Liability: Brink without Self-Sufficiency ---
    if (hero.tags.includes('Brink') && !hero.tags.includes('SelfSufficient')) {
      const hasHealer = otherHeroes.some(h => h.tags.includes('Healer'));
      if (!hasHealer) {
        totalRiskScore += 10;
      }
    }
    
    // --- Liability: Elder (Subtractive Model) ---
    if (hero.tags.includes('Elder')) {
        const baseRisk = 28;
        let careScore = 0;
        for (const caretaker of otherHeroes) {
            careScore += caretaker.stats.strength + (caretaker.tags.includes('Guarder') ? 10 : 0);
        }
        const risk = Math.max(0, baseRisk - careScore);
        totalRiskScore += risk;
    }

    // --- Liability: Outcast (Subtractive Model) ---
    if (hero.tags.includes('Outcast')) {
        const baseRisk = 22;
        let socialIntegration = 0;
        for (const unifier of otherHeroes) {
            const charmerBonus = unifier.tags.includes('Charmer') ? 8 : 0;
            const stressHealerBonus = unifier.tags.includes('StressHealer') ? 5 : 0;
            socialIntegration += (unifier.stats.sociability * 0.5) + charmerBonus + stressHealerBonus;
        }
        const risk = Math.max(0, baseRisk - socialIntegration);
        totalRiskScore += risk;
    }
    
    // --- Liability: SelfStress (Subtractive Model) ---
    if (hero.tags.includes('SelfStress')) {
        const baseRisk = 25;
        let supportScore = 0;
        for (const supporter of otherHeroes) {
            supportScore += (supporter.stats.sociability * 1.2) + (supporter.tags.includes('StressHealer') ? 12 : 0);
        }
        const risk = Math.max(0, baseRisk - supportScore);
        totalRiskScore += risk;
    }

    // --- Liability: Drunkard (Linear Conflict Model) ---
    if (hero.tags.includes('Drunkard')) {
        let temptationScore = 0;
        let disciplineScore = 0;
        for (const influencer of otherHeroes) {
            temptationScore += influencer.tags.includes('Entertainer') ? 3 : 0;
            temptationScore += influencer.tags.includes('Charmer') ? 2 : 0;
            temptationScore += influencer.stats.sociability * 0.2;
            disciplineScore += influencer.tags.includes('Cleanser') ? 8 : 0;
            disciplineScore += influencer.tags.includes('Just') ? 4 : 0;
            disciplineScore += influencer.stats.authority * 0.5;
        }
        const netRisk = temptationScore - disciplineScore;
        const risk = Math.max(0, netRisk) * 3;
        totalRiskScore += risk;
    }
  }

  // ===================================================================
  // SECTION 2: GROUP RISK ASSESSMENT (Assess the party as a whole)
  // ===================================================================

  // --- Liability: Immoral/Just Balance (Subtractive Conflict Model - REVISED) ---
  // Calculates risk based on the direct conflict between the party's corrupting
  // influences and its moral fortitude. If fortitude exceeds corruption, the risk is 0.
  let corruptionPressure = 0;
  let moralFortitude = 0;
  for (const hero of partyHeroes) {
    if (hero.tags.includes('Immoral')) {
      corruptionPressure += hero.stats.authority * 0.75 + hero.stats.sociability * 0.8;
    } else if (hero.tags.includes('Just')) {
      moralFortitude += hero.stats.authority * 2.0;
    } else {
      moralFortitude += hero.stats.authority * 0.75;
    }
  }
  if (corruptionPressure > 0) {
    const netCorruption = corruptionPressure - moralFortitude;
    const moralRisk = Math.max(0, netCorruption) * 2;
    totalRiskScore += moralRisk;
  }

  // --- Liability: Immobile Gridlock (Exponential Group Model) ---
  const immobileHeroes = partyHeroes.filter(h => h.tags.includes('Immobile'));
  if (immobileHeroes.length > 0) {
      const positionalRiskBase = Math.pow(immobileHeroes.length, 2) * 10;
      let repositioningScore = 0;
      for (const hero of partyHeroes) {
          repositioningScore += hero.tags.includes('Dancer') ? 12 : 0;
          repositioningScore += hero.stats.agility;
      }
      const avgRepositioning = party.length > 0 ? repositioningScore / party.length : 0;
      const finalPositionalRisk = positionalRiskBase / (avgRepositioning + 1);
      totalRiskScore += finalPositionalRisk;
  }
  
  return totalRiskScore;
}

// ==================================
// PARTY SCORING FUNCTIONS (CHARACTER-SPECIFIC)
// ==================================

/**
 * maximizeCommandClarity_Heiress
 *
 * Calculates a "command clarity" score for a party based on leadership strength,
 * authority gaps, and interpersonal cohesion. This is used to evaluate how well
 * a group is expected to follow orders and function hierarchically.
 * 
 * Persephone's biases include:
 * - Drunkard as a positive, self-sufficient assests.
 * - Harsher on affinity and prefers authority gaps.
 */
function maximizeCommandClarity_Heiress(party: Party, roster: CharacterRecord): number {
  if (party.length < 2) return 0;

  // STEP 1: Calculate "Persephone's" Effective Authority Score (EAS)
  const partyWithEAS = party.map(id => {
    const hero = roster[id];
    let bonus = 0;

    // Her Personal Biases:
    if (hero.tags.includes('Leader')) bonus += 3;
    if (hero.tags.includes('Noble')) bonus += 2;
    if (hero.tags.includes('Drunkard')) bonus += 2; // Her personal quirk
    if (hero.tags.includes('Vigilant')) bonus += 1; // Values reliability
    if (hero.tags.includes('SelfSufficient')) bonus += 1; // Values low-maintenance assets
    if (hero.tags.includes('Strategist')) bonus += 1;

    // Her Anxieties:
    if (hero.tags.includes('Unstable')) bonus -= 3; // Direct threat to order
    if (hero.tags.includes('Charmer')) bonus -= 2; // A rival power base
    if (hero.tags.includes('Child')) bonus -= 1;

    const eas = hero.stats.authority + bonus;
    return { id, eas, hero };
  }).sort((a, b) => b.eas - a.eas);

  const leader1 = partyWithEAS[0];
  const leader2 = partyWithEAS[1];

  // STEP 2: Calculate Potential Score (Emphasizes Leader & Gap)
  const scoreA = leader1.eas * 3; // High weight on leader's raw power
  const primaryGap = leader1.eas - leader2.eas;
  const scoreB = Math.log(primaryGap + 1) * 7; // High weight on the primary gap
  const potentialScore = scoreA + scoreB;

  // STEP 3: Calculate Total Pressure Score (Demanding)
  let totalPressureScore = 0;
  for (let i = 1; i < partyWithEAS.length; i++) {
    const subordinate = partyWithEAS[i];
    const gap_to_leader = leader1.eas - subordinate.eas;
    const riskFactor = 1 / (gap_to_leader + 0.5);

    // Demanding Neutral Point: Only proven loyalty is rewarded.
    const affinity_to_leader = subordinate.hero.relationships[leader1.id]?.affinity ?? 3;
    let affinityModifier = affinity_to_leader - 7.5;

    // An Abrasive subordinate adds significant pressure, independent of their loyalty.
    if (subordinate.hero.tags.includes('Abrasive')) {
      affinityModifier -= 4; // She finds this trait exceptionally grating.
    }

    totalPressureScore += (riskFactor * affinityModifier * 5);
  }

  // STEP 4: Convert to Cohesion Factor (Less sensitive to internal strife)
  const cohesionFactor = 1 + (totalPressureScore / 40); // Larger denominator = less swing

  // STEP 5: Final Score
  return potentialScore * cohesionFactor;
}


// ==================================
// COMPOSITION SCORING FUNCTIONS
// ==================================

function scoreCompositionByAuthorityDistribution(composition: Composition, roster: CharacterRecord): number {
  if (composition.length < 2) return 0; // Variance is 0 if there's only one party

  const leadershipPotentialScores = composition.map(party => {
    if (party.length === 0) return 0;
    
    const partyAuthorities = party.map(id => roster[id]?.stats.authority ?? 0).sort((a, b) => b - a);
    
    const maxAuthority = partyAuthorities[0] ?? 0;
    const secondMaxAuthority = partyAuthorities[1] ?? 0;
    
    return maxAuthority + (0.4 * secondMaxAuthority);
  });

  const meanLPS = leadershipPotentialScores.reduce((a, b) => a + b, 0) / leadershipPotentialScores.length;
  // Fixed: Use a robust variance calculation to avoid issues with negative numbers in edge cases.
  const variance = leadershipPotentialScores.map(lps => Math.pow(lps - meanLPS, 2)).reduce((a, b) => a + b, 0) / leadershipPotentialScores.length;
  
  return Math.sqrt(variance);
}

// ==================================
// STRATEGY DEFINITIONS & REGISTRY (UNCHANGED)
// ==================================

export type StrategyDirection = 'maximize' | 'minimize';
export type StrategyScope = 'party' | 'composition';

interface BaseStrategyDefinition {
  identifier: string;
  name: string;
  description: string;
  direction: StrategyDirection;
}

interface PartyStrategyDefinition extends BaseStrategyDefinition {
  scope: 'party';
  scorer: (target: Party, roster: CharacterRecord) => number;
}

interface CompositionStrategyDefinition extends BaseStrategyDefinition {
  scope: 'composition';
  scorer: (target: Composition, roster: CharacterRecord) => number;
}

export type StrategyDefinition = PartyStrategyDefinition | CompositionStrategyDefinition;

export const STRATEGY_REGISTRY: readonly StrategyDefinition[] = [
  {
    identifier: 'minimizeLevelHardship',
    name: 'Experience parity',
    description: 'Ensures no single hero is vastly outleveled by their peers, preventing undue hardship.',
    direction: 'minimize',
    scope: 'party',
    scorer: scorePartyByLevelPenalty,
  },
  {
    identifier: 'maximizeGameplaySynergy',
    name: 'Tactical Synergy',
    description: 'Evaluates the core combat synergies and anti-synergies within the party.',
    direction: 'maximize',
    scope: 'party',
    scorer: scorePartyByGameplaySynergy,
  },
  {
    identifier: 'maximizeAffinity',
    name: 'Team cohesion',
    description: 'Promotes well-rounded, positive relationships within a party to ensure smooth cooperation.',
    direction: 'maximize',
    scope: 'party',
    scorer: scorePartyByAffinity,
  },
  {
    identifier: 'maximizePeakAffinity',
    name: "Strong bonds",
    description: 'Strongly favors creating parties with exceptionally strong, established bonds.',
    direction: 'maximize',
    scope: 'party',
    scorer: scorePartyByPeakAffinity,
  },
  {
    identifier: 'minimizeDiscord',
    name: 'Conlict avoidance',
    description: 'Strictly punishes party compositions with known rivalries or poor relationships to avoid infighting.',
    direction: 'minimize',
    scope: 'party',
    scorer: scorePartyByDiscordPenalty,
  },
  {
    identifier: 'maximizeChildGuardianship',
    name: 'Children Guardianship',
    description: 'Ensures children are protected by capable guardians.',
    direction: 'maximize',
    scope: 'party',
    scorer: scorePartyByChildGuardianship,
  },
  {
    identifier: 'maximizeCommandClarity',
    name: 'Command Clarity',
    description: 'Evaluates the clarity of command and authority distribution within a party.',
    direction: 'maximize',
    scope: 'party',
    scorer: maximizeCommandClarity,
  },
  {
    identifier: 'maximizeCommandClarity_Heiress',
    name: 'Command Clarity (Heiress)',
    description: 'Evaluates the clarity of command and authority distribution within a party, according to the Heiress.',
    direction: 'maximize',
    scope: 'party',
    scorer: maximizeCommandClarity_Heiress,
  },
  {
    identifier: 'balanceAuthority',
    name: 'Authority distribution',
    description: 'Ensures a balanced distribution of leadership potential across parties, preventing over-concentration of authority.',
    direction: 'minimize',
    scope: 'composition',
    scorer: scoreCompositionByAuthorityDistribution,
  },
] as const;


// ==================================
// DYNAMICALLY GENERATED TYPES (UNCHANGED)
// ==================================

export type StrategyWeights = {
  [K in typeof STRATEGY_REGISTRY[number]['identifier']]?: number;
};

export interface NormalizationStats {
  mean: number;
  stdDev: number;
}

export type PartyScoringStatistics = {
  [K in typeof STRATEGY_REGISTRY[number]['identifier']]: NormalizationStats;
};