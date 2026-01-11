// src/App.tsx
import { useEffect, useState } from 'react';
import { preloadImages } from './utils/preload';
import { useEstateContext } from './contexts/EstateContext';
import { MainLayout } from './components/layout/MainLayout';
import { ModalProvider } from './modals/ModalProvider';
import { LoadEstateModal } from './modals/LoadEstateModal/LoadEstateModal';
import type { Character } from '../shared/types/types';
import type { ViewType } from './types/viewTypes';
import { GameProvider, useGameData } from './contexts/GameDataContext';
import './styles/fonts.css';

// Create a wrapper component to handle the Inner Logic
function GameContent() {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [currentView] = useState<ViewType>('manor');
  
  const { currentEstate } = useEstateContext();
  const { characterDefinitions, isGameDataReady } = useGameData();
  
  const [bootReady, setBootReady] = useState(false);
  const [estateAssetsReady, setEstateAssetsReady] = useState(false);

  // 1. Initial Boot (Fonts + Static Game Data)
  useEffect(() => {
    let cancelled = false;
    async function prepareBoot() {
       // Wait for fonts
       if (document.fonts?.ready) await document.fonts.ready;
       if (!cancelled) setBootReady(true);
    }
    prepareBoot();
    return () => { cancelled = true; };
  }, []);

  // 2. Estate Asset Preloading (Kept your existing logic here)
  useEffect(() => {
    let cancelled = false;

    async function preloadEstateAssets() {
      if (!currentEstate) {
        setEstateAssetsReady(false);
        return;
      }

      setEstateAssetsReady(false);

      // --- UI assets needed for gameplay ---
      // IMPORTANT: Use new URL(..., import.meta.url) so it works in production builds.
      const uiUrls: string[] = [
        // View backgrounds
        new URL('./assets/ui/backgrounds/manor.png', import.meta.url).href,
        new URL('./assets/ui/backgrounds/oldroad.png', import.meta.url).href,
        new URL('./assets/ui/backgrounds/strategy.png', import.meta.url).href,

        // Default portrait
        new URL('./assets/characters/portrait/small/placeholder_190x278.png', import.meta.url).href,

        // Manor buttons
        new URL('./assets/ui/views/manor/button_event.png', import.meta.url).href,
        new URL('./assets/ui/views/manor/button_recruit.png', import.meta.url).href,

        // Character panel assets
        new URL('./assets/ui/panels/characterpanel/background.png', import.meta.url).href,
        new URL('./assets/ui/panels/characterpanel/gems/strength.png', import.meta.url).href,
        new URL('./assets/ui/panels/characterpanel/gems/agility.png', import.meta.url).href,
        new URL('./assets/ui/panels/characterpanel/gems/intelligence.png', import.meta.url).href,
        new URL('./assets/ui/panels/characterpanel/gems/authority.png', import.meta.url).href,
        new URL('./assets/ui/panels/characterpanel/gems/sociability.png', import.meta.url).href,
        new URL('./assets/ui/panels/characterpanel/bookmarks/health_10.png', import.meta.url).href,
        new URL('./assets/ui/panels/characterpanel/bookmarks/mental_10.png', import.meta.url).href,

        // Recuit modal assets
        new URL('./assets/ui/modals/recruit/background.png', import.meta.url).href, 
        new URL('./assets/characters/recruit/placeholder.png', import.meta.url).href, 
      ];

      // Manor frames 0..6
      for (let i = 0; i <= 6; i++) {
        uiUrls.push(
          new URL(`./assets/ui/views/manor/frame_${i}.png`, import.meta.url).href
        );
      }

      // --- Estate/character assets ---
      const characters = Object.values(currentEstate.characters);

      const characterUrls: string[] = [];
      for (const c of characters) {
        characterUrls.push(
          // small portrait
          new URL(
            `./assets/characters/portrait/small/${c.identifier}_190x278.png`,
            import.meta.url
          ).href,
          // large portrait
          new URL(
            `./assets/characters/portrait/large/${c.identifier}_1024x1536.png`,
            import.meta.url
          ).href,
          // card
          new URL(
            `./assets/characters/card/${c.identifier}.png`,
            import.meta.url
          ).href
        );
      }

      Object.values(characterDefinitions).forEach(def => {
        characterUrls.push(
          new URL(`./assets/characters/recruit/${def.identifier}.png`, import.meta.url).href
        );
      });

      // Preload + decode everything. Errors won't hard-fail the whole preload.
      await preloadImages([...uiUrls, ...characterUrls]);

      if (!cancelled) setEstateAssetsReady(true);
    }

    preloadEstateAssets();

    return () => {
      cancelled = true;
    };
  }, [currentEstate]);


  // --- RENDER GATES ---

  // Gate 1: App Boot (Fonts & Static Data)
  if (!bootReady || !isGameDataReady) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        background: '#000',
        color: '#666',
        fontFamily: 'monospace'
      }}>
        {"Waiting for server..."}
      </div>
    );
  }

  // Gate 2: No Estate Loaded
  if (!currentEstate) {
    return (
      <ModalProvider>
        <LoadEstateModal />
      </ModalProvider>
    );
  }

  // Gate 3: Estate Assets
  if (!estateAssetsReady) {
    return (
      <ModalProvider>
        <div style={{ padding: 16 }}>Loading Estate Assets...</div>
      </ModalProvider>
    );
  }

  // Ready
  return (
    <ModalProvider>
      <MainLayout
        characters={Object.values(currentEstate.characters)}
        selectedCharacter={selectedCharacter}
        onCharacterSelect={setSelectedCharacter}
        currentView={currentView}
      />
    </ModalProvider>
  );
}

function App() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
}
export default App;
