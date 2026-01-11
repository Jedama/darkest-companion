// server/templateLoader.ts
// File order (savegame-first):
// Imports → Path constants → Helpers → Character data → Relationships → Character meta (locations/weights)
// → World (Locations/NPCs/Enemies) → Events → Keywords

import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import type {
  CharacterRelationship,
  CharacterTemplate,
  CharacterTemplateRecord,
  Enemy,
  EnemyRecord,
  EventData,
  EventRecord,
  LocationData,
  NPC,
  NPCRecord,
} from '../shared/types/types.js';

/* -------------------------------------------------------------------
 *  Module paths
 * ------------------------------------------------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');

const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');
const CHARACTER_DIR = path.join(TEMPLATES_DIR, 'characters');

const LOCATIONS_DIR = path.join(DATA_DIR, 'locations');
const NPCS_DIR = path.join(DATA_DIR, 'npcs');
const ENEMIES_DIR = path.join(DATA_DIR, 'enemies');
const EVENTS_DIR = path.join(DATA_DIR, 'events');
const KEYWORDS_DIR = path.join(DATA_DIR, 'keywords');

const DEFAULT_RELATIONSHIPS_FILE = path.join(TEMPLATES_DIR, 'defaultRelationships.json');
const DEFAULT_CHARACTER_LOCATIONS_FILE = path.join(TEMPLATES_DIR, 'defaultCharacterLocations.json');
const DEFAULT_WEIGHTS_FILE = path.join(TEMPLATES_DIR, 'defaultCharacterStrategies.json');

const TOWN_KEYWORDS_FILE = path.join(KEYWORDS_DIR, 'default.json');

// Required character templates (e.g., initial party)
const REQUIRED_CHARACTER_TEMPLATES = ['crusader', 'highwayman', 'heiress', 'kheir'] as const;

/* -------------------------------------------------------------------
 *  Helpers
 * ------------------------------------------------------------------- */

/**
 * Recursively collects all .json files under a given directory.
 * This allows subfolders like "town", "dungeon", etc.
 */
async function collectJsonFilesRecursively(dirPath: string, fileList: string[] = []): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await collectJsonFilesRecursively(fullPath, fileList);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.json')) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

/* -------------------------------------------------------------------
 *  Characters
 * ------------------------------------------------------------------- */

