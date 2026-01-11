// server/index.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import { loadEstate, listEstates, deleteEstate } from './fileOps.js';
import type { Estate } from '../shared/types/types.js';

import { createNewEstateAndSave } from './services/game/estateService.js';
import staticDataRoute from './routes/staticDataRoute.js';
import setupEventRoute from './routes/setupEventRoute.js';
import storyEventRoute from './routes/storyEventRoute.js';
import consequencesEventRoute from './routes/consequencesEventRoute.js';
import recruitEventRoute from './routes/recruitEventRoute.js';
import StaticGameDataManager from './staticGameDataManager.js';

const DEFAULT_CHARACTER_IDS = ['crusader', 'highwayman', 'heiress', 'kheir'];

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.use(staticDataRoute);
app.use(setupEventRoute);
app.use(storyEventRoute);
app.use(consequencesEventRoute);
app.use(recruitEventRoute);

// Type for request params
interface EstateParams {
  name: string;
}

// Type for request body
interface CreateEstateBody {
  estateName: string;
}

app.get('/estates', async (_req: Request, res: Response<string[]>) => {
  try {
    const estates = await listEstates();
    res.json(estates);
  } catch (error) {
    console.error('Error listing estates:', error);
    res.status(500).json([]);
  }
});

app.get('/estates/:name', async (req: Request<EstateParams>, res: Response<Estate | { error: string }>) => {
  try {
    const estate = await loadEstate(req.params.name);
    res.json(estate);
  } catch (error) {
    console.error('Error loading estate:', error);
    res.status(404).json({ error: 'Estate not found' });
  }
});

app.post('/estates', async (req: Request<{}, {}, CreateEstateBody>, res: Response<Estate | { error: string }>) => {
  try {
    const { estateName } = req.body;

    // Check for duplicates
    const gameData = StaticGameDataManager.getInstance();
    const result = await createNewEstateAndSave(estateName, gameData, DEFAULT_CHARACTER_IDS);
    
    // Check if the service returned an error object
    if ('error' in result) {
      return res.status(result.status).json({ error: result.error });
    }

    // If not, it's the full Estate object
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating estate:', error);
    res.status(500).json({ error: 'Failed to create estate' });
  }
});

app.delete('/estates/:name', async (req: Request<EstateParams>, res: Response) => {
  try {
    const estateName = req.params.name;
    
    const estates = await listEstates();
    if (!estates.includes(estateName)) {
      return res.status(404).json({ error: 'Estate not found' });
    }

    await deleteEstate(estateName);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting estate:', error);
    res.status(500).json({ error: 'Failed to delete estate' });
  }
});

// Initialize the server
async function startServer() {
  try {
    // Initialize static game data first
    await StaticGameDataManager.getInstance().initialize();
    
    // Then start the Express server
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();