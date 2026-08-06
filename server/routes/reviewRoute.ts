// server/routes/reviewRoute.ts
import { Router, Request, Response } from 'express';
import { withEstate } from '../estateLock.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../errors.js';
import { callEstateLLM, parseLlmJson, requireFields } from '../services/llm/estateLlm.js';
import { applyReview, compileReviewPrompt } from '../services/review/reviewService.js';
import { debugPoliticalLandscape } from '../services/politics/politicalLandscape.js';

const router = Router();

const MAX_NARRATIVES = 8;

/**
 * The exact shape applyReview accepts, derived from its own signature rather
 * than redeclared here. Declaring a second `ReviewResult` just gave us two
 * incompatible types with the same name.
 */
type ReviewResult = Parameters<typeof applyReview>[1];

/**
 * POST /estates/:estateName/review
 * Triggers a narrative review at dungeon-end or month-end.
 * Evaluates logs, maintains active narratives, and generates follow-up events.
 *
 * This is the route most likely to collide with something else: it renders
 * nothing, so a player can fire it and immediately open a town event.
 */
router.post(
  '/estates/:estateName/review',
  asyncHandler(async (req: Request<{ estateName: string }>, res: Response) => {
    const { estateName } = req.params;

    const result = await withEstate(estateName, async (estate) => {
      // TEMPORARY: political layer under construction. Printed before the LLM
      // call so the numbers can be checked against a live save; nothing here
      // reaches the prompt yet.
      console.log(debugPoliticalLandscape(estate));

      const prompt = compileReviewPrompt(estate);
      const response = await callEstateLLM(estate, prompt, { temperature: 0.7 });

      const parsed = parseLlmJson<ReviewResult>(response, 'review');
      requireFields(parsed, 'review', ['estate_log', 'narratives']);

      if (!Array.isArray(parsed.narratives)) {
        throw AppError.llmBadContent('review', ['"narratives" is not an array'], parsed);
      }

      if (parsed.narratives.length > MAX_NARRATIVES) {
        throw AppError.llmBadContent(
          'review',
          [`returned ${parsed.narratives.length} narratives, maximum is ${MAX_NARRATIVES}`],
          parsed
        );
      }

      console.log('Review Results');
      console.log(JSON.stringify(parsed, null, 2));
      console.log('');

      applyReview(estate, parsed);
      return parsed;
    });

    res.json({ success: true, result });
  })
);

export default router;