// server/services/llmResponseProcessor.ts
// File order:
// Imports → Domain constants → Types → Public API (parsing/display/mutation)
// → Internal processors → Internal utilities

import type { Character, CharacterLocations, Estate, LogEntry } from '../../../shared/types/types.js';
import { updateBeat, updateDay } from '../game/estateService.js';
import { NEUTRAL_AFFINITY } from '../../../shared/constants/relationships.js';
import { 
  type LogTimeframe, 
  addEstateLog, 
  addCharacterLog, 
  addRelationshipLog 
} from '../game/logService.js';

/* -------------------------------------------------------------------
 *  Types (LLM response schema + frontend display schema)
 * ------------------------------------------------------------------- */

interface ConsequenceLogEntry {
  entry: string;
  timeframe: LogTimeframe;
}

// Define all possible consequence types matching the JSON structure
export interface CharacterConsequence {
  identifier: string;
  add_log?: ConsequenceLogEntry;
  add_relationship_log?: ConsequenceLogEntry & { target: string };
  update_description?: string;
  update_history?: string;
  update_stats?: {
    strength?: number;
    agility?: number;
    intelligence?: number;
    authority?: number;
    sociability?: number;
  };
  update_status?: {
    physical?: number;
    mental?: number;
    description?: string;
  };
  gain_traits?: string[];
  lose_traits?: string[];
  update_relationships?: {
    target: string;
    affinity?: number;
    dynamic?: string;
    description?: string;
  }[];
  update_appearance?: {
    height?: string;
    build?: string;
    skinTone?: string;
    hairColor?: string;
    hairStyle?: string;
    features?: string;
  };
  update_clothing?: {
    head?: string;
    body?: string;
    legs?: string;
    accessories?: string;
  };
  gain_wound?: string;
  lose_wound?: string;
  gain_disease?: string;
  lose_disease?: string;
  gain_note?: string;
  lose_note?: string;
  gain_trinket?: string;
  lose_trinket?: string;
  update_money?: number;
  update_religion?: string;
  update_locations?: Partial<CharacterLocations>;
  death?: string;
}

export interface ConsequencesResult {
  event_log?: ConsequenceLogEntry;
  end_day?: boolean;
  characters: CharacterConsequence[];
}

/**
 * Display-friendly consequence data for the frontend
 */
export interface ConsequenceDisplay {
  characters: {
    identifier: string;
    personalChanges: Array<{
      text: string;
      color: string;
    }>;
    relationshipChanges: {
      [targetIdentifier: string]: Array<{
        text: string;
        color: string;
        affinity?: number; // For determining glow effect
      }>;
    };
  }[];
}
  
/* -------------------------------------------------------------------
 *  Display constants (UI policy)
 * ------------------------------------------------------------------- */

const consequenceColorMap: Record<string, string> = {
  'Strength': 'crimson',
  'Agility': 'green',
  'Intelligence': 'dodgerblue',
  'Authority': 'darkmagenta',
  'Sociability': 'yellow',
  'Physical': 'red',
  'Mental': 'white',
  'Money': 'gold',
  'Note': 'burlywood',
  'Appearance': 'beige',
  'Clothing': 'violet',
  'Status': 'lightseagreen',
  'Wound': 'darkred',
  'Disease': '#90EE90',
  'Religion': 'lightyellow',
  'Trait': 'orange'
};

/* -------------------------------------------------------------------
 * Helper functions
 * ------------------------------------------------------------------- */

/**
 * Deduplicates relationship logs within the LLM response.
 * Handles:
 * 1. Exact duplicates for the same character.
 * 2. Mirrored duplicates (A reports bonding with B, B reports bonding with A).
 */
