// server/services/planning/planningPosingService.ts
// File order:
// Imports → constants → compilePosingPrompt → applyPoses

import StaticGameDataManager from '../../staticGameDataManager.js';
import { parseLlmJson } from '../llm/estateLlm.js';
import type { DialogueLine } from './planningService.js';

/** Every character has these. Unique poses (see getPosesForCharacter) add to this set. */
export const FIXED_POSES = ['neutral', 'happy', 'sad', 'angry', 'surprised'] as const;

interface PoseTag {
  index: number;
  pose: string;
}

/**
 * compilePosingPrompt
 * Builds a prompt asking the LLM to tag each line of a finished dialogue
 * transcript with a sprite pose. Lines are numbered rather than re-sent for
 * the model to echo back — same reasoning as parseDialogue's identifier
 * matching: trusting the model to reproduce text verbatim is a silent-failure
 * trap, an index into what it already received is not.
 */
export function compilePosingPrompt(lines: DialogueLine[], attendeeIds: string[]): string {
  const gameData = StaticGameDataManager.getInstance();
  const posingInstructions = gameData.getPrompt('planning.posing.instructions');

  const transcript = lines
    .map((line, index) => `${index}. ${line.speaker}: ${line.text}`)
    .join('\n');

  let posesSection = '';
  for (const id of attendeeIds) {
    const unique = gameData.getPosesForCharacter(id);
    posesSection += `\n[Poses for ${id}]\n${FIXED_POSES.join(', ')}`;
    for (const [poseId, description] of Object.entries(unique)) {
      posesSection += `\n${poseId}: ${description}`;
    }
    posesSection += '\n';
  }

  return `
    ${posingInstructions}

    [Transcript]
    ${transcript}
    ${posesSection}
  `.trim();
}

/**
 * applyPoses
 * Merges tagged poses back onto lines by index. Deliberately never throws:
 * a bad pose, a missing tag, an unparseable response, an out-of-range index —
 * all of it just falls back to "neutral" per-line rather than failing the
 * whole request. A wrong sprite is cosmetic; losing an otherwise-good scene
 * over it would not be a reasonable trade. (Retrying the posing call instead
 * of falling back is a known future improvement — see TODO.txt.)
 */
export function applyPoses(lines: DialogueLine[], raw: string): DialogueLine[] {
  const gameData = StaticGameDataManager.getInstance();
  const tagged: DialogueLine[] = lines.map((line) => ({ ...line, pose: 'neutral' }));

  let tags: PoseTag[];
  try {
    tags = parseLlmJson<PoseTag[]>(raw, 'planning posing');
  } catch {
    console.warn('[Planning] Posing response could not be parsed; every line defaults to neutral.');
    return tagged;
  }

  if (!Array.isArray(tags)) {
    console.warn('[Planning] Posing response was not an array; every line defaults to neutral.');
    return tagged;
  }

  for (const tag of tags) {
    const index = tag?.index;
    if (typeof index !== 'number' || !tagged[index]) {
      console.warn(`[Planning] Posing tag has no matching line: ${JSON.stringify(tag)}`);
      continue;
    }

    const speaker = tagged[index].speaker;
    const validPoses = new Set<string>([
      ...FIXED_POSES,
      ...Object.keys(gameData.getPosesForCharacter(speaker)),
    ]);

    if (typeof tag.pose === 'string' && validPoses.has(tag.pose)) {
      tagged[index].pose = tag.pose;
    } else {
      console.warn(`[Planning] '${speaker}' has no pose '${tag?.pose}'; line ${index} defaults to neutral.`);
    }
  }

  return tagged;
}
