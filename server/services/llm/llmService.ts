// server/services/llmService.ts
import { Anthropic } from '@anthropic-ai/sdk';
import type { ContentBlock } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from "@google/generative-ai";

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
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_CLOUD_API_KEY || 'my_fallback_api_key');

  // Retrieve the specified model or default to "gemini-1.5-flash"
  const generativeModel = genAI.getGenerativeModel({
    model: model || "gemini-exp-1206"
  });

  // Format the prompt as a content array
  const parts = [
    {text: prompt}
  ];

  // Build and send the request using the generateContent method
  const response = await generativeModel.generateContent(parts);

  // Extract and return the response text
  return response.response.text();
}
