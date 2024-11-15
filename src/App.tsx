// src/App.tsx
import { useState } from 'react';
import { MainLayout } from './components/layout/MainLayout.tsx';
import { LoadEstateModal } from './modals/LoadEstateModal/LoadEstateModal.tsx';
import type { Estate, Character } from '../shared/types/types.ts';
import type { ViewType } from './types/viewTypes';

function App() {
  const [currentEstate, setCurrentEstate] = useState<Estate | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('manor');
  
  const handleLoadEstate = (estate: Estate) => {
    setCurrentEstate(estate);
    setSelectedCharacter(null); // Reset selection when loading new estate
  };

  if (!currentEstate) {
    return (
      <LoadEstateModal
        onLoadEstate={handleLoadEstate}
        onCreateEstate={(name) => console.log('Create estate:', name)}
        onDeleteEstate={(name) => console.log('Delete estate:', name)}
      />
    );
  }

  return (
    <MainLayout
      characters={Object.values(currentEstate.characters)}
      selectedCharacter={selectedCharacter}
      onCharacterSelect={setSelectedCharacter}
      currentView={currentView}
    />
  );
}

export default App;