export function deduplicateRelationshipLogs(consequences: ConsequencesResult): ConsequencesResult {
  const result: ConsequencesResult = structuredClone(consequences);
  const seenLogs = new Set<string>();

  result.characters.forEach(char => {
    const relLog = char.add_relationship_log;
    if (!relLog) return;

    const pairKey = [char.identifier, relLog.target].sort().join(':');
    const logHash = `${pairKey}|${relLog.entry.trim()}|${relLog.timeframe}`;

    if (seenLogs.has(logHash)) {
      delete char.add_relationship_log;
      console.log(`[Deduplicator] Removed duplicate relationship log for ${char.identifier} regarding ${relLog.target}`);
    } else {
      seenLogs.add(logHash);
    }
  });

  return result;
}

/**
 * Removes obvious no-op deltas from an LLM consequence payload.
 * This prevents UI noise like "Physical +0" and avoids pointless processing.
 */
export function stripNoOpConsequences(raw: ConsequencesResult): ConsequencesResult {
  const consequences: ConsequencesResult = structuredClone(raw);

  for (const char of consequences.characters) {
    // --- update_stats: remove 0 deltas ---
    if (char.update_stats) {
      for (const key of Object.keys(char.update_stats) as Array<keyof typeof char.update_stats>) {
        if (char.update_stats[key] === 0) delete char.update_stats[key];
      }
      if (Object.keys(char.update_stats).length === 0) delete char.update_stats;
    }

    // --- update_status: remove 0 deltas (keep description if present) ---
    if (char.update_status) {
      if (char.update_status.physical === 0) delete char.update_status.physical;
      if (char.update_status.mental === 0) delete char.update_status.mental;

      // Optionally strip empty description
      if (char.update_status.description !== undefined && char.update_status.description.trim() === '') {
        delete char.update_status.description;
      }

      if (Object.keys(char.update_status).length === 0) delete char.update_status;
    }

    // --- money delta ---
    if (char.update_money === 0) delete char.update_money;

    // --- relationship affinity deltas ---
    if (char.update_relationships) {
      char.update_relationships = char.update_relationships
        .map(rel => {
          const cleaned = { ...rel };

          if (cleaned.affinity === 0) delete cleaned.affinity;
          if (cleaned.dynamic !== undefined && cleaned.dynamic.trim() === '') delete cleaned.dynamic;
          if (cleaned.description !== undefined && cleaned.description.trim() === '') delete cleaned.description;

          return cleaned;
        })
        // drop entries that now do nothing (target-only)
        .filter(rel =>
          rel.affinity !== undefined || rel.dynamic !== undefined || rel.description !== undefined
        );

      if (char.update_relationships.length === 0) delete char.update_relationships;
    }

    // --- traits arrays ---
    if (char.gain_traits && char.gain_traits.length === 0) delete char.gain_traits;
    if (char.lose_traits && char.lose_traits.length === 0) delete char.lose_traits;

    // --- optional: clean appearance/clothing if all fields empty/undefined ---
    if (char.update_appearance) {
      for (const [k, v] of Object.entries(char.update_appearance)) {
        if (typeof v === 'string' && v.trim() === '') delete (char.update_appearance as any)[k];
      }
      if (Object.keys(char.update_appearance).length === 0) delete char.update_appearance;
    }

    if (char.update_clothing) {
      for (const [k, v] of Object.entries(char.update_clothing)) {
        if (typeof v === 'string' && v.trim() === '') delete (char.update_clothing as any)[k];
      }
      if (Object.keys(char.update_clothing).length === 0) delete char.update_clothing;
    }
  }

  return consequences;
}

/* -------------------------------------------------------------------
 *  Public API: story parsing
 * ------------------------------------------------------------------- */

export function separateStoryTitle(storyText: string): { title: string; body: string } {
  const titleMatch = storyText.trimStart().match(/^\[(.*?)\]/);

  if (!titleMatch) {
    return { title: '', body: storyText.trim() };
  }

  return {
    title: titleMatch[1].trim(),
    body: storyText.substring(titleMatch[0].length).trim(),
  };
}

  
/* -------------------------------------------------------------------
 *  Public API: display formatting
 * ------------------------------------------------------------------- */

