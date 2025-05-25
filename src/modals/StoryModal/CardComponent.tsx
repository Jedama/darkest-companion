import React, { useEffect, useRef, useState } from 'react';
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

  const [glowStyle, setGlowStyle] = useState<{ color: string; size: string } | null>(null);

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

  // Effect to calculate glow properties based on hover and relationship changes
  useEffect(() => {
    // Only calculate glow if another card is hovered AND this card is a target
    if (isAnotherCardHovered && relationshipsDisplayedOnThisCard.length > 0) {
      let totalAffinityChange = 0;
      relationshipsDisplayedOnThisCard.forEach(change => {
        if (typeof change.affinity === 'number') {
          totalAffinityChange += change.affinity;
        }
      });

      if (totalAffinityChange !== 0) {
        // Call the helper function to get glow properties
        const calculatedGlow = calculateGlowProperties(totalAffinityChange);
        setGlowStyle(calculatedGlow);
      } else {
        // No net affinity change, so no glow
        setGlowStyle(null);
      }
    } else {
      // No other card hovered, or this card is the hovered one, so no glow here
      setGlowStyle(null);
    }
  }, [isAnotherCardHovered, relationshipsDisplayedOnThisCard]); // Dependencies for this effect

  // Helper function to map affinity to glow color and size
  const calculateGlowProperties = (affinity: number) => {
    const maxAbsAffinity = 5; // Max absolute affinity value (+/- 5)

    let color = '';
    let size = ''; // This will be the box-shadow spread value

    if (affinity > 0) {
      // Positive affinity: interpolate towards bright white
      const intensity = Math.abs(affinity) / maxAbsAffinity; // 0 to 1
      // Base opacity of 0.2, scales up to 1.0. This ensures small changes have some glow.
      const alpha = Math.min(1, 0.2 + intensity * 0.8);
      color = `rgba(255, 255, 255, ${alpha})`; // White glow
      // Min spread 5px, max spread 25px (5 + 20*intensity)
      size = `${5 + intensity * 20}px`;
    } else if (affinity < 0) {
      // Negative affinity: interpolate towards bright red
      const intensity = Math.abs(affinity) / maxAbsAffinity; // 0 to 1
      const alpha = Math.min(1, 0.2 + intensity * 0.8);
      color = `rgba(255, 0, 0, ${alpha})`; // Red glow
      size = `${5 + intensity * 20}px`;
    } else {
      // Affinity is 0
      color = 'transparent'; // No color
      size = '0px'; // No spread
    }
    return { color, size };
  };

  const frontImageUrl = `src/assets/characters/card/${characterId}.png`;

  return (
    <div
      className="card-wrapper"
      ref={cardRef}
      data-corner={cornerIndex}
      style={{ zIndex: 100 - cornerIndex }}
      // Keep hover listeners on the outer wrapper, as it defines the clickable area
      onMouseEnter={consequences ? () => onCardHover(characterId) : undefined}
      onMouseLeave={consequences ? onCardLeave : undefined}
    >
      {/* Inner wrapper for hover effect */}
      <div className="card-inner-hover-effect">
        <div
          className="card-glow-overlay"
          style={{
            // Apply box-shadow if glowStyle is present, otherwise 'none' for smooth transition out
            boxShadow: glowStyle ? `0 0 ${glowStyle.size} ${glowStyle.size} ${glowStyle.color}` : 'none',
            // Control opacity based on whether glowStyle is active
            opacity: glowStyle ? 1 : 0,
          }}
        ></div>
        
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
    </div>
  );
}
