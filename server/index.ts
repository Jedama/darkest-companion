// server/index.ts
import express, { Request, Response } from 'express';
import cors from 'cors';

import { requireEstate, listEstates, deleteEstate, estateExists } from './fileOps.js';
import { AppError } from './errors.js';
import { asyncHandler, errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { llmModeMiddleware, DEFAULT_LLM_MODE } from './services/llm/llmMode.js';

import { createNewEstateAndSave } from './services/game/estateService.js';
import staticDataRoute from './routes/staticDataRoute.js';
import setupEventRoute from './routes/setupEventRoute.js';
import storyEventRoute from './routes/storyEventRoute.js';
import consequencesEventRoute from './routes/consequencesEventRoute.js';
import recruitEventRoute from './routes/recruitEventRoute.js';
import reviewRoute from './routes/reviewRoute.js';
import dungeonSummaryRoute from './routes/dungeonSummaryRoute.js';
import planningRoute from './routes/planningRoute.js';
import StaticGameDataManager from './staticGameDataManager.js';

const DEFAULT_CHARACTER_IDS = ['crusader', 'highwayman', 'heiress', 'kheir'];

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Opens the per-request LLM mode store. Must come after express.json(), since
// fixtures read the parsed body, and before any route that calls an LLM.
app.use(llmModeMiddleware);

/* ---------------------------------------------------------------- *
 *  Estates
 * ---------------------------------------------------------------- */

interface EstateParams {
  name: string;
}

interface CreateEstateBody {
  estateName: string;
}

app.get(
  '/estates',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await listEstates());
  })
);

app.get(
  '/estates/:name',
  asyncHandler(async (req: Request<EstateParams>, res: Response) => {
    // 404 when it doesn't exist, 500 only when the disk is genuinely unhappy.
    // The old version reported every failure — including corrupt JSON — as
    // "Estate not found".
    res.json(await requireEstate(req.params.name));
  })
);

app.post(
  '/estates',
  asyncHandler(async (req: Request<{}, {}, CreateEstateBody>, res: Response) => {
    const estateName = req.body?.estateName?.trim();
    if (!estateName) {
      throw AppError.badRequest('An estate name is required.');
    }

    const gameData = StaticGameDataManager.getInstance();
    const result = await createNewEstateAndSave(estateName, gameData, DEFAULT_CHARACTER_IDS);

    if ('error' in result) {
      // The service reports its own status; 409 is the sensible default for
      // the duplicate-name case it mostly signals.
      throw new AppError(result.error, result.status ?? 409, 'estate_exists');
    }

    res.status(201).json(result);
  })
);

app.delete(
  '/estates/:name',
  asyncHandler(async (req: Request<EstateParams>, res: Response) => {
    const deleted = await deleteEstate(req.params.name);
    if (!deleted) throw AppError.estateNotFound(req.params.name);
    res.status(204).send();
  })
);

/* ---------------------------------------------------------------- *
 *  Feature routers
 * ---------------------------------------------------------------- */

app.use(staticDataRoute);
app.use(setupEventRoute);
app.use(storyEventRoute);
app.use(consequencesEventRoute);
app.use(recruitEventRoute);
app.use(reviewRoute);
app.use(dungeonSummaryRoute);
app.use(planningRoute);

/* ---------------------------------------------------------------- *
 *  Error handling — must come after every route.
 * ---------------------------------------------------------------- */

app.use(notFoundHandler);
app.use(errorHandler);

/* ---------------------------------------------------------------- *
 *  Boot
 * ---------------------------------------------------------------- */

async function startServer() {
  try {
    // Static game data has to be in memory before the first request lands.
    await StaticGameDataManager.getInstance().initialize();

    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      if (DEFAULT_LLM_MODE !== 'live') {
        console.log(`LLM_MODE=${DEFAULT_LLM_MODE} — provider calls are stubbed by default.`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// A rejected promise outside a request would otherwise take the process down
// silently in newer Node versions. Log it and keep serving.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});