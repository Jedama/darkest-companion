// server/routes/planningRoute.ts
import { Router, Request, Response } from 'express';
import { requireEstate } from '../fileOps.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../errors.js';
import { callEstateLLM } from '../services/llm/estateLlm.js';
import {
  compileDeliberationPrompt,
  getPlanningAttendees,
  parseDialogue,
} from '../services/planning/planningService.js';

const router = Router();

/**
 * POST /estates/:estateName/planning/deliberate
 *
 * Phase one of the planning cycle. The leadership and council meet at the start
 * of the month, review what has happened, and argue over who is fit to march
 * and with whom. Returns plain dialogue for the frontend to play.
 *
 * Read-only: nothing is persisted. Constraints and team assignments come later.
 */
router.post(
  '/estates/:estateName/planning/deliberate',
  asyncHandler(async (req: Request<{ estateName: string }>, res: Response) => {
    const { estateName } = req.params;
    const estate = await requireEstate(estateName);

    const attendees = getPlanningAttendees(estate);
    if (attendees.length < 2) {
      // Not a malformed request — the estate simply isn't in a state to hold
      // a meeting, so this is a conflict rather than a bad request.
      throw AppError.invalidState(
        `Not enough leadership present to hold a planning meeting (${attendees.length} of 2 required).`
      );
    }
    const attendeeIds = attendees.map((a) => a.character.identifier);

    const prompt = compileDeliberationPrompt(estate);

    console.log('Generating planning meeting:');
    console.log(`Month ${estate.time.month}, Day ${estate.time.day}`);
    console.log(`Attending: ${attendees.map((a) => `${a.character.name} (${a.seat})`).join(', ')}\n`);

    const response = await callEstateLLM(estate, prompt, { temperature: 0.7 });

    const lines = parseDialogue(response, attendeeIds);

    if (lines.length === 0) {
      throw AppError.llmBadContent(
        'planning deliberation',
        ['no lines could be attributed to any attendee'],
        response
      );
    }

    console.log('Planning Meeting');
    lines.forEach((line) => {
      const speaker = estate.characters[line.speaker]?.name ?? line.speaker;
      console.log(`${speaker}: ${line.text}`);
    });
    console.log('');

    res.json({
      success: true,
      attendees: attendees.map((a) => ({
        identifier: a.character.identifier,
        name: a.character.name,
        title: a.character.title,
        seat: a.seat,
      })),
      lines,
    });
  })
);

export default router;