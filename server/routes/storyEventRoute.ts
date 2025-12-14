// server/routes/storyEventRoute.ts
import { Router, Request, Response } from 'express';
import { compileStoryPrompt, separateStoryTitle } from '../services/storyEventService';
import { loadEstate } from '../fileOps';
import { callClaude, callGemini, callGrok } from '../services/llm/llmService.js';
import type { Estate, EventData } from '../../shared/types/types.ts';
import { Console } from 'console';

const router = Router();

/**
 * POST /estates/:estateName/events/story
 * Expects JSON body with { event, chosenCharacterIds } or you might store these in the estate.
 * Returns a compiled prompt string that the frontend can send to the LLM.
 */
router.post('/estates/:estateName/events/story', async (req: Request, res: Response) => {
  try {
    const { estateName } = req.params;
    const { event, chosenCharacterIds, locations, npcIds, bystanders } = req.body;

    // 1. Load the estate so we can fetch character data
    const estate: Estate | undefined = await loadEstate(estateName);
    if (!estate) {
      return res.status(404).json({ error: `Estate '${estateName}' not found` });
    }

    console.log('Story Route Body:', JSON.stringify(req.body, null, 2));

    // 2. Build the prompt using your storyEventService
    const prompt = await compileStoryPrompt(estate, event, chosenCharacterIds, locations, npcIds, bystanders);

    // 3. Call Claude with the prompt
    //    (You can pass a custom model name if you like.)
    /*const response = await callGrok({
      prompt,
      model: 'grok-3-beta',
      maxTokens: 1024
    });*/

    /*const response = await callClaude({
      prompt,
      model: 'claude-3-7-sonnet-20250219',
      maxTokens: 1024
    });*/

    const response = await callGemini({
      prompt,
      model: 'gemini-3-pro-preview',
      maxTokens: 1024,
      temperature: 1
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
