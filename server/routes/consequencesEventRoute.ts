// server/routes/consequencesEventRoute.ts
import { Router, Request, Response } from 'express';
import { loadEstate } from '../fileOps';
import { callClaude, callGemini } from '../services/llm/llmService.js';
import type { Estate } from '../../shared/types/types';
import { compileConsequencesPrompt } from '../services/consequencesEventService';
import { validateConsequenceUpdate, formatConsequenceUpdate } from '../services/promptData/consequenceData';
import type { ConsequencePrompt } from '../services/promptData/consequenceData';

const router = Router();

interface ConsequencesRequest {
  story: string;
  chosenCharacterIds: string[];
}

/**
 * POST /estates/:estateName/events/consequences
 *
 * Expects JSON body with keys:
 * {
 *   story: "<the entire story text>",
 *   chosenCharacterIds: [...]
 * }
 *
 * Returns validated JSON consequences output from the LLM.
 */
router.post('/estates/:estateName/events/consequences', async (req: Request<{estateName: string}, {}, ConsequencesRequest>, res: Response) => {
  try {
    const { estateName } = req.params;
    const { story, chosenCharacterIds } = req.body;

    // 1. Load the Estate
    const estate: Estate | undefined = await loadEstate(estateName);
    if (!estate) {
      return res.status(404).json({ 
        error: 'Estate Not Found',
        message: `Estate '${estateName}' not found` 
      });
    }

    // 2. Build the prompt
    const prompt = await compileConsequencesPrompt({
      estate,
      story,
      chosenCharacterIds
    });

    console.log('Consequences prompt:', prompt);

    // 3. Call LLM
    /*const response = await callGemini({
      prompt,
      model: 'gemini-exp-1206',
      maxTokens: 1024
    });*/

    const response = await callClaude({
      prompt,
      model: 'claude-3-7-sonnet-20250219',
      maxTokens: 1024
    });

    // 4. Clean and parse the response
    const cleanResponse = (text: string): string => {
      // Remove markdown code block indicators and language tag
      return text.replace(/^```(json)?\n/, '')  // Remove opening ```json or ``` 
      .replace('+', '')              // Remove any potential +1s
      .replace(/```/, '')            // Remove closing ``` 
      .trim();                       // Clean up any extra whitespace
    };
    
    const cleanedText = cleanResponse(response);
    console.log('Cleaned response:', cleanedText);

    // 5. Parse and validate the response
    let parsedJson: ConsequencePrompt;
    try {
      // First try to parse as JSON
      parsedJson = JSON.parse(cleanedText) as ConsequencePrompt;
      
      // Check if it has the required structure
      if (!parsedJson || !Array.isArray(parsedJson.characters)) {
        throw new Error('Response missing required "characters" array');
      }

      // Validate the content against our rules
      if (!validateConsequenceUpdate(parsedJson, estate.characters)) {
        throw new Error('Response failed consequence validation rules');
      }

      // Format the consequences to ensure consistent structure
      const formattedConsequences = formatConsequenceUpdate(parsedJson);

      // 6. Return the validated and formatted consequences
      return res.json({
        success: true,
        prompt,
        consequences: formattedConsequences
      });

    } catch (err) {
      // Handle different types of validation failures
      const error = err as Error;
      
      // Determine the specific type of error for better client feedback
      let errorType = 'Unknown Error';
      let errorDetails = error.message;
      
      if (error.message.includes('JSON')) {
        errorType = 'JSON Parsing Error';
      } else if (error.message.includes('characters')) {
        errorType = 'Structure Error';
      } else if (error.message.includes('validation')) {
        errorType = 'Validation Error';
      }

      console.error('Failed to process LLM response:', error);
      return res.status(400).json({
        error: errorType,
        message: errorDetails,
        rawOutput: response
      });
    }

  } catch (error: any) {
    // Handle unexpected errors
    console.error('Error generating consequences:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

export default router;