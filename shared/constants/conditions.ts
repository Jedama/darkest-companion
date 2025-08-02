/**
 * Defines all possible character conditions (afflictions and virtues).
 * This file serves as the single source of truth for these states.
 */

export const AFFLICTIONS = {
  abusive: "Engaging in violently abusive actions towards friend and foe alike.",
  paranoid: "Consumed by intense paranoia, convinced their teammates will stab them in the back.",
  ferocious: "Overcome by a ferocious, uncontrollable rage.",
  fearful: "Paralyzed by overwhelming fear and unable to think or act logically.",
  masochistic: "Indulging in self-destructive behaviors in their strong desire for physical pain.",
  refracted: "Tormented by incomprehensible cosmic horrors.",
  irrational: "Acting with complete irrationality and mumbling utter nonsense.",
  selfish: "Driven by extreme selfishness, ignoring the team in favor of personal safety.",
  discordant: "Battling uncontrollable multiple personalities.",
  hopeless: "Crushed by a sense of utter hopelessness and sapped of all motivation.",
  rapturous: "Lost in a state of ecstatic rapture.",
} as const;

export const VIRTUES = {
  stalwart: "Displaying unwavering determination.",
  vigorous: "Brimming with energy and vitality.",
  courageous: "Exhibiting remarkable courage.",
  powerful: "Radiating a commanding presence.",
  focused: "Possessing an intense focus.",
} as const;

// Utility types derived from the constant objects
export type AfflictionType = keyof typeof AFFLICTIONS;
export type VirtueType = keyof typeof VIRTUES;
export type ConditionType = AfflictionType | VirtueType;

// Helper function to check if a condition is an affliction
export function isAffliction(condition: string): condition is AfflictionType {
  return condition in AFFLICTIONS;
}

// Helper function to check if a condition is a virtue
export function isVirtue(condition: string): condition is VirtueType {
  return condition in VIRTUES;
}