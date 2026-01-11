import { loadJsonFile, loadTextFile } from './fileOps.js';

export type PromptKey = string;
export type PromptIndex = Record<PromptKey, string>;
export type PromptMap = Record<PromptKey, string>;

function normalizeBasePath(basePath: string): string {
  // ensure no trailing slash issues
  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
}

/**
 * Loads data/prompts/index.json then loads every referenced prompt file and returns a key->text map.
 * Throws if any file is missing or if keys/paths are invalid.
 */
export async function loadPromptsFromIndex(
  promptsBasePath: string,
  indexFile = 'index.json'
): Promise<PromptMap> {
  const base = normalizeBasePath(promptsBasePath);

  const indexPath = `${base}/${indexFile}`;
  const index = await loadJsonFile<PromptIndex>(indexPath);

  const entries = Object.entries(index);

  if (entries.length === 0) {
    throw new Error(`Prompt index is empty: ${indexPath}`);
  }

  // Basic validation (cheap, catches lots of footguns)
  for (const [key, relPath] of entries) {
    if (!key || typeof key !== 'string') throw new Error(`Invalid prompt key in ${indexPath}`);
    if (!relPath || typeof relPath !== 'string') {
      throw new Error(`Invalid path for key "${key}" in ${indexPath}`);
    }
    if (relPath.startsWith('/') || relPath.includes('..')) {
      throw new Error(
        `Unsafe prompt path for key "${key}": "${relPath}". Must be relative and not contain "..".`
      );
    }
  }

  const loadedPairs = await Promise.all(
    entries.map(async ([key, relPath]) => {
      const fullPath = `${base}/${relPath}`;
      const text = await loadTextFile(fullPath);
      return [key, text] as const;
    })
  );

  return Object.fromEntries(loadedPairs) as PromptMap;
}
