// src/components/storymodal/StoryModal.tsx

import React, { useState, useEffect } from 'react';
import { DeckComponent } from './DeckComponent';
import { CardComponent } from './CardComponent';  
import { ImageButton } from '../../components/ui/buttons/ImageButton.tsx';
import { ActivityLog } from './ActivityLog.tsx';
import './StoryModal.css';
import './ActivityLog.css';

interface StoryModalProps {
  estateName: string;
  onClose: () => void; // from the modal provider or a parent
}

interface SetupResponse {
  success: boolean;
  event: any;
  chosenCharacterIds: string[];
  locations: any[];
  npcs: string[];
  bystanders: Array<{
    characterId: string;
    connectionType: 'residence' | 'workplace' | 'frequent';
  }>;
}

interface StoryResponse {
  success: boolean;
  prompt: string;
  story: {
    title: string;
    body: string;
  };
}

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

interface ConsequenceResponse {
  success: boolean;
  display: {
    characters: ConsequenceCharacterDisplay[];
  };
}

type Phase = 'input' | 'loading' | 'deck' | 'deal' | 'text';

export function StoryModal({ estateName, onClose }: StoryModalProps) {
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);

  const [chosenCharacterIds, setChosenCharacterIds] = useState<string[]>([]);

  const [storyTitle, setStoryTitle] = useState('');
  const [storyBody, setStoryBody] = useState('');
  const [consequenceDisplay, setConsequenceDisplay] = useState<ConsequenceCharacterDisplay[]>([]);

  const [hoveredCharacterId, setHoveredCharacterId] = useState<string | null>(null);

  const fetchStoryFlow = React.useCallback(async (userPrompt: string | null) => {
    const controller = new AbortController();
    const signal = controller.signal;
    setError(null); // Clear previous errors
  
    setPhase('deck');

    try {
      // 1) Setup random event (now with optional userPrompt)
      const setupRes = await fetch(
        `http://localhost:3000/estates/${estateName}/events/setup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            description: userPrompt
          }),
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

      // Transition to deck phase AFTER fetching setup data
      // (This transition now happens from handleLogProceed, not directly in useEffect)
      // setPhase('deck'); // This is handled by handleLogProceed

      // 2) Story route
      const storyRes = await fetch(
        `http://localhost:3000/estates/${estateName}/events/story`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: setupData.event,
            chosenCharacterIds: setupData.chosenCharacterIds,
            locations: setupData.locations,
            npcIds: setupData.npcs,
            bystanders: setupData.bystanders
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

      setStoryTitle(storyData.story.title);
      setStoryBody(storyData.story.body);

      // 3) Consequences route
      const consequenceRes = await fetch(
        `http://localhost:3000/estates/${estateName}/events/consequences`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            story: storyData.story.body,
            chosenCharacterIds: setupData.chosenCharacterIds,
          }),
          signal,
        }
      );
      
      if (!consequenceRes.ok) {
        throw new Error(`Consequences route failed: ${consequenceRes.status}`);
      }
      
      const consequenceData: ConsequenceResponse = await consequenceRes.json();
      if (!consequenceData.success) {
        throw new Error('Consequences route returned success=false');
      }
      
      setConsequenceDisplay(consequenceData.display.characters);

    } catch (err: any) {
      if (signal.aborted) return;
      console.error('Error in fetchStoryFlow:', err);
      setError(err.message);
      // If an error occurs, maybe reset phase or stay on logInput
      setPhase('input'); // Allow user to try again
    }
  }, [estateName]);
  
  useEffect(() => {
    // We can potentially add some pre-loading logic here if needed,
    // but the main data fetch is now user-triggered.
  }, []);

  const handleShuffleComplete = React.useCallback(() => {
    console.log('Deck shuffle complete!');
    setPhase('deal');
  }, [setPhase]);

   // Handler for when the user proceeds from the Activity Log
  const handleLogProceed = React.useCallback(async (logContent: string | null) => {
    setPhase('loading'); // Show loading screen while fetching
    await fetchStoryFlow(logContent);
  }, [fetchStoryFlow]);

  // Hover Handlers
  const handleCardHover = React.useCallback((id: string) => {
    setHoveredCharacterId(id);
  }, []);

  const handleCardLeave = React.useCallback(() => {
    setHoveredCharacterId(null);
  }, []);

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
      </div>
    );
  }

  // ---- ACTUAL RENDER ----
  // We do ONE return statement with all possible elements,
  // but we conditionally show/hide them based on the phase.

  return (
    <div className="story-modal-content">
      {phase === 'input' && (
        <ActivityLog onProceed={handleLogProceed} />
      )}
      
      {['deck', 'deal', 'text'].includes(phase) && (
        <DeckComponent
          phase={phase} 
          onShuffleComplete={handleShuffleComplete}
        />
      )}

      {['deal', 'text'].includes(phase) && (
        <>
          {chosenCharacterIds.map((id, i) => {
            // Find the consequences for this specific character
            const charConsequences = consequenceDisplay.find(
              (c) => c.identifier === id
            );
            return (
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
                // Pass consequences only when phase is 'text'
                consequences={phase === 'text' ? charConsequences : undefined} 
                hoveredCharacterId={hoveredCharacterId}
                onCardHover={handleCardHover}
                onCardLeave={handleCardLeave}
                allConsequences={consequenceDisplay}
              />
            );
          })}
        </>
      )}

      {/* 
        3) The STORY TEXT:
           Shown if phase === 'text' (or you could do >= 'text' if 
           you want it visible once dealing starts, etc.)
      */}
      {phase === 'text' && storyTitle && storyBody && (
        <div className="fade-in story-text-container">
          <h1 className="story-title">{storyTitle}</h1>
          <div className="story-body">
            {storyBody.split('\n').map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>

          {/* Buttons are inside the same container */}
          <div className="story-buttons">
            <ImageButton
              textureUrl="src/assets/ui/modals/storymodal/return.png"
              width={192}
              height={192}
              onClick={onClose} 
            />
            <ImageButton
              textureUrl="src/assets/ui/modals/storymodal/continue.png"
              width={192}
              height={192}
            />
          </div>
        </div>
      )}
    </div>
  );
}
