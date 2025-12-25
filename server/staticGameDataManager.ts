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
} from '../shared/types/types.js';

import {
  loadAllEnemies,
  loadAllLocations,
  loadCharacterTemplates,
  loadDefaultCharacterLocations,
  loadDefaultCharacterWeights,
  loadDefaultRelationships,
  loadEventTemplatesForCategory,
  loadNPCTemplatesForCategory,
  loadTownKeywords,
} from './templateLoader.js';

// Import from the strategy registry. The registry is the ultimate source of truth
// for all available strategies and their default values.
import { generateDefaultWeights } from './services/townHall/expeditionStrategies/strategyRegistry.js';

import { loadJsonFile, loadTextFile } from './fileOps.js';

/* -------------------------------------------------------------------
 *  Local types
 * ------------------------------------------------------------------- */

interface ZodiacSeason {
  name: string;
  text: string;
}

interface ElapsedMonthText {
  month: number;
  text: string;
}

/* -------------------------------------------------------------------
 *  Category lists (single source of truth)
 * ------------------------------------------------------------------- */

const EVENT_CATEGORIES = ['town', 'story'] as const;
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

/**
 * Picks a random subset of locations for a character based on predefined rules:
 * - One random residence if multiple are available
 * - 1-4 random workplaces
 * - 4-8 random frequented locations
 * NOTE: This is a simple random selection; more complex, maybe LLM-based logic can be added later.
 */