export function prepareConsequenceDisplay(rawConsequences: ConsequencesResult): ConsequenceDisplay {

  const consequences = stripNoOpConsequences(rawConsequences);

  return {
    characters: consequences.characters.map(char => {
      const display = {
        identifier: char.identifier,
        personalChanges: [] as Array<{ text: string; color: string }>,
        relationshipChanges: {} as Record<string, Array<{ text: string; color: string; affinity?: number }>>
      };

      // Process stats
      if (char.update_stats) {
        Object.entries(char.update_stats).forEach(([stat, value]) => {
          if (value !== undefined) {
            const prefix = value > 0 ? '+' : '';
            const statName = stat.charAt(0).toUpperCase() + stat.slice(1);
            display.personalChanges.push({
              text: `${statName} ${prefix}${value}`,
              color: consequenceColorMap[statName] || 'white'
            });
          }
        });
      }

      // Process status
      if (char.update_status) {
        if (char.update_status.physical !== undefined) {
          const prefix = char.update_status.physical > 0 ? '+' : '';
          display.personalChanges.push({
            text: `Physical ${prefix}${char.update_status.physical}`,
            color: consequenceColorMap['Physical'] || 'red'
          });
        }
        
        if (char.update_status.mental !== undefined) {
          const prefix = char.update_status.mental > 0 ? '+' : '';
          display.personalChanges.push({
            text: `Mental ${prefix}${char.update_status.mental}`,
            color: consequenceColorMap['Mental'] || 'white'
          });
        }
        
        if (char.update_status.description) {
          display.personalChanges.push({
            text: `↻ Status`,
            color: consequenceColorMap['Status'] || 'lightseagreen'
          });
        }
      }

      // Process traits
      if (char.gain_traits && char.gain_traits.length > 0) {
        char.gain_traits.forEach(trait => {
          display.personalChanges.push({
            text: `+ ${trait}`,
            color: consequenceColorMap['Trait'] || 'orange'
          });
        });
      }

      if (char.lose_traits && char.lose_traits.length > 0) {
        char.lose_traits.forEach(trait => {
          display.personalChanges.push({
            text: `- ${trait}`,
            color: consequenceColorMap['Trait'] || 'orange'
          });
        });
      }

      // Process appearance
      if (char.update_appearance) {
        if (Object.values(char.update_appearance).some(v => v !== undefined)) {
          display.personalChanges.push({
            text: `↻ Appearance`,
            color: consequenceColorMap['Appearance'] || 'beige'
          });
        }
      }

      // Process clothing
      if (char.update_clothing) {
        if (Object.values(char.update_clothing).some(v => v !== undefined)) {
          display.personalChanges.push({
            text: `↻ Clothing`,
            color: consequenceColorMap['Clothing'] || 'violet'
          });
        }
      }

      // Process wounds & diseases
      if (char.gain_wound) {
        display.personalChanges.push({
          text: `+ Wound`,
          color: consequenceColorMap['Wound'] || 'darkred'
        });
      }

      if (char.lose_wound) {
        display.personalChanges.push({
          text: `- Wound`,
          color: consequenceColorMap['Wound'] || 'darkred'
        });
      }

      if (char.gain_disease) {
        display.personalChanges.push({
          text: `+ Disease`,
          color: consequenceColorMap['Disease'] || '#90EE90'
        });
      }

      if (char.lose_disease) {
        display.personalChanges.push({
          text: `- Disease`,
          color: consequenceColorMap['Disease'] || '#90EE90'
        });
      }

      // Process notes
      if (char.gain_note) {
        display.personalChanges.push({
          text: `+ Note`,
          color: consequenceColorMap['Note'] || 'burlywood'
        });
      }

      // Process money
      if (char.update_money !== undefined) {
        const prefix = char.update_money > 0 ? '+' : '';
        display.personalChanges.push({
          text: `Money ${prefix}${char.update_money}`,
          color: consequenceColorMap['Money'] || 'gold'
        });
      }

      // Process religion
      if (char.update_religion) {
        display.personalChanges.push({
          text: `Religion → ${char.update_religion}`,
          color: consequenceColorMap['Religion'] || 'lightyellow'
        });
      }

      // Process relationships
      if (char.update_relationships) {
        char.update_relationships.forEach(rel => {
          if (!display.relationshipChanges[rel.target]) {
            display.relationshipChanges[rel.target] = [];
          }

          // Affinity change
          if (rel.affinity !== undefined) {
            const prefix = rel.affinity > 0 ? '+' : '';
            display.relationshipChanges[rel.target].push({
              text: `Affinity ${prefix}${rel.affinity}`,
              color: rel.affinity > 0 ? 'white' : 'red',
              affinity: rel.affinity
            });
          }

          // Dynamic change
          if (rel.dynamic) {
            display.relationshipChanges[rel.target].push({
              text: `↻ Dynamic`,
              color: 'orange'
            });
          }

          // Description change
          if (rel.description) {
            display.relationshipChanges[rel.target].push({
              text: `↻ Description`,
              color: 'orange'
            });
          }
        });
      }

      return display;
    })
  };
}

