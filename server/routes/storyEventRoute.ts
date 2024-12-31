// server/routes/storyEventRoute.ts
import { Router, Request, Response } from 'express';
import { compileStoryPrompt } from '../services/storyEventService';
import { loadEstate } from '../fileOps';
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

    // 2. For now, we assume `event` includes the necessary data 
    //    (title, summary, keywords, nrChars, etc.) as returned by setup-random.
    //    If you stored an eventIdentifier in the estate, you’d look it up here.

    // 3. Build the prompt
    const prompt = compileStoryPrompt(estate, event, chosenCharacterIds);

    // 4. Return the prompt (later you might call LLM here)
    return res.json({
      success: true,
      prompt
    });
  } catch (error: any) {
    console.error('Error compiling story prompt:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
