// server/services/llm/llmMode.ts
//
// Decides whether a request's LLM calls are real, stubbed, or deliberately
// broken — and carries that decision down to callEstateLLM without threading
// `req` through every route and service.
//
// AsyncLocalStorage is what makes that possible: the middleware opens a store
// for the request, and every async continuation started inside it — including
// code four awaits deep — can read the same store back. A plain module-level
// variable would NOT work here, because two overlapping requests would
// overwrite each other's mode mid-flight.

// Example usage: LLM_MODE=stub LLM_DELAY_MS=8000 npm run dev

import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';

export type LlmMode =
  /** Real provider calls. The default. */
  | 'live'
  /** Canned responses. No tokens spent, whole pipeline still exercised. */
  | 'stub'
  /** Every call throws as if the provider were down — exercises 502 paths. */
  | 'fail'
  /** Returns unparseable text — exercises the llm_bad_json path. */
  | 'garbage';

const MODES: LlmMode[] = ['live', 'stub', 'fail', 'garbage'];

export interface RequestLlmContext {
  mode: LlmMode;
  /** Artificial latency for stub/garbage, so the queue and spinners are testable. */
  delayMs: number;
  /** Request path, used to infer which fixture a call wants. */
  path: string;
  /** Parsed body, used to pull character ids into fixtures. */
  body: any;
  /** How many LLM calls this request has already made. */
  callCount: number;
}

const storage = new AsyncLocalStorage<RequestLlmContext>();

function parseMode(value: unknown): LlmMode | undefined {
  const text = String(value ?? '').trim().toLowerCase();
  return (MODES as string[]).includes(text) ? (text as LlmMode) : undefined;
}

/** Server-wide default, from the environment. */
export const DEFAULT_LLM_MODE: LlmMode = parseMode(process.env.LLM_MODE) ?? 'live';
const DEFAULT_DELAY_MS = Number(process.env.LLM_DELAY_MS) || 0;

/**
 * Opens the per-request store. Mount before the routers.
 *
 * A request may override the server default with headers, which is what lets a
 * debug panel flip modes per click without restarting anything:
 *
 *   X-LLM-Mode: stub          live | stub | fail | garbage
 *   X-LLM-Delay: 2500         milliseconds, stub/garbage only
 */
export const llmModeMiddleware: RequestHandler = (req, _res, next) => {
  const headerDelay = Number(req.get('x-llm-delay'));

  const context: RequestLlmContext = {
    mode: parseMode(req.get('x-llm-mode')) ?? DEFAULT_LLM_MODE,
    delayMs: Number.isFinite(headerDelay) && headerDelay > 0 ? headerDelay : DEFAULT_DELAY_MS,
    path: req.path,
    body: req.body,
    callCount: 0,
  };

  storage.run(context, next);
};

export function currentLlmContext(): RequestLlmContext | undefined {
  return storage.getStore();
}