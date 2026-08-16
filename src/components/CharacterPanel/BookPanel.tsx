// src/components/CharacterPanel/BookPanel.tsx
import type { ReactNode } from 'react';
import './BookPanel.css';

interface BookPanelProps {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * The book itself: paper, binding, and the page-edge handle.
 * It knows nothing about what is printed on the page.
 */
export function BookPanel({ open, onToggle, children }: BookPanelProps) {
  return (
    <div className="character-info">
      <div className="panel-content">
        {children}
      </div>

      <button
        type="button"
        className="book-edge"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? 'Close the register' : 'Open the register'}
      />
    </div>
  );
}