// src/components/modals/ModalProvider.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ModalPortal } from './ModalPortal.js';
import './ModalProvider.css';

interface ModalOptions {
  dismissible?: boolean;
}

interface ModalContextValue {
  show: (content: React.ReactNode, options?: ModalOptions) => void;
  hide: () => void;
  /** Lets a modal change its own mind as its internal state moves on. */
  setDismissible: (value: boolean) => void;
  isOpen: boolean;
  content: React.ReactNode | null;
}

const ModalContext = createContext<ModalContextValue>({
  show: () => {},
  hide: () => {},
  setDismissible: () => {},
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
  const [dismissible, setDismissible] = useState(true);

 const show = useCallback((content: React.ReactNode, options?: ModalOptions) => {
    setModalContent(content);
    setDismissible(options?.dismissible ?? true);
    setIsOpen(true);
  }, []);
  
  const hide = useCallback(() => {
    setModalContent(null);
    setIsOpen(false);
  }, []);

  // Escape dismisses the modal. Only bound while one is open, so nothing
  // else in the app has to know this exists.
  useEffect(() => {
    if (!isOpen || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, dismissible, hide]);

  // Effect to disable body scrolling if a modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  return (
    <ModalContext.Provider value={{ show, hide, setDismissible, isOpen, content: modalContent }}>
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
