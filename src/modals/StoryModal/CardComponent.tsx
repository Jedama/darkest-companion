import React, { useEffect, useRef } from 'react';
import './CardComponent.css';

// TODO: Move these to a types file
interface ConsequenceChange {
  text: string;
  color: string;
  affinity?: number;
}

interface ConsequenceCharacterDisplay {
  identifier: string;
  personalChanges: ConsequenceChange[];
  relationshipChanges: Record<string, ConsequenceChange[]>;
}

interface CardComponentProps {
  characterId: string;    // To get front image
  cornerIndex: number;    // Which corner to place it in
  dealDelay: number;      // How many ms before this card starts flipping/moving
  onDealComplete?: () => void; // Optional callback once the deal animation finishes
  consequences?: ConsequenceCharacterDisplay; // Prop for consequence data

  hoveredCharacterId: string | null; // ID of the character currently hovered
  onCardHover: (id: string) => void; // Callback when this card is hovered
  onCardLeave: () => void; // Callback when this card is unhovered
  allConsequences: ConsequenceCharacterDisplay[]; // Entire array for looking up relationships
}

export function CardComponent({
  characterId,
  cornerIndex,
  dealDelay,
  onDealComplete,
  consequences,
  hoveredCharacterId,
  onCardHover,
  onCardLeave,
  allConsequences,
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

  // Logic for determining which content to show
  const isThisCardHovered = hoveredCharacterId === characterId;
  const isAnotherCardHovered = hoveredCharacterId !== null && hoveredCharacterId !== characterId;

  // Find consequences data for the character currently *being hovered* (the source of changes)
  // This is used for OTHER cards to display relationships *from* the hovered card.
  const sourceOfRelationshipsConsequences = hoveredCharacterId
    ? allConsequences.find(c => c.identifier === hoveredCharacterId)
    : undefined;

  // Get the relationship changes *from* the hovered character *to this specific card's character*
  // This array will be empty if no such changes exist or if no card is hovered.
  const relationshipsDisplayedOnThisCard = sourceOfRelationshipsConsequences
    ?.relationshipChanges[characterId] || [];

  const frontImageUrl = `src/assets/characters/card/${characterId}.png`;

  return (
    <div
      className="card-wrapper"
      ref={cardRef}
      data-corner={cornerIndex}
      style={{ zIndex: 100 - cornerIndex }}
      // Only attach hover listeners if consequences are available (i.e., phase is 'text')
      onMouseEnter={consequences ? () => onCardHover(characterId) : undefined}
      onMouseLeave={consequences ? onCardLeave : undefined}
    >
      {/* The back face */}
      <div className="card-face card-back" />
      {/* The front face */}
      <div
        className="card-face card-front"
        style={{ backgroundImage: `url(${frontImageUrl})` }}
      >
        {/* Consequence Display */}
        {consequences && (
          <div className="consequences-overlay">
            {/* Personal Changes Display */}
            <div className={`personal-changes-display ${isAnotherCardHovered ? 'inactive-content' : 'active-content'}`}>
              {consequences.personalChanges.map((change, idx) => (
                <p key={idx} style={{ color: change.color }}>
                  {change.text}
                </p>
              ))}
            </div>

            {/* Relationship Changes - This section will be hidden by default for Phase 1 */}
            <div className={`relationship-changes-display ${isAnotherCardHovered ? 'active-content' : 'inactive-content'}`}>
              {/* Only render relationship changes if there are any to display */}
              {relationshipsDisplayedOnThisCard.map((change, idx) => (
                <p key={idx} style={{ color: change.color }}>
                  {change.text}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
