// shared/types/types.ts
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

export interface CharacterLocations {
  residence: string[];
  workplaces: string[];
  frequents: string[];
}

export interface CharacterRelationship {
  affinity: number;
  dynamic: string;
  description: string;
}


export type StrategyWeights = Record<string, number>;

// ========== Character ==========

export interface Character extends CharacterTemplate {
  level: number;
  money: number;
  status: CharacterStatus;
  relationships: Record<string, CharacterRelationship>;
  locations: CharacterLocations;
  strategyWeights: StrategyWeights;
}

export interface CharacterTemplate {
  identifier: string;
  title: string;
  name: string;
  description: string;
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

// ========== Logs ==========
// Each log entry records a piece of narrative or event detail at a given month.
export interface LogEntry {
  month: number;          // in-game month the log occured during
  entry: string;          // short description of what happened
  expiryMonth: number;    // month when this log should expire
}

export interface EventData {
  identifier: string;
  title: string;
  description: string;
  nrChars: number;     // number of characters typically involved
  keywords: string[];  // e.g., ["combat", "gambling", "nighttime"]
  location: EventLocationRequirements;  // location requirements for characters
  // You can add fields like "specialConsequences", "outcomes", etc., if needed
}


export interface EventLocationRequirements {
  default: string[];
  residence: number[];  // Character indices (1-based)
  workplaces: number[];  // Character indices (1-based)
  frequents: number[];  // Character indices (1-based)
  allowParentLocations?: boolean; // Controls whether parent locations are considered
  allowAll?: boolean;  // Allows any location to be used
}


// ========== Locations ==========
export interface LocationData {
  identifier: string;
  title: string;
  description: string;
  summary: string;
  restored?: string;    // description when location is restored
  capacity?: number;    // max number of characters that can reside here
  npcs?: string[];      // array of NPC identifiers connected to this location
  parent: string;       // parent location identifier
  children: string[];   // child location identifiers
}

// ========== Estate ==========

export type EstateRoles = {
  margrave: string; // The character identifier of the Margrave
  bursar: string;   // The character identifier of the Bursar
  sheriff?: string; // Optional: The character identifier of the Sheriff
  judge?: string;   // Optional: The character identifier of the Judge
  council?: string[]; // Optional: A list of character identifiers for the council
};

export interface Estate {
  estateName: string;
  money: number;
  month: number;
  roles: EstateRoles; // Roles within the estate
  characters: CharacterRecord;
  restoredLocations?: string[];  // list of location identifiers that have been restored
  estateLogs?: LogEntry[];

  // Optional logs per entity type
  characterLogs?: { [charIdentifier: string]: LogEntry[] };
  //eventLogs?: { [eventIdentifier: string]: LogEntry[] };
  //locationLogs?: { [locationIdentifier: string]: LogEntry[] };
  //npcLogs?: { [npcIdentifier: string]: LogEntry[] };

}

// A record of blueprints, loaded at startup.
export type CharacterTemplateRecord = Record<string, CharacterTemplate>;

// A record of active characters in an estate's state.
export type CharacterRecord = Record<string, Character>;

// A record of all available event blueprints.
export type EventRecord = Record<string, EventData>;


// ========== Bystanders ==========

type BystanderConnectionType = 'residence' | 'workplace' | 'frequent' | 'present';

export interface Bystander {
  characterId: string;
  connectionType: BystanderConnectionType;
}