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

export interface EstateLeadership {
  description: string;    // freeform text describing the current leadership structure and dynamics
  margrave: string;
  bursar: string;
  council?: string[];
}

/**
 * The slice of estate state a scorer may consult beyond the roster itself.
 *
 * Scorers receive this as an OPTIONAL third argument. Strategies that don't care
 * about politics ignore it entirely; strategies that do must return a neutral 0
 * when it is absent, so the expedition planner stays callable without an Estate
 * (tests, tooling, the zero-weight fast path).
 *
 * IMPORTANT: whatever context is used for scoring must also be passed to
 * `generateScoringStatistics`. Sampling without it while scoring with it
 * normalizes a context-dependent strategy against a baseline where it always
 * returned 0 — mean 0, stdDev 1 — silently turning z-scores back into raw scores.
 */
export interface StrategyContext {
  margrave?: string;
  bursar?: string;
  council?: readonly string[];
}

/** Convenience: builds the scoring context from an estate's leadership. */
export function toStrategyContext(leadership: EstateLeadership): StrategyContext {
  return {
    margrave: leadership.margrave,
    bursar: leadership.bursar,
    council: leadership.council ?? [],
  };
}

export const CONTENT_TAGS = [
  'gore',
  'nudity',
  'sexualContent',
  'infidelity',
  'animalHarm',
  'romanceMM',
  'romanceFF',
  'romanceMF',
] as const;

export type ContentTag = (typeof CONTENT_TAGS)[number];

export type ContentLevel = 'forbidden' | 'restricted' | 'permitted' | 'emphasized';

export type ContentPreferences = Partial<Record<ContentTag, ContentLevel>>;

export interface EstatePreferences {
  llmProvider: LlmProvider; // Which provider family to use (ChatGPT/OpenAI, Claude/Anthropic, Gemini/Google, Grok/xAI, etc.)
  llmModel: string; // Specific model to use within the provider family
  maxTokens?: number; // Optional maximum response tokens (defaults to 16384)
  guidance: string; // Freeform system-level guidance / style constraints
  content?: ContentPreferences;
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

export interface DungeonState {
  region: string;           // e.g. "ruins", "warrens", "weald"
  roster: string[];         // character identifiers
  startDay: number;         // for knowing which logs belong to this dungeon run
}

export interface FollowUpEvent {
  title: string;
  description: string;
  characters: string[]; // roster identifiers
  location: string;     // location identifier, or "any"
}

export interface FollowUpQueue {
  events: FollowUpEvent[];   // newest first — front-inserted on ingestion
  consecutiveServed: number; // follow-ups fired in a row; resets when a random event fires
  inFlight?: FollowUpEvent;  // reserved by setup, consumed by commitFollowUp; see followUpService
}

export interface Estate {
  name: string;
  preferences?: EstatePreferences;
  dungeon?: DungeonState;
  time: EstateTime;
  weather: {
    current: Weather;
    previous: Weather;
  }
  leadership: EstateLeadership; // Roles within the estate
  money: number;
  narratives: string[];
  followUps?: FollowUpQueue;
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

// Strategy identifiers live in shared/constants/strategies.ts so that both this
// file and the server-side registry can depend on the same list without shared/
// having to import from server/. Re-exported here for existing import sites.
import type { StrategyWeights } from '../constants/strategies.js';
export type { StrategyId, StrategyWeights } from '../constants/strategies.js';

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