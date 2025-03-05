// shared/types/types.ts

export interface Stats {
  strength: number;
  agility: number;
  intelligence: number;
  authority: number;
  sociability: number;
}

export interface Status {
  physical: number;
  mental: number;
  affliction: string;
  description: string;
  wounds: string[];
  diseases: string[];
}

export interface Appearance {
  height: string;
  build: string;
  skinTone: string;
  hairColor: string;
  hairStyle: string;
  features: string;
}

export interface Clothing {
  head: string;
  body: string;
  legs: string;
  accessories: string;
}

export interface Combat {
  role: string;
  strengths: string[];
  weaknesses: string[];
}

export interface Relationship {
  affinity: number;
  dynamic: string;
  description: string;
}

export interface CharacterLocations {
  residence: string[];
  workplaces: string[];
  frequents: string[];
}

// ========== Character ==========

export interface Character {
  identifier: string;
  title: string;
  name: string;
  level: number;
  money: number;
  summary: string;
  history: string;
  race: string;
  gender: string;
  religion: string;
  traits: string[];
  status: Status;
  stats: Stats;
  locations: CharacterLocations;
  appearance: Appearance;
  clothing: Clothing;
  combat: Combat;
  magic: string;
  notes: string[];
  relationships: Record<string, Relationship>;
}

export interface NPC {
  identifier: string;
  title: string;
  name: string;
  summary: string;
  history: string;
  traits: string[];
  appearance: Appearance;
  clothing: Clothing;
  notes: string[];
}

// Utility type for storing multiple characters by their identifier
export type CharacterRecord = {
  [identifier: string]: Character;
};

// ========== Logs ==========
// Each log entry records a piece of narrative or event detail at a given month.
export interface LogEntry {
  month: number;   // could be in-game month or actual date index
  entry: string;   // short description of what happened
}

// ========== Events ==========
export type EventRecord = {
  [identifier: string]: EventData;
};

export interface EventData {
  identifier: string;
  title: string;
  summary: string;
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
  restored?: string;    // description when location is restored
  capacity?: number;    // max number of characters that can reside here
  npcs?: string[];      // array of NPC identifiers connected to this location
  parent: string;       // parent location identifier
  children: string[];   // child location identifiers
}

// ========== Estate ==========
export interface Estate {
  estateName: string;
  money: number;
  month: number;
  characters: CharacterRecord;
  restoredLocations?: string[];  // list of location identifiers that have been restored

  // Optional logs per entity type
  characterLogs?: { [charIdentifier: string]: LogEntry[] };
  eventLogs?: { [eventIdentifier: string]: LogEntry[] };
  locationLogs?: { [locationIdentifier: string]: LogEntry[] };
  npcLogs?: { [npcIdentifier: string]: LogEntry[] };

}

// ========== Helper Functions ==========

export function getCharacter(characters: CharacterRecord, id: string): Character | undefined {
  return characters[id];
}

// Helper function to create a new estate
export function createNewEstate(estateName: string): Estate {
  return {
    estateName,
    money: 0,
    month: 0,
    characters: {}
  };
}

// Helper function to add a character to an estate
export function addCharacterToEstate(estate: Estate, character: Character): Estate {
  return {
    ...estate,
    characters: {
      ...estate.characters,
      [character.identifier]: character
    }
  };
}
