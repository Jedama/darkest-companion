import React from 'react';
import ReactDOM from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
}

/**
 * Renders children into the #modal-root element via React Portal.
 */
export function ModalPortal({ children }: ModalPortalProps) {
  const modalRoot = document.getElementById('modal-root');

  if (!modalRoot) {
    // Fallback, in case there's no #modal-root (should not happen in production).
    return null;
  }

  return ReactDOM.createPortal(children, modalRoot);
}
