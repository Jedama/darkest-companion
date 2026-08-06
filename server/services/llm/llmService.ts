// server/services/llmService.ts
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

import type { LlmProvider } from "../../../shared/types/types.js";

/**
 * Effort levels supported by Claude Opus 4.8 / 4.7 (adaptive thinking models).
 * Higher effort => deeper reasoning, more tokens, more latency.
 * Anthropic's default is "high".
 */
export type AnthropicEffort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Configuration for the LLM request.
 */
export interface LLMRequest {
  provider: LlmProvider;

  prompt: string;

  model?: string;       // provider-specific model id
  maxTokens?: number;   // maximum tokens in the response
  temperature?: number; // controls randomness (NOTE: ignored for Anthropic Opus 4.8 — see callAnthropic)
  system?: string;      // optional system prompt / instruction

  /**
   * Anthropic-only. Controls reasoning depth on adaptive-thinking models
   * (Opus 4.8 / 4.7). Defaults to "high". Other providers ignore this.
   */
  effort?: AnthropicEffort;

  /** Overall wall-clock budget for this call. Defaults to LLM_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * Centralized defaults so routes don't hardcode model IDs.
 * You can tweak these later without touching endpoints.
 */
const DEFAULT_MODEL: Record<LlmProvider, string> = {
  openai: "gpt-5.5",
  xai: "grok-4.20-0309-reasoning",
  anthropic: "claude-fable-5",
  google: "gemini-3.1-pro-preview",
};

/* -------------------------------------------------------------------
 *  Timeouts
 *
 *  A call with no deadline is worse here than elsewhere: routes run inside the
 *  estate write lock, so one hung connection wedges that estate until the
 *  process restarts. The budget below is deliberately under the client's
 *  five-minute limit, so the server fails first with a clean 504 rather than
 *  the browser giving up on a request the server still thinks is alive.
 * ------------------------------------------------------------------- */

export const DEFAULT_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 180_000;

/** Retries multiply wall time, so keep the count low and let the budget rule. */
const MAX_RETRIES = 1;

export class LlmTimeoutError extends Error {
  constructor(readonly provider: LlmProvider, readonly timeoutMs: number) {
    super(`The ${provider} request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "LlmTimeoutError";
  }
}

/**
 * Enforces the overall budget.
 *
 * The AbortSignal is what actually stops the work; this race is the backstop
 * for an SDK that ignores it, so a hung call can never outlive the budget and
 * hold the lock. Note that if the race wins, the underlying request may still
 * be settling in the background — it is abandoned, not awaited.
 */
async function withDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  provider: LlmProvider,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new LlmTimeoutError(provider, timeoutMs)), timeoutMs)
      ),
    ]);
  } catch (error) {
    // An SDK that honours the signal reports its own abort; report ours instead,
    // so callers see one consistent error however the deadline was enforced.
    if (controller.signal.aborted) throw new LlmTimeoutError(provider, timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing environment variable: ${name}`);
  return val;
}

/* -------------------------------------------------------------------
 *  Clients
 *
 *  Built once on first use rather than per call: constructing a client per
 *  request threw away connection pooling. Lazy so that a missing key only
 *  matters for the provider you actually use.
 * ------------------------------------------------------------------- */

let anthropicClient: Anthropic | undefined;
let openaiClient: OpenAI | undefined;
let xaiClient: OpenAI | undefined;
let googleClient: GoogleGenAI | undefined;

function getAnthropic(): Anthropic {
  anthropicClient ??= new Anthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    maxRetries: MAX_RETRIES,
  });
  return anthropicClient;
}

function getOpenAI(): OpenAI {
  openaiClient ??= new OpenAI({
    apiKey: requireEnv("OPENAI_API_KEY"),
    maxRetries: MAX_RETRIES,
  });
  return openaiClient;
}

function getXai(): OpenAI {
  xaiClient ??= new OpenAI({
    apiKey: requireEnv("XAI_API_KEY"),
    baseURL: "https://api.x.ai/v1",
    maxRetries: MAX_RETRIES,
  });
  return xaiClient;
}

function getGoogle(): GoogleGenAI {
  googleClient ??= new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  return googleClient;
}

/**
 * Single entry point: callLLM routes the call to the correct provider adapter.
 * Every path is bounded by the request's timeout budget.
 */