/* -------------------------------------------------------------------
 *  Public API: state mutation
 * ------------------------------------------------------------------- */

export function applyConsequences(estate: Estate, consequences: ConsequencesResult): Estate {
  // Mutates the estate in place and returns it. The route owns load → apply → save,
  // and loadEstate hands back a fresh object per request, so there's nothing to
  // protect by copying.

  // Initialize character logs if they don't exist
  if (!estate.characterLogs) {
    estate.characterLogs = {} as { [charIdentifier: string]: LogEntry[] };
  }

  if (consequences.event_log) {
    addEstateLog(
      estate,
      consequences.event_log.entry,
      consequences.event_log.timeframe
    );
  }

  consequences = deduplicateRelationshipLogs(consequences);

  // Process each character's consequences
  for (const characterConsequence of consequences.characters) {
    const { identifier } = characterConsequence;

    // Skip if character doesn't exist in estate
    if (!estate.characters[identifier]) {
      console.warn(`Character ${identifier} not found in estate, skipping consequences`);
      continue;
    }

    const character = estate.characters[identifier];

    processAddLog(estate, character, characterConsequence);
    processAddRelationshipLog(estate, character, characterConsequence);
    processUpdateDescription(character, characterConsequence);
    processUpdateHistory(character, characterConsequence);
    processUpdateStats(character, characterConsequence);
    processUpdateStatus(character, characterConsequence);
    processTraits(character, characterConsequence);
    processRelationships(character, characterConsequence);
    processAppearance(character, characterConsequence);
    processClothing(character, characterConsequence);
    processWoundsAndDiseases(character, characterConsequence);
    processNotes(character, characterConsequence);
    processUpdateLocations(character, characterConsequence);
    processMiscUpdates(character, characterConsequence);
  }

  processEstateCalendar(estate, consequences);

  return estate;
}

/**
 * Ensures that every character involved in the event has a consequence object.
 * If the LLM omitted a character (because nothing happened), this adds an empty
 * consequence object for them so the frontend can still render the character card.
 */
export function ensureAllCharactersHaveConsequences(
  consequences: ConsequencesResult,
  chosenCharacterIds: string[]
): ConsequencesResult {
  const result: ConsequencesResult = structuredClone(consequences);

  const returnedIds = new Set(result.characters.map(c => c.identifier));

  chosenCharacterIds.forEach((id) => {
    if (!returnedIds.has(id)) {
      const emptyConsequence: CharacterConsequence = { identifier: id };
      result.characters.push(emptyConsequence);
    }
  });

  return result;
}

/* -------------------------------------------------------------------
 *  Internal processors (mutation helpers)
 * ------------------------------------------------------------------- */

function processEstateCalendar(estate: Estate, consequences: ConsequencesResult): void {

  // If the consequences indicate the day should end and it isn't the first beat of a new day already, advance the day
  if (consequences.end_day && estate.time.beat != 0) {
    updateDay(estate, 1);
  } else {
    updateBeat(estate, 1);
  }
}

/**
 * Process and add a log entry to a character's logs
 */
