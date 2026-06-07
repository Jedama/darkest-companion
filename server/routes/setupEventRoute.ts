import { Router, Request, Response } from 'express';
import { setupEvent, setupFollowUpEvent } from '../services/story/setupEventService.js';
import { takeFollowUpEvent } from '../services/game/followUpService.js';
import { loadEstate, saveEstate } from '../fileOps.js';

const router = Router();

router.post('/estates/:estateName/events/setup', async (req: Request, res: Response) => {
  try {
    const { estateName } = req.params;
    const { eventId, characterIds, enemyIds } = req.body;

    const estate = await loadEstate(estateName);
    if (!estate) {
      return res.status(404).json({ error: `Estate '${estateName}' not found` });
    }

    // A follow-up may only pre-empt an *undirected* random pull. A request that
    // names an event or specific participants is honored as-is.
    const isUndirected = !eventId && !characterIds?.length && !enemyIds?.length;

    let result;
    let usedFollowUp = false;

    if (isUndirected) {
      const followUp = takeFollowUpEvent(estate); // mutates estate.followUps (queue + streak)

      result = followUp
        ? await setupFollowUpEvent(estate, followUp)
        : await setupEvent(estate, { eventId, characterIds, enemyIds });

      usedFollowUp = !!followUp;

      // takeFollowUpEvent touched the queue/counter — persist it.
      await saveEstate(estate);
    } else {
      result = await setupEvent(estate, { eventId, characterIds, enemyIds });
    }

    return res.json({ success: true, usedFollowUp, ...result });
  } catch (error: any) {
    console.error('Error setting up event:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;