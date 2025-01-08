import React, { useEffect } from 'react';
import './DeckComponent.css';

interface DeckComponentProps {
  onShuffleComplete: () => void; // Callback to notify parent when shuffle is done
}

export function DeckComponent({ onShuffleComplete }: DeckComponentProps) {
  useEffect(() => {
    // Notify parent after the shuffle animation is complete
    const timer = setTimeout(() => {
      onShuffleComplete();
    }, 3000); // Shuffle duration in milliseconds (3 seconds)

    return () => clearTimeout(timer); // Cleanup timer if unmounted early
  }, [onShuffleComplete]);

  const deckSize = 8; // Number of visible cards in the stack
  const offset = 3; // Offset between each card

  return (
    <div className="deck-container">
      {[...Array(deckSize)].map((_, index) => {
        const randomX = index === 0 ? 0 : Math.random() * 4 - 2; // Slight random offset (-2px to +2px)
        const randomY = index === 0 ? 0 : Math.random() * 4 - 2;

        // Alternate between clockwise and counterclockwise rotation
        const rotationDirection = index % 2 === 0 ? 1 : -1;
        const rotationAmount = index === 0 ? 0 : (Math.random() * 2) * rotationDirection; // ±2 degrees

        // Add random delay to each card's animation
        const animationDelay = 0.5 + Math.random() * 0.1; // 0.5-0.6s delay
        const animationDuration = 0.15 + Math.random() * 0.05; // 0.15-0.2s

        return (
          <div
            key={index}
            className="deck-card"
            style={{
              zIndex: deckSize - index,
              transform: `translate(${index * offset + randomX}px, ${
                index * offset + randomY
              }px) rotate(${rotationAmount}deg)`,
              animation: `${index % 2 === 0 ? 'shuffle-clockwise' : 'shuffle-counterclockwise'} 
                         ${animationDuration}s 
                         ${animationDelay}s 
                         ease-in-out`,
              animationIterationCount: '3'
            }}
          ></div>
        );
      })}
    </div>
  );
}
