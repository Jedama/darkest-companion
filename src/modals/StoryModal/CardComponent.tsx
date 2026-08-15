import { useEffect, useRef, useState } from 'react';
import type { AnimationEvent } from 'react';
import type { ConsequenceCharacterDisplay } from '../../utils/api.js';
import './CardComponent.css';

/** Max absolute affinity value (+/- 5), used to scale the glow. */
const MAX_ABS_AFFINITY = 5;

/** Stable empty array, so "no relationships" isn't a new reference each render. */
const NO_CHANGES: never[] = [];

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

/** Maps a net affinity change to a glow colour and spread. */
function glowFor(affinity: number): { color: string; size: string } | null {
  if (affinity === 0) return null;

  const intensity = Math.min(Math.abs(affinity) / MAX_ABS_AFFINITY, 1);
  // Base opacity of 0.2 so even small changes register, scaling up to 1.0.
  const alpha = Math.min(1, 0.2 + intensity * 0.8);

  return {
    color: affinity > 0 ? `rgba(255, 255, 255, ${alpha})` : `rgba(255, 0, 0, ${alpha})`,
    size: `${5 + intensity * 20}px`, // 5px min spread, 25px max
  };
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
  /**
   * React owns the animation class now, rather than a classList.add() from
   * inside an effect. Same visual result, but the DOM can no longer disagree
   * with the component about whether this card has been dealt.
   */
  const [isDealing, setIsDealing] = useState(false);

  /**
   * The parent passes a fresh arrow every render. Holding it in a ref keeps it
   * out of the effect's dependencies — otherwise every parent re-render (and
   * the story flow causes several while cards are in flight) would clear the
   * pending timer and restart the deal delay from zero.
   */
  const onDealCompleteRef = useRef(onDealComplete);
  onDealCompleteRef.current = onDealComplete;

  /** Deal completion is reported exactly once, whatever the DOM does. */
  const hasReportedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsDealing(true), dealDelay);
    return () => window.clearTimeout(timer);
  }, [dealDelay]);

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    // animationend bubbles. Without this, any animation on a child — a face, an
    // overlay, anything added later — would report the deal as finished and
    // shunt the story straight to its text phase.
    if (event.target !== event.currentTarget) return;

    if (hasReportedRef.current) return;
    hasReportedRef.current = true;
    onDealCompleteRef.current?.();
  };

  // Which content to show
  const isThisCardHovered = hoveredCharacterId === characterId;
  const isAnotherCardHovered = hoveredCharacterId !== null && !isThisCardHovered;

  // Relationship changes FROM the hovered character TO this card's character.
  const incomingChanges =
    (hoveredCharacterId
      ? allConsequences.find((c) => c.identifier === hoveredCharacterId)?.relationshipChanges[
          characterId
        ]
      : undefined) ?? NO_CHANGES;

  /**
   * Derived during render rather than pushed into state by an effect. The glow
   * is a pure function of the props, so storing it was an extra render and an
   * extra chance for the two to disagree.
   */
  const netAffinity =
    isAnotherCardHovered && incomingChanges.length > 0
      ? incomingChanges.reduce((sum, change) => sum + (change.affinity ?? 0), 0)
      : 0;

  const glow = glowFor(netAffinity);

  // Built with new URL so Vite fingerprints it at build time. A plain
  // 'src/assets/...' string only resolves under the dev server.
  const frontImageUrl = new URL(
    `../../assets/characters/card/${characterId}.png`,
    import.meta.url
  ).href;

  return (
    <div
      className={`card-wrapper${isDealing ? ' deal-animation' : ''}`}
      data-corner={cornerIndex}
      style={{ zIndex: 100 - cornerIndex }}
      onAnimationEnd={handleAnimationEnd}
      // Hover listeners stay on the outer wrapper, which defines the hit area.
      onMouseEnter={consequences ? () => onCardHover(characterId) : undefined}
      onMouseLeave={consequences ? onCardLeave : undefined}
    >
      {/* Inner wrapper for hover effect */}
      <div className="card-inner-hover-effect">
        <div
          className="card-glow-overlay"
          style={{
            boxShadow: glow ? `0 0 ${glow.size} ${glow.size} ${glow.color}` : 'none',
            opacity: glow ? 1 : 0,
          }}
        />

        {/* The back face */}
        <div className="card-face card-back" />

        {/* The front face */}
        <div className="card-face card-front" style={{ backgroundImage: `url(${frontImageUrl})` }}>
          {consequences && (
            <div className="consequences-overlay">
              <div
                className={`personal-changes-display ${
                  isAnotherCardHovered ? 'inactive-content' : 'active-content'
                }`}
              >
                {consequences.personalChanges.map((change, idx) => (
                  <p key={idx} style={{ color: change.color }}>
                    {change.text}
                  </p>
                ))}
              </div>

              <div
                className={`relationship-changes-display ${
                  isAnotherCardHovered ? 'active-content' : 'inactive-content'
                }`}
              >
                {incomingChanges.map((change, idx) => (
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