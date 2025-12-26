// server/routes/storyEventRoute.ts
import { Router, Request, Response } from 'express';
import { compileStoryPrompt } from '../services/storyEventService';
import { separateStoryTitle } from '../services/llmResponseProcessor.js';
import { loadEstate } from '../fileOps';
import { callLLM } from '../services/llm/llmService.js';
import type { Estate } from '../../shared/types/types.ts';


const router = Router();

/**
 * POST /estates/:estateName/events/story
 * Expects JSON body with { event, chosenCharacterIds } or you might store these in the estate.
 * Returns a compiled prompt string that the frontend can send to the LLM.
 */
router.post('/estates/:estateName/events/story', async (req: Request, res: Response) => {
  try {
    const { estateName } = req.params;
    const { event, chosenCharacterIds, locations, npcIds, enemyIds, bystanders } = req.body;

    // 1. Load the estate so we can fetch character data
    const estate: Estate | undefined = await loadEstate(estateName);
    if (!estate) {
      return res.status(404).json({ error: `Estate '${estateName}' not found` });
    }

    console.log('Story Route Body:', JSON.stringify(req.body, null, 2));

    // 2. Build the prompt using your storyEventService
    const prompt = await compileStoryPrompt(estate, event, chosenCharacterIds, locations, npcIds, enemyIds, bystanders);

    // 3. Call LLM with the prompt
    const provider = estate.preferences?.llmProvider ?? "anthropic";
    const model = estate.preferences?.llmModel; // if undefined, provider default in callLLM will apply

    const response = await callLLM({
      provider,
      model,
      prompt,
      maxTokens: 1024,
      temperature: 1.0,
      // system: estate.preferences?.guidance ?? undefined, // NOT USED per your request
    });

    // 4. Extract title from response
    const { title, body } = separateStoryTitle(response);

    // 5. Return both the prompt and the LLM's response
    return res.json({
      success: true,
      prompt,
      story: {
        title,
        body
      }
    });
  } catch (error: any) {
    console.error('Error compiling story prompt:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
