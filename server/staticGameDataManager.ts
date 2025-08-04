// server/staticGameDataManager.ts
import { 
  CharacterTemplate, CharacterTemplateRecord, LocationData, EventRecord, NPC,
  EventData, CharacterRelationship, CharacterLocations, StrategyWeights
} from '../shared/types/types';
import { 
  loadCharacterTemplates, loadDefaultRelationships, loadDefaultCharacterLocations,
  loadEventTemplatesForCategory, loadTownKeywords, loadAllLocations, loadAllNPCs, loadDefaultCharacterWeights
} from './templateLoader.js';
// Import from the strategy registry. The registry is the ultimate source of truth
// for all available strategies and their default values.
import { generateDefaultWeights } from './services/townHall/expeditionStrategies/strategyRegistry.js';


/**
 * Picks a random subset of locations for a character based on predefined rules:
 * - One random residence if multiple are available
 * - 1-4 random workplaces
 * - 4-8 random frequented locations
 */
function pickRandomLocationsForCharacter(locations: CharacterLocations): CharacterLocations {
  // Helper function to shuffle an array and take a subset
  function getRandomSubset<T>(array: T[], minCount: number, maxCount: number): T[] {
    if (!array.length) return [];
    
    // Fisher-Yates shuffle
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Determine how many to pick (between min and max)
    const count = Math.min(
      shuffled.length, // Don't exceed array length
      Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount
    );
    
    return shuffled.slice(0, count);
  }
  
  return {
    // For residence: pick exactly one if multiple are available
    residence: locations.residence.length > 1 
      ? [locations.residence[Math.floor(Math.random() * locations.residence.length)]]
      : locations.residence,
    
    // For workplaces: pick 1-4 random locations
    workplaces: getRandomSubset(locations.workplaces, 1, 4),
    
    // For frequented places: pick 4-8 random locations
    frequents: getRandomSubset(locations.frequents, 4, 8)
  };
}

