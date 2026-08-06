// server/staticGameDataManager.ts
// File order (savegame-first mindset, static data registry):
// Imports → Local types → Constants → Helpers → StaticGameDataManager (fields + init + getters)
// Domain inside the class:
// Characters → Relationships → Character meta (locations/weights) → World (Locations/NPCs/Enemies) → Events → Keywords → Prompts

import type {
  CharacterLocations,
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
  StrategyWeights,
  ZodiacSeason,
} from '../shared/types/types.js';

import {
  loadAllEnemies,
  loadAllLocations,
  loadCharacterTemplates,
  loadDefaultCharacterWeights,
  loadDefaultRelationships,
  loadEnemyRelationships,
  loadEventTemplatesForCategory,
  loadNPCTemplatesForCategory,
  loadTownKeywords,
} from './templateLoader.js';

import { loadPromptsFromIndex } from './promptRegistry.js';

// Import from the strategy registry. The registry is the ultimate source of truth
// for all available strategies and their default values.
import { generateDefaultWeights } from './services/townHall/expeditionStrategies/strategyRegistry.js';

import { loadJsonFile, loadTextFile } from './fileOps.js';
import { PROMPTS_DIR } from './paths.js';

/* -------------------------------------------------------------------
 *  Local types
 * ------------------------------------------------------------------- */

interface ElapsedMonthText {
  month: number;
  text: string;
}

/* -------------------------------------------------------------------
 *  Category lists (single source of truth)
 * ------------------------------------------------------------------- */

const EVENT_CATEGORIES = ['gameplay', 'town', 'dungeon', 'story', 'recruit'] as const;
type EventCategory = (typeof EVENT_CATEGORIES)[number];

const NPC_CATEGORIES = ['town', 'kingdom'] as const;
type NPCCategory = (typeof NPC_CATEGORIES)[number];

/* -------------------------------------------------------------------
 *  Helpers
 * ------------------------------------------------------------------- */

/**
 * Generic loader: takes categories + a loader(category) and returns Record<category, data>
 */
async function loadRecordByCategory<C extends readonly string[], T>(
  categories: C,
  loader: (category: C[number]) => Promise<T>
): Promise<Record<C[number], T>> {
  const entries = await Promise.all(
    categories.map(async (category) => [category, await loader(category)] as const)
  );

  return Object.fromEntries(entries) as Record<C[number], T>;
}

/* -------------------------------------------------------------------
 *  StaticGameDataManager
 * ------------------------------------------------------------------- */

/**
 * A singleton manager for all static game data that doesn't change during gameplay.
 * This data is loaded once at server startup and cached for efficient access.
 *
 * This class acts as a mediator between raw data files (JSON) and the complex,
 * typed "source of truth" systems like the strategyRegistry. It is responsible
 * for loading, combining, and caching this data into a simple, ready-to-use format.
 */
class StaticGameDataManager {
  private static instance: StaticGameDataManager;
  private initialized = false;

  /* -------------------------------------------------------------------
   *  Characters
   * ------------------------------------------------------------------- */

  private characterTemplates: CharacterTemplateRecord = {};

  /* -------------------------------------------------------------------
   *  Relationships
   * ------------------------------------------------------------------- */

  private defaultRelationships: Record<string, Record<string, CharacterRelationship>> = {};

  private enemyRelationships: Record<string, Record<string, string>> = {};

  /* -------------------------------------------------------------------
   *  Character meta (non-template)
   * ------------------------------------------------------------------- */

  /**
   * Holds the complete set of default weights for ALL strategies.
   * Generated directly from the `strategyRegistry` at startup.
   */
  private baseDefaultWeights: Record<string, number> = {};

  /**
   * Character-specific weight OVERRIDES loaded from JSON.
   * This file only needs to contain weights that differ from the base defaults.
   */
  private characterWeightOverrides: Record<string, Record<string, number>> = {};

  /* -------------------------------------------------------------------
   *  World: Locations
   * ------------------------------------------------------------------- */

  private locations: LocationData[] = [];
  private locationMap: Map<string, LocationData> = new Map();

  /* -------------------------------------------------------------------
   *  World: NPCs
   * ------------------------------------------------------------------- */

  private npcsByCategory: Partial<Record<NPCCategory, NPCRecord>> = {};

  /* -------------------------------------------------------------------
   *  World: Enemies
   * ------------------------------------------------------------------- */

