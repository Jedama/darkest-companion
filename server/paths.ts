// server/paths.ts
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// paths.ts lives in server/, data/ lives in server/data/
export const DATA_DIR = path.join(__dirname, 'data');
export const PROMPTS_DIR = path.join(DATA_DIR, 'prompts');
export const ESTATES_DIR = path.join(DATA_DIR, 'estates');

// Templates
export const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');
export const CHARACTER_DIR = path.join(TEMPLATES_DIR, 'characters');

// World Data Directories
export const LOCATIONS_DIR = path.join(DATA_DIR, 'locations');
export const NPCS_DIR = path.join(DATA_DIR, 'npcs');
export const ENEMIES_DIR = path.join(DATA_DIR, 'enemies');
export const EVENTS_DIR = path.join(DATA_DIR, 'events');
export const KEYWORDS_DIR = path.join(DATA_DIR, 'keywords');

// Specific Data Files
export const DEFAULT_RELATIONSHIPS_FILE = path.join(TEMPLATES_DIR, 'defaultRelationships.json');
export const DEFAULT_WEIGHTS_FILE = path.join(TEMPLATES_DIR, 'defaultCharacterStrategies.json');
export const ENEMY_RELATIONSHIPS_FILE = path.join(TEMPLATES_DIR, 'enemyRelationships.json');
export const TOWN_KEYWORDS_FILE = path.join(KEYWORDS_DIR, 'default.json');
