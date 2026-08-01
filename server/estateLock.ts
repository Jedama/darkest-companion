// server/estateLock.ts
//
// Serialises the load → mutate → save window for a single estate.
//
// Why this is needed even though Node is single-threaded: every `await` yields
// the event loop. A route that loads an estate, awaits a 60-second LLM call and
// then saves has a 60-second window in which another request can load the same
// file, finish first, and be silently erased when the slower one writes its
// whole in-memory copy back over the top.
//
// The lock is per estate name, so unrelated estates never wait on each other.
// Read-only routes (story, planning, static data) take no lock at all.

import { requireEstate, saveEstate } from './fileOps.js';
import { AppError } from './errors.js';
import type { Estate } from '../shared/types/types.js';

/**
 * How long a request will queue before giving up. Comfortably longer than the
 * slowest legitimate holder (recruit: two chained LLM calls), so hitting this
 * means something is genuinely stuck rather than merely slow.
 */
const DEFAULT_WAIT_MS = 5 * 60_000;

/** Held longer than this and we say so — a hung provider call shows up here. */
const SLOW_HOLD_MS = 90_000;

type Release = () => void;

/**
 * One promise chain per estate. Each acquirer appends a link and waits on the
 * previous one; releasing resolves its own link, admitting the next in line.
 * Links only ever resolve, never reject, so one failure can't poison the queue.
 */
const chains = new Map<string, Promise<void>>();

async function acquire(estateName: string, waitMs: number): Promise<Release> {
  const previous = chains.get(estateName) ?? Promise.resolve();

  let releaseSelf!: () => void;
  const self = new Promise<void>((resolve) => {
    releaseSelf = resolve;
  });

  const chain = previous.then(() => self);
  chains.set(estateName, chain);

  const release: Release = () => {
    releaseSelf();
    // Drop the map entry once the queue behind us has drained, so idle estates
    // don't accumulate. If someone queued after us, `chain` is no longer the
    // tail and we leave it alone.
    void chain.then(() => {
      if (chains.get(estateName) === chain) chains.delete(estateName);
    });
  };

  const waitedFrom = Date.now();
  let timer: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      previous,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(AppError.estateBusy(estateName, Date.now() - waitedFrom)),
          waitMs
        );
      }),
    ]);
  } catch (error) {
    // We already appended ourselves to the chain, so we must release even
    // though we never really held the lock — otherwise the estate wedges.
    release();
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }

  return release;
}

/**
 * Runs `mutate` with exclusive access to an estate: loads it, hands it over,
 * and saves it once the callback resolves.
 *
 * The estate is only written on success — throw anywhere inside and the file
 * on disk is untouched. Whatever the callback returns becomes the return value,
 * so routes can build their response body inside the lock:
 *
 *   const display = await withEstate(estateName, async (estate) => {
 *     ...
 *     applyConsequences(estate, consequences);
 *     return prepareConsequenceDisplay(consequences);
 *   });
 *
 * Mutate the object you are given. Do not reassign it — the reference passed in
 * is the one that gets saved. If a service returns a fresh estate rather than
 * mutating in place, fold it back with Object.assign(estate, returned).
 */
export async function withEstate<T>(
  estateName: string,
  mutate: (estate: Estate) => Promise<T> | T,
  options: { waitMs?: number } = {}
): Promise<T> {
  const release = await acquire(estateName, options.waitMs ?? DEFAULT_WAIT_MS);
  const heldFrom = Date.now();

  try {
    const estate = await requireEstate(estateName);
    const result = await mutate(estate);
    await saveEstate(estate);
    return result;
  } finally {
    const heldMs = Date.now() - heldFrom;
    if (heldMs > SLOW_HOLD_MS) {
      console.warn(`Estate '${estateName}' write lock held for ${Math.round(heldMs / 1000)}s.`);
    }
    release();
  }
}

/** Diagnostics — how many estates currently have a queue. */
export function activeEstateLocks(): string[] {
  return [...chains.keys()];
}