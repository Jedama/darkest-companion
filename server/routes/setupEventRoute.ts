// server/routes/setupEventRoute.ts
import { Router, Request, Response } from 'express';
import { setupEvent, setupFollowUpEvent } from '../services/story/setupEventService.js';
import { takeFollowUpEvent, reclaimInFlight } from '../services/game/followUpService.js';
import { withEstate } from '../estateLock.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

interface SetupRequest {
  eventId?: string | null;
  characterIds?: string[];
  enemyIds?: string[];
}

/**
 * POST /estates/:estateName/events/setup
 *
 * Picks the event, cast and scenery for a town event. Both paths take the write
 * lock: even a directed setup reclaims an unresolved follow-up reservation, so
 * no reservation can outlive the setup that follows it.
 */
router.post(
  '/estates/:estateName/events/setup',
  asyncHandler(async (req: Request<{ estateName: string }, {}, SetupRequest>, res: Response) => {
    const { estateName } = req.params;
    const { eventId, characterIds, enemyIds } = req.body ?? {};

    // A follow-up may only pre-empt an *undirected* random pull. A request that
    // names an event or specific participants is honored as-is.
    const isUndirected = !eventId && !characterIds?.length && !enemyIds?.length;

    let usedFollowUp = false;

    const result = await withEstate(estateName, async (estate) => {
      if (!isUndirected) {
        // Directed setup can't serve a follow-up, but it must still clear any
        // stale reservation — otherwise a later consequences call would commit
        // a follow-up that was never told.
        reclaimInFlight(estate);
        return setupEvent(estate, {
          eventId: eventId ?? undefined,
          characterIds,
          enemyIds,
        });
      }

      // Reserves into estate.followUps.inFlight and updates the streak counter.
      const followUp = takeFollowUpEvent(estate);
      usedFollowUp = !!followUp;

      // If this throws, withEstate skips the save. The reservation is not
      // written, so the follow-up stays where it was.
      return followUp
        ? setupFollowUpEvent(estate, followUp)
        : setupEvent(estate, { eventId: undefined, characterIds, enemyIds });
    });

    res.json({ ...result, success: true, usedFollowUp });
  })
);

export default router;