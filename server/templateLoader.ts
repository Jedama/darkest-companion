// server/templateLoader.ts
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type {
  Character,
  CharacterRecord,
  Relationship,
  EventData,
  EventRecord
} from '../shared/types/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, 'data', 'templates', 'characters');
const DEFAULT_RELATIONSHIPS_FILE = path.join(TEMPLATES_DIR, 'defaultRelationships.json');

// Where your events live
const EVENTS_DIR = path.join(__dirname, 'data', 'events');

// Required character templates (e.g., initial party)
const REQUIRED_CHARACTER_TEMPLATES = ['crusader', 'highwayman', 'heiress', 'kheir'];

/* -------------------------------------------------------------------
 *  Character Templates
 * ------------------------------------------------------------------- */

export async function loadCharacterTemplates(): Promise<CharacterRecord> {
  try {
    const files = await readdir(TEMPLATES_DIR);
    const templates: CharacterRecord = {};

    // Load all template files
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await readFile(path.join(TEMPLATES_DIR, file), 'utf-8');
        const character: Character = JSON.parse(content);
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
    const character: Character = JSON.parse(content);
    
    const requiredFields = ['identifier', 'title', 'name', 'level', 'stats', 'traits'];
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
export type DefaultRelationshipsMap = Record<string, Record<string, Relationship>>;

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
      const eventData: EventData = JSON.parse(content);
      if (!eventData.identifier) {
        console.warn(`Event file ${file} missing 'identifier' field. Skipping...`);
        continue;
      }

      events[eventData.identifier] = eventData;
    }
    return events;
  } catch (error) {
    console.error(`Error loading event templates for category "${category}":`, error);
    throw error;
  }
}
