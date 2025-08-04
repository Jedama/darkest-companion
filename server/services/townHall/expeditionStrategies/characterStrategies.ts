/**
 * @file Contains all character-specific, "opinionated" scoring functions.
 * Each function in this file represents the unique worldview, biases, and
 * priorities of a specific character, allowing for highly personalized
 * team drafting strategies.
 */

import { CharacterRecord, Character } from '../../../../shared/types/types';
import { Party, Composition } from '../expeditionPlanner';
import { countTag, calculateSimplePairSynergy } from './strategyUtils';

// ===================================================================
// HEIRESS (PERSEPHONE) - STRATEGIES
// ===================================================================

/**
 * maximizeCommandClarity_Heiress
 *
 * Calculates a "command clarity" score for a party based on leadership strength,
 * authority gaps, and interpersonal cohesion, all filtered through the specific
 * biases and anxieties of the Heiress (Persephone).
 *
 * Her biases include:
 * - A preference for Nobles and those who demonstrate reliability (Vigilant, Leader).
 * - A strange respect for fellow Drunkards, seeing it as a sign of self-awareness.
 * - A deep distrust of rival power bases (Charmers) and instability (Unstable).
 * - A demanding leadership style that requires proven loyalty and harshly penalizes abrasive personalities.
 */
export function scorePartyByCommandClarity_Heiress(party: Party, roster: CharacterRecord): number {
  if (party.length < 2) return 0;

  // STEP 1: Calculate "Persephone's" Effective Authority Score (EAS)
  const partyWithEAS = party.map(id => {
    const hero = roster[id];
    if (!hero) return { id, eas: -99, hero: null }; // Should not happen, but a safeguard.

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

  // Safeguard against empty party or bad data
  if (!leader1?.hero || !leader2?.hero) {
    return 0;
  }

  // STEP 2: Calculate Potential Score (Emphasizes Leader & Gap)
  const scoreA = leader1.eas * 3; // High weight on leader's raw power
  const primaryGap = leader1.eas - leader2.eas;
  const scoreB = Math.log(primaryGap + 1) * 7; // High weight on the primary gap
  const potentialScore = scoreA + scoreB;

  // STEP 3: Calculate Total Pressure Score (Demanding)
  let totalPressureScore = 0;
  for (let i = 1; i < partyWithEAS.length; i++) {
    const subordinate = partyWithEAS[i];
    if (!subordinate.hero) continue;

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
  // Ensure cohesion doesn't flip the score negative if pressure is extremely high
  return potentialScore * Math.max(0, cohesionFactor);
}


export function scorePartyByChildGuardianship_Cook(party: Party, roster: CharacterRecord): number {
  let score = 0;
  if (countTag(party, roster, 'Child') === 0) {
    return 0;
  }
  score += calculateSimplePairSynergy(party, roster, 'Child', 'Guarder', 8);
  if (score == 0) {
    score += calculateSimplePairSynergy(party, roster, 'Child', 'Tank', 3);
  }
  score += calculateSimplePairSynergy(party, roster, 'Child', 'Healer', 2);
  return score;
}

export function scorePartyBySocialVitality_Zenith(party: Party, roster: CharacterRecord): number {
  const zenithId = 'zenith'; // Assuming the Zenith has a fixed identifier.
  const zenithIsInParty = party.includes(zenithId);
  
  // Party size must be 4 for the 2-and-2 logic to be meaningful.
  if (party.length !== 4) {
    return 0; // Not applicable for other party sizes.
  }
  
  let maleSociability = 0;
  let femaleSociability = 0;
  
  // We'll need the IDs grouped by gender for the new affinity logic
  const males: string[] = [];
  const females: string[] = [];
  
  for (const heroId of party) {
    const hero = roster[heroId];
    if (!hero) continue;
    if (hero.gender === 'Male') {
      maleSociability += hero.stats.sociability;
      males.push(heroId);
    }
    if (hero.gender === 'Female') {
      femaleSociability += hero.stats.sociability;
      females.push(heroId);
    }
  }
  
  const totalSociability = maleSociability + femaleSociability;
  if (totalSociability === 0) return 0;
  
  // --- Base Score: The original balance calculation ---
  let diff = Math.abs(maleSociability - femaleSociability);
  
  // --- Zenith's Personal Bias Bonus ---
  if (zenithIsInParty && males.length === 1) {
    diff /= 5; 
  }
  
  const charmerCount = countTag(party, roster, 'Charmer');
  if (charmerCount > 1 && diff <= 1) {
    diff /= 1.5; 
  }
  
  let score = Math.max(0, 100 - (diff / totalSociability) * 100);
  
  // --- NEW: Affinity Modifier for 2 Male / 2 Female Parties ---
  if (males.length === 2 && females.length === 2) {
    let affinityAdjustment = 0;
    const NEUTRAL_AFFINITY = 4; // On a 0-10 scale.
    
    const getAffinity = (fromId: string, toId: string) => {
      return roster[fromId]?.relationships?.[toId]?.affinity ?? NEUTRAL_AFFINITY;
    };
    
    // 1. Intra-Gender Rivalry (low affinity is good)
    const maleAff1 = getAffinity(males[0], males[1]);
    const maleAff2 = getAffinity(males[1], males[0]);
    affinityAdjustment += (NEUTRAL_AFFINITY - maleAff1); // Bonus if aff < 4
    affinityAdjustment += (NEUTRAL_AFFINITY - maleAff2);
    
    const femaleAff1 = getAffinity(females[0], females[1]);
    const femaleAff2 = getAffinity(females[1], females[0]);
    affinityAdjustment += (NEUTRAL_AFFINITY - femaleAff1); // Bonus if aff < 4
    affinityAdjustment += (NEUTRAL_AFFINITY - femaleAff2);
    
    // 2. Inter-Gender Appreciation (high affinity is good)
    for (const maleId of males) {
      for (const femaleId of females) {
        // Male -> Female affinity
        affinityAdjustment += (getAffinity(maleId, femaleId) - NEUTRAL_AFFINITY);
        // Female -> Male affinity
        affinityAdjustment += (getAffinity(femaleId, maleId) - NEUTRAL_AFFINITY);
      }
    }
    
    // Scale the adjustment to be a "light" modifier, e.g., +/- 15 points max
    const affinityModifier = affinityAdjustment / 4; 
    score += affinityModifier;
  }
  
  // Clamp final score between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * [CHARACTER-SPECIFIC] Minimizes the disparity in suffering within a party,
 * according to the zealous philosophy of the Flagellant (Damien).
 *
 * The Flagellant believes all must share in the holy trial of suffering. An
 * ideal party is not one with a strong protector, but a "congregation" of
 * roughly equal fortitude. High variance in toughness is a sin.
 *
 * This function scores a party based on this principle:
 * 1. It calculates a "Trial Endurance" score for each hero.
 * 2. It calculates the statistical variance of these scores. A lower variance is better.
 * 3. If a Healer is present, it calculates a "Grace Multiplier" that reduces the
 *    variance penalty. This bonus is now capped and scaled to be significant
 *    only for the frailest parties, as healing exists only to enable more suffering.
 *
 * @param party The party to be scored.
 * @param roster The complete character roster.
 * @returns A score representing the party's suffering imbalance. Lower is better.
 */
export function scoreCompositionBySufferingDisparity_Flagellant(party: Party, roster: CharacterRecord): number {
  /**
   * Calculates the "Trial Endurance" score for a single hero.
   * This is nested as it's only used within this specific scoring function.
   */
  function getTrialEndurance(hero: Character): number {
    // Base score from core stats and a minor health tie-breaker.
    let score = (hero.stats.strength * 1.5) + (hero.level * 0.5) + (hero.status.physical / 100);

    // --- RECALIBRATED: Tag modifiers are halved to be less explosive ---
    const tagModifiers: { [tag: string]: number } = {
      'Tank': 4,          
      'SelfSufficient': 3, 
      'Brink': 3,       
      'Religious': 1.5,  
      'Just': 0.5,          
      'Frail': -4,        
      'Hider': -4,        
      'Weak': -2.5,       
    };

    for (const tag in tagModifiers) {
      if (hero.tags.includes(tag)) {
        score += tagModifiers[tag];
      }
    }
    return score;
  }

  if (party.length === 0) {
    return 0;
  }

  const partyHeroes = party.map(id => roster[id]);

  // Step 1: Calculate the Trial Endurance for each hero using the nested function.
  const enduranceScores = partyHeroes.map(hero => getTrialEndurance(hero));

  // Step 2: Calculate the statistical variance of these scores.
  const meanEndurance = enduranceScores.reduce((a, b) => a + b, 0) / enduranceScores.length;
  const variance = enduranceScores.reduce((sum, score) => sum + Math.pow(score - meanEndurance, 2), 0) / enduranceScores.length;

  // Step 3: Calculate the "Grace Multiplier" if a healer is present.
  let graceMultiplier = 1.0; // Default: No benefit.

  const hasHealer = partyHeroes.some(h => h.tags.includes('Healer') || h.tags.includes('Cleanser'));

  if (hasHealer) {
    const MAX_GRACE_DISCOUNT = 0.30; // A healer can reduce the penalty by a maximum of 30%.
    const THEORETICAL_MAX_ENDURANCE = 50; // Theoretical max endurance for a hero, used to calculate frailty ratio.
    const averageEndurance = meanEndurance;
    
    // The "Frailty Ratio" measures how far the party is from the ideal toughness.
    const frailtyRatio = 1.0 - (averageEndurance / THEORETICAL_MAX_ENDURANCE);
    const clampedFrailty = Math.max(0, Math.min(1, frailtyRatio));
    
    // The discount now scales with the square of frailty (pow 2). This means the
    // benefit is very small for moderately tough parties and only ramps up to the
    // max discount for the absolute frailest congregations.
    const graceDiscount = MAX_GRACE_DISCOUNT * Math.pow(clampedFrailty, 2);
    
    graceMultiplier = 1.0 - graceDiscount;
  }

  // Step 4: The final score is the variance, scaled by the healer's modest grace.
  return variance * graceMultiplier;
}

/**
 * [CHARACTER-SPECIFIC] Maximizes protective bonds according to the zealous
 * philosophy of the Martyr (Anastasia).
 *
 * This strategy values a protector's personal devotion to their entire team above all else.
 * It believes that for mortals without the Martyr's absolute faith, the will to
 * protect must come from genuine care for their comrades.
 *
 * The score is a simple product of the protector's capability (Bulwark Potency)
 * and their average affinity towards the other three party members. A special
 * clause grants the Martyr herself a super-maximal affinity to reflect her divine conviction.
 */
export function scorePartyByDedicatedProtector_Martyr(party: Party, roster: CharacterRecord): number {
  if (party.length !== 4) {
    return 0;
  }

  const partyHeroes = party.map(id => roster[id]);
  const averagePartyLevel = partyHeroes.reduce((sum, h) => sum + h.level, 0) / partyHeroes.length;

  // Step 1: Identify the Bulwark (best protector).
  const protectorScores = partyHeroes.map(hero => {
    let score = 1; // Base score
    if (hero.tags.includes('Tank')) score += 15;
    if (hero.tags.includes('Guarder')) score += 10;
    if (hero.tags.includes('SelfSufficient')) score += 5;

    const strengthModifier = 1 + (hero.stats.strength / 10);
    const levelDelta = hero.level - averagePartyLevel;
    const levelModifier = 1 + (levelDelta * 0.1);

    return { hero, score: score * strengthModifier * levelModifier };
  });
  protectorScores.sort((a, b) => b.score - a.score);
  const bulwark = protectorScores[0].hero;
  const bulwarkPotency = protectorScores[0].score;
  
  // Step 2: Calculate the Bulwark's average affinity to the other three "Wards".
  const wards = partyHeroes.filter(h => h.identifier !== bulwark.identifier);
  let averageAffinity: number;

  if (bulwark.identifier === 'snor_rasp') {
    // The Martyr's special clause: her devotion is absolute and universal.
    averageAffinity = 10; // Super-maximal affinity override
  } else {
    const totalAffinity = wards.reduce((sum, ward) => {
      return sum + (bulwark.relationships[ward.identifier]?.affinity ?? 3);
    }, 0);
    averageAffinity = wards.length > 0 ? totalAffinity / wards.length : 3;
  }

  // Step 3: The final score is a direct product of potency and devotion.
  const rawScore = bulwarkPotency * averageAffinity;
  const scaledScore = Math.log(rawScore + 1);
  return scaledScore;
}

/**
 * [CHARACTER-SPECIFIC] Values protection born from alienation and morbid empathy,
 * according to the philosophy of the Offering.
 *
 * This strategy posits that the most profound understanding comes from protecting
 * those one is most distant from. It seeks to create teams where a protector
 * shares a burden with strangers or rivals, believing shared pain is the only
 * true bridge to empathy.
 *
 * The score is a product of the protector's capability (Bulwark Potency)
 * and their average "dis-affinity" (10 - affinity) towards the other three
 * party members. It actively rewards a protector who is alienated from their team.
 */
export function scorePartyByDedicatedProtector_Offering(party: Party, roster: CharacterRecord): number {
  if (party.length !== 4) {
    return 0;
  }

  const partyHeroes = party.map(id => roster[id]);
  const averagePartyLevel = partyHeroes.reduce((sum, h) => sum + h.level, 0) / partyHeroes.length;

  // Step 1: Identify the Bulwark (best protector). (Same logic as Martyr's)
  const protectorScores = partyHeroes.map(hero => {
    let score = 1;
    if (hero.tags.includes('Tank')) score += 15;
    if (hero.tags.includes('Guarder')) score += 10;
    if (hero.tags.includes('SelfSufficient')) score += 5;
    if (hero.tags.includes('Warrior')) score += 2.5;

    const strengthModifier = 1 + (hero.stats.strength / 10);
    const levelDelta = hero.level - averagePartyLevel;
    const levelModifier = 1 + (levelDelta * 0.1);

    return { hero, score: score * strengthModifier * levelModifier };
  });
  protectorScores.sort((a, b) => b.score - a.score);
  const bulwark = protectorScores[0].hero;
  const bulwarkPotency = protectorScores[0].score;

  // Step 2: Calculate the Bulwark's average DIS-affinity to the other three "Wards".
  const wards = partyHeroes.filter(h => h.identifier !== bulwark.identifier);
  
  // The Offering has no special clause; her philosophy applies universally.
  const totalDisAffinity = wards.reduce((sum, ward) => {
    const affinity = bulwark.relationships[ward.identifier]?.affinity ?? 3;
    const disAffinity = 10 - affinity; // Inverted affinity
    return sum + disAffinity;
  }, 0);
  
  const averageDisAffinity = wards.length > 0 ? totalDisAffinity / wards.length : 7; // (10 - 3)

  // Step 3: The final score is a product of potency and alienation.
  const rawScore = bulwarkPotency * averageDisAffinity;
  const scaledScore = Math.log(rawScore + 1);
  return scaledScore;
}

export function scoreCompositionByQuarantinedHorrors_Heir(composition: Composition, roster: CharacterRecord): number {
  
  function calculatePartyHorrorScore(party: Party, roster: CharacterRecord): number {
    let score = 0;
    for (const heroId of party) {
      const hero = roster[heroId];
      if (!hero) continue;

      if (hero.race !== 'Human') {
        score += 10;
      }

      if (hero.tags.includes('Eldritch') || hero.tags.includes('Unholy') || hero.tags.includes('Shapeshifter')) {
        score += 10;
      }
      if (hero.tags.includes('Unstable') || hero.tags.includes('Animal')) {
        score += 5;
      }
      if (hero.tags.includes('Brink')) {
        score += 2;
      }
    }
    return score;
  }

  // If the composition is empty or has only one party, return 0
  if (composition.length < 2) return 0;

  const horrorScores = composition.map(party => calculatePartyHorrorScore(party, roster));
  
  const mean = horrorScores.reduce((a, b) => a + b, 0) / horrorScores.length;
  const variance = horrorScores.map(score => Math.pow(score - mean, 2)).reduce((a, b) => a + b, 0) / horrorScores.length;
  
  return variance; // Direction: 'maximize'
}