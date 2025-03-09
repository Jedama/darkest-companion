// staticGameDataManager.ts
import { 
  Character, CharacterRecord, LocationData, EventRecord, NPC,
  EventData, Relationship
} from '../shared/types/types';
import { 
  loadCharacterTemplates, loadDefaultRelationships, loadDefaultCharacterLocations,
  loadEventTemplatesForCategory, loadTownKeywords, loadAllLocations, loadAllNPCs 
} from './templateLoader.js';

/**
 * Picks a random subset of locations for a character based on predefined rules:
 * - One random residence if multiple are available
 * - 1-4 random workplaces
 * - 4-8 random frequented locations
 */
function pickRandomLocationsForCharacter(locations: {
  residence: string[],
  workplaces: string[],
  frequents: string[]
}): {
  residence: string[],
  workplaces: string[],
  frequents: string[]
} {
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
 */
class StaticGameDataManager {
  private static instance: StaticGameDataManager;
  private initialized = false;

  // Character data
  private characterTemplates: CharacterRecord = {};
  private defaultRelationships: Record<string, Record<string, Relationship>> = {};
  private defaultCharacterLocations: Record<string, {
    residence: string[],
    workplaces: string[],
    frequents: string[]
  }> = {};
  
  // Location data
  private locations: LocationData[] = [];
  private locationMap: Map<string, LocationData> = new Map();
  
  // Event data
  private townEvents: EventRecord = {};
  private townKeywords: string[] = [];
  
  // NPC data
  private npcs: Record<string, NPC> = {};

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
        locations,
        townEvents,
        townKeywords,
        npcs
      ] = await Promise.all([
        loadCharacterTemplates(),
        loadDefaultRelationships(),
        loadDefaultCharacterLocations(),
        loadAllLocations(),
        loadEventTemplatesForCategory('town'),
        loadTownKeywords(),
        loadAllNPCs()
      ]);
      
      // Store the loaded data
      this.characterTemplates = characterTemplates;
      this.defaultRelationships = defaultRelationships;
      this.defaultCharacterLocations = defaultCharacterLocations;
      this.locations = locations;
      this.townEvents = townEvents;
      this.townKeywords = townKeywords;
      this.npcs = npcs;
      
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
  
  public getCharacterTemplates(): CharacterRecord {
    this.ensureInitialized();
    return this.characterTemplates;
  }
  
  public getCharacterTemplate(id: string): Character | undefined {
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
  
  public getDefaultRelationships(): Record<string, Record<string, Relationship>> {
    this.ensureInitialized();
    return this.defaultRelationships;
  }
  
  /**
   * Get default relationships for a character
   */
  public getDefaultRelationshipsForCharacter(characterId: string): Record<string, Relationship> {
    // Only return explicitly defined relationships
    return this.defaultRelationships[characterId] || {};
  }
  
  /* Character Location Methods */    
  public getDefaultLocationsForCharacter(characterId: string): {
    residence: string[],
    workplaces: string[],
    frequents: string[]
  } {
    this.ensureInitialized();
    return this.defaultCharacterLocations[characterId] || {
      residence: [],
      workplaces: [],
      frequents: []
    };
  }

  public getRandomizedLocationsForCharacter(characterId: string): {
    residence: string[],
    workplaces: string[],
    frequents: string[]
  } {
    this.ensureInitialized();
    const defaultLocations = this.getDefaultLocationsForCharacter(characterId);
    
    // Only randomize if there are multiple residence options
    if (defaultLocations.residence.length <= 1) {
      return defaultLocations;
    }
    
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
}

export default StaticGameDataManager;