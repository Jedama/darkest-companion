// server/services/llmService.ts
import { Anthropic, ContentBlock } from '@anthropic-ai/sdk';

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

// Example usage:
// const result = await callClaude({
//   prompt: "What is the capital of France?",
//   model: "claude-3-sonnet-20241022",
//   maxTokens: 1024,
//   temperature: 0.7,
//   system: "You are a helpful AI assistant."
// });