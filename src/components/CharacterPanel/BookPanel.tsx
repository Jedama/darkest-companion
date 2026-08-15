// src/components/CharacterPanel/BookPanel.tsx
import type { ReactNode } from 'react';
import './BookPanel.css';

interface BookPanelProps {
  children: ReactNode;
}

/**
 * The book itself: paper, binding, and — later — the page-edge handle and the
 * slide in and out. It knows nothing about what is printed on the page.
 */
export function BookPanel({ children }: BookPanelProps) {
  return (
    <div className="character-info">
      <div className="panel-content">
        {children}
      </div>
    </div>
  );
}