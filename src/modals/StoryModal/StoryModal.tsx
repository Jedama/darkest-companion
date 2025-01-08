// src/components/storymodal/StoryModal.tsx

import React, { useState, useEffect } from 'react';
import { DeckComponent } from './DeckComponent';
import { CardComponent } from './CardComponent';  // Our new card flipping component
import './StoryModal.css';

interface StoryModalProps {
  estateName: string;
  onClose: () => void; // from the modal provider or a parent
}

interface SetupResponse {
  success: boolean;
  event: any;
  chosenCharacterIds: string[];
}

interface StoryResponse {
  success: boolean;
  prompt: string;
  story: {
    title: string;
    body: string;
  };
}

type Phase = 'loading' | 'deck' | 'deal' | 'text';

export function StoryModal({ estateName, onClose }: StoryModalProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);

  const [chosenCharacterIds, setChosenCharacterIds] = useState<string[]>([]);

  const [storyTitle, setStoryTitle] = useState('');
  const [storyBody, setStoryBody] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
  
    async function fetchStoryFlow() {
      try {
        // 1) Setup random event
        const setupRes = await fetch(
          `http://localhost:3000/estates/${estateName}/events/setup-random`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
          }
        );
        if (!setupRes.ok) {
          throw new Error(`Setup route failed: ${setupRes.status}`);
        }
        const setupData: SetupResponse = await setupRes.json();
        if (!setupData.success) {
          throw new Error('Setup returned success=false');
        }

        console.log('setupData:', setupData);
        setChosenCharacterIds(setupData.chosenCharacterIds);

        // Go to deck phase
        setPhase('deck');

        // 2) Story route
        const storyRes = await fetch(
          `http://localhost:3000/estates/${estateName}/events/story`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: setupData.event,
              chosenCharacterIds: setupData.chosenCharacterIds,
            }),
            signal,
          }
        );
        if (!storyRes.ok) {
          throw new Error(`Story route failed: ${storyRes.status}`);
        }
        const storyData: StoryResponse = await storyRes.json();
        if (!storyData.success) {
          throw new Error('Story route returned success=false');
        }

        console.log('storyRes:', storyData);
        setStoryTitle(storyData.story.title);
        setStoryBody(storyData.story.body);
      } catch (err: any) {
        if (signal.aborted) return;
        console.error('Error in fetchStoryFlow:', err);
        setError(err.message);
      }
    }
  
    fetchStoryFlow();
    return () => controller.abort();
  }, []);

  const handleShuffleComplete = React.useCallback(() => {
    console.log('Deck shuffle complete!');
    setPhase('deal');
  }, [setPhase]);

  // Handle errors
  if (error) {
    return (
      <div className="story-modal-content">
        <p className="error">{error}</p>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }

  // If we're still waiting for the setup route to finish
  if (phase === 'loading') {
    return (
      <div className="story-modal-content">
        <p>Loading event...</p>
      </div>
    );
  }

  // ---- ACTUAL RENDER ----
  // We do ONE return statement with all possible elements,
  // but we conditionally show/hide them based on the phase.

  return (
    <div className="story-modal-content">
      {/* 
        1) The DECK: 
           Show the deck if phase >= 'deck'. 
           Let it remain there through dealing & text if you want.
      */}
      <DeckComponent onShuffleComplete={handleShuffleComplete} />

      {/* 
        2) The CARDS: 
           Show them if we are in the 'deal' phase or beyond 
           (so they stay on screen during the text). 
      */}
      {['deal', 'text'].includes(phase) && (
        <>
          {chosenCharacterIds.map((id, i) => (
            <CardComponent
              key={id}
              characterId={id}
              cornerIndex={i}
              // stagger by 1s
              dealDelay={i * 1000}
              onDealComplete={() => {
                console.log(`Card ${id} finished dealing.`);
                // If it’s the last card, we can move on to text phase,
                // but only if we’re still in 'deal' phase:
                if (i === chosenCharacterIds.length - 1 && phase === 'deal') {
                  setPhase('text');
                }
              }}
            />
          ))}
        </>
      )}

      {/* 
        3) The STORY TEXT:
           Shown if phase === 'text' (or you could do >= 'text' if 
           you want it visible once dealing starts, etc.)
      */}
      {phase === 'text' && (
        <div className="fade-in story-text-container">
          <h1 className="story-title">{storyTitle}</h1>
          <div className="story-body">
            {storyBody.split('\n').map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
