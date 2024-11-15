// src/components/views/ManorView.tsx
import { useState, useEffect, useRef } from 'react';
import type { Character } from '../../../shared/types/types.ts';
import './ManorView.css'; 

interface ManorViewProps {
  characters: Character[];
  onCharacterSelect: (character: Character) => void;
  selectedCharacterId?: string;
}

export function ManorView({ characters, onCharacterSelect, selectedCharacterId }: ManorViewProps) {
  const [frameImages, setFrameImages] = useState<{ [key: number]: string }>({});
  const [portraits, setPortraits] = useState<{ [key: string]: string }>({});
  const gridRef = useRef<HTMLDivElement>(null);

  // Load frame images
  useEffect(() => {
    const loadFrameImages = async () => {
      const frames: { [key: number]: string } = {};
      for (let i = 0; i <= 6; i++) {
        try {
          const framePath = new URL(
            `../../assets/ui/views/manor/frame_${i}.png`, 
            import.meta.url
          ).href;
          frames[i] = framePath;
        } catch (error) {
          console.error(`Failed to load frame_${i}.png`);
        }
      }
      setFrameImages(frames);
    };
    
    loadFrameImages();
  }, []);

  // Load character portraits
  useEffect(() => {
    const loadPortraits = async () => {
      const loadedPortraits: { [key: string]: string } = {};
      for (const character of characters) {
        try {
          const portraitPath = new URL(
            `../../assets/characters/portrait/small/${character.identifier}_190x278.png`,
            import.meta.url
          ).href;
          loadedPortraits[character.identifier] = portraitPath;
        } catch (error) {
          // Use default portrait if character portrait is missing
          const defaultPath = new URL(
            '../../assets/ui/default_portrait.png',
            import.meta.url
          ).href;
          loadedPortraits[character.identifier] = defaultPath;
        }
      }
      setPortraits(loadedPortraits);
    };

    loadPortraits();
  }, [characters]);

  // Handle mouse wheel scrolling
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      grid.scrollLeft += e.deltaY;
    };

    grid.addEventListener('wheel', handleWheel);
    return () => {
      grid.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div className="manor-view">
      <div className="portrait-grid" ref={gridRef}>
        {characters.map(character => (
          <div
            key={character.identifier}
            className="portrait-container"
            onClick={() => onCharacterSelect(character)}
          >
            <div className="portrait-frame">
              <img
                src={frameImages[Math.min(character.level, 6)]}
                alt={`Level ${character.level} frame`}
                className="frame-image"
              />
              <img
                src={portraits[character.identifier]}
                alt={character.name}
                className="character-portrait"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