  private enemies: EnemyRecord = {};

  /* -------------------------------------------------------------------
   *  Events
   * ------------------------------------------------------------------- */

  private eventsByCategory: Partial<Record<EventCategory, EventRecord>> = {};

  /* -------------------------------------------------------------------
   *  Keywords 
   * ------------------------------------------------------------------- */

  private townKeywords: string[] = [];

  /* -------------------------------------------------------------------
   *  Prompts
   * ------------------------------------------------------------------- */

  private prompts: Record<string, string> = {};

  private promptZodiacSeasons: ZodiacSeason[] = [];
  private promptMonthText: ElapsedMonthText[] = [];

  /* -------------------------------------------------------------------
   *  Initialization
   * ------------------------------------------------------------------- */

  private constructor() {}

  public static getInstance(): StaticGameDataManager {
    if (!StaticGameDataManager.instance) {
      StaticGameDataManager.instance = new StaticGameDataManager();
    }
    return StaticGameDataManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('StaticGameDataManager already initialized');
      return;
    }

    try {
      console.log('Initializing static game data...');

      const [
        characterTemplates,
        defaultRelationships,
        enemyRelationships,
        characterWeightOverrides,
        locations,
        npcsByCategory,
        enemies,
        eventsByCategory,
        townKeywords,
        elapsedMonthText,
        zodiacSeasons,
        prompts
      ] = await Promise.all([
        // Characters / relationships / meta
        loadCharacterTemplates(),
        loadDefaultRelationships(),
        loadEnemyRelationships(),
        loadDefaultCharacterWeights(),

        // World
        loadAllLocations(),
        loadRecordByCategory(NPC_CATEGORIES, loadNPCTemplatesForCategory),
        loadAllEnemies(),

        // Events + Keywords
        loadRecordByCategory(EVENT_CATEGORIES, loadEventTemplatesForCategory),
        loadTownKeywords(),

        // Prompts
        loadJsonFile<ElapsedMonthText[]>(`${PROMPTS_DIR}/game/elapsedMonthText.json`),
        loadJsonFile<ZodiacSeason[]>(`${PROMPTS_DIR}/game/zodiacSeasons.json`),

        loadPromptsFromIndex(PROMPTS_DIR),
      ]);

      // Characters / relationships / meta
      this.characterTemplates = characterTemplates;
      this.defaultRelationships = defaultRelationships;
      this.enemyRelationships = enemyRelationships;
      this.characterWeightOverrides = characterWeightOverrides;

      this.baseDefaultWeights = generateDefaultWeights() as Record<string, number>;

      // World
      this.locations = locations;
      this.npcsByCategory = npcsByCategory;
      this.enemies = enemies;

      // Events + keywords
      this.eventsByCategory = eventsByCategory;
      this.townKeywords = townKeywords;

      // Prompts
      this.promptMonthText = elapsedMonthText;
      this.promptZodiacSeasons = zodiacSeasons;
      this.prompts = prompts;

      // Build lookup maps
      this.buildLocationMap();

      this.initialized = true;

      // Log success info
      console.log(`StaticGameDataManager initialized successfully with:`);
      console.log(`- ${Object.keys(this.characterTemplates).length} character templates`);
      console.log(`- ${this.locations.length} locations`);

      const totalEvents = Object.values(this.eventsByCategory).reduce(
        (sum, rec) => sum + Object.keys(rec || {}).length,
        0
      );
      const totalNpcs = Object.values(this.npcsByCategory).reduce(
        (sum, rec) => sum + Object.keys(rec || {}).length,
        0
      );

      console.log(`- ${totalEvents} total events across categories`);
      console.log(`- ${totalNpcs} total NPCs across categories`);
      console.log(`- ${Object.keys(this.enemies).length} enemies`);
      console.log(`- ${Object.keys(this.prompts).length} prompts`);
    } catch (error) {
      console.error('Failed to initialize StaticGameDataManager:', error);
      throw error;
    }
  }

  /* -------------------------------------------------------------------
   *  Internal helpers
   * ------------------------------------------------------------------- */

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('StaticGameDataManager not initialized. Call initialize() first.');
    }
  }

  private buildLocationMap(): void {
    this.locationMap.clear();
    for (const loc of this.locations) {
      this.locationMap.set(loc.identifier, loc);
    }
  }

  /* -------------------------------------------------------------------
   *  Characters
   * ------------------------------------------------------------------- */

  public getCharacterTemplates(): CharacterTemplateRecord {
    this.ensureInitialized();
    return this.characterTemplates;
  }

  public getCharacterTemplate(id: string): CharacterTemplate | undefined {
    this.ensureInitialized();
    return this.characterTemplates[id];
  }

  /* -------------------------------------------------------------------
   *  Relationships
   * ------------------------------------------------------------------- */

  public getDefaultRelationships(): Record<string, Record<string, CharacterRelationship>> {
    this.ensureInitialized();
    return this.defaultRelationships;
  }

  public getDefaultRelationshipsForCharacter(characterId: string): Record<string, CharacterRelationship> {
    return this.defaultRelationships[characterId] || {};
  }

  public getEnemyRelationships(): Record<string, Record<string, string>> {
    this.ensureInitialized();
    return this.enemyRelationships;
  }

  public getEnemyRelationshipsForCharacter(characterId: string): Record<string, string> {
    this.ensureInitialized();
    return this.enemyRelationships[characterId] || {};
  }

  /* -------------------------------------------------------------------
   *  Character meta (strategy weights)
   * ------------------------------------------------------------------- */

  public getStrategiesForCharacter(characterId: string): StrategyWeights {
    this.ensureInitialized();

    const finalWeights = { ...this.baseDefaultWeights };
    const overrides = this.characterWeightOverrides[characterId];

    if (overrides) Object.assign(finalWeights, overrides);

    return finalWeights;
  }

  /* -------------------------------------------------------------------
   *  World: Locations
   * ------------------------------------------------------------------- */

  public getAllLocations(): LocationData[] {
    this.ensureInitialized();
    return this.locations;
  }

  public getLocationMap(): Map<string, LocationData> {
    this.ensureInitialized();
    return this.locationMap;
  }

  public getLocationById(id: string): LocationData | undefined {
    this.ensureInitialized();
    return this.locationMap.get(id);
  }

  /* -------------------------------------------------------------------
   *  World: NPCs
   * ------------------------------------------------------------------- */

  public getNPCsByCategory(category: NPCCategory): NPCRecord {
    this.ensureInitialized();
    return this.npcsByCategory[category] || {};
  }

  public getNPCById(id: string): NPC | undefined {
    this.ensureInitialized();

    for (const rec of Object.values(this.npcsByCategory)) {
      const npc = rec[id];
      if (npc) return npc;
    }
    return undefined;
  }

  /* -------------------------------------------------------------------
   *  World: Enemies
   * ------------------------------------------------------------------- */

  public getAllEnemies(): EnemyRecord {
    this.ensureInitialized();
    return this.enemies;
  }

  public getEnemyById(id: string): Enemy | undefined {
    this.ensureInitialized();
    return this.enemies[id];
  }

  /* -------------------------------------------------------------------
   *  Events
   * ------------------------------------------------------------------- */

  public getEventsByCategory(category: EventCategory): EventRecord {
    this.ensureInitialized();
    return this.eventsByCategory[category] || {};
  }

  public getTownEventById(id: string): EventData | undefined {
    this.ensureInitialized();
    return (this.eventsByCategory.town || {})[id];
  }

  public getEventById(id: string): EventData | undefined {
    this.ensureInitialized();

    for (const rec of Object.values(this.eventsByCategory)) {
      const ev = rec?.[id];
      if (ev) return ev;
    }
    return undefined;
  }

  /* -------------------------------------------------------------------
   *  Keywords
   * ------------------------------------------------------------------- */

  public getTownKeywords(): string[] {
    this.ensureInitialized();
    return this.townKeywords;
  }

  /* -------------------------------------------------------------------
   *  Prompts
   * ------------------------------------------------------------------- */

  public getPromptElapsedMonthText(): ElapsedMonthText[] {
    this.ensureInitialized();
    return this.promptMonthText;
  }

  public getZodiacSeasons(): ZodiacSeason[] {
    this.ensureInitialized();
    return this.promptZodiacSeasons;
  }

  public getPrompt(key: string): string {
    this.ensureInitialized();
    const text = this.prompts[key];
    if (!text) {
      throw new Error(`Missing prompt for key "${key}". Check ./data/prompts/index.json`);
    }
    return text;
  }
}

export default StaticGameDataManager;
