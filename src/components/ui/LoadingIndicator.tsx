// src/components/ui/LoadingIndicator.tsx
//
// A slowly turning roster portrait. Two faces are stacked back to back and the
// pair spins on Y; each face is hidden for half of every revolution, and that
// is when it swaps to a different character. The change is therefore never
// visible, and a sprite is never seen mirrored.
//
// Falls back to a plain ring when no estate is loaded or no sprites resolve.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEstateContext } from '../../contexts/EstateContext.js';

interface LoadingIndicatorProps {
  /** What we're waiting on, e.g. "the month-end review". Optional. */
  waitingFor?: string | null;
  /** Shown beneath the sprite. Overrides the waitingFor phrasing. */
  message?: string;
  /** Milliseconds for one full turn. A character changes every half turn. */
  revolutionMs?: number;
  /**
   * Dim and block whatever is behind. Use when the indicator covers a form or
   * a view that must not be interacted with while the work runs.
   */
  backdrop?: boolean;
  /**
   * Stacking order within the positioned ancestor. Needs to beat any sibling
   * that appears later in the DOM — images in particular, which otherwise
   * paint straight over the top.
   */
  zIndex?: number;
}

const DEFAULT_REVOLUTION_MS = 3200;

function spriteUrl(identifier: string): string {
  return new URL(`../../assets/characters/loading/${identifier}.png`, import.meta.url).href;
}

/** Random pick that avoids whatever is on the other face. */
function pickOther(pool: string[], avoid: string | null): string | null {
  if (pool.length === 0) return null;
  const candidates = pool.length > 1 ? pool.filter((id) => id !== avoid) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

export function LoadingIndicator({
  waitingFor,
  message,
  revolutionMs = DEFAULT_REVOLUTION_MS,
  backdrop = false,
  zIndex = 20,
}: LoadingIndicatorProps) {
  const { currentEstate } = useEstateContext();

  const roster = useMemo(
    () => Object.keys(currentEstate?.characters ?? {}),
    [currentEstate]
  );

  /**
   * Identifiers whose sprite failed to load. Dropping them from the pool means
   * characters without loading art are simply skipped — no list to maintain,
   * and nothing to change as you add the missing ones.
   */
  const [missingArt, setMissingArt] = useState<Set<string>>(new Set());

  const pool = useMemo(
    () => roster.filter((id) => !missingArt.has(id)),
    [roster, missingArt]
  );

  // The interval reads the pool through a ref so that marking a sprite missing
  // doesn't restart the timer and drift out of step with the CSS animation.
  const poolRef = useRef(pool);
  poolRef.current = pool;

  /** [front, back]. Only the hidden one is ever reassigned. */
  const [faces, setFaces] = useState<[string | null, string | null]>([null, null]);
  const halfTurnsRef = useRef(0);

  // Seed both faces once there is a roster to draw from.
  useEffect(() => {
    if (pool.length === 0) {
      setFaces([null, null]);
      return;
    }
    setFaces(([front, back]) => {
      if (front && pool.includes(front) && back && pool.includes(back)) return [front, back];
      const first = pickOther(pool, null);
      return [first, pickOther(pool, first)];
    });
  }, [pool]);

  // Warm the cache so a face swap never lands on an undecoded image.
  useEffect(() => {
    pool.forEach((id) => {
      const img = new Image();
      img.src = spriteUrl(id);
    });
  }, [pool]);

  // Swap the hidden face every half turn.
  useEffect(() => {
    if (pool.length < 2) return;

    const timer = window.setInterval(() => {
      halfTurnsRef.current += 1;

      // At 180deg the back is facing us and the front is hidden; at 360deg the
      // reverse. Odd half-turns hide the front, even ones hide the back.
      const hidden = halfTurnsRef.current % 2 === 1 ? 0 : 1;

      setFaces((prev) => {
        const next: [string | null, string | null] = [...prev] as [string | null, string | null];
        next[hidden] = pickOther(poolRef.current, prev[hidden === 0 ? 1 : 0]);
        return next;
      });
    }, revolutionMs / 2);

    return () => window.clearInterval(timer);
    // Deliberately not depending on `pool`: see poolRef above.
  }, [pool.length >= 2, revolutionMs]);

  const handleMissing = (identifier: string | null) => {
    if (!identifier) return;
    setMissingArt((prev) => {
      if (prev.has(identifier)) return prev;
      const next = new Set(prev);
      next.add(identifier);
      return next;
    });
  };

  const text = message ?? (waitingFor ? `Waiting for ${waitingFor}…` : 'Working…');
  const [front, back] = faces;
  const hasSprites = front !== null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        color: '#e8ddc8',
        font: '1rem/1.4 inherit',
        textAlign: 'center',
        zIndex,
        // A backdrop swallows clicks on purpose, so the form underneath can't
        // be typed into while the request is in flight.
        pointerEvents: backdrop ? 'auto' : 'none',
        ...(backdrop ? { background: 'rgba(8, 6, 5, 0.72)' } : null),
      }}
    >
      <style>{`
        @keyframes li-flip { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
        @keyframes li-spin { to { transform: rotate(360deg); } }
        @keyframes li-breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

        .li-stage { perspective: 900px; }
        .li-flipper {
          position: relative;
          width: 9rem;
          height: 13rem;
          transform-style: preserve-3d;
          animation: li-flip var(--li-revolution) linear infinite;
        }
        .li-face {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45));
        }
        .li-face--back { transform: rotateY(180deg); }

        /* One face only: let it turn all the way round rather than blink out
           for half of every revolution. */
        .li-flipper--solo .li-face { backface-visibility: visible; }

        @media (prefers-reduced-motion: reduce) {
          .li-flipper { animation-duration: calc(var(--li-revolution) * 3); }
        }
      `}</style>

      {hasSprites ? (
        <div className="li-stage">
          <div
            className={`li-flipper${back === null ? ' li-flipper--solo' : ''}`}
            style={{ ['--li-revolution' as any]: `${revolutionMs}ms` }}
          >
            <img
              className="li-face"
              src={spriteUrl(front)}
              alt=""
              draggable={false}
              onError={() => handleMissing(front)}
            />
            {back && (
              <img
                className="li-face li-face--back"
                src={spriteUrl(back)}
                alt=""
                draggable={false}
                onError={() => handleMissing(back)}
              />
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            width: '3rem',
            height: '3rem',
            border: '2px solid rgba(180, 150, 110, 0.25)',
            borderTopColor: 'rgba(232, 221, 200, 0.9)',
            borderRadius: '50%',
            animation: 'li-spin 1.1s linear infinite',
          }}
        />
      )}

      <div style={{ animation: 'li-breathe 2.4s ease-in-out infinite' }}>{text}</div>
    </div>
  );
}