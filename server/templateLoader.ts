// server/templateLoader.ts
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Character, CharacterRecord } from '../shared/types/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, 'data', 'templates', 'characters');
const REQUIRED_TEMPLATES = ['crusader', 'highwayman', 'heiress', 'kheir'];

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
    const missingTemplates = REQUIRED_TEMPLATES.filter(id => !templates[id]);
    if (missingTemplates.length > 0) {
      throw new Error(`Missing required character templates: ${missingTemplates.join(', ')}`);
    }

    return templates;
  } catch (error) {
    console.error('Error loading character templates:', error);
    throw error;
  }
}

// Helper function to validate a template file
export async function validateTemplate(templatePath: string): Promise<boolean> {
  try {
    const content = await readFile(templatePath, 'utf-8');
    const character: Character = JSON.parse(content);
    
    // Add any additional template validation here
    const requiredFields = [
      'identifier',
      'title',
      'name',
      'level',
      'stats',
      'traits'
    ];

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