function processAddLog(estate: Estate, character: Character, consequence: CharacterConsequence): void {
  if (!consequence.add_log) return;
  
  addCharacterLog(
    estate, 
    character.identifier, 
    consequence.add_log.entry, 
    consequence.add_log.timeframe
  );
}

/**
 * Process and add a relationship log entry to both characters' logs
 */
function processAddRelationshipLog(
  estate: Estate, 
  character: Character, 
  consequence: CharacterConsequence
): void {
  if (!consequence.add_relationship_log) return;
  
  addRelationshipLog(
    estate, 
    character.identifier, 
    consequence.add_relationship_log.target, 
    consequence.add_relationship_log.entry, 
    consequence.add_relationship_log.timeframe
  );
}

/**
 * Update a character's description or history
 */

function processUpdateDescription(character: Character, consequence: CharacterConsequence): void {
  if (!consequence.update_description?.trim()) return;
  character.description = consequence.update_description;
}

function processUpdateHistory(character: Character, consequence: CharacterConsequence): void {
  if (!consequence.update_history?.trim()) return;
  character.history = consequence.update_history;
}


/**
 * Update a character's stats based on consequences
 */
function processUpdateStats(character: Character, consequence: CharacterConsequence): void {
  if (!consequence.update_stats) return;
  
  const { update_stats } = consequence;
  
  // Update each stat if provided, ensuring they stay within 0-10 range
  if (update_stats.strength !== undefined) {
    character.stats.strength = clamp(character.stats.strength + update_stats.strength, 0, 10);
  }
  
  if (update_stats.agility !== undefined) {
    character.stats.agility = clamp(character.stats.agility + update_stats.agility, 0, 10);
  }
  
  if (update_stats.intelligence !== undefined) {
    character.stats.intelligence = clamp(character.stats.intelligence + update_stats.intelligence, 0, 10);
  }
  
  if (update_stats.authority !== undefined) {
    character.stats.authority = clamp(character.stats.authority + update_stats.authority, 0, 10);
  }
  
  if (update_stats.sociability !== undefined) {
    character.stats.sociability = clamp(character.stats.sociability + update_stats.sociability, 0, 10);
  }
}

/**
 * Update a character's status based on consequences
 */
function processUpdateStatus(character: Character, consequence: CharacterConsequence): void {
  if (!consequence.update_status) return;
  
  const { update_status } = consequence;
  
  // Update physical and mental health, ensuring they stay within 0-100 range
  if (update_status.physical !== undefined) {
    character.status.physical = clamp(character.status.physical + update_status.physical, 0, 100);
  }
  
  if (update_status.mental !== undefined) {
    character.status.mental = clamp(character.status.mental + update_status.mental, 0, 100);
  }
  
  // Update description if provided
  if (update_status.description) {
    character.status.description = update_status.description;
  }
}

/**
 * Process trait changes (additions and removals)
 */
function processTraits(character: Character, consequence: CharacterConsequence): void {
  // Add new traits
  if (consequence.gain_traits && consequence.gain_traits.length > 0) {
    for (const trait of consequence.gain_traits) {
      // Only add if not already present
      if (!character.traits.includes(trait)) {
        character.traits.push(trait);
      }
    }
  }
  
  // Remove traits
  if (consequence.lose_traits && consequence.lose_traits.length > 0) {
    character.traits = character.traits.filter(trait => 
      !consequence.lose_traits!.includes(trait)
    );
  }
}

/**
 * Process relationship updates
 */
function processRelationships(character: Character, consequence: CharacterConsequence): void {
  if (!consequence.update_relationships) return;
  
  for (const relationshipUpdate of consequence.update_relationships) {
    const { target, affinity, dynamic, description } = relationshipUpdate;
    
    // Skip if target doesn't exist
    if (!target) continue;
    
    // Create relationship if it doesn't exist (this should never happen)
    if (!character.relationships[target]) {
      character.relationships[target] = {
        affinity: NEUTRAL_AFFINITY, // Default neutral affinity
        dynamic: "",
        description: ""
      };
    }
    
    // Get current relationship
    const relationship = character.relationships[target];
    
    // Update affinity if provided
    if (affinity !== undefined) {
      relationship.affinity = clamp(relationship.affinity + affinity, 0, 10);
    }
    
    // Update dynamic if provided
    if (dynamic) {
      relationship.dynamic = dynamic;
    }
    
    // Update description if provided
    if (description) {
      relationship.description = description;
    }
  }
}

