// src/components/modals/RecruitModal/RecruitModal.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useGameData } from '../../contexts/GameDataContext';
import { useEstateContext } from '../../contexts/EstateContext';
import { ImageButton } from '../../components/ui/buttons/ImageButton';
import { recruitCharacter, isAbortError } from '../../utils/api';
import './RecruitModal.css';

interface RecruitModalProps {
  onClose: () => void;
}

interface SealData {
  text: string;
  x: number;
  y: number;
  rotation: number;
}

// 9-Grid Positions
const SEAL_POSITIONS = [
    { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 },
    { x: 10, y: 45 }, { x: 50, y: 45 }, { x: 90, y: 45 },
    { x: 10, y: 80 }, { x: 50, y: 80 }, { x: 90, y: 80 }
];

const placeholderSrc = new URL('../../assets/characters/recruit/placeholder.png', import.meta.url).href;
const hireButtonSrc = new URL('../../assets/ui/modals/recruitmodal/hire.png', import.meta.url).href;

// Inline for now, matching CalendarDial's approach. Move to a .recruit-error
// rule when you next touch RecruitModal.css.
const errorStyle: CSSProperties = {
  maxWidth: '28rem',
  margin: '0.5rem auto 0',
  padding: '0.5rem 1rem',
  textAlign: 'center',
  background: 'rgba(20, 16, 14, 0.92)',
  border: '1px solid rgba(180, 150, 110, 0.45)',
  color: '#e8ddc8',
  font: '0.9rem/1.4 inherit',
};

export function RecruitModal({ onClose }: RecruitModalProps) {
  const { characterDefinitions } = useGameData();
  const { currentEstate, handleLoadEstate } = useEstateContext();
  const estateName = currentEstate?.name || '';
  const selectRef = useRef<HTMLSelectElement>(null);

  // 1. Filter & Sort Available Characters
  const availableClasses = useMemo(() => {
    if (!currentEstate) return [];
    
    const ownedIdentifiers = Object.values(currentEstate.characters).map(c => c.identifier);
    
    const filtered = Object.values(characterDefinitions).filter(
      def => !ownedIdentifiers.includes(def.identifier)
    );

    return filtered.sort((a, b) => a.title.localeCompare(b.title));
  }, [characterDefinitions, currentEstate]);

  // 1b. Pre-calculate URLs for all available classes to ensure stability
  const classImages = useMemo(() => {
    return availableClasses.map(c => ({
      id: c.identifier,
      src: new URL(`../../assets/characters/recruit/${c.identifier}.png`, import.meta.url).href
    }));
  }, [availableClasses]);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [name, setName] = useState('');
  const [modifierInput, setModifierInput] = useState('');
  const [seals, setSeals] = useState<SealData[]>([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Recruitment is two chained LLM calls; closing the modal walks away. */
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (availableClasses.length > 0 && !selectedClassId) {
      handleClassChange(availableClasses[0].identifier);
    }
    if (selectRef.current) {
      selectRef.current.focus();
    }
  }, [availableClasses]);

  const handleClassChange = (id: string) => {
    setSelectedClassId(id);
    const def = characterDefinitions[id];
    if (def) {
      setName(def.name);
    }
    setSeals([]);
    setModifierInput('');
    setError(null);
  };

  const handleModifierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = modifierInput.trim();
      if (!text) return;
      if (seals.length >= 9) return;

      const posIndex = seals.length % SEAL_POSITIONS.length;
      const basePos = SEAL_POSITIONS[posIndex];
      const x = basePos.x + (Math.random() * 4 - 2);
      const y = basePos.y + (Math.random() * 4 - 2);
      const rotation = Math.random() * 40 - 20;

      setSeals(prev => [...prev, { text, x, y, rotation }]);
      setModifierInput(''); 
    }
  };

  const handleRecruit = async () => {
    if (seals.length === 0 || !selectedClassId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setIsSubmitting(true);
    try {
      const context = `Personality modifiers for the new recruit: ${seals
        .map(s => s.text)
        .join(', ')}`;

      await recruitCharacter(
        estateName,
        {
          eventId: 'recruit_0',
          characterId: selectedClassId,
          name,
          context,
        },
        controller.signal
      );

      await handleLoadEstate(estateName);
      onClose();
    } catch (err) {
      if (isAbortError(err)) return; // modal closed mid-flight
      console.error('Recruitment failed:', err);
      setError(err instanceof Error ? err.message : 'Recruitment failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = seals.length === 0 || isSubmitting;

  if (availableClasses.length === 0) {
    return (
      <div className="recruit-modal-container">
        <div className="recruit-content">
          <h2 className="recruit-title">Roster Full</h2>
          <p>No new recruits available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="recruit-modal-container">
      <div className="recruit-content">
        
        <h2 className="recruit-title">Recruit</h2>

        <div className="recruit-input-group">
          <select 
            ref={selectRef}
            className="recruit-input"
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
          >
            {availableClasses.map(c => (
              <option key={c.identifier} value={c.identifier}>
                {c.title}
              </option>
            ))}
          </select>

          <input 
            type="text" 
            className="recruit-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            maxLength={20}
          />
        </div>

        {/* --- Image Area --- */}
        <div className="recruit-image-container">
          
          {/* Render ALL available images, but hide the non-selected ones.
              This keeps them decoded in the DOM. */}
          {classImages.map((imgData) => (
            <img 
              key={imgData.id}
              src={imgData.src} 
              alt="Recruit" 
              className="recruit-image"
              // Use display: none instead of removing from DOM
              style={{ display: imgData.id === selectedClassId ? 'block' : 'none' }}
              onError={(e) => {
                 e.currentTarget.src = placeholderSrc;
                 e.currentTarget.onerror = null;
              }}
            />
          ))}

          {/* Seals Overlay */}
          {seals.map((seal, index) => (
            <div 
              key={index}
              className="seal-overlay"
              style={{
                left: `${seal.x}%`,
                top: `${seal.y}%`,
                transform: `translate(-50%, -50%) rotate(${seal.rotation}deg)`
              }}
            >
              {seal.text}
            </div>
          ))}
        </div>

        <div className="modifier-section">
          <input 
            type="text" 
            className="recruit-input"
            placeholder="Enter quirk..."
            value={modifierInput}
            onChange={(e) => setModifierInput(e.target.value)}
            onKeyDown={handleModifierKeyDown}
            disabled={seals.length >= 9} 
          />
        </div>

        {error && (
          <div className="recruit-error" style={errorStyle} role="alert">
            {error}
          </div>
        )}

        <div className={`recruit-hire-btn ${isDisabled ? 'disabled' : ''}`}>
          <ImageButton 
            textureUrl={hireButtonSrc}
            width={140}
            height={140}
            onClick={handleRecruit}
            disabled={isDisabled} 
          />
        </div>

      </div>
    </div>
  );
}