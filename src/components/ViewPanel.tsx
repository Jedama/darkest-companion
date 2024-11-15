// src/components/ViewPanel.tsx
import { ManorView } from './views/ManorView';
import type { ViewType } from '../types/viewTypes';
import type { Character } from '../../shared/types/types.ts';

interface ViewPanelProps {
  currentView: ViewType;
  characters: Character[];
  onCharacterSelect: (character: Character) => void;
  selectedCharacterId?: string;
}

export function ViewPanel({ 
  currentView, 
  characters, 
  onCharacterSelect,
  selectedCharacterId 
}: ViewPanelProps) {
  switch (currentView) {
    case 'manor':
      return (
        <ManorView 
          characters={characters} 
          onCharacterSelect={onCharacterSelect}
          selectedCharacterId={selectedCharacterId}
        />
      );
    case 'dungeon':
      // To be implemented
      return <div>Dungeon View</div>;
    case 'strategy':
      // To be implemented
      return <div>Strategy View</div>;
    default:
      return <div>Invalid View</div>;
  }
}