// shared/types/types.ts
// Domain order:
// Estate → Character primitives → Character runtime/template → World (Locations/NPCs/Enemies) → Events → Keywords → Logs → Helpers → Record types

/* -------------------------------------------------------------------
 *  Estate (primary runtime state)
 * ------------------------------------------------------------------- */

export type LlmProvider = "openai" | "anthropic" | "google" | "xai";

export interface LogEntry {
  month: number; // in-game month the log occurred during
  day: number; // in-game day the log occurred on
  beat: number; // a counter to order logs within the same month
  entry: string; // short description of what happened
  expiryMonth: number; // month when this log should expire
}

export interface RelationshipLogEntry extends LogEntry {
  target: string; // the other character's identifier
}

export type EstateRoles = {
  margrave: string; // The character identifier of the Margrave
  bursar: string; // The character identifier of the Bursar
  sheriff?: string; // Optional: The character identifier of the Sheriff
  judge?: string; // Optional: The character identifier of the Judge
  council?: string[]; // Optional: A list of character identifiers for the council
};

export interface EstatePreferences {
  llmProvider: LlmProvider; // Which provider family to use (ChatGPT/OpenAI, Claude/Anthropic, Gemini/Google, Grok/xAI, etc.)
  llmModel: string; // Specific model to use within the provider family
  guidance: string; // Freeform system-level guidance / style constraints
}

export interface EstateTime {
  month: number;
  day: number;
  beat: number;
}

// Estate seasonality and weather patterns
export interface WeatherDistribution {
  mean: number;
  variance: number;
}

export interface ZodiacSeason {
  name: string;
  text: string;
  weather: {
    heat: WeatherDistribution;
    rain: WeatherDistribution;
    wind: WeatherDistribution;
  };
}

export interface Weather {
  heat: number; // float (0.5-9.5), converted to integer tier (1-9) for descriptions
  rain: number; // float (0.5-9.5), converted to integer tier (1-9) for descriptions
  wind: number; // float (0.5-9.5), converted to integer tier (1-9) for descriptions
}

export interface Estate {
  name: string;
  preferences?: EstatePreferences;
  time: EstateTime;
  weather: {
    current: Weather;
    previous: Weather;
  }
  roles: EstateRoles; // Roles within the estate
  money: number;
  narratives: string[];
  characters: CharacterRecord;
  restoredLocations?: string[]; // list of location identifiers that have been restored
  estateLogs?: LogEntry[];

  // Optional logs per entity type
  characterLogs?: { [charIdentifier: string]: LogEntry[] };
  relationshipLogs?: { [charIdentifier: string]: RelationshipLogEntry[] };
  //eventLogs?: { [eventIdentifier: string]: LogEntry[] };
  //locationLogs?: { [locationIdentifier: string]: LogEntry[] };
  //npcLogs?: { [npcIdentifier: string]: LogEntry[] };

}

/* -------------------------------------------------------------------
 *  Characters (building blocks)
 * ------------------------------------------------------------------- */

export interface CharacterStats {
  strength: number;
  agility: number;
  intelligence: number;
  authority: number;
  sociability: number;
}

export interface CharacterAppearance {
  height: string;
  build: string;
  skinTone: string;
  hairColor: string;
  hairStyle: string;
  features: string;
}

export interface CharacterClothing {
  head: string;
  body: string;
  legs: string;
  accessories: string;
}

export interface CharacterCombat {
  role: string;
  strengths: string[];
  weaknesses: string[];
}

export interface CharacterStatus {
  physical: number;
  mental: number;
  affliction: string;
  description: string;
  wounds: string[]; // Or a more specific Wound type
  diseases: string[]; // Or a more specific Disease type
}

/* -------------------------------------------------------------------
 *  Character (non-narrative fields)
 * ------------------------------------------------------------------- */

export interface CharacterLocations {
  residence: string[];
  workplaces: string[];
  frequents: string[];
}

export type StrategyWeights = Record<string, number>;

/* -------------------------------------------------------------------
 *  Relationships 
 * ------------------------------------------------------------------- */

export interface CharacterRelationship {
  affinity: number;
  dynamic: string;
  description: string;
}

