// server/routes/planningRoute.ts
import { Router, Request, Response } from 'express';
import { loadEstate } from '../fileOps.js';
import { callLLM } from '../services/llm/llmService.js';
import {
  compileDeliberationPrompt,
  getPlanningAttendees,
  parseDialogue,
} from '../services/planning/planningService.js';

import type { Estate } from '../../shared/types/types.js';
import type { LLMRequest } from '../services/llm/llmService.js';

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
router.post('/estates/:estateName/planning/deliberate', async (req: Request, res: Response) => {
  try {
    const { estateName } = req.params;

    // 1. Load the estate
    const estate: Estate | undefined = await loadEstate(estateName);
    if (!estate) {
      return res.status(404).json({ error: `Estate '${estateName}' not found` });
    }

    // 2. Determine attendance
    const attendees = getPlanningAttendees(estate);
    if (attendees.length < 2) {
      return res.status(400).json({ error: 'Not enough leadership present to hold a planning meeting.' });
    }
    const attendeeIds = attendees.map(a => a.character.identifier);

    // 3. Compile the prompt
    const deliberationPrompt = compileDeliberationPrompt(estate);

    console.log(`Generating planning meeting:`);
    console.log(`Month ${estate.time.month}, Day ${estate.time.day}`);
    console.log(`Attending: ${attendees.map(a => `${a.character.name} (${a.seat})`).join(', ')}\n`);

    // 4. Call LLM
    const provider = estate.preferences?.llmProvider ?? 'anthropic';
    const model = estate.preferences?.llmModel;

    const deliberationRequest: LLMRequest = {
      provider,
      model,
      prompt: deliberationPrompt,
      maxTokens: estate.preferences?.maxTokens,
      temperature: 0.7,
    };

    const response = await callLLM(deliberationRequest);

    // 5. Parse the dialogue
    const lines = parseDialogue(response, attendeeIds);

    if (lines.length === 0) {
      console.error('Raw response:\n' + response);
      throw new Error('Deliberation produced no usable dialogue lines');
    }

    console.log(`Planning Meeting`);
    lines.forEach(line => {
      const speaker = estate.characters[line.speaker]?.name ?? line.speaker;
      console.log(`${speaker}: ${line.text}`);
    });
    console.log('');

    return res.json({
      success: true,
      attendees: attendees.map(a => ({
        identifier: a.character.identifier,
        name: a.character.name,
        title: a.character.title,
        seat: a.seat,
      })),
      lines,
    });

  } catch (error: any) {
    console.error('Error in planning deliberation route:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;