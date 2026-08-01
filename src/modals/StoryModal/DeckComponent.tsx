import { useEffect, useMemo, useRef } from 'react';
import './DeckComponent.css';

/* -------------------------------------------------------------------
 *  Shuffle timing — the single source of truth.
 *
 *  Every value below is applied to the cards as an inline style AND used to
 *  work out when the shuffle is over. Previously the completion callback fired
 *  on a hardcoded 3000ms while the animation itself finished at roughly 1.5s,
 *  so the deck sat motionless for about a second and a half before dealing.
 * ------------------------------------------------------------------- */

const DECK_SIZE = 8;   // Number of visible cards in the stack
const OFFSET = 3;      // Offset between each card, in px

const ITERATIONS = 3;
const DELAY_BASE_S = 0.7;
const DELAY_JITTER_S = 0.1;
const DURATION_BASE_S = 0.2;
const DURATION_JITTER_S = 0.05;

/** Beat of stillness after the last card settles, before dealing starts. */
const HOLD_AFTER_SHUFFLE_MS = 400;

interface DeckComponentProps {
  phase: string;
  onShuffleComplete: () => void; // Callback to notify parent when shuffle is done
}

export function DeckComponent({ phase, onShuffleComplete }: DeckComponentProps) {
  /**
   * Generated once, not during render. Math.random() in the render body meant
   * every re-render — and the story flow triggers several while the deck is up
   * — reshuffled the scatter, so the stack visibly twitched mid-animation.
   */
  const cards = useMemo(
    () =>
      Array.from({ length: DECK_SIZE }, (_, index) => {
        const isBottom = index === 0;
        return {
          // Slight random offset (-2px to +2px)
          x: index * OFFSET + (isBottom ? 0 : Math.random() * 4 - 2),
          y: index * OFFSET + (isBottom ? 0 : Math.random() * 4 - 2),
          // Alternate between clockwise and counterclockwise rotation, ±2deg
          rotation: isBottom ? 0 : Math.random() * 2 * (index % 2 === 0 ? 1 : -1),
          delayS: DELAY_BASE_S + Math.random() * DELAY_JITTER_S,
          durationS: DURATION_BASE_S + Math.random() * DURATION_JITTER_S,
          animationName: index % 2 === 0 ? 'shuffle-clockwise' : 'shuffle-counterclockwise',
        };
      }),
    []
  );

  /** When the slowest card stops moving, derived from the values above. */
  const shuffleEndsMs = useMemo(
    () =>
      Math.max(...cards.map((card) => card.delayS + card.durationS * ITERATIONS)) * 1000,
    [cards]
  );

  // Ref so a parent re-render can't restart the timer part-way through.
  const onShuffleCompleteRef = useRef(onShuffleComplete);
  onShuffleCompleteRef.current = onShuffleComplete;

  useEffect(() => {
    const timer = window.setTimeout(
      () => onShuffleCompleteRef.current(),
      shuffleEndsMs + HOLD_AFTER_SHUFFLE_MS
    );
    return () => window.clearTimeout(timer);
  }, [shuffleEndsMs]);

  return (
    <div className={`deck-container ${phase === 'text' ? 'deck-fade-out' : ''}`}>
      {cards.map((card, index) => (
        <div
          key={index}
          className="deck-card"
          style={{
            zIndex: DECK_SIZE - index,
            transform: `translate(${card.x}px, ${card.y}px) rotate(${card.rotation}deg)`,
            animationName: card.animationName,
            animationDuration: `${card.durationS}s`,
            animationDelay: `${card.delayS}s`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: ITERATIONS,
          }}
        />
      ))}
    </div>
  );
}