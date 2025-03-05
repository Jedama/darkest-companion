import type { CharacterRecord } from '../../../shared/types/types';

// Types for the consequence system
interface StatUpdate {
    strength?: number;
    agility?: number;
    intelligence?: number;
    authority?: number;
    sociability?: number;
  }
  
  interface StatusUpdate {
    physical?: number;
    mental?: number;
    description?: string;
  }
  
  interface RelationshipUpdate {
    target: string;
    affinity?: number;
    dynamic?: string;
    description?: string;
  }
  
  interface AppearanceUpdate {
    height?: string;
    build?: string;
    skinTone?: string;
    hairColor?: string;
    hairStyle?: string;
    features?: string;
  }
  
  interface ClothingUpdate {
    head?: string;
    body?: string;
    legs?: string;
    other?: string;
  }

  type LogTimeframe = 
    | "transient"      // Just this event/month, likely irrelevant soon
    | "short_term"     // Relevant for next few months
    | "mid_term"       // Significant for half a year or so
    | "long_term"      // Major impact lasting a year or more
    | "permanent"      // Forever changes the character

  interface LogEntry {
    entry: string;
    timeframe: LogTimeframe;
  }
  
  interface CharacterConsequence {
    identifier: string;
    add_log?: LogEntry;
    update_stats?: StatUpdate;
    update_status?: StatusUpdate;
    gain_traits?: string[];
    lose_traits?: string[];
    update_relationships?: RelationshipUpdate[];
    update_appearance?: AppearanceUpdate;
    update_clothing?: ClothingUpdate;
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
    death?: string;
  }
  
  export interface ConsequencePrompt {
    characters: CharacterConsequence[];
  }
  
  // The base consequence prompt template
  const consequenceInstructions = `STRICT JSON FORMAT REQUIREMENTS:
  - Output only the "characters" array. No other root keys.
  - All changes must relate to characters in the CHARACTERS list above.
  - Use only the commands and fields below:
  
  ALLOWED COMMANDS PER CHARACTER:
  {
    "identifier": "string (MUST match character identifiers)",
    
    // CHARACTER LOG
    "add_log": {
      "entry": "string describing a notable event or development",
      "timeframe": "transient" | "short_term" | "mid_term" | "long_term" | "permanent"
    }

    // STATS (numeric changes, range: 0-10)
    "update_stats?": {
      "strength?": ±number (-5 to +5),
      "agility?": ±number (-5 to +5),
      "intelligence?": ±number (-5 to +5),
      "authority?": ±number (-5 to +5),
      "sociability?": ±number (-5 to +5)
    },
  
    // STATUS (numeric changes, range: 0-100)
    "update_status?": {
      "physical?": ±number (-50 to +50),
      "mental?": ±number (-50 to +50),
      "description?": "new_description"
    },
  
    // TRAITS (add/remove)
    "gain_traits?": ["trait"],
    "lose_traits?": ["EXACT_existing_trait"],
  
    // RELATIONSHIPS (target by identifier, affinity range: 0 to 10)
    "update_relationships?": [{
      "target": "character_identifier",
      "affinity?": ±number (-5 to +5),
      "dynamic?": "string (new relationship dynamic, 1-3 words)",
      "description?": "string (new relationship description, 1-2 sentences)"
    }],
  
    // APPEARANCE (specific fields)
    "update_appearance?": {
      "height?": "new_description",
      "build?": "new_description",
      "skinTone?": "new_description",
      "hairColor?": "new_description",
      "hairStyle?": "new_description",
      "features?": "new_description"
    },
  
    // CLOTHING (specific fields)
    "update_clothing?": {
      "head?": "new_description",
      "body?": "new_description",
      "legs?": "new_description",
      "other?": "new_description"
    },
  
    // WOUNDS/DISEASES
    "gain_wound?": "wound_description",
    "lose_wound?": "EXACT_wound_description_to_remove",
    "gain_disease?": "disease_name",
    "lose_disease?": "EXACT_disease_name_to_remove",
  
    // NOTES/
    "gain_note?": "new_note_text",
    "lose_note?": "EXACT_note_text_to_remove",

    // MONEY/RELIGION
    "update_money?": ±number,
    "update_religion?": "new_religion_name"

    // DEATH
    "death?": "cause_of_death"
  }
  
  RULES:
  1. Use ONLY the fields above. No new keys.
  2. For removals (lose_trait, lose_note, etc.), values MUST match existing entries exactly.
  3. Omit fields entirely if no changes (don't include empty arrays/objects).
  4. If no consequences apply to a character, omit them entirely.
  5. Refer to the characters by their identifiers, labeled with [identifier] above.
  6. Don't include the questionmarks in your response, they are only there to indicate optional fields.'
  7. Notes must describe persistent personality traits or habits (e.g. "Always checks doorways twice", "Mutters prayers under breath"), and never relate to other characters.
  8. When updating descriptive fields (summary, history, relationships), your output will overwrite what's already there, so rewrite most of the existing text while weaving in the new developments.
  9. Only status descriptions should reflect immediate conditions or temporary states - all other descriptive fields (summary/history/relationship description) should capture enduring changes to the character without mentioning or tying to this specific event.
  10. Add a log to each character. Mark it with a timeframe to avoid bloating the logs with irrelevant information.
  
  Example:
  {
    characters: [
      {
        add_log: {
          entry: "Became the new head of the Thieves' Guild",
          timeframe: "long_term"
        },
        identifier: "crusader",
        update_stats: {
          strength: 1,
          authority: -2
        },
        update_status: {
          physical: -10,
          description: "Bruised and battered from a recent battle."
        },
        gain_traits: ["Greedy"],
        lose_traits: ["Zealous"],
        gain_note: "Prays for forgiveness each night",
        update_relationships: [
          {
            target: "highwayman",
            affinity: 1,
            dynamic: "Trusted Allies"
          },
          {
            target: "seraph",
            affinity: -2,
            description: "The Crusader saw the Seraph as a guiding light in their past crusades, but her harsh judgements have gone too far for the Crusader to follow."
          }
        ]
      }
    ]
  }
  
  Now determine appropriate consequences based on the story. Output them in JSON with no additional text.`;
  
  // Helper function to get the consequence instructions
  export function getConsequenceInstructions(): string {
    return consequenceInstructions;
  }
  
  export function validateConsequenceUpdate(
    update: ConsequencePrompt, 
    characters: CharacterRecord
  ): boolean {
    // Check if update has the required structure
    if (!update || !Array.isArray(update.characters)) return false;
    
    // Validate each character's consequences
    for (const char of update.characters) {
      // Required fields
      if (!char.identifier) return false;
      
      // Check if the character identifier exists in the record
      if (!characters[char.identifier]) return false;
      
      // Validate log timeframe
      if (char.add_log && !["transient", "short_term", "mid_term", "long_term", "permanent"].includes(char.add_log.timeframe)) {
        return false;
      }
      
      // Validate stat ranges (just the change values, not the result)
      if (char.update_stats) {
        for (const [key, value] of Object.entries(char.update_stats)) {
          // Check if the key is valid
          if (!["strength", "agility", "intelligence", "authority", "sociability"].includes(key)) return false;
          
          // Check if the value is within allowed range (-5 to +5)
          if (value < -5 || value > 5) return false;
        }
      }
      
      // Validate status changes (not the resulting values)
      if (char.update_status) {
        if (char.update_status.physical !== undefined && 
            (char.update_status.physical < -50 || char.update_status.physical > 50)) {
          return false;
        }
        
        if (char.update_status.mental !== undefined && 
            (char.update_status.mental < -50 || char.update_status.mental > 50)) {
          return false;
        }
      }
      
      // Validate relationship updates
      if (char.update_relationships) {
        for (const rel of char.update_relationships) {
          // Check if target exists
          if (!rel.target || !characters[rel.target]) return false;
          
          // Validate affinity range for the change
          if (rel.affinity !== undefined && (rel.affinity < -5 || rel.affinity > 5)) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
  
  // Helper function to format a consequence update
  export function formatConsequenceUpdate(update: ConsequencePrompt): string {
    return JSON.stringify({ characters: update.characters }, null, 2);
  }