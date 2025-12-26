// server/services/llmService.ts
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import type { ContentBlock } from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

import type { LlmProvider } from "../../../shared/types/types.js";

/**
 * Configuration for the LLM request.
 */
export interface LLMRequest {
  provider: LlmProvider;

  prompt: string;

  model?: string;       // provider-specific model id
  maxTokens?: number;   // maximum tokens in the response
  temperature?: number; // controls randomness
  system?: string;      // optional system prompt / instruction
}

/**
 * Centralized defaults so routes don't hardcode model IDs.
 * You can tweak these later without touching endpoints.
 */
const DEFAULT_MODEL: Record<LlmProvider, string> = {
  openai: "gpt-4o-mini",
  xai: "grok-4-1-fast-reasoning",
  anthropic: "claude-opus-4-5-20251101",
  google: "gemini-3-pro-preview",
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
 * Same API shape across Claude models; model string selects which one. :contentReference[oaicite:3]{index=3}
 */
export async function callAnthropic({
  prompt,
  model,
  maxTokens,
  temperature,
  system,
}: LLMRequest): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
  });

  const response = await anthropic.messages.create({
    model: model || DEFAULT_MODEL.anthropic,
    max_tokens: maxTokens ?? 1024,
    temperature: temperature ?? 1.0,
    system: system, // top-level system field (Anthropic does not use a "system" message role) :contentReference[oaicite:4]{index=4}
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content
    .filter(
      (block: ContentBlock): block is { type: "text"; text: string } =>
        block.type === "text"
    )
    .map((block) => block.text)
    .join("\n");

  return textContent;
}

/**
 * xAI (Grok) — OpenAI-compatible API surface. :contentReference[oaicite:5]{index=5}
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
    max_tokens: maxTokens ?? 1024,
    temperature: temperature ?? 1.0,
    messages: [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      { role: "user" as const, content: prompt },
    ],
  });

  return response.choices[0]?.message?.content || "";
}

/**
 * OpenAI — Chat Completions. :contentReference[oaicite:6]{index=6}
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
    max_tokens: maxTokens ?? 1024,
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
 * Uses models.generateContent and supports generationConfig + systemInstruction. :contentReference[oaicite:7]{index=7}
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
    ...(system
      ? { systemInstruction: { parts: [{ text: system }] } }
      : {}),
    generationConfig: {
      ...(typeof maxTokens === "number" ? { maxOutputTokens: maxTokens } : {}),
      ...(typeof temperature === "number" ? { temperature } : {}),
    },
  });

  return response.text ?? "";
}
