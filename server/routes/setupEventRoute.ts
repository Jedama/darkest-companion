// server/routes/setupEventRoute.ts
import { Router, Request, Response } from 'express';
import { setupEvent } from '../services/story/setupEventService.js';
import { loadEstate } from '../fileOps.js';

const router = Router();

/**
 * POST /estates/:estateName/events/setup
 * Sets up an event. Can be purely random, or directed by specific inputs.
 * Body: {
 *   eventId?: string,
 *   characterIds?: string[],
 *   enemyIds?: string[],
 *   description?: string
 * }
 */
router.post('/estates/:estateName/events/setup', async (req: Request, res: Response) => {
  try {
    const { estateName } = req.params;
    const { eventId, characterIds, enemyIds, description } = req.body;

    // 1. Load the estate so we can fetch character data
    const estate = await loadEstate(estateName);
    if (!estate) {
      return res.status(404).json({ error: `Estate '${estateName}' not found` });
    }

    // Call the service to pick random event + characters
    const result = await setupEvent(estate, {
      eventId,
      characterIds,
      enemyIds,
      description // Passed through, though currently unused logic-wise
    });

    // Return them to the frontend
    // You might also want to store them in the estate so that the next steps know about them
    // For now, let's just return them in the JSON response
    return res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error setting up random event:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
