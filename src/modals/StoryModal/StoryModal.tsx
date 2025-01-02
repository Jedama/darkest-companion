// src/components/storymodal/StoryModal.tsx
import { Console } from 'console';
import React, { useState, useEffect } from 'react';

interface StoryModalProps {
  estateName: string;
  onClose: () => void;    // We'll call this when we want to close the modal
}

interface SetupResponse {
  success: boolean;
  event: any;
  chosenCharacterIds: string[];
}

interface StoryResponse {
  success: boolean;
  prompt: string;
  llmResponse: string;
}

export function StoryModal({ estateName, onClose }: StoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [storyText, setStoryText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function fetchStoryFlow() {
      try {
        // 1) Setup random event
        const setupRes = await fetch(`http://localhost:3000/estates/${estateName}/events/setup-random`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!setupRes.ok) {
          throw new Error(`Setup route failed with status ${setupRes.status}`);
        }
        const setupData = (await setupRes.json()) as SetupResponse;
        if (!setupData.success) {
          throw new Error('Setup returned success=false');
        }

        // 2) Now call the story route
        const storyRes = await fetch(`http://localhost:3000/estates/${estateName}/events/story`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: setupData.event,
            chosenCharacterIds: setupData.chosenCharacterIds,
          }),
        });
        if (!storyRes.ok) {
          throw new Error(`Story route failed with status ${storyRes.status}`);
        }
        const storyData = (await storyRes.json()) as StoryResponse;
        if (!storyData.success) {
          throw new Error('Story route returned success=false');
        }

        if (!aborted) {
          // 3) Save the LLM’s text and mark loading as false
          setStoryText(storyData.llmResponse);
          setLoading(false);
        }
      } catch (err: any) {
        if (!aborted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetchStoryFlow();

    // Cleanup if the component unmounts quickly
    return () => {
      aborted = true;
    };
  }, [estateName]);

  if (loading) {
    return (
      <div className="story-modal-content">
        <div>Loading story...</div>
        {/* Maybe a spinner or something */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="story-modal-content">
        <div className="error-message">Error: {error}</div>
        {/* You can add a retry button or a close button here */}
        <button onClick={onClose}>Close</button>
      </div>
    );
  }

  // Display the story text, respecting newlines
  return (
    <div className="story-modal-content">
      <div className="story-text">
        {storyText.split('\n').map((line, idx) => (
          <p key={idx}>{line}</p>
        ))}
      </div>
    </div>
  );
}
