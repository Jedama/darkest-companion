import { setupRandomEvent } from './server/services/eventSetupService.js';
import { compileStoryPrompt } from './server/services/storyEventService.js';
import { callClaude } from './server/services/llmService.js';
import { loadEstate } from './server/fileOps.js'; // Adjust the path based on your project structure
import type { Estate } from './shared/types/types.js';

/**
 * A debug script to test setupRandomEvent, compileStoryPrompt, and send the prompt to Claude.
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

    // Step 4: Send prompt to Claude
    console.log('Sending prompt to Claude...');
    const llmResponse = await callClaude({
      prompt,
    });

    console.log('LLM Response:');
    console.log(llmResponse);
  } catch (error) {
    console.error('Error during debug script:', error);
  }
})();
