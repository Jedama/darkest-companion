// server/fileOps.ts
import { readFile, writeFile, readdir, unlink } from 'fs/promises';
import path from 'path';
import type { Estate } from '../shared/types/types.ts';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ESTATES_DIR = path.join(__dirname, 'data', 'estates');

export async function loadEstate(estateName: string): Promise<Estate> {
  try {
    const filePath = path.join(ESTATES_DIR, `${estateName}.json`);
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading estate ${estateName}:`, error);
    throw error;
  }
}

export async function saveEstate(estate: Estate): Promise<void> {
  try {
    const filePath = path.join(ESTATES_DIR, `${estate.estateName}.json`);
    await writeFile(filePath, JSON.stringify(estate, null, 2));
  } catch (error) {
    console.error(`Error saving estate ${estate.estateName}:`, error);
    throw error;
  }
}

export async function listEstates(): Promise<string[]> {
  try {
    const files = await readdir(ESTATES_DIR);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error) {
    console.error('Error listing estates:', error);
    throw error;
  }
}

export async function deleteEstate(estateName: string): Promise<void> {
  try {
    const filePath = path.join(ESTATES_DIR, `${estateName}.json`);
    await unlink(filePath);
  } catch (error) {
    console.error(`Error deleting estate ${estateName}:`, error);
    throw error;
  }
}