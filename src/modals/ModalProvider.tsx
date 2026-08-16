// src/components/modals/ModalProvider.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ModalPortal } from './ModalPortal.js';
import './ModalProvider.css';

interface ModalContextValue {
  show: (content: React.ReactNode) => void;
  hide: () => void;
  isOpen: boolean;
  content: React.ReactNode | null;
}

const ModalContext = createContext<ModalContextValue>({
  show: () => {},
  hide: () => {},
  isOpen: false,
  content: null,
});

// Optional helper hook so we don't import the context directly everywhere
export function useModalContext() {
  return useContext(ModalContext);
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const show = (content: React.ReactNode) => {
    setModalContent(content);
    setIsOpen(true);
  };

  const hide = useCallback(() => {
    setModalContent(null);
    setIsOpen(false);
  }, []);

  // Escape dismisses the modal. Only bound while one is open, so nothing
  // else in the app has to know this exists.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, hide]);

  // Effect to disable body scrolling if a modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  return (
    <ModalContext.Provider value={{ show, hide, isOpen, content: modalContent }}>
      {children}

      <ModalPortal>
        {isOpen && (
          <div className="modal-backdrop">
            {modalContent}
          </div>
        )}
      </ModalPortal>
    </ModalContext.Provider>
  );
}
