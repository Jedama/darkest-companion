// src/components/ui/ErrorNotice.tsx
//
// Every failure the player sees, in one shape. Three placements, one skin:
//
//   panel    sits in the flow of a form or modal body
//   overlay  dims its container and takes it over — for a failure that ends
//            whatever the player was doing
//   toast    pinned to the bottom of the viewport, for background work that
//            failed without a screen of its own
//
// Self-contained styling on purpose, matching LoadingIndicator, so the two
// read as one family without either needing a CSS file. If you later move this
// into CSS, the palette below is the only thing to carry across.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

const PALETTE = {
  ink: '#e8ddc8',
  panel: 'rgba(20, 16, 14, 0.94)',
  edge: 'rgba(180, 150, 110, 0.45)',
  edgeStrong: 'rgba(180, 150, 110, 0.75)',
  scrim: 'rgba(8, 6, 5, 0.72)',
} as const;

export type ErrorNoticeVariant = 'panel' | 'overlay' | 'toast';

interface ErrorNoticeProps {
  /** One line of context: "The month could not be advanced." Optional. */
  title?: string;
  /** The failure itself — usually an ApiError's message. */
  message: ReactNode;
  variant?: ErrorNoticeVariant;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  /**
   * Dismiss itself after this many milliseconds. Requires onDismiss — the
   * notice never removes itself, it asks its owner to.
   *
   * The countdown restarts if the message changes, and pauses while the
   * pointer is over the box so a notice can't vanish mid-read.
   */
  autoDismissMs?: number;
}

const buttonStyle: CSSProperties = {
  padding: '0.4rem 1.1rem',
  background: 'transparent',
  border: `1px solid ${PALETTE.edgeStrong}`,
  color: PALETTE.ink,
  font: 'inherit',
  fontSize: '0.9rem',
  letterSpacing: '0.04em',
  cursor: 'pointer',
  pointerEvents: 'auto',
};

const boxStyle: CSSProperties = {
  maxWidth: '32rem',
  padding: '1rem 1.25rem',
  background: PALETTE.panel,
  border: `1px solid ${PALETTE.edge}`,
  color: PALETTE.ink,
  font: '0.95rem/1.5 inherit',
  textAlign: 'center',
};

const containerStyle: Record<ErrorNoticeVariant, CSSProperties> = {
  panel: {
    display: 'flex',
    justifyContent: 'center',
    margin: '0.75rem 0',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: PALETTE.scrim,
    zIndex: 20,
  },
  toast: {
    position: 'fixed',
    left: '50%',
    bottom: '3rem',
    transform: 'translateX(-50%)',
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 30,
  },
};

export function ErrorNotice({
  title,
  message,
  variant = 'panel',
  onRetry,
  retryLabel = 'Try again',
  onDismiss,
  dismissLabel = 'Close',
  autoDismissMs,
}: ErrorNoticeProps) {
  const hasActions = Boolean(onRetry || onDismiss);

  const [isHovered, setIsHovered] = useState(false);

  // Held in a ref so an inline arrow from the parent can't restart the
  // countdown on every render — which would keep it from ever firing.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!autoDismissMs || !dismissRef.current || isHovered) return;

    const timer = window.setTimeout(() => dismissRef.current?.(), autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs, isHovered, message]);

  return (
    <div style={containerStyle[variant]} role="alert">
      <div
        style={{
          ...boxStyle,
          // A toast is inert by default so it can't swallow clicks on the view
          // behind it, but its own buttons must still work.
          ...(variant === 'toast' && hasActions ? { pointerEvents: 'auto' } : null),
        }}
        onMouseEnter={autoDismissMs ? () => setIsHovered(true) : undefined}
        onMouseLeave={autoDismissMs ? () => setIsHovered(false) : undefined}
      >
        {title && (
          <div style={{ marginBottom: '0.4rem', letterSpacing: '0.03em' }}>{title}</div>
        )}

        <div style={{ opacity: title ? 0.85 : 1 }}>{message}</div>

        {hasActions && (
          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
            }}
          >
            {onRetry && (
              <button type="button" style={buttonStyle} onClick={onRetry}>
                {retryLabel}
              </button>
            )}
            {onDismiss && (
              <button type="button" style={buttonStyle} onClick={onDismiss}>
                {dismissLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}