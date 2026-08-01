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
}

/**
 * Centralized defaults so routes don't hardcode model IDs.
 * You can tweak these later without touching endpoints.
 */
const DEFAULT_MODEL: Record<LlmProvider, string> = {
  openai: "gpt-5.5",
  xai: "grok-4.5",
  anthropic: "claude-fable-5",
  google: "gemini-3.1-pro-preview",
};

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing environment variable: ${name}`);
  return val;
}

/**
 * Single entry point: callLLM routes the call to the correct provider adapter.
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
}: LLMRequest): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
  });

  const response = await anthropic.messages.create({
    model: model || DEFAULT_MODEL.anthropic,
    max_tokens: maxTokens ?? 16384,
    system: system, // top-level system field (Anthropic does not use a "system" message role)
    thinking: { type: "adaptive" },
    // effort lives under output_config on the Messages API. Defaults to "high".
    output_config: { effort: effort ?? "high" },
    messages: [{ role: "user", content: prompt }],
  });

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
}: LLMRequest): Promise<string> {
  const client = new OpenAI({
    apiKey: requireEnv("XAI_API_KEY"),
    baseURL: "https://api.x.ai/v1",
  });

  const response = await client.chat.completions.create({
    model: model || DEFAULT_MODEL.xai,
    max_tokens: maxTokens ?? 16384,
    temperature: temperature ?? 1.0,
    messages: [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      { role: "user" as const, content: prompt },
    ],
  });

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
}: LLMRequest): Promise<string> {
  const client = new OpenAI({
    apiKey: requireEnv("OPENAI_API_KEY"),
  });

  const response = await client.chat.completions.create({
    model: model || DEFAULT_MODEL.openai,
    max_tokens: maxTokens ?? 16384,
    temperature: temperature ?? 1.0,
    messages: [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      { role: "user" as const, content: prompt },
    ],
  });

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
}: LLMRequest): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });

  const response = await ai.models.generateContent({
    model: model || DEFAULT_MODEL.google,
    contents: prompt,
    config: {
      ...(system ? { systemInstruction: system } : {}),
      maxOutputTokens: maxTokens ?? 16384,
      ...(typeof temperature === "number" ? { temperature } : {}),
    },
  });

  return response.text ?? "";
}