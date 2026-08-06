// server/services/review/reviewService.ts
import { addFollowUpEvent } from '../game/followUpService.js';
import { purgeLogs, addEstateLog } from '../game/logService.js';
import type { Estate } from '../../../shared/types/types.js';

import {
  buildAllLogsSection,
  buildCharacterRosterSection,
  buildContentPreferencesSection,
  buildLeadershipSection,
  buildLocationSummarySection,
  buildNarrativesSection,
} from '../llm/buildPromptService.js';

import StaticGameDataManager from '../../staticGameDataManager.js';
import { buildPoliticalLandscapeSection } from '../politics/politicalLandscape.js';
import { getAllLocationLabels } from '../game/locationService.js';
import { updateMonth } from '../game/estateService.js';

interface ReviewResult {
  estate_log: { entry: string; timeframe: 'short_term' | 'mid_term' | 'long_term' };
  narratives: string[];
  follow_up_events?: Array<{ title: string; description: string; characters: string[]; location: string }>;
}

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

    [Leadership]
    ${buildLeadershipSection(estate)}

    [Political Landscape]
    ${buildPoliticalLandscapeSection(estate, getAllLocationLabels())}

    [Active Narratives]
    ${buildNarrativesSection(estate)}

    [Logs]
    ${buildAllLogsSection(estate)}

    [Locations]
    ${buildLocationSummarySection()}

    [Content Preferences]
    ${buildContentPreferencesSection(estate.preferences)}

    ${format}
    ${examples}
  `.trim();

  return prompt;
}

/**
 * applyReview
 * Applies a parsed narrative review to the estate in place: replaces the active
 * narratives (the review's array is the COMPLETE set), appends the period's estate
 * log, queues follow-ups newest-first, and purges expired logs. Caller persists.
 */
export function applyReview(estate: Estate, result: ReviewResult): void {
  estate.narratives = result.narratives;

  for (const followUp of result.follow_up_events ?? []) {
    addFollowUpEvent(estate, followUp);
  }

  updateMonth(estate);
  purgeLogs(estate);

  addEstateLog(estate, result.estate_log.entry, result.estate_log.timeframe);
}