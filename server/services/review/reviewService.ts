// server/services/review/reviewService.ts
import type { Estate } from '../../../shared/types/types.js';

import {
  buildCharacterRosterSection,
  buildNarrativesSection,
  buildAllLogsSection,
  buildLocationSummarySection,
} from '../llm/buildPromptService.js';

import StaticGameDataManager from '../../staticGameDataManager.js';

/* -------------------------------------------------------------------
 *  Main export
 * ------------------------------------------------------------------- */

/**
 * compileReviewPrompt
 * Builds the full prompt for the narrative review LLM call.
 */
export function compileReviewPrompt(estate: Estate): string {
  const gameData = StaticGameDataManager.getInstance();

  const instructions = gameData.getPrompt('review.instructions');
  const format = gameData.getPrompt('review.format');
  const examples = gameData.getPrompt('review.examples');

  const prompt = `
    ${instructions}

    [Character Roster]
    ${buildCharacterRosterSection(estate)}

    [Active Narratives]
    ${buildNarrativesSection(estate)}

    [Logs]
    ${buildAllLogsSection(estate)}

    [Locations]
    ${buildLocationSummarySection()}

    ${format}
    ${examples}
  `.trim();

  return prompt;
}