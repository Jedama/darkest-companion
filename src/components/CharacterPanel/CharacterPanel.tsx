// src/components/CharacterPanel/CharacterPanel.tsx
import React from 'react';
import { useMemo } from 'react';
import type { Character } from '../../../shared/types/types.ts';
import type { StatName } from '../../types/statTypes.ts';
import './CharacterPanel.css';

interface CharacterPanelProps {
  character: Character | null;
}

// Base path constant
const BASE_PATH = '../../assets';

// Asset path configuration
const ASSETS = {
  BASE_PATH,
  paths: {
    gems: (gemName: string) => 
      new URL(`${BASE_PATH}/ui/panels/characterpanel/gems/${gemName}.png`, import.meta.url).href,
    portrait: (identifier: string) => 
      new URL(`${BASE_PATH}/characters/portrait/large/${identifier}_832x1216.png`, import.meta.url).href,
    bookmarks: {
      health: (level = 10) => 
        new URL(`${BASE_PATH}/ui/panels/characterpanel/bookmarks/health${level}.png`, import.meta.url).href,
      mental: (level = 10) => 
        new URL(`${BASE_PATH}/ui/panels/characterpanel/bookmarks/mental${level}.png`, import.meta.url).href,
    }
  }
};

const STAT_GEMS: Record<StatName, string> = {
  strength: ASSETS.paths.gems('strength'),
  agility: ASSETS.paths.gems('agility'),
  intelligence: ASSETS.paths.gems('intelligence'),
  authority: ASSETS.paths.gems('authority'),
  sociability: ASSETS.paths.gems('sociability'),
};

export function CharacterPanel({ character }: CharacterPanelProps) {
  const getGemLevel = (stat: number) => {
    // Convert stat to gem level (0-10)
    return Math.min(Math.floor(stat), 10);
  };

  const statItems = useMemo(() => {
    if (!character) return [];
    
    return [
      { name: 'strength', value: character.stats.strength },
      { name: 'agility', value: character.stats.agility },
      { name: 'intelligence', value: character.stats.intelligence },
      { name: 'authority', value: character.stats.authority },
      { name: 'sociability', value: character.stats.sociability },
    ];
  }, [character]);

  if (!character) return null;

  return (
    <div className="character-info">
      <div className="panel-content">
        <div id="character-name">{character.name}</div>
        <div id="character-title">{`The ${character.title}`}</div>

        {/* Character Picture */}
        <img
          className="character-picture"
          src={ASSETS.paths.portrait(character.identifier)}
          alt={character.name}
        />

        {/* Traits */}
        <div className="trait-list">
          <ul id="character-traits">
            {character.traits.map((trait, index) => (
              <li key={index}>{trait}</li>
            ))}
          </ul>
        </div>

        {/* Health and Mental Bookmarks */}
        <div 
          className="health-bookmark"
          style={{
            backgroundImage: `url(${ASSETS.paths.bookmarks.health()})`
          }}
        />
        <div 
          className="mental-bookmark"
          style={{
            backgroundImage: `url(${ASSETS.paths.bookmarks.mental()})`
          }}
        />

        {/* Stats */}
        <div className="stats-container">
          {statItems.map(({ name, value }) => (
            <div key={name} className="stat-item" data-stat={name}>
              <div className="gem-wrapper">
                <img
                  src={STAT_GEMS[name as StatName]}
                  alt={name}
                  className={`gem gem-level-${getGemLevel(value)}`}
                />
              </div>
              <span className="stat-number">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}