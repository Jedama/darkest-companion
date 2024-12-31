import { setupRandomEvent } from './server/services/eventSetupService.js';
import { compileStoryPrompt } from './server/services/storyEventService.js';
import { loadEstate } from './server/fileOps.js'; // Adjust the path based on your project structure
import type { Estate } from './shared/types/types.js';

/**
 * A simple debug script to test both setupRandomEvent and compileStoryPrompt.
 * Make sure you have a valid estate file (e.g., "MyEstate.json").
 */

(async () => {
  try {
    const estateName = '4'; // Replace with a valid estate name
    console.log(`Testing setupRandomEvent for estate: ${estateName}`);

    // Step 1: Test setupRandomEvent
    const { event, chosenCharacterIds } = await setupRandomEvent(estateName);
    console.log('Random event picked:', event);
    console.log('Characters chosen:', chosenCharacterIds);

    // Step 2: Load the estate to pass into the story prompt
    const estate: Estate = await loadEstate(estateName);
    console.log(`Estate loaded: ${estateName}`);

    // Step 3: Test compileStoryPrompt
    const prompt = compileStoryPrompt(estate, event, chosenCharacterIds);
    console.log('Generated Story Prompt:');
    console.log(prompt);

    // If you'd like to send the prompt to the LLM or test it with a mock response, you could add that here.
  } catch (error) {
    console.error('Error during debug script:', error);
  }
})();