/**
 * StaticGameDataManager
 * 
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

  // Character data
  private characterTemplates: CharacterTemplateRecord = {};
  private defaultRelationships: Record<string, Record<string, CharacterRelationship>> = {};
  private defaultCharacterLocations: Record<string, CharacterLocations> = {};
  
  // Location data
  private locations: LocationData[] = [];
  private locationMap: Map<string, LocationData> = new Map();
  
  // Event data
  private townEvents: EventRecord = {};
  private townKeywords: string[] = [];
  
  // NPC data
  private npcs: Record<string, NPC> = {};

  /**
   * @description Holds the complete set of default weights for ALL strategies.
   * This object is generated directly from the `strategyRegistry` at startup,
   * ensuring a single source of truth for default values.
   */
  private baseDefaultWeights: Record<string, number> = {};

  /**
   * @description Holds character-specific weight OVERRIDES loaded from JSON.
   * This file only needs to contain weights that differ from the base defaults,
   * keeping the configuration minimal.
   */
  private characterWeightOverrides: Record<string, Record<string, number>> = {};

  private constructor() {}

  public static getInstance(): StaticGameDataManager {
    if (!StaticGameDataManager.instance) {
      StaticGameDataManager.instance = new StaticGameDataManager();
    }
    return StaticGameDataManager.instance;
  }

  /**
   * Initialize all static game data. Call this at server startup.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('StaticGameDataManager already initialized');
      return;
    }
    
    try {
      console.log('Initializing static game data...');
      
      // Load all static data in parallel for efficiency
      const [
        characterTemplates,
        defaultRelationships,
        defaultCharacterLocations,
        characterWeightOverrides,
        locations,
        townEvents,
        townKeywords,
        npcs
      ] = await Promise.all([
        loadCharacterTemplates(),
        loadDefaultRelationships(),
        loadDefaultCharacterLocations(),
        loadDefaultCharacterWeights(),
        loadAllLocations(),
        loadEventTemplatesForCategory('town'),
        loadTownKeywords(),
        loadAllNPCs()
      ]);
      
      // Store the loaded data
      this.characterTemplates = characterTemplates;
      this.defaultRelationships = defaultRelationships;
      this.defaultCharacterLocations = defaultCharacterLocations;
      this.characterWeightOverrides = characterWeightOverrides;
      this.locations = locations;
      this.townEvents = townEvents;
      this.townKeywords = townKeywords;
      this.npcs = npcs;


      // Here, we generate the baseline weights from the strategy registry.
      // The `generateDefaultWeights` function returns a highly specific, dynamically
      // generated type based on the registry's contents.
      // We use a type assertion (`as`) to tell TypeScript, "Trust us, we know
      // this function will always produce a simple `Record<string, number>`."
      // This is a safe and necessary step to bridge the gap between the complex,
      // specific registry type and the general-purpose type used by the rest of the application.
      this.baseDefaultWeights = generateDefaultWeights() as Record<string, number>;
      
      // Build lookup maps
      this.buildLocationMap();
      
      this.initialized = true;
      
      // Log success info
      console.log(`StaticGameDataManager initialized successfully with:`);
      console.log(`- ${Object.keys(this.characterTemplates).length} character templates`);
      console.log(`- ${this.locations.length} locations`);
      console.log(`- ${Object.keys(this.townEvents).length} town events`);
      console.log(`- ${Object.keys(this.npcs).length} NPCs`);
    } catch (error) {
      console.error('Failed to initialize StaticGameDataManager:', error);
      throw error;
    }
  }

  /**
   * Make sure the manager is initialized before accessing data
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('StaticGameDataManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Build the location map for quick lookups by ID
   */
  private buildLocationMap(): void {
    this.locationMap.clear();
    for (const loc of this.locations) {
      this.locationMap.set(loc.identifier, loc);
    }
  }

  /* Character Template Methods */
  
  public getCharacterTemplates(): CharacterTemplateRecord {
    this.ensureInitialized();
    return this.characterTemplates;
  }
  
  public getCharacterTemplate(id: string): CharacterTemplate | undefined {
    this.ensureInitialized();
    return this.characterTemplates[id];
  }
  
  /* Location Methods */
  
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
  
  /* Event Methods */
  
  public getTownEvents(): EventRecord {
    this.ensureInitialized();
    return this.townEvents;
  }
  
  public getTownEventById(id: string): EventData | undefined {
    this.ensureInitialized();
    return this.townEvents[id];
  }
  
  public getTownKeywords(): string[] {
    this.ensureInitialized();
    return this.townKeywords;
  }
  
  /* Relationship Methods */
  
  public getDefaultRelationships(): Record<string, Record<string, CharacterRelationship>> {
    this.ensureInitialized();
    return this.defaultRelationships;
  }
  
  /**
   * Get default relationships for a character
   */
  public getDefaultRelationshipsForCharacter(characterId: string): Record<string, CharacterRelationship> {
    // Only return explicitly defined relationships
    return this.defaultRelationships[characterId] || {};
  }
  
  /* Character Location Methods */    
  public getDefaultLocationsForCharacter(characterId: string): CharacterLocations {
    this.ensureInitialized();
    return this.defaultCharacterLocations[characterId] || {
      residence: [],
      workplaces: [],
      frequents: []
    };
  }

  public getRandomizedLocationsForCharacter(characterId: string): CharacterLocations {
    this.ensureInitialized();
    const defaultLocations = this.getDefaultLocationsForCharacter(characterId);
    
    return pickRandomLocationsForCharacter(defaultLocations);
  }

  
  /* NPC Methods */
  public getAllNPCs(): Record<string, NPC> {
    this.ensureInitialized();
    return this.npcs;
  }
  
  public getNPCById(id: string): NPC | undefined {
    this.ensureInitialized();
    return this.npcs[id];
  }
  
  public getNPCsByIds(ids: string[]): NPC[] {
    this.ensureInitialized();
    return ids
      .map(id => this.npcs[id])
      .filter((npc): npc is NPC => !!npc);
  }

  /**
   * Gets the final, complete set of strategy weights for a given character.
   * This method performs a three-step process:
   * 1. Starts with the full set of global default weights from the registry.
   * 2. Looks up the character-specific overrides loaded from JSON.
   * 3. Merges the overrides on top of the defaults, producing the final weights.
   * 
   * This ensures every character has a value for every strategy, while allowing
   * for easy, minimal configuration of their unique preferences.
   * @param characterId The identifier of the character (e.g., "heiress").
   * @returns A complete map of strategy identifiers to their final weights.
   */
  public getStrategiesForCharacter(characterId: string): StrategyWeights {
    this.ensureInitialized();
    
    // 1. Start with the complete set of default weights from the registry.
    const finalWeights = { ...this.baseDefaultWeights };

    // 2. Get the specific overrides for this character, if they exist.
    const overrides = this.characterWeightOverrides[characterId];

    // 3. If there are overrides, merge them. The spread operator elegantly
    //    overwrites any default keys with the character's specific value.
    if (overrides) {
      Object.assign(finalWeights, overrides);
    }

    return finalWeights;
  }
}

export default StaticGameDataManager;