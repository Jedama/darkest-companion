// server/routes/recruitEventRoute.ts
import { Router, Request, Response } from 'express';
import { withEstate } from '../estateLock.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../errors.js';
import { callEstateLLM, parseLlmJson } from '../services/llm/estateLlm.js';
import { checkConsequences, reportUnhandledConsequences } from '../services/llm/consequenceChecks.js';
import { setupEvent } from '../services/story/setupEventService.js';
import { addCharacterToEstate } from '../services/game/estateService.js';
import {
  compileRecruitPrompt,
  compileRecruitConsequencesPrompt,
} from '../services/recruit/recruitEventService.js';
import {
  applyConsequences,
  separateStoryTitle,
  ensureAllCharactersHaveConsequences,
  type ConsequencesResult,
} from '../services/llm/llmResponseProcessor.js';

import type { Character } from '../../shared/types/types.js';

const router = Router();

interface RecruitRequest {
  eventId: string;
  characterId: string;
  name: string;
  context?: string;
}

/**
 * POST /estates/:estateName/events/recruit
 *
 * Adds a character to the estate and narrates their arrival, then applies the
 * consequences of that arrival. Two chained LLM calls, so this holds the estate
 * lock longer than anything else — expect the slow-hold warning on a bad day.
 *
 * The estate is only written once both calls succeed, so a failure anywhere
 * leaves the roster untouched.
 */
router.post(
  '/estates/:estateName/events/recruit',
  asyncHandler(async (req: Request<{ estateName: string }, {}, RecruitRequest>, res: Response) => {
    const { estateName } = req.params;
    const { eventId, characterId, name, context } = req.body ?? {};

    if (!characterId) throw AppError.badRequest('No character class was chosen.');
    if (!name?.trim()) throw AppError.badRequest('The recruit needs a name.');

    const story = await withEstate(estateName, async (estate) => {
      // The modal filters out classes already on the roster, but the route
      // shouldn't take its word for it — adding twice would overwrite the
      // existing character, name, logs and all.
      const existing = estate.characters[characterId];
      if (existing) {
        throw AppError.invalidState(
          `${existing.name} already serves this estate as ${characterId}.`
        );
      }

      // Fold the result back onto the locked reference rather than reassigning,
      // so it works whether addCharacterToEstate mutates or returns a copy.
      Object.assign(estate, addCharacterToEstate(estate, characterId));

      // The guard above narrowed estate.characters[characterId] to `never`, and
      // TS doesn't undo that for a mutation made through Object.assign. The
      // annotation restates what is true after the call.
      const recruit: Character = estate.characters[characterId];
      if (!recruit) {
        throw new AppError(
          `addCharacterToEstate produced no character for '${characterId}'.`,
          500,
          'internal'
        );
      }
      recruit.name = name.trim();

      const setupResult = await setupEvent(estate, {
        eventId,
        characterIds: [characterId],
      });

      console.log('Generating story:');
      console.log(`${setupResult.event.title} (${setupResult.event.identifier})`);
      console.log(`Keywords: ${setupResult.keywords?.join(', ') || 'none'}`);
      console.log(`Recruiting: ${name} (${characterId})`);
      console.log(`Modifiers: ${context || 'none'}\n`);

      const recruitPrompt = await compileRecruitPrompt(
        estate,
        setupResult.event,
        setupResult.chosenCharacterIds,
        setupResult.locations,
        setupResult.bystanders,
        setupResult.keywords,
        context ?? ''
      );

      // Two LLM calls share this request's path, so the label can't be inferred.
      const recruitResponse = await callEstateLLM(estate, recruitPrompt, {
        temperature: 0.7,
        label: 'recruit story',
      });
      const { title, body } = separateStoryTitle(recruitResponse);

      if (!body.trim()) {
        throw AppError.llmBadContent(
          'recruit story',
          ['the response contained no story text'],
          recruitResponse
        );
      }

      console.log('Story:');
      console.log(`[${title}]`);
      console.log(`${body}\n`);

      const consequencesPrompt = await compileRecruitConsequencesPrompt({
        estate,
        story: body,
        chosenCharacterIds: setupResult.chosenCharacterIds,
        keywords: setupResult.keywords,
      });

      const consequencesResponse = await callEstateLLM(estate, consequencesPrompt, {
        temperature: 0.7,
        label: 'recruit consequences',
      });
      const parsed = parseLlmJson<ConsequencesResult>(consequencesResponse, 'recruit consequences');

      if (!Array.isArray(parsed.characters)) {
        throw AppError.llmBadContent(
          'recruit consequences',
          ['response has no "characters" array'],
          parsed
        );
      }

      const problems = checkConsequences(parsed, estate.characters);
      if (problems.length > 0) {
        throw AppError.llmBadContent('recruit consequences', problems, parsed);
      }

      reportUnhandledConsequences(parsed, 'recruit consequences');

      // structuredClone inside here is what keeps `parsed` unmutated — the old
      // formatConsequences() shallow copy was redundant with it.
      const consequences = ensureAllCharactersHaveConsequences(
        parsed,
        setupResult.chosenCharacterIds
      );

      console.log('Consequences');
      console.log(JSON.stringify(consequences, null, 2));
      console.log('');

      applyConsequences(estate, consequences);
      return { title, body };
    });

    res.json({ success: true, story });
  })
);

export default router;