/**
 * Process appearance updates
 */
function processAppearance(character: Character, consequence: CharacterConsequence): void {
  if (!consequence.update_appearance) return;
  
  const { update_appearance } = consequence;
  
  // Update each appearance attribute if provided
  if (update_appearance.height) {
    character.appearance.height = update_appearance.height;
  }
  
  if (update_appearance.build) {
    character.appearance.build = update_appearance.build;
  }
  
  if (update_appearance.skinTone) {
    character.appearance.skinTone = update_appearance.skinTone;
  }
  
  if (update_appearance.hairColor) {
    character.appearance.hairColor = update_appearance.hairColor;
  }
  
  if (update_appearance.hairStyle) {
    character.appearance.hairStyle = update_appearance.hairStyle;
  }
  
  if (update_appearance.features) {
    character.appearance.features = update_appearance.features;
  }
}

/**
 * Process clothing updates
 */
function processClothing(character: Character, consequence: CharacterConsequence): void {
  if (!consequence.update_clothing) return;
  
  const { update_clothing } = consequence;
  
  // Update each clothing item if provided
  if (update_clothing.head) {
    character.clothing.head = update_clothing.head;
  }
  
  if (update_clothing.body) {
    character.clothing.body = update_clothing.body;
  }
  
  if (update_clothing.legs) {
    character.clothing.legs = update_clothing.legs;
  }
  
  if (update_clothing.accessories) {
    character.clothing.accessories = update_clothing.accessories;
  }
}

/**
 * Process wounds and diseases
 */
function processWoundsAndDiseases(character: Character, consequence: CharacterConsequence): void {
  // Process wound gain
  if (consequence.gain_wound) {
    character.status.wounds.push(consequence.gain_wound);
  }
  
  // Process wound removal
  if (consequence.lose_wound) {
    character.status.wounds = character.status.wounds.filter(
      wound => wound !== consequence.lose_wound
    );
  }
  
  // Process disease gain
  if (consequence.gain_disease) {
    character.status.diseases.push(consequence.gain_disease);
  }
  
  // Process disease removal
  if (consequence.lose_disease) {
    character.status.diseases = character.status.diseases.filter(
      disease => disease !== consequence.lose_disease
    );
  }
}

/**
 * Process character notes
 */
function processNotes(character: Character, consequence: CharacterConsequence): void {
  // Add note
  if (consequence.gain_note) {
    character.notes.push(consequence.gain_note);
  }
  
  // Remove note
  if (consequence.lose_note) {
    character.notes = character.notes.filter(
      note => note !== consequence.lose_note
    );
  }
}

/**
 * Process miscellaneous updates like money and religion
 */
function processMiscUpdates(character: Character, consequence: CharacterConsequence): void {
  // Update money
  if (consequence.update_money !== undefined) {
    character.money += consequence.update_money;
    // Ensure money doesn't go below 0
    if (character.money < 0) character.money = 0;
  }
  
  // Update religion
  if (consequence.update_religion) {
    character.religion = consequence.update_religion;
  }
}

/**
 * Update character locations (residence, workplaces, frequents)
 */
function processUpdateLocations(character: Character, consequence: CharacterConsequence): void {
  if (!consequence.update_locations) return;

  const { update_locations } = consequence;

  if (update_locations.residence) {
    character.locations.residence = update_locations.residence;
  }
  if (update_locations.workplaces) {
    character.locations.workplaces = update_locations.workplaces;
  }
  if (update_locations.frequents) {
    character.locations.frequents = update_locations.frequents;
  }
}

/* -------------------------------------------------------------------
 *  Internal utilities
 * ------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

