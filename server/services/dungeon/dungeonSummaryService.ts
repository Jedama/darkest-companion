// server/services/dungeon/dungeonSummaryService.ts
import type { Estate, Character } from '../../../shared/types/types.js';

import {
  buildAllLogsSection,
  buildCharacterRosterSection,
  buildLeadershipSection,
} from '../llm/buildPromptService.js';

import StaticGameDataManager from '../../staticGameDataManager.js';

/* -------------------------------------------------------------------
 *  Helpers
 * ------------------------------------------------------------------- */

/**
 * Builds a detailed section for the bursar, who decides the pay split.
 */
function buildBursarSection(estate: Estate): string {
  const bursarId = estate.leadership.bursar;
  const bursar = estate.characters[bursarId];
  if (!bursar) return 'Bursar not found.\n';

  const lines: string[] = [];
  lines.push(`[Bursar — The Decision Maker]`);
  lines.push(`${bursar.name} (${bursar.title}), identifier: ${bursarId}`);
  lines.push(`Summary: ${bursar.summary}`);
  lines.push(`Traits: ${bursar.traits.join(', ')}`);
  lines.push(`Stats: Authority ${bursar.stats.authority}, Intelligence ${bursar.stats.intelligence}, Sociability ${bursar.stats.sociability}`);
  lines.push(`Status: Physical ${bursar.status.physical}, Mental ${bursar.status.mental} — ${bursar.status.description}`);
  lines.push('');

  // Bursar's relationships with roster members
  const roster = estate.dungeon?.roster ?? [];
  const relLines: string[] = [];
  for (const charId of roster) {
    if (charId === bursarId) continue;
    const rel = bursar.relationships[charId];
    const char = estate.characters[charId];
    if (!char) continue;

    if (rel) {
      relLines.push(`  → ${char.title} (${charId}): Affinity ${rel.affinity}, ${rel.dynamic}. ${rel.description}`);
    } else {
      relLines.push(`  → ${char.title} (${charId}): No established relationship.`);
    }
  }

  if (relLines.length) {
    lines.push(`Bursar's view of the expedition party:`);
    lines.push(...relLines);
    lines.push('');
  }

  return lines.join('\n');
}

function buildDungeonRosterSection(estate: Estate): string {
  const roster = estate.dungeon?.roster ?? [];
  const lines: string[] = [];
  lines.push(`[Expedition Roster]`);

  for (const id of roster) {
    const char = estate.characters[id];
    if (!char) continue;
    lines.push(`- ${char.title} (${id}), ${char.name}: ${char.summary}`);
    lines.push(`  Traits: ${char.traits.join(', ')}`);
    if (char.notes.length > 0) {
      lines.push(`  Notes: ${char.notes.join(', ')}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/* -------------------------------------------------------------------
 *  Main export
 * ------------------------------------------------------------------- */

export function compileDungeonSummaryPrompt(estate: Estate, totalLoot: number): string {
  const gameData = StaticGameDataManager.getInstance();

  const instructions = gameData.getPrompt('dungeonsummary.instructions');
  const format = gameData.getPrompt('dungeonsummary.format');
  const examples = gameData.getPrompt('dungeonsummary.examples');

  const prompt = `
    ${instructions}

    [Total Loot]
    ${totalLoot} gold to distribute.

    ${buildBursarSection(estate)}

    ${buildDungeonRosterSection(estate)}

    ${buildLeadershipSection(estate)}

    [Period Logs]
    ${buildAllLogsSection(estate)}

    ${format}
    ${examples}
  `.trim();

  return prompt;
}