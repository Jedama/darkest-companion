// server/services/game/followUpService.ts
// File order:
// Imports → Constants → Public API (ingestion / month-end / selection) → Internals (roll / pick / validity) → Utilities

import type { Estate, FollowUpEvent, FollowUpQueue } from '../../../shared/types/types.js';

/* -------------------------------------------------------------------
 *  Constants (tune here)
 * ------------------------------------------------------------------- */

// Month-end retention: keep this many of the newest follow-ups, drop the rest.
const MONTH_END_KEEP = 5;

// Follow-up vs. random: chance = BASE_FOLLOWUP_CHANCE * STREAK_DECAY^consecutiveServed.
// e.g. 0.9, 0.45, 0.225, ...  Serving a random event resets the streak to 0.
const BASE_FOLLOWUP_CHANCE = 0.9;
const STREAK_DECAY = 0.5;

// In-queue position weighting: weight(i) = max(TAIL_FLOOR, FRONT_DECAY^i), index 0 = newest.
// FRONT_DECAY sets how sharply the freshest entries are favored. TAIL_FLOOR stops the deep
// tail from going astronomically small, so a 40-deep queue behaves like a ~10-deep one with
// a long flat tail: everything past the first several positions is similarly (small) likely.
const FRONT_DECAY = 0.7;
const TAIL_FLOOR = 0.02;

/* -------------------------------------------------------------------
 *  Public API
 * ------------------------------------------------------------------- */

/**
 * addFollowUpEvent
 * Front-inserts one newly generated follow-up so the queue stays newest-first.
 * Call once per follow-up when applying a review result to the estate.
 */
export function addFollowUpEvent(estate: Estate, event: FollowUpEvent): void {
  const queue = ensureQueue(estate);
  queue.events.unshift(event);
}

/**
 * trimFollowUpEvents
 * Month-end cleanup: keep the `keep` newest follow-ups, drop the rest.
 * Newest-first ordering means the freshest entries are the ones that survive.
 */
export function trimFollowUpEvents(estate: Estate, keep: number = MONTH_END_KEEP): void {
  const queue = estate.followUps;
  if (!queue?.events.length) return;
  queue.events = queue.events.slice(0, keep);
}

/**
 * takeFollowUpEvent
 * Decides whether the next town event should be a follow-up and, if so, returns
 * one (removing it from the queue). Returns null when a normal random event
 * should fire instead.
 *
 * - Rolls follow-up vs. random on the streak-decayed chance only.
 * - On a win, picks front-skewed and validates the chosen entry; an entry whose
 *   characters no longer exist is pruned (dropped) and the pick is retried.
 * - Maintains the consecutive-served counter: it increments only when a valid
 *   follow-up is actually returned, and resets to 0 whenever a random fires.
 */
export function takeFollowUpEvent(estate: Estate): FollowUpEvent | null {
  const queue = estate.followUps;

  if (!queue || queue.events.length === 0 || !rollForFollowUp(queue)) {
    if (queue) queue.consecutiveServed = 0;
    return null;
  }

  // Won the roll — find a valid follow-up, pruning invalid ones as we hit them.
  while (queue.events.length > 0) {
    const index = pickFrontSkewedIndex(queue.events.length);
    const [candidate] = queue.events.splice(index, 1);

    if (charactersPresent(estate, candidate)) {
      queue.consecutiveServed += 1;
      return candidate;
    }
    // Invalid: already spliced out (pruned). Loop and pick again.
  }

  // Won the roll but nothing valid remained → a random fires this turn.
  queue.consecutiveServed = 0;
  return null;
}

/* -------------------------------------------------------------------
 *  Internals: roll / pick / validity
 * ------------------------------------------------------------------- */

function rollForFollowUp(queue: FollowUpQueue): boolean {
  const chance = BASE_FOLLOWUP_CHANCE * Math.pow(STREAK_DECAY, queue.consecutiveServed);
  return Math.random() < chance;
}

/**
 * Weighted random index over [0, count), front-biased via FRONT_DECAY^i with a
 * TAIL_FLOOR. Index 0 (newest) is most likely; the deep tail stays small but flat.
 */
function pickFrontSkewedIndex(count: number): number {
  const weights: number[] = [];
  let total = 0;

  for (let i = 0; i < count; i++) {
    const w = Math.max(TAIL_FLOOR, Math.pow(FRONT_DECAY, i));
    weights.push(w);
    total += w;
  }

  let r = Math.random() * total;
  for (let i = 0; i < count; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }

  return count - 1; // float-safety fallback
}

/**
 * Town events fire only while everyone is home, so the sole validity gate is
 * existence: every referenced character must still be in the estate.
 */
function charactersPresent(estate: Estate, event: FollowUpEvent): boolean {
  return event.characters.every((id) => !!estate.characters[id]);
}

/* -------------------------------------------------------------------
 *  Internals: utilities
 * ------------------------------------------------------------------- */

function ensureQueue(estate: Estate): FollowUpQueue {
  if (!estate.followUps) {
    estate.followUps = { events: [], consecutiveServed: 0 };
  }
  return estate.followUps;
}