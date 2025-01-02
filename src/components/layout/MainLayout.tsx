// src/components/layout/MainLayout.tsx
import { useState } from 'react';
import { ViewPanel } from '../ViewPanel.tsx';
import { CharacterPanel } from '../characterpanel/CharacterPanel.tsx';
import type { ViewType } from '../../types/viewTypes.ts';
import type { Character } from '../../../shared/types/types.ts';
import './MainLayout.css';

interface MainLayoutProps {
  characters: Character[];
  selectedCharacter: Character | null;
  onCharacterSelect: (character: Character) => void;
  currentView: ViewType;
}

// Map views to their background images
const VIEW_BACKGROUNDS: Record<ViewType, string> = {
  manor: '/src/assets/ui/backgrounds/manor.png',
  dungeon: '/src/assets/ui/backgrounds/oldroad.png',
  strategy: '/src/assets/ui/backgrounds/strategy.png'
};

export function MainLayout({ 
  characters, 
  selectedCharacter, 
  onCharacterSelect,
  currentView 
}: MainLayoutProps) {

  return (
    <div className="main-layout"
      style={{
        backgroundImage: `url(${VIEW_BACKGROUNDS[currentView]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Character Panel (left side) */}
      <div className="character-panel">
        {selectedCharacter ? (
          <CharacterPanel character={selectedCharacter} />
        ) : (
          <div className="no-character-selected">
            
          </div>
        )}
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
    </div>
  );
}