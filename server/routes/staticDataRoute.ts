// server/routes/staticDataRoute.ts
import { Router, Request, Response } from 'express';
import StaticGameDataManager from '../staticGameDataManager.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

/**
 * GET /game/static-data
 * Returns static dictionaries (definitions) for the game.
 * Used by the frontend to populate lists (Recruit modal, Glossaries, etc).
 *
 * Also the frontend's de facto "is the server awake?" probe — GameDataContext
 * retries this until it answers.
 */
router.get(
  '/game/static-data',
  asyncHandler(async (_req: Request, res: Response) => {
    const gameDataManager = StaticGameDataManager.getInstance();

    // The manager stores templates as a Record, so map to the flat definition
    // shape the frontend actually wants.
    const characterDefinitions = Object.values(gameDataManager.getCharacterTemplates()).map((t) => ({
      identifier: t.identifier, // e.g., "crusader"
      title: t.title,           // e.g., "Crusader"
      name: t.name,             // e.g., "Reynauld" (default name)
    }));

    res.json({
      success: true,
      data: {
        characters: characterDefinitions,
        // Future: enemies, factions, etc.
      },
    });
  })
);

export default router;