export async function loadCharacterTemplates(): Promise<CharacterTemplateRecord> {
  try {
    const files = await readdir(CHARACTER_DIR);
    const templates: CharacterTemplateRecord = {};

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const content = await readFile(path.join(CHARACTER_DIR, file), 'utf-8');
      const character: CharacterTemplate = JSON.parse(content);
      templates[character.identifier] = character;
    }

    const missingTemplates = REQUIRED_CHARACTER_TEMPLATES.filter((id) => !templates[id]);
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
    const parsed = JSON.parse(content) as unknown;

    if (typeof parsed !== 'object' || parsed === null) {
      console.error(`Template ${templatePath} is not an object`);
      return false;
    }

    const character = parsed as Record<string, unknown>;

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
 *  Relationships
 * ------------------------------------------------------------------- */

export type DefaultRelationshipsMap = Record<string, Record<string, CharacterRelationship>>;

export async function loadDefaultRelationships(): Promise<DefaultRelationshipsMap> {
  try {
    const content = await readFile(DEFAULT_RELATIONSHIPS_FILE, 'utf-8');
    return JSON.parse(content) as DefaultRelationshipsMap;
  } catch (error) {
    console.error('Error loading default relationships:', error);
    throw error;
  }
}

/* -------------------------------------------------------------------
 *  Character meta (non-template)
 * ------------------------------------------------------------------- */

export async function loadDefaultCharacterLocations(): Promise<
  Record<
    string,
    {
      residence: string[];
      workplaces: string[];
      frequents: string[];
    }
  >
> {
  try {
    const content = await readFile(DEFAULT_CHARACTER_LOCATIONS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading default character locations:', error);
    throw error;
  }
}

// Loads character-specific strategy overrides.
export async function loadDefaultCharacterWeights(): Promise<Record<string, Record<string, number>>> {
  try {
    const content = await readFile(DEFAULT_WEIGHTS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading default character weights:', error);
    throw error;
  }
}

/* -------------------------------------------------------------------
 *  World: Locations
 * ------------------------------------------------------------------- */

export async function loadAllLocations(): Promise<LocationData[]> {
  try {
    const files = await readdir(LOCATIONS_DIR);
    const locationFiles = files.filter((file) => file.endsWith('.json'));

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
    return allLocations.find((loc) => loc.identifier === locationId) || null;
  } catch (error) {
    console.error(`Error loading location ${locationId}:`, error);
    throw error;
  }
}

/* -------------------------------------------------------------------
 *  World: NPCs
 * ------------------------------------------------------------------- */

/**
 * Loads NPC templates ONLY from a given category folder inside `data/npcs`.
 * E.g., "town", "dungeon", etc. (and any subfolders in that category).
 */
export async function loadNPCTemplatesForCategory(category: string): Promise<NPCRecord> {
  try {
    const categoryPath = path.join(NPCS_DIR, category);

    const stats = await stat(categoryPath);
    if (!stats.isDirectory()) {
      throw new Error(`Category path ${categoryPath} is not a directory`);
    }

    const files = await collectJsonFilesRecursively(categoryPath);
    const npcs: NPCRecord = {};

    for (const file of files) {
      const content = await readFile(file, 'utf-8');

      let npcArray: NPC[];
      try {
        const parsed = JSON.parse(content);
        npcArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch (parseError) {
        console.error(`Error parsing NPC JSON file ${file}:`, parseError);
        continue;
      }

      for (const npc of npcArray) {
        if (!npc.identifier) {
          console.warn(`NPC in file ${file} missing 'identifier'. Skipping...`);
          continue;
        }

        if (npcs[npc.identifier]) {
          console.warn(
            `Duplicate NPC identifier "${npc.identifier}" found in ${file}. ` +
              `Later definition will override earlier one.`
          );
        }

        npcs[npc.identifier] = npc;
      }
    }

    return npcs;
  } catch (error) {
    console.error(`Error loading NPC templates for category "${category}":`, error);
    throw error;
  }
}

/* -------------------------------------------------------------------
 *  World: Enemies
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
 *  Events
 * ------------------------------------------------------------------- */

/**
 * Loads event templates ONLY from a given category folder inside `data/events`.
 * E.g., "town", "dungeon", etc. (and any subfolders in that category).
 */
export async function loadEventTemplatesForCategory(category: string): Promise<EventRecord> {
  try {
    const categoryPath = path.join(EVENTS_DIR, category);

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
        eventDataArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch (parseError) {
        console.error(`Error parsing JSON file ${file}:`, parseError);
        continue;
      }

      for (const eventData of eventDataArray) {
        if (!eventData.identifier) {
          console.warn(`Event in file ${file} missing 'identifier' field. Skipping...`);
          continue;
        }

        if (eventData.type && eventData.type !== category) {
          console.warn(
            `Event '${eventData.identifier}' has type '${eventData.type}' but is in '${category}' folder (${file}).`
          );
        }

        // Validate characterCount
        if (!Array.isArray(eventData.characterCount) || eventData.characterCount.length !== 2) {
          throw new Error(
            `Event '${eventData.identifier}' has invalid characterCount format; expected [min, max]`
          );
        }
        assertValidCharacterCountRange(eventData.characterCount, eventData.identifier);

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

function assertValidCharacterCountRange(
  range: [number, number],
  eventId: string
): void {
  const [min, max] = range;

  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error(`Event '${eventId}' has non-integer characterCount: [${min}, ${max}]`);
  }
  if (min < 1 || max < 1) {
    throw new Error(`Event '${eventId}' has characterCount < 1: [${min}, ${max}]`);
  }
  if (min > max) {
    throw new Error(`Event '${eventId}' has invalid characterCount range: [${min}, ${max}]`);
  }
}

/* -------------------------------------------------------------------
 *  Keywords
 * ------------------------------------------------------------------- */

export async function loadTownKeywords(): Promise<string[]> {
  try {
    const content = await readFile(TOWN_KEYWORDS_FILE, 'utf-8');
    return JSON.parse(content) as string[];
  } catch (err) {
    console.error('Error loading town keywords:', err);
    throw err;
  }
}
