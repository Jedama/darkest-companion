// src/components/layout/MainLayout.tsx
import { ViewPanel } from '../ViewPanel.js';
import { BookPanel } from '../CharacterPanel/BookPanel.js';
import { TitlePage } from '../CharacterPanel/TitlePage.js';
import { CharacterSheet } from '../CharacterPanel/CharacterSheet.js';
import { DebugPanel } from '../debug/DebugPanel.js';
import { useEstateContext } from '../../contexts/EstateContext.js';

import type { ViewType } from '../../types/viewTypes.js';
import type { Character } from '../../../shared/types/types.js';
import './MainLayout.css';

import manorBg from '../../assets/ui/backgrounds/manor.png';
import oldroadBg from '../../assets/ui/backgrounds/oldroad.png';
import strategyBg from '../../assets/ui/backgrounds/strategy.png';

interface MainLayoutProps {
  characters: Character[];
  selectedCharacter: Character | null;
  onCharacterSelect: (character: Character) => void;
  currentView: ViewType;
}

// Map views to their background images
const VIEW_BACKGROUNDS: Record<ViewType, string> = {
  manor: manorBg,
  dungeon: oldroadBg,
  strategy: strategyBg,
};

export function MainLayout({ 
  characters, 
  selectedCharacter, 
  onCharacterSelect,
  currentView 
}: MainLayoutProps) {
  const { currentEstate } = useEstateContext();

  return (
    <div className="main-layout"
      style={{
        backgroundImage: `url(${VIEW_BACKGROUNDS[currentView]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* The book (left side) */}
      <div className="character-panel">
        <BookPanel>
          <TitlePage visible={!selectedCharacter} />
          <CharacterSheet character={selectedCharacter} />
        </BookPanel>
      </div>

      {/* View Panel (right side) */}
      <div className="view-panel">
        <ViewPanel
          currentView={currentView}
          characters={characters}
          onCharacterSelect={onCharacterSelect}
          selectedCharacterId={selectedCharacter?.identifier}
        />
      </div>
      {currentEstate && <DebugPanel />}
    </div>
  );
}