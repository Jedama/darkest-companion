// src/components/layout/MainLayout.tsx
import { useEffect, useState } from 'react';

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
import { useModalContext } from '../../modals/ModalProvider.js';

interface MainLayoutProps {
  characters: Character[];
  selectedCharacter: Character | null;
  onCharacterSelect: (character: Character | null) => void;
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

  const [bookOpen, setBookOpen] = useState(false);
  const { isOpen: modalIsOpen } = useModalContext();

  const handleCharacterSelect = (character: Character) => {
    // Clicking the open character's own portrait shuts the book.
    if (bookOpen && selectedCharacter?.identifier === character.identifier) {
      setBookOpen(false);
      return;
    }
    setBookOpen(true);
    onCharacterSelect(character);
  };

  const handlePanelTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;   // child fades bubble up here too
    if (e.propertyName !== 'transform') return;
    if (!bookOpen) onCharacterSelect(null);
  };

  useEffect(() => {
    if (!bookOpen || modalIsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBookOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bookOpen, modalIsOpen]);

  useEffect(() => {
    setBookOpen(false);
  }, [currentView]);

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
      <div className={`character-panel${bookOpen ? ' is-open' : ''}`} onTransitionEnd={handlePanelTransitionEnd}>
        <BookPanel open={bookOpen} onToggle={() => setBookOpen((o) => !o)}>
          <TitlePage visible={!selectedCharacter} />
          <CharacterSheet character={selectedCharacter} />
        </BookPanel>
      </div>

      {/* View Panel (right side) */}
      <div className="view-panel">
        <ViewPanel
          currentView={currentView}
          characters={characters}
          onCharacterSelect={handleCharacterSelect}
          selectedCharacterId={selectedCharacter?.identifier}
        />
      </div>

      {currentEstate && <DebugPanel />}
    </div>
  );
}