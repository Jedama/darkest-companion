import { loadEstate, saveEstate } from '../fileOps.js';
import { loadEventTemplatesForCategory, loadTownKeywords } from '../templateLoader.js';
import { Estate, EventData, EventRecord } from '../../shared/types/types.js';

/**
 * Loads all event templates, picks one at random.
 */
async function pickRandomEvent(): Promise<EventData> {
  const allEvents: EventRecord = await loadEventTemplatesForCategory('town');
  const eventIds = Object.keys(allEvents);

  if (eventIds.length === 0) {
    throw new Error('No event templates found in data/events.');
  }

  const randomId = eventIds[Math.floor(Math.random() * eventIds.length)];
  return allEvents[randomId];
}

/**
 * Picks a random subset of character IDs from the estate.
 * Ensures we have enough characters to match a randomly selected number within the event's nrChars range.
 */
function pickRandomCharacters(estate: Estate, nrCharsRange: [number, number]): string[] {
  const allCharIds = Object.keys(estate.characters);

  if (allCharIds.length < nrCharsRange[0]) {
    throw new Error(
      `Not enough characters in the estate to pick ${nrCharsRange[0]}. Have only ${allCharIds.length}.`
    );
  }

  // Determine how many characters to pick within the range
  const howMany = Math.floor(
    Math.random() * (nrCharsRange[1] - nrCharsRange[0] + 1)
  ) + nrCharsRange[0];

  // Shuffle the array using Fisher-Yates
  for (let i = allCharIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCharIds[i], allCharIds[j]] = [allCharIds[j], allCharIds[i]];
  }

  // Return the first `howMany`
  return allCharIds.slice(0, howMany);
}

/**
 * Combines event and town keywords, removes duplicates, shuffles, and selects a subset.
*/
export function pickKeywords(
  eventKeywords: string[],
  townKeywords: string[]
): string[] {
  // 1. Combine + remove duplicates
  const combined = Array.from(new Set([...eventKeywords, ...townKeywords]));
  
  // 2. Shuffle
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  
  // 3. Choose keywords
  let chosen = combined.slice(0, 4);
  
  // 4. Ensure at least one original event keyword is in the final set
  //    but only if the event had any original keywords.
  const eventKeywordsSet = new Set(eventKeywords);
  if (eventKeywords.length > 0) {
    const hasEventKeyword = chosen.some((kw) => eventKeywordsSet.has(kw));
    if (!hasEventKeyword) {
      // replace the last chosen with a random event keyword
      const randomEventKeyword =
      eventKeywords[Math.floor(Math.random() * eventKeywords.length)];
      chosen[chosen.length - 1] = randomEventKeyword;
    }
  }
  
  return chosen;
}

/**
 * Main function that:
 * 1) Loads the estate,
 * 2) Picks a random event,
 * 3) Picks random characters to match the event requirement,
 * 4) Optionally stores the selection in the estate (commented out below).
 */
export async function setupRandomEvent(estateName: string): Promise<{
  event: EventData;
  chosenCharacterIds: string[];
}> {
  // 1. Load the estate
  const estate = await loadEstate(estateName);
  if (!estate) {
    throw new Error(`Estate '${estateName}' not found`);
  }

  // 2. Pick a random event
  const event = await pickRandomEvent();

  // 3. Load town keywords & pick final set
  const townKeywords = await loadTownKeywords();
  const finalKeywords = pickKeywords(event.keywords || [], townKeywords);
  event.keywords = finalKeywords; // Overwrite or add a new property

  // 4. Determine the range for nrChars
  if (!Array.isArray(event.nrChars) || event.nrChars.length !== 2) {
    throw new Error(`Invalid nrChars format for event '${event.identifier}'. Expected a range [min, max].`);
  }

  // Cast nrChars to [number, number] for type safety
  const nrCharsRange: [number, number] = [event.nrChars[0], event.nrChars[1]];

  // 5. Pick random characters
  const chosenCharacterIds = pickRandomCharacters(estate, nrCharsRange);

  // (Optional) Store the selection in the estate for later use:
  /*
  estate.currentEvent = {
    eventIdentifier: event.identifier,
    chosenCharacterIds
  };
  await saveEstate(estate);
  */

  // Return the data for the route handler (or the next step)
  return { event, chosenCharacterIds };
}
