// server/routes/staticDataRoute.ts
import { Router, Request, Response } from 'express';
import StaticGameDataManager from '../staticGameDataManager.js'; 

const router = Router();

/**
 * GET /game/static-data
 * Returns static dictionaries (definitions) for the game.
 * Used by the frontend to populate lists (Recruit modal, Glossaries, etc).
 */
router.get('/game/static-data', (req: Request, res: Response) => {
  try {
    const gameDataManager = StaticGameDataManager.getInstance();
    
    // 1. Get Character Templates
    const templates = gameDataManager.getCharacterTemplates();

    // Map internal template format to the clean frontend definition
    // We use Object.values because the manager stores them as a Record<string, Template>
    const characterDefinitions = Object.values(templates).map((t) => ({
      identifier: t.identifier, // e.g., "crusader"
      title: t.title,           // e.g., "Crusader"
      name: t.name              // e.g., "Reynauld" (Default name)
    }));

    // 2. Future: Enemies, Factions, etc.
    // const enemies = manager.getAllEnemies();

    return res.json({
      success: true,
      data: {
        characters: characterDefinitions,
        // enemies: ...
      }
    });

  } catch (error: any) {
    console.error('Error fetching static game data:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;