export async function callLLM(req: LLMRequest): Promise<string> {
  switch (req.provider) {
    case "anthropic":
      return callAnthropic(req);
    case "xai":
      return callXai(req);
    case "google":
      return callGoogle(req);
    case "openai":
      return callOpenAI(req);
    default: {
      const _exhaustive: never = req.provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}

/**
 * Anthropic (Claude) via Messages API.
 *
 * Opus 4.8 uses ADAPTIVE thinking — you can't force a fixed thinking budget.
 * Setting thinking: { type: "enabled", budget_tokens: N } returns a 400 error
 * on Opus 4.8 / 4.7. Instead:
 *   - thinking: { type: "adaptive" } lets the model decide when/how much to think
 *   - the `effort` level (low|medium|high|xhigh|max) controls reasoning depth
 *
 * At "high" (the default) and above, the model thinks before answering on
 * essentially any non-trivial request. Use "xhigh"/"max" to push it harder.
 *
 * Note: temperature/top_p/top_k must stay at defaults on Opus 4.8 — passing a
 * non-default value returns a 400 error, so we deliberately do NOT forward it.
 *
 * `display` defaults to "omitted" on Opus 4.8 (empty thinking blocks, lower
 * latency). Since this function only returns the final text, that's fine. Set
 * display: "summarized" if you ever want to surface the reasoning summary.
 */
export async function callAnthropic({
  prompt,
  model,
  maxTokens,
  system,
  effort,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: LLMRequest): Promise<string> {
  const response = await withDeadline(
    (signal) =>
      getAnthropic().messages.create(
        {
          model: model || DEFAULT_MODEL.anthropic,
          max_tokens: maxTokens ?? 16384,
          system: system, // top-level system field (Anthropic does not use a "system" message role)
          thinking: { type: "adaptive" },
          // effort lives under output_config on the Messages API. Defaults to "high".
          output_config: { effort: effort ?? "high" },
          messages: [{ role: "user", content: prompt }],
        },
        { signal, timeout: timeoutMs }
      ),
    "anthropic",
    timeoutMs
  );

  // With thinking enabled the response can contain `thinking` (and
  // `redacted_thinking`) blocks alongside `text` blocks. We only want the
  // final text, so filter to text blocks.
  const textContent = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n");

  return textContent;
}

/**
 * xAI (Grok) — OpenAI-compatible API surface.
 */
export async function callXai({
  prompt,
  model,
  maxTokens,
  temperature,
  system,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: LLMRequest): Promise<string> {
  const response = await withDeadline(
    (signal) =>
      getXai().chat.completions.create(
        {
          model: model || DEFAULT_MODEL.xai,
          max_tokens: maxTokens ?? 16384,
          temperature: temperature ?? 1.0,
          messages: [
            ...(system ? [{ role: "system" as const, content: system }] : []),
            { role: "user" as const, content: prompt },
          ],
        },
        { signal, timeout: timeoutMs }
      ),
    "xai",
    timeoutMs
  );

  return response.choices[0]?.message?.content || "";
}

/**
 * OpenAI — Chat Completions.
 */
export async function callOpenAI({
  prompt,
  model,
  maxTokens,
  temperature,
  system,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: LLMRequest): Promise<string> {
  const response = await withDeadline(
    (signal) =>
      getOpenAI().chat.completions.create(
        {
          model: model || DEFAULT_MODEL.openai,
          max_tokens: maxTokens ?? 16384,
          temperature: temperature ?? 1.0,
          messages: [
            ...(system ? [{ role: "system" as const, content: system }] : []),
            { role: "user" as const, content: prompt },
          ],
        },
        { signal, timeout: timeoutMs }
      ),
    "openai",
    timeoutMs
  );

  return response.choices[0]?.message?.content || "";
}

/**
 * Google Gemini via @google/genai.
 * Uses models.generateContent and supports generationConfig + systemInstruction.
 */
export async function callGoogle({
  prompt,
  model,
  maxTokens,
  temperature,
  system,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: LLMRequest): Promise<string> {
  const response = await withDeadline(
    (signal) =>
      getGoogle().models.generateContent({
        model: model || DEFAULT_MODEL.google,
        contents: prompt,
        config: {
          ...(system ? { systemInstruction: system } : {}),
          maxOutputTokens: maxTokens ?? 16384,
          ...(typeof temperature === "number" ? { temperature } : {}),
          abortSignal: signal,
        },
      }),
    "google",
    timeoutMs
  );

  return response.text ?? "";
}