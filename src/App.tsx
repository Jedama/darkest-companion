// src/App.tsx
import { useState } from 'react';
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

  // If no estate loaded, show the modal
  if (!currentEstate) {
    return (
      <ModalProvider>
        <LoadEstateModal />
      </ModalProvider>
    );
  }

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
