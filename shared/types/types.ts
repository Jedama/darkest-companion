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
  other: string;
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
  equipment: string[];
  trinkets: string[];
  appearance: Appearance;
  clothing: Clothing;
  combat: Combat;
  magic: string;
  notes: string[];
  relationships: Record<string, Relationship>;
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
  // You can add fields like "specialConsequences", "outcomes", etc., if needed
}

// ========== Locations ==========
// Minimal structure for a location; add fields as needed
export interface LocationData {
  identifier: string;
  title: string;
  npcs: string[];      // array of NPC names or identifiers
  keywords: string[];  // e.g., ["urban", "gambling", "crowded"]
  // Could also have a longer description field, hazards, etc.
}

// ========== Estate ==========
export interface Estate {
  estateName: string;
  money: number;
  month: number;
  characters: CharacterRecord;

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
