// server/templateLoader.ts
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  CharacterTemplate,
  CharacterTemplateRecord,
  CharacterRelationship,
  NPC,
  Enemy,
  EnemyRecord,
  EventData,
  EventRecord,
  LocationData
} from '../shared/types/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, 'data', 'templates');
const CHARACTER_DIR = path.join(__dirname, 'data', 'templates', 'characters');
const NPCS_DIR = path.join(__dirname, 'data', 'npcs', 'town');
const ENEMIES_DIR = path.join(__dirname, 'data', 'enemies');
const EVENTS_DIR = path.join(__dirname, 'data', 'events');
const DEFAULT_RELATIONSHIPS_FILE = path.join(TEMPLATES_DIR, 'defaultRelationships.json');
const DEFAULT_WEIGHTS_FILE = path.join(TEMPLATES_DIR, 'defaultCharacterStrategies.json');

// Keywords file
const TOWN_KEYWORDS_FILE = path.join(__dirname, 'data', 'keywords', 'default.json');

// Required character templates (e.g., initial party)
const REQUIRED_CHARACTER_TEMPLATES = ['crusader', 'highwayman', 'heiress', 'kheir'];

/* -------------------------------------------------------------------
 *  Character Templates
 * ------------------------------------------------------------------- */

export async function loadCharacterTemplates(): Promise<CharacterTemplateRecord> {
  try {
    const files = await readdir(CHARACTER_DIR);
    const templates: CharacterTemplateRecord = {};

    // Load all template files
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await readFile(path.join(CHARACTER_DIR, file), 'utf-8');
        const character: CharacterTemplate = JSON.parse(content);
        templates[character.identifier] = character;
      }
    }

    // Verify all required templates are present
    const missingTemplates = REQUIRED_CHARACTER_TEMPLATES.filter(
      id => !templates[id]
    );
    if (missingTemplates.length > 0) {
      throw new Error(`Missing required character templates: ${missingTemplates.join(', ')}`);
    }

    return templates;
  } catch (error) {
    console.error('Error loading character templates:', error);
    throw error;
  }
}

