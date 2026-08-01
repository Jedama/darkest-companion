// server/routes/consequencesEventRoute.ts
import { Router, Request, Response } from 'express';
import { withEstate } from '../estateLock.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../errors.js';
import { callEstateLLM, parseLlmJson } from '../services/llm/estateLlm.js';
import { checkConsequences, reportUnhandledConsequences } from '../services/llm/consequenceChecks.js';
import { compileConsequencesPrompt } from '../services/story/consequencesEventService.js';
import {
  applyConsequences,
  prepareConsequenceDisplay,
  ensureAllCharactersHaveConsequences,
  type ConsequencesResult,
} from '../services/llm/llmResponseProcessor.js';

const router = Router();

interface ConsequencesRequest {
  story: string;
  chosenCharacterIds: string[];
}

/**
 * POST /estates/:estateName/events/consequences
 *
 * Turns a finished story into state changes, applies them, and hands back the
 * display data for the character cards.
 *
 * No try/catch: anything thrown here lands in errorHandler, which owns the
 * response shape. Anything thrown inside withEstate leaves the save file
 * untouched.
 */
router.post(
  '/estates/:estateName/events/consequences',
  asyncHandler(async (req: Request<{ estateName: string }, {}, ConsequencesRequest>, res: Response) => {
    const { estateName } = req.params;
    const { story, chosenCharacterIds } = req.body ?? {};

    // Cheap request validation happens before we queue for the lock.
    if (!story?.trim()) {
      throw AppError.badRequest('No story text was supplied to draw consequences from.');
    }
    if (!Array.isArray(chosenCharacterIds) || chosenCharacterIds.length === 0) {
      throw AppError.badRequest('No characters were supplied for consequences.');
    }

    const display = await withEstate(estateName, async (estate) => {
      const prompt = await compileConsequencesPrompt({ estate, story, chosenCharacterIds });
      const response = await callEstateLLM(estate, prompt, { temperature: 0.7 });

      const parsed = parseLlmJson<ConsequencesResult>(response, 'consequences');

      if (!Array.isArray(parsed.characters)) {
        throw AppError.llmBadContent('consequences', ['response has no "characters" array'], parsed);
      }

      // Every problem at once, named — rather than "failed validation rules".
      const problems = checkConsequences(parsed, estate.characters);
      if (problems.length > 0) {
        throw AppError.llmBadContent('consequences', problems, parsed);
      }

      // Not a failure: fields the schema offers but nothing applies yet.
      reportUnhandledConsequences(parsed, 'consequences');

      // structuredClone inside here is what keeps `parsed` unmutated — the old
      // formatConsequences() shallow copy was redundant with it.
      const consequences = ensureAllCharactersHaveConsequences(parsed, chosenCharacterIds);

      console.log('Consequences');
      console.log(JSON.stringify(consequences, null, 2));
      console.log('');

      applyConsequences(estate, consequences);
      return prepareConsequenceDisplay(consequences);
    });

    res.json({ success: true, display });
  })
);

export default router;