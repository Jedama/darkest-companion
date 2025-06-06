// server/index.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import { loadEstate, saveEstate, listEstates, deleteEstate } from './fileOps.js';
import { createNewEstate } from '../shared/types/types.js';
import type { Estate } from '../shared/types/types.js';
import logRoutes from './logs/logRoutes.js';
import setupEventRoute from './routes/setupEventRoute.js';
import storyEventRoute from './routes/storyEventRoute.js';
import consequencesEventRoute from './routes/consequencesEventRoute.js';
import StaticGameDataManager from './staticGameDataManager.js';

const DEFAULT_CHARACTER_IDS = ['crusader', 'highwayman', 'heiress', 'kheir'];

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.use(logRoutes);
app.use(setupEventRoute);
app.use(storyEventRoute);
app.use(consequencesEventRoute);

// Type for request params
interface EstateParams {
  name: string;
}

// Type for request body
interface CreateEstateBody {
  estateName: string;
}

function validateEstateName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Estate name is required' };
  }
  
  if (name.length < 1) {
    return { valid: false, error: 'Estate name cannot be empty' };
  }
  
  if (name.length > 50) {
    return { valid: false, error: 'Estate name cannot be longer than 50 characters' };
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return { valid: false, error: 'Estate name cannot be only whitespace' };
  }

  return { valid: true };
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
    
    // Validate estate name
    const validation = validateEstateName(estateName);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error || 'Invalid estate name' });
    }

    // Check for duplicates
    const estates = await listEstates();
    if (estates.includes(estateName)) {
      return res.status(409).json({ error: 'An estate with this name already exists' });
    }

    const gameData = StaticGameDataManager.getInstance();
    
    // Get data from the static manager instead of loading it each time
    const characterTemplates = gameData.getCharacterTemplates();
    
    // Filter only the initial characters from templates
    const defaultCharacters = Object.fromEntries(
      DEFAULT_CHARACTER_IDS
        .map((id) => {
          const template = characterTemplates[id];
          if (!template) return [id, undefined];
          
          return [
            id,
            {
              ...template,
              relationships: gameData.getDefaultRelationshipsForCharacter(id) || {}, 
              locations: gameData.getRandomizedLocationsForCharacter(id)
            },
          ];
        })
        .filter(([_, char]) => char !== undefined) // Ensure character exists
    );

    // Create new estate with initial characters
    const newEstate = {
      ...createNewEstate(estateName),
      month: 0,
      characters: defaultCharacters
    };

    await saveEstate(newEstate);

    res.status(201).json(newEstate);
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