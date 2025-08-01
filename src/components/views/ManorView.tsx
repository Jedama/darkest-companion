// src/components/views/ManorView.tsx

import { useState, useEffect, useRef } from 'react';

import { useEstateContext } from '../../contexts/EstateContext';
import type { Character } from '../../../shared/types/types.ts';
import { useModalContext } from '../../modals/ModalProvider';
import { StoryModal } from '../../modals/StoryModal/StoryModal';
import { ImageButton } from '../ui/buttons/ImageButton.tsx';
import townEventButton from '../../assets/ui/views/manor/button_event.png';
import './ManorView.css';

interface ManorViewProps {
  characters: Character[];
  onCharacterSelect: (character: Character) => void;
  selectedCharacterId?: string;
}

/**
 * Adds inertia-based scrolling to a container that would normally scroll with wheel events.
 */
export function useInertiaScroll(
  containerRef: React.RefObject<HTMLDivElement>,
  {
    friction = 0.99,
    velocityThreshold = 0.1,
  }: {
    friction?: number;
    velocityThreshold?: number;
  } = {}
) {
  // Current velocity
  const velocityRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // The function that does the inertia step each frame
  function animateInertia() {
    const el = containerRef.current;
    if (!el) return;

    el.scrollLeft += velocityRef.current;

    // apply friction
    velocityRef.current *= friction;

    // if velocity is large enough, keep going
    if (Math.abs(velocityRef.current) > velocityThreshold) {
      rafIdRef.current = requestAnimationFrame(animateInertia);
    } else {
      // stop
      velocityRef.current = 0;
      rafIdRef.current = null;
    }
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
    
      const delta = e.deltaY;
    
      // Amplify the delta based on its magnitude
      const amplifiedDelta = Math.sign(delta) * Math.pow(Math.abs(delta), 1.2); // Exponential boost
      velocityRef.current += amplifiedDelta;
    
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(animateInertia);
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [containerRef, friction, velocityThreshold]);
}


export function ManorView({
  characters,
  onCharacterSelect,
  selectedCharacterId
}: ManorViewProps) {
  const { currentEstate } = useEstateContext();
  const estateName = currentEstate?.estateName || 'no-estate-selected';

  // 1) Access the modal context
  const { show, hide } = useModalContext();
  
  const [frameImages, setFrameImages] = useState<{ [key: number]: string }>({});
  const [portraits, setPortraits] = useState<{ [key: string]: string }>({});
  const gridRef = useRef<HTMLDivElement>(null);

  useInertiaScroll(gridRef);

  useEffect(() => {
    // Load frame images
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

  useEffect(() => {
    // Load character portraits
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
          // Fallback portrait
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

  function handleTownEventClick() {
    show(
      <StoryModal
        // the StoryModal can close itself via onClose => hide()
        onClose={hide}
        estateName={estateName}
      />
    );
  }

  return (
    <div className="manor-view">
      <div className="portrait-grid" ref={gridRef}>
        {characters.map((character) => (
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

      <div className="manor-button-container">
        <ImageButton
          textureUrl={townEventButton}
          width={400}
          height={250}
          onClick={handleTownEventClick}
        />
      </div>
    </div>
  );
}
