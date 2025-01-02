// src/components/modals/ModalProvider.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ModalPortal } from './ModalPortal';
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

  const hide = () => {
    setModalContent(null);
    setIsOpen(false);
  };

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