// Optional helper to validate a single character template file
export async function validateTemplate(templatePath: string): Promise<boolean> {
  try {
    const content = await readFile(templatePath, 'utf-8');
    const character: CharacterTemplate = JSON.parse(content);
    
    const requiredFields = ['identifier', 'title', 'name', 'stats', 'traits'];
    for (const field of requiredFields) {
      if (!(field in character)) {
        console.error(`Template ${templatePath} missing required field: ${field}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(`Error validating template ${templatePath}:`, error);
    return false;
  }
}

/* -------------------------------------------------------------------
 *  Default Relationships
 * ------------------------------------------------------------------- */
export type DefaultRelationshipsMap = Record<string, Record<string, CharacterRelationship>>;

export async function loadDefaultRelationships(): Promise<DefaultRelationshipsMap> {
  try {
    const content = await readFile(DEFAULT_RELATIONSHIPS_FILE, 'utf-8');
    const parsed: DefaultRelationshipsMap = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error('Error loading default relationships:', error);
    throw error;
  }
}

/* -------------------------------------------------------------------
 *  Default Character Locations
 * ------------------------------------------------------------------- */

export async function loadDefaultCharacterLocations(): Promise<Record<string, {
  residence: string[],
  workplaces: string[],
  frequents: string[]
}>> {
  try {
    const content = await readFile(path.join(TEMPLATES_DIR, 'defaultCharacterLocations.json'), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading default character locations:', error);
    throw error;
  }
}

/* -------------------------------------------------------------------
 *  Event Templates
 * ------------------------------------------------------------------- */

/**
 * Recursively collects all .json files under a given directory.
 * This allows subfolders like "town", "dungeon", etc.
 */
async function collectJsonFilesRecursively(
  dirPath: string,
  fileList: string[] = []
): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      // Recurse into subdirectory
      await collectJsonFilesRecursively(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

/**
 * Loads event templates ONLY from a given category folder inside `data/events`.
 * E.g., "town", "dungeon", etc. (and any subfolders in that category).
 */
export async function loadEventTemplatesForCategory(category: string): Promise<EventRecord> {
  try {
    const categoryPath = path.join(EVENTS_DIR, category);

    // Validate that categoryPath is a directory
    const stats = await stat(categoryPath);
    if (!stats.isDirectory()) {
      throw new Error(`Category path ${categoryPath} is not a directory`);
    }

    const files = await collectJsonFilesRecursively(categoryPath);
    const events: EventRecord = {};

    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      let eventDataArray: EventData[];
      
      try {
        const parsed = JSON.parse(content);
        // Handle both single objects and arrays
        eventDataArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch (parseError) {
        console.error(`Error parsing JSON file ${file}:`, parseError);
        continue;
      }

      // Process each event in the array
      for (const eventData of eventDataArray) {
        if (!eventData.identifier) {
          console.warn(`Event in file ${file} missing 'identifier' field. Skipping...`);
          continue;
        }

        // Check for duplicate identifiers
        if (events[eventData.identifier]) {
          console.warn(`Duplicate event identifier "${eventData.identifier}" found in ${file}. Later definition will override earlier one.`);
        }

        events[eventData.identifier] = eventData;
      }
    }
    return events;
  } catch (error) {
    console.error(`Error loading event templates for category "${category}":`, error);
    throw error;
  }
}

/* -------------------------------------------------------------------
 *  Town Keywords
 * ------------------------------------------------------------------- */

export async function loadTownKeywords(): Promise<string[]> {
  try {
    const content = await readFile(TOWN_KEYWORDS_FILE, 'utf-8');
    const keywords: string[] = JSON.parse(content);
    return keywords;
  } catch (err) {
    console.error('Error loading town keywords:', err);
    throw err;
  }
}

/* -------------------------------------------------------------------
 *  Locations
 * ------------------------------------------------------------------- */

const LOCATIONS_DIR = path.join(__dirname, 'data', 'locations');

export async function loadAllLocations(): Promise<LocationData[]> {
  try {
      // Read all location JSON files
      const files = await readdir(LOCATIONS_DIR);
      const locationFiles = files.filter(file => file.endsWith('.json'));
      
      let allLocations: LocationData[] = [];
      
      for (const file of locationFiles) {
          const content = await readFile(path.join(LOCATIONS_DIR, file), 'utf-8');
          const locations = JSON.parse(content);
          
          // Each file contains an array of locations
          allLocations = allLocations.concat(locations);
      }
      
      return allLocations;
  } catch (error) {
      console.error('Error loading locations:', error);
      throw error;
  }
}

export async function loadLocation(locationId: string): Promise<LocationData | null> {
  try {
    const allLocations = await loadAllLocations();
    return allLocations.find(loc => loc.identifier === locationId) || null;
  } catch (error) {
    console.error(`Error loading location ${locationId}:`, error);
    throw error;
  }
}

/* -------------------------------------------------------------------
 *  NPCs
 * ------------------------------------------------------------------- */

/**
 * Loads all NPC data files into a record indexed by their identifier.
 */
export async function loadAllNPCs(): Promise<Record<string, NPC>> {
  try {
    const files = await readdir(NPCS_DIR);
    const npcFiles = files.filter(file => file.endsWith('.json'));

    const allNPCs: Record<string, NPC> = {};

    for (const file of npcFiles) {
      const content = await readFile(path.join(NPCS_DIR, file), 'utf-8');
      const npcData: NPC = JSON.parse(content);

      allNPCs[npcData.identifier] = npcData;
    }

    return allNPCs;
  } catch (error) {
    console.error('Error loading NPCs:', error);
    throw error;
  }
}

/**
 * Loads specific NPCs by their identifiers.
 */
export async function loadNPCsByIds(npcIds: string[]): Promise<NPC[]> {
  const allNPCs = await loadAllNPCs();

  return npcIds
    .map(id => allNPCs[id])
    .filter((npc): npc is NPC => !!npc); // Filter out undefined entries
}

/* -------------------------------------------------------------------
 *  Enemies
* ------------------------------------------------------------------- */

export async function loadAllEnemies(): Promise<EnemyRecord> {
  try {
    const files = await collectJsonFilesRecursively(ENEMIES_DIR);
    const enemies: EnemyRecord = {};

    for (const file of files) {
      const content = await readFile(file, 'utf-8');

      let enemyArray: Enemy[];
      try {
        const parsed = JSON.parse(content);
        enemyArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch (parseError) {
        console.error(`Error parsing enemy JSON file ${file}:`, parseError);
        continue;
      }

      for (const enemy of enemyArray) {
        if (!enemy.identifier) {
          console.warn(`Enemy in file ${file} missing 'identifier'. Skipping...`);
          continue;
        }

        if (enemies[enemy.identifier]) {
          console.warn(
            `Duplicate enemy identifier "${enemy.identifier}" found in ${file}. ` +
            `Later definition will override earlier one.`
          );
        }

        enemies[enemy.identifier] = enemy;
      }
    }

    return enemies;
  } catch (error) {
    console.error('Error loading enemies:', error);
    throw error;
  }
}

/* -------------------------------------------------------------------
 *  Default Character Strategy Weights
 * ------------------------------------------------------------------- */

// This function loads the character-specific overrides.
export async function loadDefaultCharacterWeights(): Promise<Record<string, Record<string, number>>> {
  try {
    const content = await readFile(DEFAULT_WEIGHTS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading default character weights:', error);
    throw error;
  }
}