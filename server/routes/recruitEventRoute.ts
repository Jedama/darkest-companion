// server/routes/recruitEventRoute.ts
import { Router, Request, Response } from 'express';
import { setupEvent } from '../services/setupEventService.js';
import { compileRecruitPrompt } from '../services/recruitEventService';
import { separateStoryTitle } from '../services/llmResponseProcessor.js';
import { saveEstate, loadEstate } from '../fileOps';
import { callLLM } from '../services/llm/llmService.js';
import { compileConsequencesPrompt } from '../services/consequencesEventService.js';
import { validateConsequenceUpdate, formatConsequenceUpdate } from '../services/promptService.js';
import { applyConsequences, prepareConsequenceDisplay, ensureAllCharactersHaveConsequences } from '../services/llmResponseProcessor.js';

import type { Estate } from '../../shared/types/types.ts';
import type { LLMRequest } from "../services/llm/llmService.js";
import type { ConsequencePrompt } from '../services/promptService.js';
import type { ConsequencesResult } from '../services/llmResponseProcessor.js';
import { addCharacterToEstate } from '../services/estateService.js';


const router = Router();

/**
 * POST /estates/:estateName/events/story
 * Expects JSON body with { event, chosenCharacterIds } or you might store these in the estate.
 * Returns a compiled prompt string that the frontend can send to the LLM.
 */
router.post('/estates/:estateName/events/recruit', async (req: Request, res: Response) => {
  try {
    const { estateName } = req.params;
    const { eventId, characterId, name, modifiers } = req.body;

    // 1. Load the estate so we can fetch character data
    let estate: Estate | undefined = await loadEstate(estateName);
    if (!estate) {
      return res.status(404).json({ error: `Estate '${estateName}' not found` });
    }

    console.log('Recruit route - loaded estate:', estateName, 'with requested character:', characterId);

    // 2. Add the new character to the estate
    estate = addCharacterToEstate(estate, characterId);
    estate.characters[characterId].name = name;

    // 3. Call the service to pick random event + characters
    const setupResult = await setupEvent(estate, {
      eventId,
      characterIds: characterId ? [characterId] : [],
      modifiers, // Passed through, though currently unused logic-wise
    });
    
    // 4. Build the prompt using your storyEventService
    const recruitPrompt = await compileRecruitPrompt(
      estate, 
      setupResult.event, 
      setupResult.chosenCharacterIds, 
      setupResult.locations, 
      setupResult.bystanders, 
      setupResult.keywords
    );

    // 5. Call LLM with the prompt
    const provider = estate.preferences?.llmProvider ?? "anthropic";
    const model = estate.preferences?.llmModel; // if undefined, provider default in callLLM will apply

    const recruitRequest: LLMRequest = {
      provider,
      model,
      prompt: recruitPrompt,
      maxTokens: 2048,
      temperature: 0.7,
    };

    const recruitResponse = await callLLM(recruitRequest);

    // 6. Extract title from response
    const { title, body } = separateStoryTitle(recruitResponse);
    const consequencesPrompt = await compileConsequencesPrompt({
      estate,
      story: body,
      chosenCharacterIds: setupResult.chosenCharacterIds
    });

    console.log('Story:', body);

    /*const response = await callLLM({
      provider,
      model,
      prompt: consequencesPrompt,
      maxTokens: 2048,
      temperature: 0.7,
    });

    // 7. Clean and parse the response
    const cleanResponse = (text: string): string => {
      // Remove markdown code block indicators and language tag
      return text.replace(/^```(json)?\n/, '')  // Remove opening ```json or ``` 
      .replace('+', '')              // Remove any potential +1s
      .replace(/```/, '')            // Remove closing ``` 
      .trim();                       // Clean up any extra whitespace
    };
    
    const cleanedText = cleanResponse(response);
    console.log('Cleaned response:\n', cleanedText);

    // 8. Parse and validate the response
    let parsedJson: ConsequencePrompt;
    parsedJson = JSON.parse(cleanedText) as ConsequencePrompt;

    if (!parsedJson || !Array.isArray(parsedJson.characters)) {
      throw new Error('Response missing required "characters" array');
    }

    if (!validateConsequenceUpdate(parsedJson, estate.characters)) {
      throw new Error('Response failed consequence validation rules');
    }

    const formattedConsequences = formatConsequenceUpdate(parsedJson);

    const consequencesForProcessing: ConsequencesResult =
      ensureAllCharactersHaveConsequences(formattedConsequences, setupResult.chosenCharacterIds);

    // const updatedEstate = applyConsequences(estate, consequencesForProcessing);

    // await saveEstate(updatedEstate);*/

    return res.json({
      success: true,
      prompt: recruitPrompt,
      story: { title, body },
    });
    
  } catch (error: any) {
    console.error('Error in recruit route:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
