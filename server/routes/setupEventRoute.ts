// server/routes/setupEventRoute.ts
import { Router, Request, Response } from 'express';
import { setupRandomEvent } from '../services/eventSetupService.js';

const router = Router();

/**
 * POST /estates/:estateName/events/setup-random
 * This route picks a random event and random characters,
 * then returns them. You can add more logic if needed.
 */
router.post('/estates/:estateName/events/setup-random', async (req: Request, res: Response) => {
  try {
    const { estateName } = req.params;

    // Call the service to pick random event + characters
    const { event, chosenCharacterIds, locations, npcs } = await setupRandomEvent(estateName);

    // Return them to the frontend
    // You might also want to store them in the estate so that the next steps know about them
    // For now, let's just return them in the JSON response
    return res.json({
      success: true,
      event,
      chosenCharacterIds,
      locations,
      npcs
    });
  } catch (error: any) {
    console.error('Error setting up random event:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