/* -------------------------------------------------------------------
 *  Character Template + Runtime Character
 * ------------------------------------------------------------------- */

export interface CharacterTemplate {
  identifier: string;
  title: string;
  name: string;
  description: string;
  summary: string;
  history: string;
  race: string;
  gender: string;
  religion: string;
  zodiac: string;
  traits: string[];
  stats: CharacterStats;
  equipment: string[];
  appearance: CharacterAppearance;
  clothing: CharacterClothing;
  combat: CharacterCombat;
  magic: string;
  notes: string[];
  tags: string[];
}

export interface Character extends CharacterTemplate {
  level: number;
  money: number;
  status: CharacterStatus;
  relationships: Record<string, CharacterRelationship>;
  locations: CharacterLocations;
  strategyWeights: StrategyWeights;
}

/* -------------------------------------------------------------------
 *  Locations
 * ------------------------------------------------------------------- */

export interface LocationData {
  identifier: string;
  title: string;
  description: string;
  summary: string;
  restored?: string; // description when location is restored
  capacity?: number; // max number of characters that can reside here
  npcs?: string[]; // array of NPC identifiers connected to this location
  parent: string; // parent location identifier
  children: string[]; // child location identifiers
}

/* -------------------------------------------------------------------
 *  NPCs
 * ------------------------------------------------------------------- */

export interface NPC {
  identifier: string;
  title: string;
  name: string;
  description: string;
  history: string;
  summary: string;
  traits: string[];
  appearance: CharacterAppearance;
  clothing: CharacterClothing;
  notes: string[];
}

/* -------------------------------------------------------------------
 *  Enemies
 * ------------------------------------------------------------------- */

export interface Enemy {
  identifier: string;
  title: string;
  faction: string[];
  description: string;
  history: string;
  summary: string;

  race: string;
  gender: string;
  religion: string;

  traits: string[];
  stats: CharacterStats;
  equipment: string[];

  appearance: CharacterAppearance;
  clothing: CharacterClothing;
  combat: CharacterCombat;

  magic: string;
}

/* -------------------------------------------------------------------
 *  Events
 * ------------------------------------------------------------------- */

export type EventCategory = 'town' | 'story';

export interface EventLocationRequirements {
  default: string[];
  residence: number[]; // Character indices (1-based)
  workplaces: number[]; // Character indices (1-based)
  frequents: number[]; // Character indices (1-based)
  allowParentLocations?: boolean; // Controls whether parent locations are considered
  allowAll?: boolean; // Allows any location to be used
  multipleLocations?: number; // Number of different locations required
}

export interface EventData {
  identifier: string;
  title: string;
  type?: EventCategory; // folder serves as ground truth, but type exists here as well
  description: string;
  characterCount: [number, number]; // [min, max]
  keywords: string[]; // e.g., ["combat", "gambling", "nighttime"]
  location: EventLocationRequirements; // location requirements for characters
  enemies?: string[]; // optional array of enemy identifiers
  npcs?: string[]; // optional array of NPC identifiers
  randomNPCs?: number; // optional number of random NPCs to include
  roles?: string[]; // optional array of estate roles required

  // You can add fields like "specialConsequences", "outcomes", etc., if needed
}

/* -------------------------------------------------------------------
 *  Keywords
 * -------------------------------------------------------------------
 *  (No dedicated keyword types yet; using string[] in EventData.)
 * ------------------------------------------------------------------- */

/* -------------------------------------------------------------------
 *  Bystanders (state / runtime helpers)
 * ------------------------------------------------------------------- */

export type BystanderConnectionType = 'residence' | 'workplace' | 'frequent' | 'present';

export interface Bystander {
  identifier: string;
  connectionType: BystanderConnectionType;
}

/* -------------------------------------------------------------------
 *  Record Types
 * ------------------------------------------------------------------- */

export type CharacterTemplateRecord = Record<string, CharacterTemplate>;
export type CharacterRecord = Record<string, Character>;
export type EventRecord = Record<string, EventData>;
export type NPCRecord = Record<string, NPC>;
export type EnemyRecord = Record<string, Enemy>;
