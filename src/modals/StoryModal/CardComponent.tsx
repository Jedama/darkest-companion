import React, { useEffect, useRef } from 'react';
import './CardComponent.css';

interface CardComponentProps {
  characterId: string;    // To get front image
  cornerIndex: number;    // Which corner to place it in
  dealDelay: number;      // How many ms before this card starts flipping/moving
  onDealComplete?: () => void; // Optional callback once the deal animation finishes
}

export function CardComponent({
  characterId,
  cornerIndex,
  dealDelay,
  onDealComplete,
}: CardComponentProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    // Delay the addition of the animation class
    const timer = setTimeout(() => {
      el.classList.add('deal-animation');
    }, dealDelay);

    // Listen for animation end to notify parent
    const handleAnimationEnd = () => {
      onDealComplete?.();
    };

    el.addEventListener('animationend', handleAnimationEnd);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('animationend', handleAnimationEnd);
    };
  }, [characterId, cornerIndex, dealDelay, onDealComplete]);

  const frontImageUrl = `src/assets/characters/card/${characterId}.png`;

  return (
    <div
      className="card-wrapper"
      ref={cardRef}
      data-corner={cornerIndex}
      style={{ zIndex: 100 - cornerIndex }} // Ensure correct stacking order
    >
      {/* The back face */}
      <div className="card-face card-back" />
      {/* The front face */}
      <div
        className="card-face card-front"
        style={{ backgroundImage: `url(${frontImageUrl})` }}
      />
    </div>
  );
}
