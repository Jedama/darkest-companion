// src/components/views/ManorView.tsx

import { useState, useEffect, useRef } from 'react';

import { useEstateContext } from '../../contexts/EstateContext.js';
import type { Character } from '../../../shared/types/types.js';
import { useModalContext } from '../../modals/ModalProvider.js';
import { StoryModal } from '../../modals/StoryModal/StoryModal.js';
import { RecruitModal } from '../../modals/RecruitModal/RecruitModal.js';
import { ImageButton } from '../ui/buttons/ImageButton.js';
import { CalendarDial } from '../calendar/CalendarDial.js';

import townEventButton from '../../assets/ui/views/manor/button_event.png';
import recruitButton from '../../assets/ui/views/manor/button_recruit.png';

import './ManorView.css';

interface ManorViewProps {
  characters: Character[];
  onCharacterSelect: (character: Character) => void;
  selectedCharacterId?: string;
}

/**
 * Inertia scrolling for a horizontal container.
 *
 * Coast distance is velocity / (1 - friction), so friction is the strong knob:
 * 0.92 gives each unit of velocity ~12px of travel, 0.95 gives ~20px.
 */
export function useInertiaScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  {
    friction = 0.5,
    velocityThreshold = 0.5,
  }: {
    friction?: number;
    velocityThreshold?: number;
  } = {}
) {
  const velocityRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  /** Wheel pixels → velocity. Lower is heavier. */
  const WHEEL_MULTIPLIER = 0.35;
  /** Ceiling on a single flick, in px per frame. */
  const MAX_VELOCITY = 45;
  /** Assumed line height for mice that report deltas in lines. */
  const LINE_HEIGHT = 16;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function step() {
      const node = containerRef.current;
      if (!node) {
        rafIdRef.current = null;
        return;
      }

      const max = node.scrollWidth - node.clientWidth;
      const next = node.scrollLeft + velocityRef.current;
      const clamped = Math.max(0, Math.min(max, next));

      // Hit an end — drop the velocity instead of spinning against the wall.
      if (clamped !== next) velocityRef.current = 0;

      node.scrollLeft = clamped;
      velocityRef.current *= friction;

      if (Math.abs(velocityRef.current) > velocityThreshold) {
        rafIdRef.current = requestAnimationFrame(step);
      } else {
        velocityRef.current = 0;
        rafIdRef.current = null;
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();

      // Trackpads send horizontal deltas, wheels vertical. Take the larger.
      let delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

      // deltaMode 1 = lines, 2 = pages. Without this, different mice scroll
      // at wildly different speeds.
      if (e.deltaMode === 1) delta *= LINE_HEIGHT;
      else if (e.deltaMode === 2) delta *= el!.clientWidth;

      velocityRef.current += delta * WHEEL_MULTIPLIER;
      velocityRef.current = Math.max(
        -MAX_VELOCITY,
        Math.min(MAX_VELOCITY, velocityRef.current)
      );

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(step);
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [containerRef, friction, velocityThreshold]);
}


export function ManorView({
  characters,
  onCharacterSelect,
  // selectedCharacterId is still passed by ViewPanel and kept on the props
  // interface — destructure it again when the selected-portrait styling lands.
}: ManorViewProps) {
  const { currentEstate } = useEstateContext();
  const estateName = currentEstate?.name || 'no-estate-selected';

  const { show, hide } = useModalContext();

  const [frameImages, setFrameImages] = useState<{ [key: number]: string }>({});
  const [portraits, setPortraits] = useState<{ [key: string]: string }>({});
  const gridRef = useRef<HTMLDivElement>(null);

  useInertiaScroll(gridRef);

  // Default fallback URLs (immediately available)
  const placeholderPortraitUrl = new URL(
    '../../assets/characters/portrait/small/placeholder_190x278.png',
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
      <RecruitModal onClose={hide} />
    );
  }

  // When a portrait fails to load, replace it with default (both DOM + state).
  function handlePortraitError(characterId: string) {
    setPortraits((prev) => {
      // avoid extra state updates if already default
      if (prev[characterId] === placeholderPortraitUrl) return prev;
      return { ...prev, [characterId]: placeholderPortraitUrl };
    });
  }

  return (
    <div className="manor-view">
      <div className="portrait-grid" ref={gridRef}>
        {characters.map((character) => {
          const frameIndex = Math.min(character.level, 6);
          const frameSrc = frameImages[frameIndex] ?? defaultFrameUrl;

          const portraitSrc = portraits[character.identifier] ?? placeholderPortraitUrl;

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
                    (e.currentTarget as HTMLImageElement).src = placeholderPortraitUrl;
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

      {/* Rendered here so it lives and dies with the manor view,
          but portals itself into #overlay-root to paint above everything. */}
      <CalendarDial />
    </div>
  );
}