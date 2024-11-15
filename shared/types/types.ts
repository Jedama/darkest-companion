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
  
  export type CharacterRecord = {
    [identifier: string]: Character;
  }
  
  export interface Estate {
    estateName: string;
    money: number;
    month: number;
    characters: CharacterRecord;
  }
  
  // Helper functions
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