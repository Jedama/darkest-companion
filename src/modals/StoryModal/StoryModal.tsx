// src/components/storymodal/StoryModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import { DeckComponent } from './DeckComponent.js';
import { CardComponent } from './CardComponent.js';
import { ActivityLog } from './ActivityLog.js';
import { ImageButton } from '../../components/ui/buttons/ImageButton.js';
import { LoadingIndicator } from '../../components/ui/LoadingIndicator.js';
import { ErrorNotice } from '../../components/ui/ErrorNotice.js';
import { parseFormattedText } from '../../utils/textUtils.js';
import { useEstateContext } from '../../contexts/EstateContext.js';
import {
  setupStoryEvent,
  generateStory,
  generateConsequences,
  isAbortError,
} from '../../utils/api.js';
import type { ConsequenceCharacterDisplay } from '../../utils/api.js';

// Imported, not written as 'src/assets/...' strings: raw paths resolve in the
// dev server but 404 after a production build. Same folder as ActivityLog's.
import returnButtonSrc from '../../assets/ui/modals/storymodal/return.png';
import continueButtonSrc from '../../assets/ui/modals/storymodal/continue.png';

import './StoryModal.css';
import './ActivityLog.css';

interface StoryModalProps {
  estateName: string;
  onClose: () => void; // from the modal provider or a parent
}

type Phase = 'input' | 'loading' | 'deck' | 'deal' | 'text';

export function StoryModal({ estateName, onClose }: StoryModalProps) {
  const { runExclusive, activity } = useEstateContext();

  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);

  const [chosenCharacterIds, setChosenCharacterIds] = useState<string[]>([]);

  const [storyTitle, setStoryTitle] = useState('');
  const [storyBody, setStoryBody] = useState('');
  const [consequenceDisplay, setConsequenceDisplay] = useState<ConsequenceCharacterDisplay[]>([]);

  const [hoveredCharacterId, setHoveredCharacterId] = useState<string | null>(null);

  /**
   * Cancels the in-flight chain. The story flow is three sequential LLM calls,
   * so closing the modal has to be able to walk away from it — otherwise the
   * later setState calls land on an unmounted tree.
   */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const fetchStoryFlow = React.useCallback(
    async (userPrompt: string | null) => {
      abortRef.current?.abort(); // drop any previous attempt
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      setError(null);

      try {
        // The whole three-call flow is one exclusive action. Phase stays on
        // 'loading' — and the loading indicator stays up — until our turn comes
        // round, so clicking the quill during a review shows the wait rather
        // than starting a deck shuffle that then stalls.
        await runExclusive('a town event', async () => {
          if (signal.aborted) return;

          // Clear anything left over from a previous attempt, so a retry can't
          // deal cards from the last run against results from this one.
          setChosenCharacterIds([]);
          setConsequenceDisplay([]);
          setStoryTitle('');
          setStoryBody('');
          setHoveredCharacterId(null);

          setPhase('deck');

          // 1) Setup: pick the event, the cast and the scenery.
          //
          // eventId stays null here. It names a *specific* event to run, and a
          // non-null value also tells the server this pull is "directed", which
          // suppresses any queued follow-up event. The player's free text is
          // narrative colour, so it belongs on the story call as `description`.
          const setup = await setupStoryEvent(estateName, { eventId: null }, signal);

          setChosenCharacterIds(setup.chosenCharacterIds);

          // 2) Story
          const story = await generateStory(
            estateName,
            {
              event: setup.event,
              chosenCharacterIds: setup.chosenCharacterIds,
              locations: setup.locations,
              npcIds: setup.npcs,
              enemyIds: setup.enemies,
              bystanders: setup.bystanders,
              keywords: setup.keywords,
              context: '',
              description: userPrompt,
            },
            signal
          );

          setStoryTitle(story.title);
          setStoryBody(story.body);

          // 3) Consequences (also persists them server-side)
          const characters = await generateConsequences(
            estateName,
            {
              story: story.body,
              chosenCharacterIds: setup.chosenCharacterIds,
            },
            signal
          );

          setConsequenceDisplay(characters);
        });
      } catch (err) {
        if (isAbortError(err)) return; // we cancelled on purpose
        console.error('Error in fetchStoryFlow:', err);
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        setPhase('input');
      }
    },
    [estateName, runExclusive]
  );

  const handleShuffleComplete = React.useCallback(() => {
    setPhase('deal');
  }, []);

  // Handler for when the user proceeds from the Activity Log
  const handleLogProceed = React.useCallback(
    async (logContent: string | null) => {
      setPhase('loading'); // Show loading screen while queued and fetching
      await fetchStoryFlow(logContent);
    },
    [fetchStoryFlow]
  );

  const handleRetry = React.useCallback(() => {
    setError(null);
    setPhase('input');
  }, []);

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
        <ErrorNotice
          variant="overlay"
          title="The event could not be told."
          message={error}
          onRetry={handleRetry}
          onDismiss={onClose}
        />
      </div>
    );
  }

  // Queued behind another action, or waiting on the first response.
  if (phase === 'loading') {
    return (
      <div className="story-modal-content">
        <LoadingIndicator waitingFor={activity?.label} />
      </div>
    );
  }

  // ---- ACTUAL RENDER ----
  // We do ONE return statement with all possible elements,
  // but we conditionally show/hide them based on the phase.

  return (
    <div className="story-modal-content">
      {phase === 'input' && <ActivityLog onProceed={handleLogProceed} />}

      {['deck', 'deal', 'text'].includes(phase) && (
        <DeckComponent phase={phase} onShuffleComplete={handleShuffleComplete} />
      )}

      {['deal', 'text'].includes(phase) && (
        <>
          {chosenCharacterIds.map((id, i) => {
            // Find the consequences for this specific character
            const charConsequences = consequenceDisplay.find((c) => c.identifier === id);
            return (
              <CardComponent
                key={id}
                characterId={id}
                cornerIndex={i}
                // stagger by 1s
                dealDelay={i * 1000}
                onDealComplete={() => {
                  // If it's the last card, we can move on to text phase,
                  // but only if we're still in 'deal' phase.
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
              <p key={idx}>{parseFormattedText(line)}</p>
            ))}
          </div>

          {/* Buttons are inside the same container */}
          <div className="story-buttons">
            <ImageButton
              textureUrl={returnButtonSrc}
              width={192}
              height={192}
              onClick={onClose}
            />
            <ImageButton
              textureUrl={continueButtonSrc}
              width={192}
              height={192}
              // TODO: this button still has no handler.
            />
          </div>
        </div>
      )}
    </div>
  );
}