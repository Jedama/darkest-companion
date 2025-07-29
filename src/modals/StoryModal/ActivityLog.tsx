// src/components/storymodal/ActivityLog.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ImageButton } from '../../components/ui/buttons/ImageButton';
import './ActivityLog.css';

// Import the new assets
import activityLogPaper from '../../assets/ui/modals/storymodal/activitylog.png';
import quill from '../../assets/ui/modals/storymodal/quill.png';

interface ActivityLogProps {
  onProceed: (logContent: string | null) => void;
}

export function ActivityLog({ onProceed }: ActivityLogProps) {
  const [logText, setLogText] = useState('');
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholderText = "Leave empty for random...";

  // Autofocus the textarea when the component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      setIsTextareaFocused(true); // Manually set focus state as it's autofocused
    }
  }, []); // Run once on mount

  const handleTextareaFocus = () => {
    setIsTextareaFocused(true);
  };

  const handleTextareaBlur = () => {
    setIsTextareaFocused(false);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLogText(e.target.value);
  };

  const handleQuillClick = () => {
    // Pass null if the text is empty or just whitespace, otherwise pass the trimmed text
    onProceed(logText.trim() === '' ? null : logText.trim());
  };

  const showPlaceholder = logText.trim();

  return (
    // The container for the activity log content, positioned centrally
    <div className="activity-log-container fade-in">
      {/* The paper image */}
      <img src={activityLogPaper} alt="Activity Log Paper" className="activity-log-paper" />

      {/* Wrapper for the textarea and its placeholder */}
      <div className="activity-log-input-wrapper">
        <textarea
          ref={textareaRef}
          className="activity-log-textarea"
          value={logText}
          onChange={handleTextareaChange}
          onFocus={handleTextareaFocus}
          onBlur={handleTextareaBlur}
          maxLength={500} // Optional: Limit input length
          autoFocus // Enables automatic focusing on mount
        />
        {/* Placeholder text, conditionally rendered with fade transition */}
        {!showPlaceholder && (
          <div className="activity-log-placeholder">
            {placeholderText}
          </div>
        )}
      </div>

      {/* The quill button, positioned independently within the modal space.
          It is still a child of this component for simplicity of state management,
          but its CSS positioning will make it appear relative to the overall modal. */}
      <ImageButton
        textureUrl={quill}
        // width and height are set in CSS for better responsiveness
        className="activity-log-quill-button"
        onClick={handleQuillClick}
      />
    </div>
  );
}