// server/services/promptData/consequenceData
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

export interface ConsequencePrompt {
  event_log: EventLog;  // Required single event log entry
  characters: CharacterConsequence[];
}

// The updated consequence prompt template
const consequenceInstructions = `
NARRATIVE STORYTELLING COMPANION - CONSEQUENCE DETECTION

You are analyzing a narrative scene between characters to identify meaningful developments, revelations, and relationship changes that impact their ongoing story. Your goal is to extract the most narratively significant elements that should persist beyond this scene.

WHAT TO LOOK FOR:
- Character revelations: hidden abilities, fears, weaknesses, or personality traits revealed
- Relationship developments: new dynamics, trust, conflict, or disdain between characters
- Physical or mental changes: injuries, confidence boosts, trauma, or emotional breakthroughs
- Personality shifts: changes in outlook, priorities, or behavior patterns
- Significant plot events: major developments that impact the story overall

STRICT JSON FORMAT REQUIREMENTS:
- Output contains "event_log" array and "characters" array as root keys.
- All character changes must relate to characters in the CHARACTERS list above.
- Use only the commands and fields below:

GLOBAL EVENT LOG FORMAT:
{
  "event_log": {
    "entry": "string describing the most significant plot event or development of the scene",
    "timeframe": "transient" | "short_term" | "mid_term" | "long_term" | "permanent"
  },
  "characters": [...]
}

ALLOWED COMMANDS PER CHARACTER:
{
  "identifier": "string (MUST match character identifiers)",
  
  // CHARACTER LOG - Record significant story developments
  "add_log?": {
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

  // NOTES - Record persistent character qualities or knowledge
  "gain_note?": "new_note_text",
  "lose_note?": "EXACT_note_text_to_remove",

  // MONEY/RELIGION
  "update_money?": ±number,
  "update_religion?": "new_religion_name"

  // DEATH
  "death?": "cause_of_death"
}

GUIDANCE FOR QUALITY CONSEQUENCES:
  - Always remember: This is a game of managing broken, horrible people and difficulty, dysfunctional relationships, and those few moments of true redemption are our primary selling points. 
  Make the characters hate and love and despise and long for each other. Extreme character dynamics are the core of our stories.

1. EVENT LOG:
   - Add a single story log entry detaileing the core of what transpired
   - Keep entries factual and focused on what happened, not character reactions
   - Entry should be brief and summarize the scene
   - Use timeframes to indicate story impact:
     * transient: minor plot developments and character interactions
     * short_term: events that influence the hamlet as a whole for a short while
     * mid_term: significant developments with broader implications for the whole reclamation effort
     * long_term: major plot points that shape the quest
     * permanent: fundamental world or setting changes

2. CHARACTER LOGS:
   - Character logs are optional. Add one if relevant
   - Focus only on the core development or revelation
   - Use timeframes appropriately:
     * transient: fleeting emotions or minor developments
     * short_term: events with impact over next few interactions
     * mid_term: significant changes with lasting implications
     * long_term: major life events that reshape a character
     * permanent: fundamental, irreversible transformations

3. STATUS DESCRIPTIONS:
   - Capture the character's current emotional/mental state
   - Be specific and evocative (e.g., "Haunted by memories of imprisonment" not "Feeling sad")
   - Reflect immediate conditions from this scene, not long-term states
   - Don't confine your numerical updates to multiples of five. 

4. TRAITS:
   - Traits represent fundamental character attributes reflected in their behavior
   - One or two words maximum

5. NOTES:
   - Notes should be specific and capture:
     * Unique abilities or skills
     * Persistent habits or behaviors
     * Established beliefs, values, or fears
   - Format notes as timeless attributes rather than developments in progress
   - Bad example: "Becoming suspicious of authority" (transitional)
   - Good example: "Scrutinizes authority figures' motives" (established behavior)
   - Avoid adding duplicate notes that merely restate information already present elsewhere
   
6. STATS:
   - Only update when a significant change is demonstrated
   - Strength/Agility: physical capabilities displayed
   - Intelligence: knowledge or mental acuity revealed
   - Authority: command presence or leadership shown
   - Sociability: social skills or connection demonstrated

7. RELATIONSHIPS:
   - Be bold but truthful, and focus on evolving relationships towards future narrative paths
   - Dynamics should be concise (1-3 words) and capture the relationship's essence
   - Descriptions should explain WHY characters relate this way
   - Avoid mentioning specific events in relationship descriptions
   - Relationships at the extremeties 0 or 10 should be dramatic: open animosity, resentment, reverence, or love

RULES:
1. Use ONLY the fields above. No new keys.
2. For removals (lose_trait, lose_note, etc.), values MUST match existing entries exactly.
3. Omit fields entirely if no changes (don't include empty arrays/objects).
4. If an event character is absent (merely talked or dreamt about), do NOT list any consequences for them, ONLY for the speakers/dreamers.
5. Refer to the characters by their identifiers, labeled with [identifier] above. Be extra attentive as some characters don't use their exact title as identifier (Heir is kheir, for example)
6. Don't include the questionmarks in your response, they are only there to indicate optional fields.
7. Focus on the most meaningful 2-3 changes per character rather than trying to change everything.

EXAMPLE GOOD CONSEQUENCE:
{
  "event_log": {
    "entry": "A challenge to the Heiress's leadership resulted in restructuring the hamlet's authority into a more collaborative council.",
    "timeframe": "mid_term"
  },
  "characters": [
    {
      "identifier": "abomination",
      "add_log": {
        "entry": "Stood firm against the Heiress' established leadership, voicing concerns that changed hamlet governance.",
        "timeframe": "short_term"
      },
      "update_stats": {
        "authority": 1,
        "sociability": 1
      },
      "update_relationships": [
        {
          "target": "heiress",
          "affinity": 1,
          "dynamic": "Quiet Counsel",
          "description": "The Abomination offers wisdom that the Heiress has gradually come to value, providing a grounding perspective that tempers her more impulsive tendencies."
        }
      ]
    },
    {
      "identifier": "highwayman",
      "add_log": {
        "entry": "Initiated challenge against the Heiress's unilateral decision-making, sparking hamlet governance reform.",
        "timeframe": "mid_term"
      },
      "update_status": {
        "mental": -9
      },
      "update_relationships": [
        {
          "target": "heiress",
          "affinity": -1,
          "dynamic": "Principled Defiance",
          "description": "The Highwayman values mission success above loyalty to leadership, finding the Heiress's judgment increasingly at odds with his practical experience of survival."
        }
      ]
    },
    {
      "identifier": "crusader",
      "update_stats": {
        "authority": 1
      },
      "update_relationships": [
        {
          "target": "abomination",
          "affinity": 1,
          "dynamic": "Tolerance",
          "description": "Despite his prior religious objections to the Abomination's condition, the Crusader has come to value his measured insight and restraint. Their growing alliance challenges the Crusader's dogmatic principles with a more nuanced understanding of virtue."
        },
        {
          "target": "heiress",
          "affinity": 1
        }
      ]
    },
    {
      "identifier": "heiress",
      "add_log": {
        "entry": "Relinquished sole authority to adopt council-based leadership following group challenge.",
        "timeframe": "mid_term"
      },
      "update_stats": {
        "authority": -2
      },
      "gain_note": "Seeks out and listens to other's opinions before finalizing decisions.",
      "lose_note": "Scared of losing her authority, she meets those challenging it by becoming more commanding and inflexible.",
      "update_status": {
        "mental": -27,
        "description": "Anxious about the looming threats and struggling to maintain authority"
      },
      "update_relationships": [
        {
          "target": "abomination",
          "dynamic": "Hard-Won Respect",
          "description": "The Heiress values the Abomination's insights despite her initial prejudice, finding unexpected wisdom beneath his monstrous appearance that challenges her preconceptions."
        },
        {
          "target": "highwayman",
          "affinity": -2,
          "dynamic": "Contempt",
          "description": "The Heiress views the Highwayman as a direct threat undermining her authority, interpreting his practical suggestions as deliberate challenges to her leadership."
        },
        {
          "target": "crusader",
          "affinity": 1,
        }
      ]
    }
  ]
}

EXAMPLE GOOD CONSEQUENCE 2:
{
  "event_log": {
    "entry": "The Highwayman's experienced nightmares about failing the Heiress.",
    "timeframe": "transient"
  },
  "characters": [
    {
      "identifier": "highwayman",
      "add_log": {
        "entry": "Experienced vivid nightmares of the Heiress's death and swore a personal oath of protection.",
        "timeframe": "mid_term"
      },
      "update_status": {
        "mental": -27,
        "description": "Plagued by nightmares and deep-seated fears of failing the Heiress"
      },
      "gain_traits": ["Protective"],
      "lose_traits": ["Desperate"],
      "update_relationships": [
        {
          "target": "heiress",
          "affinity": 3,
          "dynamic": "Devoted Protector",
          "description": "Has privately resolved to ensure the Heiress's survival at any cost, including his own life, seeking redemption through this ultimate sacrifice."
        }
      ],
      "lose_note": "Carries a tarnished locket taken from a past victim as a reminder of his sins"
    }
  ]
}

Now determine appropriate consequences based on the story. Focus on the most narratively significant developments that can impact future storytelling. Output them in JSON with no additional text.`;

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