// src/components/views/ManorView.tsx

import { useState, useEffect, useRef } from 'react';

import { useEstateContext } from '../../contexts/EstateContext';
import type { Character } from '../../../shared/types/types.ts';
import { useModalContext } from '../../modals/ModalProvider';
import { StoryModal } from '../../modals/StoryModal/StoryModal';
import { ImageButton } from '../ui/buttons/ImageButton.tsx';

import townEventButton from '../../assets/ui/views/manor/button_event.png';
import recruitButton from '../../assets/ui/views/manor/button_recruit.png';

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
  selectedCharacterId,
}: ManorViewProps) {
  const { currentEstate } = useEstateContext();
  const estateName = currentEstate?.estateName || 'no-estate-selected';

  const { show, hide } = useModalContext();

  const [frameImages, setFrameImages] = useState<{ [key: number]: string }>({});
  const [portraits, setPortraits] = useState<{ [key: string]: string }>({});
  const gridRef = useRef<HTMLDivElement>(null);

  useInertiaScroll(gridRef);

  // Default fallback URLs (immediately available)
  const defaultPortraitUrl = new URL(
    '../../assets/ui/views/manor/defaultportrait_190x278.png',
    import.meta.url
  ).href;

  // Pick whatever "safe default frame" you want. frame_0 is a reasonable baseline.
  const defaultFrameUrl = new URL(
    '../../assets/ui/views/manor/frame_0.png',
    import.meta.url
  ).href;

  useEffect(() => {
    const loadFrameImages = async () => {
      const frames: { [key: number]: string } = {};
      for (let i = 0; i <= 6; i++) {
        // new URL won't throw for missing files at runtime, but this is fine as a URL builder.
        frames[i] = new URL(
          `../../assets/ui/views/manor/frame_${i}.png`,
          import.meta.url
        ).href;
      }
      setFrameImages(frames);
    };
    loadFrameImages();
  }, []);

  useEffect(() => {
    const loadedPortraits: { [key: string]: string } = {};
    for (const character of characters) {
      loadedPortraits[character.identifier] = new URL(
        `../../assets/characters/portrait/small/${character.identifier}_190x278.png`,
        import.meta.url
      ).href;
    }
    setPortraits(loadedPortraits);
  }, [characters]);

  function handleTownEventClick() {
    show(
      <StoryModal
        onClose={hide}
        estateName={estateName}
      />
    );
  }

  function handleRecruitClick() {
    show(
      <div style={{ padding: 20 }}>
        <h2>New Recruit</h2>
        <p>Recruit modal goes here.</p>
        <button onClick={hide}>Close</button>
      </div>
    );
  }

  // When a portrait fails to load, replace it with default (both DOM + state).
  function handlePortraitError(characterId: string) {
    setPortraits((prev) => {
      // avoid extra state updates if already default
      if (prev[characterId] === defaultPortraitUrl) return prev;
      return { ...prev, [characterId]: defaultPortraitUrl };
    });
  }

  return (
    <div className="manor-view">
      <div className="portrait-grid" ref={gridRef}>
        {characters.map((character) => {
          const frameIndex = Math.min(character.level, 6);
          const frameSrc = frameImages[frameIndex] ?? defaultFrameUrl;

          const portraitSrc = portraits[character.identifier] ?? defaultPortraitUrl;

          return (
            <div
              key={character.identifier}
              className="portrait-container"
              onClick={() => onCharacterSelect(character)}
              // optional: if you later use selectedCharacterId, you can toggle a class here
              // data-selected={selectedCharacterId === character.identifier}
            >
              <div className="portrait-frame">
                <img
                  src={frameSrc}
                  alt={`Level ${character.level} frame`}
                  className="frame-image"
                />
                <img
                  src={portraitSrc}
                  alt={character.name}
                  className="character-portrait"
                  onError={(e) => {
                    // DOM immediate fallback to stop broken-image icon
                    (e.currentTarget as HTMLImageElement).src = defaultPortraitUrl;
                    handlePortraitError(character.identifier);
                  }}
                />
              </div>
            </div>
          );
        })}
        <div className="portrait-container recruit-tile">
          <div className="portrait-frame">
            <div className="recruit-button-wrapper">
              <ImageButton
                textureUrl={recruitButton}
                onClick={handleRecruitClick}
              />
            </div>
          </div>
        </div>
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
