// server/routes/consequencesEventRoute.ts
import type { Estate } from '../../shared/types/types.js';
import { Router, Request, Response } from 'express';
import { loadEstate, saveEstate } from '../fileOps.js';
import { callLLM } from '../services/llm/llmService.js';
import { validateConsequenceUpdate, formatConsequenceUpdate } from '../services/llm/promptService.js';
import type { ConsequencePrompt } from '../services/llm/promptService.js';
import { compileConsequencesPrompt } from '../services/story/consequencesEventService.js';
import { applyConsequences, ConsequencesResult, prepareConsequenceDisplay, ensureAllCharactersHaveConsequences } from '../services/llm/llmResponseProcessor.js';

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
    const provider = estate.preferences?.llmProvider ?? "anthropic";
    const model = estate.preferences?.llmModel; // if undefined, provider default in callLLM will apply

    const response = await callLLM({
      provider,
      model,
      prompt,
      maxTokens: 2048,
      temperature: 0.7,
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

      const consequencesForProcessing: ConsequencesResult = ensureAllCharactersHaveConsequences(
        formattedConsequences,
        chosenCharacterIds
      );

      // 6. Apply the consequences to the estate
      
      const updatedEstate = applyConsequences(estate, consequencesForProcessing);
      
      // 7. Generate display-friendly data for the frontend
      const displayData = prepareConsequenceDisplay(consequencesForProcessing);

      // 8. Save the updated estate
      await saveEstate(updatedEstate);

      // 9. Return the display data and updated estate
      return res.json({
        success: true,
        display: displayData
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