// server/fileOps.ts
import { readFile, writeFile, readdir, unlink, mkdir, rename } from 'fs/promises';
import path from 'path';

import type { Estate } from '../shared/types/types.js';
import { ESTATES_DIR } from './paths.js';
import { AppError } from './errors.js';

// Ensure the estates directory exists when the server starts
async function ensureEstatesDir() {
  await mkdir(ESTATES_DIR, { recursive: true });
}

/** True for "the file isn't there", as opposed to a real IO failure. */
function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
}

function estatePath(estateName: string): string {
  return path.join(ESTATES_DIR, `${estateName}.json`);
}

// A simple utility to load raw text files.
export async function loadTextFile(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

// A simple utility to load json files.
export async function loadJsonFile<T>(filePath: string): Promise<T> {
  const data = await readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

/**
 * Reads an estate from disk.
 *
 * Returns undefined when there is no such estate — which is what every caller
 * already assumed by typing this `Estate | undefined` and checking for it.
 * Previously it threw instead, so those `if (!estate) return 404` branches were
 * dead code and a missing estate surfaced as a 500.
 *
 * Real IO failures (permissions, corrupt JSON) still throw.
 */
export async function loadEstate(estateName: string): Promise<Estate | undefined> {
  try {
    return JSON.parse(await readFile(estatePath(estateName), 'utf-8')) as Estate;
  } catch (error) {
    if (isMissingFile(error)) return undefined;
    if (error instanceof SyntaxError) {
      throw new AppError(
        `The save file for '${estateName}' is corrupt and could not be read.`,
        500,
        'internal',
        error.message
      );
    }
    throw error;
  }
}

/**
 * loadEstate, but a missing estate is a 404 rather than an undefined.
 * Routes should use this — it collapses the five-line guard every one of them
 * was repeating into a single call.
 */
export async function requireEstate(estateName: string): Promise<Estate> {
  const estate = await loadEstate(estateName);
  if (!estate) throw AppError.estateNotFound(estateName);
  return estate;
}

export async function estateExists(estateName: string): Promise<boolean> {
  return (await listEstates()).includes(estateName);
}

/**
 * Writes an estate atomically: serialise to a temp file, then rename it into
 * place. rename() is atomic within a filesystem, so a crash mid-save leaves
 * either the old file or the new one — never a truncated one that fails to
 * parse. Writing directly to the target risked exactly that.
 *
 * Temp files end in .tmp, so listEstates (which filters on .json) ignores any
 * that a hard kill leaves behind.
 */
export async function saveEstate(estate: Estate): Promise<void> {
  await ensureEstatesDir();

  const target = estatePath(estate.name);
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(temp, JSON.stringify(estate, null, 2));
    await rename(temp, target);
  } catch (error) {
    await unlink(temp).catch(() => {}); // best effort; the write already failed
    throw error;
  }
}

export async function listEstates(): Promise<string[]> {
  await ensureEstatesDir();
  const files = await readdir(ESTATES_DIR);
  return files.filter((file) => file.endsWith('.json')).map((file) => file.replace('.json', ''));
}

/** Returns false when there was nothing to delete. */
export async function deleteEstate(estateName: string): Promise<boolean> {
  try {
    await unlink(estatePath(estateName));
    return true;
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
}