function pickRandomLocationsForCharacter(locations: CharacterLocations): CharacterLocations {
  function getRandomSubset<T>(array: T[], minCount: number, maxCount: number): T[] {
    if (!array.length) return [];

    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const count = Math.min(
      shuffled.length,
      Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount
    );

    return shuffled.slice(0, count);
  }

  return {
    residence:
      locations.residence.length > 1
        ? [locations.residence[Math.floor(Math.random() * locations.residence.length)]]
        : locations.residence,
    workplaces: getRandomSubset(locations.workplaces, 1, 4),
    frequents: getRandomSubset(locations.frequents, 4, 8),
  };
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

  /* -------------------------------------------------------------------
   *  Character meta (non-template)
   * ------------------------------------------------------------------- */

  private defaultCharacterLocations: Record<string, CharacterLocations> = {};

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
   *  Keywords / Modifiers
   * ------------------------------------------------------------------- */

  private townKeywords: string[] = [];

  /* -------------------------------------------------------------------
   *  Prompts
   * ------------------------------------------------------------------- */

  private promptStoryInstructions = '';
  private promptStoryBackstory = '';
  private promptConsequenceInstructions = '';
  private promptConsequenceFormat = '';
  private promptConsequenceExamples = '';
  private promptZodiacSeasons: ZodiacSeason[] = [];
  private promptMonthText: ElapsedMonthText[] = [];

  private constructor() {}

  public static getInstance(): StaticGameDataManager {
    if (!StaticGameDataManager.instance) {
      StaticGameDataManager.instance = new StaticGameDataManager();
    }
    return StaticGameDataManager.instance;
  }

  /* -------------------------------------------------------------------
   *  Initialization
   * ------------------------------------------------------------------- */

  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('StaticGameDataManager already initialized');
      return;
    }

    try {
      console.log('Initializing static game data...');

      const promptsBasePath = './data/prompts';

      const [
        characterTemplates,
        defaultRelationships,
        defaultCharacterLocations,
        characterWeightOverrides,
        locations,
        npcsByCategory,
        enemies,
        eventsByCategory,
        townKeywords,
        promptStoryInstructions,
        promptStoryBackstory,
        promptConsequenceInstructions,
        promptConsequenceFormat,
        promptConsequenceExamples,
        zodiacSeasons,
        elapsedMonthText,
      ] = await Promise.all([
        // Characters / relationships / meta
        loadCharacterTemplates(),
        loadDefaultRelationships(),
        loadDefaultCharacterLocations(),
        loadDefaultCharacterWeights(),

        // World
        loadAllLocations(),
        loadRecordByCategory(NPC_CATEGORIES, loadNPCTemplatesForCategory),
        loadAllEnemies(),

        // Events + modifiers
        loadRecordByCategory(EVENT_CATEGORIES, loadEventTemplatesForCategory),
        loadTownKeywords(),

        // Prompts
        loadTextFile(`${promptsBasePath}/story/storyInstructions.txt`),
        loadTextFile(`${promptsBasePath}/story/storyBackstory.txt`),
        loadTextFile(`${promptsBasePath}/consequences/consequencesInstructions.txt`),
        loadTextFile(`${promptsBasePath}/consequences/consequencesFormat.txt`),
        loadTextFile(`${promptsBasePath}/consequences/consequencesExamples.txt`),
        loadJsonFile<ZodiacSeason[]>(`${promptsBasePath}/story/zodiacSeasons.json`),
        loadJsonFile<ElapsedMonthText[]>(`${promptsBasePath}/story/elapsedMonthText.json`),
      ]);

      // Characters / relationships / meta
      this.characterTemplates = characterTemplates;
      this.defaultRelationships = defaultRelationships;
      this.defaultCharacterLocations = defaultCharacterLocations;
      this.characterWeightOverrides = characterWeightOverrides;

      this.baseDefaultWeights = generateDefaultWeights() as Record<string, number>;

      // World
      this.locations = locations;
      this.npcsByCategory = npcsByCategory;
      this.enemies = enemies;

      // Events + modifiers
      this.eventsByCategory = eventsByCategory;
      this.townKeywords = townKeywords;

      // Prompts
      this.promptStoryInstructions = promptStoryInstructions;
      this.promptStoryBackstory = promptStoryBackstory;
      this.promptConsequenceInstructions = promptConsequenceInstructions;
      this.promptConsequenceFormat = promptConsequenceFormat;
      this.promptConsequenceExamples = promptConsequenceExamples;
      this.promptZodiacSeasons = zodiacSeasons;
      this.promptMonthText = elapsedMonthText;

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

  /* -------------------------------------------------------------------
   *  Character meta (locations / strategy weights)
   * ------------------------------------------------------------------- */

  public getDefaultLocationsForCharacter(characterId: string): CharacterLocations {
    this.ensureInitialized();
    return (
      this.defaultCharacterLocations[characterId] || {
        residence: [],
        workplaces: [],
        frequents: [],
      }
    );
  }

  public getRandomizedLocationsForCharacter(characterId: string): CharacterLocations {
    this.ensureInitialized();
    return pickRandomLocationsForCharacter(this.getDefaultLocationsForCharacter(characterId));
  }

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
   *  Keywords / Modifiers
   * ------------------------------------------------------------------- */

  public getTownKeywords(): string[] {
    this.ensureInitialized();
    return this.townKeywords;
  }

  /* -------------------------------------------------------------------
   *  Prompts
   * ------------------------------------------------------------------- */

  public getPromptStoryInstructions(): string {
    this.ensureInitialized();
    return this.promptStoryInstructions;
  }

  public getPromptStoryBackstory(): string {
    this.ensureInitialized();
    return this.promptStoryBackstory;
  }

  public getPromptConsequenceInstructions(): string {
    this.ensureInitialized();
    return this.promptConsequenceInstructions;
  }

  public getPromptConsequenceFormat(): string {
    this.ensureInitialized();
    return this.promptConsequenceFormat;
  }

  public getPromptConsequenceExamples(): string {
    this.ensureInitialized();
    return this.promptConsequenceExamples;
  }

  public getPromptZodiacSeasons(): ZodiacSeason[] {
    this.ensureInitialized();
    return this.promptZodiacSeasons;
  }

  public getPromptElapsedMonthText(): ElapsedMonthText[] {
    this.ensureInitialized();
    return this.promptMonthText;
  }
}

export default StaticGameDataManager;
