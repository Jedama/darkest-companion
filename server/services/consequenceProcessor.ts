// server/services/consequencesProcessor.ts
import { Estate, Character, LogEntry, Relationship } from '../../shared/types/types';

// Define all possible consequence types matching the JSON structure
export interface CharacterConsequence {
  identifier: string;
  add_log?: {
    entry: string;
    timeframe: 'transient' | 'short_term' | 'mid_term' | 'long_term' | 'permanent';
  };
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
  update_money?: number;
  update_religion?: string;
  // death?: string; // Will be implemented later
}

export interface ConsequencesResult {
  characters: CharacterConsequence[];
}

/**
 * Interface for the display-friendly consequence data
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
  
  /**
   * Color mapping for different consequence types
   */
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
  
  /**
   * Prepares display-friendly consequence data for the frontend
   * 
   * @param consequences The raw consequence data from the LLM
   * @returns Formatted display data for the frontend
   */
  export function prepareConsequenceDisplay(consequences: ConsequencesResult): ConsequenceDisplay {
    return {
      characters: consequences.characters.map(char => {
        const display = {
          identifier: char.identifier,
          personalChanges: [] as Array<{ text: string; color: string }>,
          relationshipChanges: {} as Record<string, Array<{ text: string; color: string; affinity?: number }>>
        };
  
        // Process add_log (just for debugging if needed)
        // if (char.add_log) {
        //   display.personalChanges.push({
        //     text: `Log entry added`,
        //     color: 'white'
        //   });
        // }
  
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

/**
 * Apply consequences to the estate based on the structured LLM response
 * @param estate The current estate object
 * @param consequences The validated consequences from the LLM
 * @returns The updated estate object with all consequences applied
 */
export function applyConsequences(estate: Estate, consequences: ConsequencesResult): Estate {
  // Create a deep copy of the estate to avoid mutating the original
  const updatedEstate: Estate = JSON.parse(JSON.stringify(estate));
  
  // Initialize character logs if they don't exist
  if (!updatedEstate.characterLogs) {
    updatedEstate.characterLogs = {} as { [charIdentifier: string]: LogEntry[] };
  }

  // Process each character's consequences
  for (const characterConsequence of consequences.characters) {
    const { identifier } = characterConsequence;
    
    // Skip if character doesn't exist in estate
    if (!updatedEstate.characters[identifier]) {
      console.warn(`Character ${identifier} not found in estate, skipping consequences`);
      continue;
    }

    // Get reference to the character to update
    const character = updatedEstate.characters[identifier];

    // Process each consequence type
    processAddLog(updatedEstate, character, characterConsequence);
    processUpdateStats(character, characterConsequence);
    processUpdateStatus(character, characterConsequence);
    processTraits(character, characterConsequence);
    processRelationships(character, characterConsequence);
    processAppearance(character, characterConsequence);
    processClothing(character, characterConsequence);
    processWoundsAndDiseases(character, characterConsequence);
    processNotes(character, characterConsequence);
    processMiscUpdates(character, characterConsequence);
  }

  return updatedEstate;
}

/**
 * Process and add a log entry to a character's logs
 */
function processAddLog(estate: Estate, character: Character, consequence: CharacterConsequence): void {
    if (!consequence.add_log) return;
    
    // Ensure characterLogs exists on the estate
    if (!estate.characterLogs) {
      estate.characterLogs = {};
    }
    
    // Initialize character logs array if it doesn't exist
    if (!estate.characterLogs[character.identifier]) {
      estate.characterLogs[character.identifier] = [];
    }
    
    // Create a new log entry
    const logEntry: LogEntry = {
      month: estate.month, // Current month from estate
      entry: consequence.add_log.entry,
      expiryMonth: calculateExpiryMonth(estate.month, consequence.add_log.timeframe)
    };
    
    // Add the log entry to the character's logs
    estate.characterLogs[character.identifier].push(logEntry);
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
    
    // Create relationship if it doesn't exist
    if (!character.relationships[target]) {
      character.relationships[target] = {
        affinity: 5, // Default neutral affinity
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
 * Utility function to clamp a number between min and max values
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Calculate the expiry month based on the timeframe
 */
function calculateExpiryMonth(currentMonth: number, timeframe: string): number {
    const timeframeToMonths: Record<string, number> = {
      'transient': 1,
      'short_term': 3,
      'mid_term': 7, 
      'long_term': 12,
      'permanent': 1000
    };
  
    // Default to mid_term if timeframe is not recognized
    const months = timeframeToMonths[timeframe] || timeframeToMonths['mid_term'];
    
    return currentMonth + months;
  }