// server/services/promptService.ts
import type { CharacterRecord } from '../../shared/types/types.js';

// Define the types again for clarity, or import them from a shared location.
interface ZodiacSeason { name: string; text: string; }
interface PresentDayScenario { month?: number; text: string; }

// --- Pure Helper Functions ---
export function getZodiacForMonth(month: number, zodiacs: ZodiacSeason[]): ZodiacSeason {
  // This function now requires the zodiac data to be passed in.
  const seasonIndex = month % 12;
  return zodiacs[seasonIndex];
}

export function getPresentDayText(month: number, scenarios: PresentDayScenario[]): string {
  // This function now requires the scenario data to be passed in.
  if (month >= scenarios.length) {
    month = scenarios.length - 1; // Clamp to the last scenario if month exceeds available scenarios
  }
  let scenario = scenarios.find(s => s.month === month);
  return scenario ? scenario.text : "Time has passed, and the struggle continues.";
}

function formatTimeSinceEvent(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) {
    return `${remainingMonths} months`;
  } else {
    return `${years} years and ${remainingMonths} months`;
  }
}


// --- The Main Assembler Function ---

interface NarrativeContextPayload {
  month: number;
  estateName: string;
  instructions: string;
  backstory: string;
  zodiacs: ZodiacSeason[];
  scenarios: PresentDayScenario[];
}

/**
 * Compiles the full context prompt for the LLM from pre-loaded data.
 */
export function compileNarrativeContext(payload: NarrativeContextPayload): string {
  const { month, estateName, instructions, backstory, zodiacs, scenarios } = payload;
  
  const zodiac = getZodiacForMonth(month, zodiacs);
  const presentDayText = getPresentDayText(month, scenarios);

  // Use a simple template literal with placeholders
  let contextTemplate = `
    [Instructions]
    ${instructions}

    [Context]
    ${backstory}

    PRESENT DAY:
    It is the month of ${zodiac.name}. ${zodiac.text}
    ${formatTimeSinceEvent(month)} have passed since the Ancestor's suicide and invasion of the hamlet. 
    ${presentDayText}
  `;

  // Replace all placeholders like ${estateName} at the very end
  return contextTemplate.replace(/\$\{estateName\}/g, estateName);
}

export interface ConsequencePrompt {
  event_log: EventLog;  // Required single event log entry
  characters: CharacterConsequence[];
}

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

// New interface for global event logs
interface EventLog {
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

export function validateConsequenceUpdate(
  update: ConsequencePrompt, 
  characters: CharacterRecord
): boolean {
  // Check if update has the required structure
  if (!update || !Array.isArray(update.characters)) return false;
  
  // Validate event_log (required)
  if (!update.event_log || typeof update.event_log !== 'object') return false;
  
  // Validate required fields for event_log
  if (!update.event_log.entry || !update.event_log.timeframe) return false;
  
  // Validate timeframe value
  if (!["transient", "short_term", "mid_term", "long_term", "permanent"].includes(update.event_log.timeframe)) {
    return false;
  }
  
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
export function formatConsequenceUpdate(update: ConsequencePrompt): ConsequencePrompt {
  // Apply any necessary transformations or validations to the consequences
  // This returns the actual object, not a string
  
  // Creating a new object to avoid mutating the input
  const formatted: ConsequencePrompt = {
    // Format the required event_log
    event_log: {
      entry: update.event_log.entry,
      timeframe: update.event_log.timeframe
    },
    // Format the characters array
    characters: update.characters.map(character => ({
      ...character,
      // Add any transformations here
    }))
  };
  
  return formatted;
}