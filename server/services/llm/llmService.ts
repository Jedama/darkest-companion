// server/services/llmService.ts
import OpenAI from "openai";
import { Anthropic } from '@anthropic-ai/sdk';
import type { ContentBlock } from '@anthropic-ai/sdk';
import {GoogleGenAI} from '@google/genai';

/**
 * Configuration for the LLM request.
 */
export interface LLMRequest {
  prompt: string;
  model?: string;       // e.g. "claude-3-opus-20240229", "claude-3-sonnet-20240229"
  maxTokens?: number;   // maximum number of tokens in the response
  temperature?: number; // controls randomness (0-1)
  system?: string;     // optional system prompt
}

/**
 * A function to call Claude via Anthropic's Messages API.
 * The idea is to keep it generic so you can swap to different providers later.
 */
export async function callClaude({ 
  prompt, 
  model, 
  maxTokens,
  temperature,
  system
}: LLMRequest): Promise<string> {
  // Create an Anthropic client using your API key
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'my_fallback_api_key',
  });

  // Build and send the request using the Messages API
  const response = await anthropic.messages.create({
    model: model || 'claude-3-5-sonnet-20241022',  // fallback model if not provided
    max_tokens: maxTokens ?? 1024,
    temperature: temperature ?? 1.0,
    system: system,  // optional system prompt
    messages: [
      { 
        role: 'user', 
        content: prompt 
      }
    ],
  });

  // Extract text from the response content
  // Filter for text blocks and concatenate their content
  const textContent = response.content
    .filter((block: ContentBlock): block is { type: 'text'; text: string } => 
      block.type === 'text'
    )
    .map(block => block.text)
    .join('\n');

  return textContent;
}

/**
 * A function to call Grok via X.AI's API (using OpenAI's client).
 * Uses the same pattern as other LLM functions for consistency.
 */
export async function callGrok({ 
  prompt, 
  model, 
  maxTokens, 
  temperature,
  system
}: LLMRequest): Promise<string> {
  // Create an OpenAI client configured for X.AI
  const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY || 'my_fallback_api_key',
    baseURL: "https://api.x.ai/v1"
  });

  // Build and send the request
  const response = await client.chat.completions.create({
    model: model || "grok-3-beta",
    max_tokens: maxTokens,
    temperature: temperature ?? 1.0,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt }
    ]
  });

  // Extract and return the response text
  return response.choices[0]?.message?.content || '';
}

/**
 * A function to call Gemini via Google's Generative AI SDK.
 * The idea is to keep it generic so you can swap to different providers later.
 */
export async function callGemini({ 
  prompt, 
  model, 
  maxTokens, 
  temperature
}: LLMRequest): Promise<string> {
  // Create a Google Generative AI client using your API key
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  // Construct the generationConfig object
  const generationConfig: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  } = {};

  generationConfig.temperature = temperature;

  const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});

  // Retrieve the specified model or default to "gemini-1.5-flash"
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
  });

  console.log(response.text);

  // Extract and return the response text
  return response.text  ?? '';
}
