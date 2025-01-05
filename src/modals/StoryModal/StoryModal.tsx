// src/components/storymodal/StoryModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { DeckComponent } from './DeckComponent';
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

export function StoryModal({ estateName, onClose }: StoryModalProps) {
  const [phase, setPhase] = useState<'loading' | 'deck' | 'text'>('loading');
  const [error, setError] = useState<string | null>(null);

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
            signal, // Attach the abort signal
          }
        );
        if (!setupRes.ok) {
          throw new Error(`Setup route failed: ${setupRes.status}`);
        }
        const setupData: SetupResponse = await setupRes.json();
        if (!setupData.success) {
          throw new Error('Setup returned success=false');
        }
  
        setPhase('deck');
        console.log('setupData:', setupData);
  
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
            signal, // Attach the abort signal
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
  
        // Set the story data
        setStoryTitle(storyData.story.title);
        setStoryBody(storyData.story.body);
        setPhase('text');
      } catch (err: any) {
        if (signal.aborted) {
          // Prevent duplicate calls by blocking subsequent calls during React's Strict Mode behavior
          return;
        }
        console.error('Error in fetchStoryFlow:', err);
        setError(err.message);
      }
    }
  
    fetchStoryFlow();
  
    return () => {
      // Abort the fetch if the component unmounts
      controller.abort();
    };
  }, [estateName]);

  if (error) {
    return (
      <div className="story-modal-content">
        <p className="error">{error}</p>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }

  if (phase === 'deck') {
    return (
      <div className="story-modal-content">
        <DeckComponent onShuffleComplete={() => setPhase('text')} />
      </div>
    );
  }

  return (
    <div className="story-modal-content fade-in">
      <h1 className="story-title">{storyTitle}</h1>
      <div className="story-body">
        {storyBody.split('\n').map((line, idx) => (
          <p key={idx}>{line}</p>
        ))}
      </div>
    </div>
  );
}
