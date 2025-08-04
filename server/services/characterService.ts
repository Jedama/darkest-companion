// server/services/characterService.ts
import type { Character, CharacterTemplate, CharacterStatus } from '../../shared/types/types.js';
import StaticGameDataManager from '../staticGameDataManager.js';

/**
 * Creates a full Character instance from a template, adding default dynamic data.
 * This is where the "blueprint" becomes a "real character".
 * @param template The character blueprint to use.
 * @param gameData The static data manager instance to get default relationships/locations.
 * @returns A full Character object ready for gameplay.
 */
export function createCharacterFromTemplate(
  template: CharacterTemplate, 
  gameData: StaticGameDataManager
): Character {
  // Define the default starting status for any new character
  const defaultStatus: CharacterStatus = {
    physical: 100,
    mental: 100,
    affliction: "",
    description: "In good health and high spirits",
    wounds: [],
    diseases: [],
  };

  return {
    ...template, // 1. Copy all static properties from the template blueprint
    
    // 2. Add the dynamic properties with their default starting values
    level: 0,
    money: 0,
    status: defaultStatus,
    
    // 3. Get the dynamic starting relationships and locations from the manager
    relationships: gameData.getDefaultRelationshipsForCharacter(template.identifier),
    locations: gameData.getRandomizedLocationsForCharacter(template.identifier),
    strategyWeights: gameData.getStrategiesForCharacter(template.identifier),
  };
}