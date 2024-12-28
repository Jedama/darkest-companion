// debug.ts
import { setupRandomEvent } from './server/services/eventSetupService.ts';
// or wherever your service function is located

/**
 * A simple debug script to test the setupRandomEvent function.
 * Make sure you have a valid estate file (e.g., "MyEstate.json") 
 * and that your fileOps.js is pointing to the correct directory.
 */

// Use an Immediately Invoked Function Expression (IIFE) 
// so we can use async/await at the top level.
(async () => {
  try {
    // Replace "MyEstate" with the name of a real estate file you have
    const { event, chosenCharacterIds } = await setupRandomEvent('all');
    console.log('Random event picked:', event);
    console.log('Characters chosen:', chosenCharacterIds);
  } catch (error) {
    console.error('Error during debug script:', error);
  }
})();
