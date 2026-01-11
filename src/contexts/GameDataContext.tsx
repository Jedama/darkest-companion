// src/contexts/GameDataContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CharacterDefinition {
  identifier: string; 
  title: string; 
  name: string; 
}

interface GameContextValue {
  characterDefinitions: Record<string, CharacterDefinition>;
  isGameDataReady: boolean;
}

const GameContext = createContext<GameContextValue>({
  characterDefinitions: {},
  isGameDataReady: false
});

export const useGameData = () => useContext(GameContext);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [characterDefinitions, setCharacterDefinitions] = useState<Record<string, CharacterDefinition>>({});
  const [isGameDataReady, setIsGameDataReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadStaticData = async () => {
      // Keep trying as long as the component is mounted and we haven't succeeded
      while (mounted) {
        try {
          
          const res = await fetch('http://localhost:3000/game/static-data');
          
          // If server is up but returns 500, throw to trigger retry
          if (!res.ok) throw new Error(`Server returned ${res.status}`);

          const json = await res.json();
          if (!json.success) throw new Error(json.error || 'API Error');

          // Process data
          const charMap: Record<string, CharacterDefinition> = {};
          json.data.characters.forEach((def: CharacterDefinition) => {
            charMap[def.identifier] = def;
          });

          if (mounted) {
            setCharacterDefinitions(charMap);
            setIsGameDataReady(true);
            return; // EXIT THE LOOP - We are done!
          }
        } catch (err: any) {
          console.log("Server not ready, retrying in 2s...", err.message);
          if (mounted) {
            // Wait 2 seconds before retrying
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
    };

    loadStaticData();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <GameContext.Provider value={{ characterDefinitions, isGameDataReady }}>
      {children}
    </GameContext.Provider>
  );
}