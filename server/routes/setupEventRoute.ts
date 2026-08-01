// server/routes/setupEventRoute.ts
import { Router, Request, Response } from 'express';
import { setupEvent, setupFollowUpEvent } from '../services/story/setupEventService.js';
import { takeFollowUpEvent } from '../services/game/followUpService.js';
import { requireEstate } from '../fileOps.js';
import { withEstate } from '../estateLock.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

interface SetupRequest {
  eventId?: string | null;
  characterIds?: string[];
  enemyIds?: string[];
}

router.post(
  '/estates/:estateName/events/setup',
  asyncHandler(async (req: Request<{ estateName: string }, {}, SetupRequest>, res: Response) => {
    const { estateName } = req.params;
    const { eventId, characterIds, enemyIds } = req.body ?? {};

    // A follow-up may only pre-empt an *undirected* random pull. A request that
    // names an event or specific participants is honored as-is.
    const isUndirected = !eventId && !characterIds?.length && !enemyIds?.length;

    if (!isUndirected) {
      // Directed setup reads but never writes, so it takes no lock.
      const estate = await requireEstate(estateName);
      const result = await setupEvent(estate, {
        eventId: eventId ?? undefined,
        characterIds,
        enemyIds,
      });
      res.json({ ...result, success: true, usedFollowUp: false });
      return;
    }

    // Undirected setup consumes from the follow-up queue and updates the
    // streak counter, so it does write.
    let usedFollowUp = false;

    const result = await withEstate(estateName, async (estate) => {
      // Mutates estate.followUps (removes the served entry, updates the streak).
      const followUp = takeFollowUpEvent(estate);
      usedFollowUp = !!followUp;

      // If this throws, withEstate skips the save and the queue on disk is
      // untouched — a failed setup doesn't silently eat a follow-up.
      return followUp
        ? await setupFollowUpEvent(estate, followUp)
        : await setupEvent(estate, { eventId: undefined, characterIds, enemyIds });
    });

    res.json({ ...result, success: true, usedFollowUp });
  })
);

export default router;