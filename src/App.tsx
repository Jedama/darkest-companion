// src/App.tsx
import { useEffect, useState } from 'react';
import { preloadImages } from './utils/preload';
import { useEstateContext } from './contexts/EstateContext';
import { MainLayout } from './components/layout/MainLayout';
import { ModalProvider } from './modals/ModalProvider';
import { LoadEstateModal } from './modals/LoadEstateModal/LoadEstateModal';
import type { Character } from '../shared/types/types';
import type { ViewType } from './types/viewTypes';
import './styles/fonts.css';

function App() {
  // We'll still track selectedCharacter and currentView in here.
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('manor');

  // Grab the current estate from context
  const { currentEstate } = useEstateContext();

  // Gate 1: Boot gate (fonts)
  // NOTE: When you build a proper main menu/splash screen, you can move this gating there
  // and show an actual loading screen/progress bar instead of this minimal placeholder.
  const [bootReady, setBootReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepareBootAssets() {
      try {
        // Wait for all @font-face fonts declared in CSS to be ready.
        // This reduces FOUT (flash of unstyled text) when CharacterPanel mounts.
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
        // If anything goes wrong, don't block the app; just continue.
      } finally {
        if (!cancelled) setBootReady(true);
      }
    }

    prepareBootAssets();
    return () => {
      cancelled = true;
    };
  }, []);

  // Gate 3: Estate assets gate (UI + roster assets)
  // This runs only after an estate has been loaded/created, because we need the roster identifiers.
  const [estateAssetsReady, setEstateAssetsReady] = useState(false);

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
        new URL('./assets/ui/default_portrait.png', import.meta.url).href,

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

      // Preload + decode everything. Errors won't hard-fail the whole preload.
      await preloadImages([...uiUrls, ...characterUrls]);

      if (!cancelled) setEstateAssetsReady(true);
    }

    preloadEstateAssets();

    return () => {
      cancelled = true;
    };
  }, [currentEstate]);

  // --- Rendering gates ---

  if (!bootReady) {
    // Minimal boot loading screen (temporary).
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  // If no estate loaded, show the load/create modal.
  // (In the future this can become your real main menu screen.)
  if (!currentEstate) {
    return (
      <ModalProvider>
        <LoadEstateModal />
      </ModalProvider>
    );
  }

  // Estate exists, but assets aren't ready yet.
  // This prevents portraits/panels from popping in piece-by-piece.
  if (!estateAssetsReady) {
    return (
      <ModalProvider>
        <div style={{ padding: 16 }}>Loading estate assets…</div>
      </ModalProvider>
    );
  }

  // Fully ready: render the actual game layout.
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

export default App;
