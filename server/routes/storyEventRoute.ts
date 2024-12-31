// server/routes/storyEventRoute.ts
import { Router, Request, Response } from 'express';
import { compileStoryPrompt } from '../services/storyEventService';
import { loadEstate } from '../fileOps';
import { callClaude } from '../services/llmService.js';
import type { Estate, EventData } from '../../shared/types/types.ts';

const router = Router();

/**
 * POST /estates/:estateName/events/story
 * Expects JSON body with { event, chosenCharacterIds } or you might store these in the estate.
 * Returns a compiled prompt string that the frontend can send to the LLM.
 */
router.post('/estates/:estateName/events/story', async (req: Request, res: Response) => {
  try {
    const { estateName } = req.params;
    const { event, chosenCharacterIds } = req.body;

    // 1. Load the estate so we can fetch character data
    const estate: Estate | undefined = await loadEstate(estateName);
    if (!estate) {
      return res.status(404).json({ error: `Estate '${estateName}' not found` });
    }

    // 2. Build the prompt using your storyEventService
    const prompt = compileStoryPrompt(estate, event, chosenCharacterIds);

    // 3. Call Claude with the prompt
    //    (You can pass a custom model name if you like.)
    const claudeResponse = await callClaude({
      prompt,
      model: 'claude-3-5-sonnet-20241022',    // or "claude-2.0", etc.
      maxTokens: 1024
    });

    // 4. Return both the prompt and the LLM's response
    return res.json({
      success: true,
      prompt,
      llmResponse: claudeResponse
    });
  } catch (error: any) {
    console.error('Error compiling story prompt:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
