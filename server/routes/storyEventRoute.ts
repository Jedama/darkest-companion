// server/routes/storyEventRoute.ts
import { Router, Request, Response } from 'express';
import { compileStoryPrompt } from '../services/story/storyEventService.js';
import { separateStoryTitle } from '../services/llm/llmResponseProcessor.js';
import { requireEstate } from '../fileOps.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../errors.js';
import { callEstateLLM } from '../services/llm/estateLlm.js';

import type { EventData, LocationData, Bystander } from '../../shared/types/types.js';

const router = Router();

interface StoryRequest {
  event: EventData;
  chosenCharacterIds: string[];
  locations: LocationData[];
  npcIds: string[];
  enemyIds: string[];
  bystanders: Bystander[];
  keywords: string[];
  context?: string;
  description?: string | null;
}

/**
 * POST /estates/:estateName/events/story
 * Takes a resolved setup (event, cast, scenery) and narrates it.
 * Read-only: the story is persisted later, by the consequences route.
 */
router.post(
  '/estates/:estateName/events/story',
  asyncHandler(async (req: Request<{ estateName: string }, {}, StoryRequest>, res: Response) => {
    const { estateName } = req.params;
    const {
      event,
      chosenCharacterIds,
      locations,
      npcIds,
      enemyIds,
      bystanders,
      keywords,
      context,
      description,
    } = req.body ?? {};

    if (!event) {
      throw AppError.badRequest('No event was supplied to narrate. Run /events/setup first.');
    }
    if (!chosenCharacterIds?.length) {
      throw AppError.badRequest('No characters were supplied for the story.');
    }

    const estate = await requireEstate(estateName);

    const prompt = await compileStoryPrompt(
      estate,
      event,
      chosenCharacterIds,
      locations,
      npcIds,
      enemyIds,
      bystanders,
      keywords,
      // Both are optional over the wire but the prompt compiler wants strings.
      // Empty string is falsy, so `if (description)` inside it behaves exactly
      // as it did when these arrived as undefined/null.
      context ?? '',
      description ?? ''
    );

    console.log('Generating story:');
    console.log(`${event.title} (${event.identifier})`);
    console.log(`Keywords: ${keywords?.join(', ') || 'none'}\n`);

    console.log('Prompt:');
    console.log(prompt);
    console.log('');

    const response = await callEstateLLM(estate, prompt, { temperature: 1.0 });

    const { title, body } = separateStoryTitle(response);

    if (!body.trim()) {
      throw AppError.llmBadContent('story', ['the response contained no story text'], response);
    }

    console.log('Story:');
    console.log(`[${title}]`);
    console.log(`${body}\n`);

    res.json({
      success: true,
      story: { title, body },
    });
  })
);

export default router;