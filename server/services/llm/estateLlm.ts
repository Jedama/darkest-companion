// server/services/llm/estateLlm.ts
//
// The two things every LLM route was reimplementing: assembling a request from
// estate preferences, and dragging JSON out of a fenced response.

import { callLLM } from './llmService.js';
import { AppError } from '../../errors.js';
import { currentLlmContext } from './llmMode.js';
import { inferLabel, stubResponse, garbageResponse } from './llmStub.js';

import type { Estate } from '../../../shared/types/types.js';
import type { AnthropicEffort } from './llmService.js';
import type { LlmLabel } from './llmStub.js';

interface EstateLLMOptions {
  /** Ignored by Anthropic's adaptive-thinking models. See callAnthropic. */
  temperature?: number;
  system?: string;
  effort?: AnthropicEffort;
  /**
   * Which kind of call this is, used to pick a debug fixture. Inferred from the
   * request path when omitted — only routes that make more than one call per
   * request need to say (recruit makes two).
   */
  label?: LlmLabel;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a prompt using the estate's configured provider, model and token budget.
 *
 * Provider failures — auth, rate limits, outages, missing API keys — come back
 * as a 502 rather than a 500, so the client can tell "try again" apart from
 * "this is broken".
 */
export async function callEstateLLM(
  estate: Estate,
  prompt: string,
  options: EstateLLMOptions = {}
): Promise<string> {
  const context = currentLlmContext();
  const mode = context?.mode ?? 'live';
  const label = options.label ?? inferLabel(context?.path);

  if (context) context.callCount += 1;

  if (mode !== 'live') {
    console.log(`[llm:${mode}] ${label} (call ${context?.callCount ?? 1}) — no tokens spent`);

    if (context?.delayMs) await sleep(context.delayMs);

    if (mode === 'fail') {
      throw AppError.llmUnavailable(`LLM_MODE=fail — simulated provider outage for "${label}".`);
    }
    if (mode === 'garbage') {
      return garbageResponse(label);
    }
    return stubResponse(label, estate, context?.body);
  }

  const { label: _label, ...providerOptions } = options;

  try {
    return await callLLM({
      provider: estate.preferences?.llmProvider ?? 'anthropic',
      model: estate.preferences?.llmModel,
      maxTokens: estate.preferences?.maxTokens,
      prompt,
      ...providerOptions,
    });
  } catch (error) {
    throw AppError.llmUnavailable(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Strips markdown fences from a model response.
 *
 * The old inline version was `.replace(/^```(json)?\n/, '').replace(/```/, '')`,
 * which only worked when the opening fence was followed immediately by a
 * newline. Anything else — a leading space, a preamble sentence, \r\n — left the
 * closing fence in place and the parse blew up. This matches the whole fenced
 * block instead, and falls back to the widest brace/bracket span if that fails.
 */
function extractJsonText(raw: string): string {
  const trimmed = raw.trim();

  const fenced = trimmed.match(/```[a-zA-Z]*\s*\r?\n([\s\S]*?)\r?\n?```/);
  if (fenced) return fenced[1].trim();

  // No fence, but possibly a sentence of preamble around the object.
  const firstBrace = trimmed.search(/[[{]/);
  const lastBrace = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

/**
 * Parses a model's JSON response.
 *
 * `label` names the call for the error message — 'consequences', 'review',
 * 'dungeon summary'. On failure the raw text goes into the error's details, so
 * the response that broke is visible in the client instead of only the console.
 */
export function parseLlmJson<T>(raw: string, label: string): T {
  const text = extractJsonText(raw)
    // Models like to write "+6" for a positive delta. Legal English, illegal
    // JSON. Only touch it directly after a colon, where a value belongs.
    .replace(/:\s*\+(\d)/g, ': $1');

  try {
    return JSON.parse(text) as T;
  } catch {
    throw AppError.llmBadJson(label, raw);
  }
}

/**
 * Asserts that a parsed response has the fields the route depends on.
 * Reports every missing field at once rather than only the first.
 */
export function requireFields<T extends object>(
  parsed: T,
  label: string,
  fields: Array<keyof T>
): void {
  const missing = fields.filter((field) => parsed[field] === undefined);
  if (missing.length > 0) {
    throw AppError.llmBadContent(
      label,
      missing.map((field) => `missing required field "${String(field)}"`),
      parsed
    );
  }
}