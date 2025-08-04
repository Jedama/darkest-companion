// server/services/estateService.ts
import type { Estate, Character, CharacterRecord } from '../../shared/types/types.js';
import { saveEstate, listEstates } from '../fileOps.js';
import StaticGameDataManager from '../staticGameDataManager.js';
import { createCharacterFromTemplate } from './characterService.js';

export function getCharacter(characters: CharacterRecord, id: string): Character | undefined {
  return characters[id];
}

// Helper function to create a new estate
export function createNewEstate(estateName: string): Estate {
  return {
    estateName,
    money: 0,
    month: 0,
    roles: {
      margrave: 'heiress',
      bursar: 'kheir',
    },
    characters: {}
  };
}

// Helper function to add a character to an estate
export function addCharacterToEstate(estate: Estate, character: Character): Estate {
  return {
    ...estate,
    characters: {
      ...estate.characters,
      [character.identifier]: character
    }
  };
}

// Function to validate the estate name
export function validateEstateName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Estate name is required' };
  }
  
  if (name.length < 1) {
    return { valid: false, error: 'Estate name cannot be empty' };
  }
  
  if (name.length > 50) {
    return { valid: false, error: 'Estate name cannot be longer than 50 characters' };
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return { valid: false, error: 'Estate name cannot be only whitespace' };
  }

  return { valid: true };
}

export async function createNewEstateAndSave(
  estateName: string,
  gameData: StaticGameDataManager,
  characterIds: string[]
): Promise<Estate | { error: string; status: number }> {

  // 1. Validation Logic
  const validation = validateEstateName(estateName);
  if (!validation.valid) {
    return { error: validation.error || 'Invalid estate name', status: 400 };
  }

  // 2. Duplicate Check Logic (Now in the service!)
  const estates = await listEstates(); // Assumes listEstates is imported here
  if (estates.includes(estateName)) {
    return { error: 'An estate with this name already exists', status: 409 };
  }
  
  // 3. Character Creation Logic
  const characterTemplates = gameData.getCharacterTemplates();
  const defaultCharacters: CharacterRecord = Object.fromEntries(
    characterIds
      .map((id) => {
        const template = characterTemplates[id];
        if (!template) return null;
        return [id, createCharacterFromTemplate(template, gameData)];
      })
      .filter((entry): entry is [string, Character] => entry !== null)
  );

  // 4. Assembly Logic
  const newEstate = {
    ...createNewEstate(estateName), // Uses the other service function
    characters: defaultCharacters
  };

  // 5. Persistence
  await saveEstate(newEstate);

  // 6. Return the successful result
  return newEstate;
}

