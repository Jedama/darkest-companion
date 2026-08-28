// server/routes/planningRoute.ts
import { Router, Request, Response } from 'express';
import { requireEstate } from '../fileOps.js';
import { withEstate } from '../estateLock.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../errors.js';
import { callEstateLLM, parseLlmJson } from '../services/llm/estateLlm.js';
import { checkConsequences, reportUnhandledConsequences } from '../services/llm/consequenceChecks.js';
import {
  preparePlanningMeeting,
  parseDialogue,
  type DialogueLine,
} from '../services/planning/planningService.js';
import { compilePlanningConsequencesPrompt } from '../services/planning/planningConsequencesService.js';
import { compilePosingPrompt, applyPoses } from '../services/planning/planningPosingService.js';
import {
  applyConsequences,
  prepareConsequenceDisplay,
  ensureAllCharactersHaveConsequences,
  type ConsequencesResult,
} from '../services/llm/llmResponseProcessor.js';

const router = Router();

/**
 * POST /estates/:estateName/planning/deliberate
 *
 * Phase one of the planning cycle. The leadership, the seated council and this
 * month's advisors meet at the start of the month, review what has happened, and
 * argue over who is fit to march and with whom. Returns plain dialogue for the
 * frontend to play.
 *
 * Read-only: nothing is persisted. Constraints and team assignments come later.
 */
router.post(
  '/estates/:estateName/planning/deliberate',
  asyncHandler(async (req: Request<{ estateName: string }>, res: Response) => {
    const { estateName } = req.params;
    const estate = await requireEstate(estateName);

    // One assembly, used for the prompt, the response payload and dialogue parsing.
    const { council, attendees, attendeeIds, prompt } = preparePlanningMeeting(estate);

    if (attendees.length < 2) {
      // Not a malformed request — the estate simply isn't in a state to hold
      // a meeting, so this is a conflict rather than a bad request.
      throw AppError.invalidState(
        `Not enough leadership present to hold a planning meeting (${attendees.length} of 2 required).`
      );
    }

    console.log('Generating planning meeting:');
    console.log(`Month ${estate.time.month}, Day ${estate.time.day}`);
    console.log(`Attending: ${attendees.map((a) => `${a.character.name} (${a.seat})`).join(', ')}`);
    if (council.margraveIsActing) console.log(`Acting Margrave: ${council.margrave}`);
    if (council.bursarIsActing) console.log(`Acting Bursar: ${council.bursar}`);
    if (council.absent.length) {
      console.log(`Chairs empty: ${council.absent.map((a) => `${a.identifier} (${a.reason})`).join(', ')}`);
    }
    console.log('');

    const response = await callEstateLLM(estate, prompt, { temperature: 0.7, label: 'planning deliberation' });

    const parsedLines = parseDialogue(response, attendeeIds);

    if (parsedLines.length === 0) {
      throw AppError.llmBadContent(
        'planning deliberation',
        ['no lines could be attributed to any attendee'],
        response
      );
    }

    // Second, cosmetic pass: tags each line with a sprite pose. Never fails the
    // request — a bad tag falls back to neutral inside applyPoses.
    const posingPrompt = compilePosingPrompt(parsedLines, attendeeIds);
    const posingResponse = await callEstateLLM(estate, posingPrompt, {
      temperature: 0.3,
      label: 'planning posing',
    });
    const lines = applyPoses(parsedLines, posingResponse);

    console.log('Planning Meeting');
    lines.forEach((line) => {
      const speaker = estate.characters[line.speaker]?.name ?? line.speaker;
      console.log(`${speaker} [${line.pose}]: ${line.text}`);
    });
    console.log('');

    res.json({
      success: true,
      leadership: {
        margrave: council.margrave,
        bursar: council.bursar,
        margraveIsActing: council.margraveIsActing,
        bursarIsActing: council.bursarIsActing,
        absent: council.absent,
      },
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

interface PlanningConsequencesRequest {
  lines: DialogueLine[];
  attendeeIds: string[];
}

/**
 * POST /estates/:estateName/planning/consequences
 *
 * Phase two of the planning cycle. Turns the finished deliberation into state
 * changes — the same consequence schema/engine as story and recruit events,
 * with planning-specific instructions — and applies them, including any
 * party intents (see PartyIntent, shared/types/types.ts) declared for next
 * month's expedition.
 */
router.post(
  '/estates/:estateName/planning/consequences',
  asyncHandler(async (req: Request<{ estateName: string }, {}, PlanningConsequencesRequest>, res: Response) => {
    const { estateName } = req.params;
    const { lines, attendeeIds } = req.body ?? {};

    if (!Array.isArray(lines) || lines.length === 0) {
      throw AppError.badRequest('No dialogue was supplied to draw consequences from.');
    }
    if (!Array.isArray(attendeeIds) || attendeeIds.length === 0) {
      throw AppError.badRequest('No attendees were supplied for consequences.');
    }

    const display = await withEstate(estateName, async (estate) => {
      const prompt = await compilePlanningConsequencesPrompt({ estate, lines, attendeeIds });
      const response = await callEstateLLM(estate, prompt, { temperature: 0.7 });

      const parsed = parseLlmJson<ConsequencesResult>(response, 'planning consequences');

      if (!Array.isArray(parsed.characters)) {
        throw AppError.llmBadContent('planning consequences', ['response has no "characters" array'], parsed);
      }

      const problems = checkConsequences(parsed, estate.characters);
      if (problems.length > 0) {
        throw AppError.llmBadContent('planning consequences', problems, parsed);
      }

      reportUnhandledConsequences(parsed, 'planning consequences');

      const consequences = ensureAllCharactersHaveConsequences(parsed, attendeeIds);

      console.log('Planning Consequences');
      console.log(JSON.stringify(consequences, null, 2));
      console.log('');

      applyConsequences(estate, consequences);

      return prepareConsequenceDisplay(consequences);
    });

    res.json({ success: true, display });
  })
);

export default router;