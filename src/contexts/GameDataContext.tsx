// src/contexts/GameDataContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchStaticGameData, isAbortError } from '../utils/api.js';
import type { CharacterDefinition } from '../utils/api.js';

// Re-exported so existing `import type { CharacterDefinition } from
// '../contexts/GameDataContext'` lines keep working. The type itself now lives
// in api.ts alongside the call that returns it.
export type { CharacterDefinition };

interface GameContextValue {
  characterDefinitions: Record<string, CharacterDefinition>;
  isGameDataReady: boolean;
  /** Set once we've failed at least once. Cleared on success. */
  loadError: string | null;
}

const GameContext = createContext<GameContextValue>({
  characterDefinitions: {},
  isGameDataReady: false,
  loadError: null,
});

export const useGameData = () => useContext(GameContext);

/** Retry backoff: 1s, 2s, 4s, 8s, then every 10s. */
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 10_000;

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [characterDefinitions, setCharacterDefinitions] = useState<
    Record<string, CharacterDefinition>
  >({});
  const [isGameDataReady, setIsGameDataReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Cancels the in-flight request as well as ending the retry loop, so an
    // unmount doesn't leave a fetch running against a dead component.
    const controller = new AbortController();

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, ms);
        controller.signal.addEventListener('abort', () => {
          window.clearTimeout(timer);
          resolve();
        });
      });

    const loadStaticData = async () => {
      // The server is often still booting when the page loads, so keep trying
      // rather than failing outright — but back off, and say so on screen.
      for (let attempt = 0; !controller.signal.aborted; attempt++) {
        try {
          const data = await fetchStaticGameData(controller.signal);

          const charMap: Record<string, CharacterDefinition> = {};
          for (const def of data.characters) {
            charMap[def.identifier] = def;
          }

          if (controller.signal.aborted) return;

          setCharacterDefinitions(charMap);
          setIsGameDataReady(true);
          setLoadError(null);
          return;
        } catch (err) {
          if (isAbortError(err) || controller.signal.aborted) return;

          const message = err instanceof Error ? err.message : 'Unknown error';
          console.warn(`Static game data unavailable (attempt ${attempt + 1}):`, message);
          setLoadError(message);

          const delay = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
          await sleep(delay);
        }
      }
    };

    void loadStaticData();

    return () => controller.abort();
  }, []);

  return (
    <GameContext.Provider value={{ characterDefinitions, isGameDataReady, loadError }}>
      {children}
    </GameContext.Provider>
  );
}