// server/routes/dungeonSummaryRoute.ts
import { Router, Request, Response } from 'express';
import { loadEstate } from '../fileOps.js';
import { callLLM } from '../services/llm/llmService.js';
import { compileDungeonSummaryPrompt } from '../services/dungeon/dungeonSummaryService.js';

import type { Estate } from '../../shared/types/types.js';
import type { LLMRequest } from '../services/llm/llmService.js';

const router = Router();

/**
 * POST /estates/:estateName/dungeon/summary
 * Generates a wage split and dungeon summary after a completed expedition.
 * Called after story + consequences have already been processed.
 */
router.post('/estates/:estateName/dungeon/summary', async (req: Request, res: Response) => {
  try {
    const { estateName } = req.params;
    const { totalLoot } = req.body;

    // 1. Load the estate (already updated with return-home consequences)
    const estate: Estate | undefined = await loadEstate(estateName);
    if (!estate) {
      return res.status(404).json({ error: `Estate '${estateName}' not found` });
    }

    if (!estate.dungeon) {
      return res.status(400).json({ error: 'No active dungeon on this estate' });
    }

    console.log('Dungeon summary route - loaded estate:', estateName, 'loot:', totalLoot);

    // 2. Compile the summary prompt
    const summaryPrompt = compileDungeonSummaryPrompt(estate, totalLoot);

    // 3. Call LLM
    const provider = estate.preferences?.llmProvider ?? 'anthropic';
    const model = estate.preferences?.llmModel;

    const summaryRequest: LLMRequest = {
      provider,
      model,
      prompt: summaryPrompt,
      maxTokens: 2048,
      temperature: 0.7,
    };

    const response = await callLLM(summaryRequest);

    // 4. Clean and parse the response
    const cleanedText = response
      .replace(/^```(json)?\n/, '')
      .replace(/:\s*\+(\d)/g, ': $1')
      .replace(/```/, '')
      .trim();

    console.log('Dungeon summary response:\n', cleanedText);

    const parsedJson = JSON.parse(cleanedText);

    // 5. Basic validation
    if (!parsedJson.headline || !Array.isArray(parsedJson.characters) || parsedJson.town === undefined) {
      throw new Error('Dungeon summary response missing required fields');
    }

    // 6. Validate wage total
    const characterTotal = parsedJson.characters.reduce(
      (sum: number, c: any) => sum + (c.share || 0), 0
    );
    const totalDistributed = characterTotal + (parsedJson.town || 0);
    const lootNum = parseInt(totalLoot) || 0;

    if (totalDistributed !== lootNum) {
      console.warn(`Wage total mismatch: distributed ${totalDistributed}, expected ${lootNum}. Adjusting town share.`);
      parsedJson.town = lootNum - characterTotal;
    }

    // 7. TODO: Apply results to estate
    // - Update character.money for each wage
    // - Update estate.money with town share
    // - Clear estate.dungeon
    // - Save estate

    return res.json({
      success: true,
      prompt: summaryPrompt,
      result: parsedJson,
    });

  } catch (error: any) {
    console.error('Error in dungeon summary route:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;