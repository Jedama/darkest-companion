// server/routes/dungeonSummaryRoute.ts
import { Router, Request, Response } from 'express';
import { withEstate } from '../estateLock.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../errors.js';
import { callEstateLLM, parseLlmJson, requireFields } from '../services/llm/estateLlm.js';
import { compileDungeonSummaryPrompt } from '../services/dungeon/dungeonSummaryService.js';

const router = Router();

interface WageShare {
  identifier: string;
  share?: number;
}

interface DungeonSummary {
  headline: string;
  characters: WageShare[];
  town: number;
  bursar?: number;
}

/**
 * POST /estates/:estateName/dungeon/summary
 * Generates a wage split and dungeon summary after a completed expedition.
 * Called after story + consequences have already been processed.
 */
router.post(
  '/estates/:estateName/dungeon/summary',
  asyncHandler(async (req: Request<{ estateName: string }, {}, { totalLoot: unknown }>, res: Response) => {
    const { estateName } = req.params;
    const { totalLoot } = req.body ?? {};

    const lootTotal = Number(totalLoot);
    if (!Number.isFinite(lootTotal) || lootTotal < 0) {
      throw AppError.badRequest(
        `totalLoot must be a non-negative number, got ${JSON.stringify(totalLoot)}.`
      );
    }

    const summary = await withEstate(estateName, async (estate) => {
      if (!estate.dungeon) {
        throw AppError.invalidState('There is no active dungeon on this estate to summarise.');
      }

      const prompt = compileDungeonSummaryPrompt(estate, totalLoot as any);
      const response = await callEstateLLM(estate, prompt, { temperature: 0.7 });

      const parsed = parseLlmJson<DungeonSummary>(response, 'dungeon summary');
      requireFields(parsed, 'dungeon summary', ['headline', 'characters', 'town']);

      if (!Array.isArray(parsed.characters)) {
        throw AppError.llmBadContent('dungeon summary', ['"characters" is not an array'], parsed);
      }

      console.log(`Total money: ${lootTotal}`);
      console.log(JSON.stringify(parsed, null, 2));
      console.log('');

      // --- Reconcile the split against the actual loot ---
      const characterTotal = parsed.characters.reduce((sum, c) => sum + (c.share || 0), 0);
      const bursarCut = parsed.bursar || 0;
      const distributed = characterTotal + (parsed.town || 0) + bursarCut;

      if (distributed !== lootTotal) {
        console.warn(
          `Wage total mismatch: distributed ${distributed}, expected ${lootTotal}. Adjusting town share.`
        );
        parsed.town = lootTotal - characterTotal - bursarCut;
      }

      // The model can hand out more than exists. Absorbing that as a negative
      // town share would quietly drain the estate's treasury, so floor it and
      // say so instead.
      if (parsed.town < 0) {
        console.warn(
          `Wages exceeded the loot by ${-parsed.town}. Town share floored at 0; the estate covers the shortfall.`
        );
        parsed.town = 0;
      }

      // --- Apply ---
      for (const charShare of parsed.characters) {
        const char = estate.characters[charShare.identifier];
        if (char) {
          char.money += charShare.share || 0;
        } else {
          console.warn(`Wage for unknown character '${charShare.identifier}' discarded.`);
        }
      }

      estate.money += parsed.town;

      if (bursarCut > 0) {
        const bursarId = estate.leadership.bursar;
        const bursar = estate.characters[bursarId];
        if (bursar) {
          bursar.money += bursarCut;
        } else {
          console.warn(
            `Bursar cut of ${bursarCut} diverted to estate: Bursar '${bursarId}' not found.`
          );
          estate.money += bursarCut;
        }
      }

      estate.dungeon = undefined;
      return parsed;
    });

    res.json({ success: true, result: summary });
  })
);

export default router;