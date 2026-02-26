// server/routes/reviewRoute.ts
import { Router, Request, Response } from 'express';
import { loadEstate } from '../fileOps.js';
import { callLLM } from '../services/llm/llmService.js';
import { compileReviewPrompt } from '../services/review/reviewService.js';

import type { Estate } from '../../shared/types/types.js';
import type { LLMRequest } from '../services/llm/llmService.js';

const router = Router();

/**
 * POST /estates/:estateName/review
 * Triggers a narrative review at dungeon-end or month-end.
 * Evaluates logs, maintains active narratives, and generates follow-up events.
 */
router.post('/estates/:estateName/review', async (req: Request, res: Response) => {
  try {
    const { estateName } = req.params;

    // 1. Load the estate
    const estate: Estate | undefined = await loadEstate(estateName);
    if (!estate) {
      return res.status(404).json({ error: `Estate '${estateName}' not found` });
    }

    console.log('Review route - loaded estate:', estateName);

    // 2. Compile the review prompt
    const reviewPrompt = compileReviewPrompt(estate);

    console.log('Compiled review prompt:\n', reviewPrompt);

    // 3. Call LLM
    const provider = estate.preferences?.llmProvider ?? 'anthropic';
    const model = estate.preferences?.llmModel;

    const reviewRequest: LLMRequest = {
      provider,
      model,
      prompt: reviewPrompt,
      maxTokens: 4096,
      temperature: 0.7,
    };

    const response = await callLLM(reviewRequest);

    // 4. Clean and parse the response
    const cleanResponse = (text: string): string => {
      return text
        .replace(/^```(json)?\n/, '')
        .replace('+', '')
        .replace(/```/, '')
        .trim();
    };

    const cleanedText = cleanResponse(response);
    console.log('Review response:\n', cleanedText);

    const parsedJson = JSON.parse(cleanedText);

    // 5. Basic validation
    if (!parsedJson.estate_log || !Array.isArray(parsedJson.narratives)) {
      throw new Error('Review response missing required "estate_log" or "narratives" array');
    }

    if (parsedJson.narratives.length > 8) {
      throw new Error(`Review returned ${parsedJson.narratives.length} narratives, maximum is 8`);
    }

    // 6. TODO: Apply results to estate
    // - estate.narratives = parsedJson.narratives
    // - Apply estate_log entry to estate.estateLogs
    // - Store follow_up_events in estate event queue
    // - Save estate

    return res.json({
      success: true,
      prompt: reviewPrompt,
      result: parsedJson,
    });

  } catch (error: any) {
    console.error('Error in review route:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;