// src/components/calendar/CalendarDial.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useEstateContext } from '../../contexts/EstateContext';
import { runReview } from '../../utils/api';
import { ErrorNotice } from '../ui/ErrorNotice';

import baseSrc from '../../assets/ui/views/manor/calendar_base.png';
import monthHandSrc from '../../assets/ui/views/manor/calendar_month.png';
import dayHandSrc from '../../assets/ui/views/manor/calendar_day.png';

import './CalendarDial.css';

/* -------------------------------------------------------------------
 *  Dial geometry
 *
 *  Both rings run CLOCKWISE and both have a BOUNDARY at twelve o'clock:
 *    - inner ring:  ... 30 | 31 | 1 | 2 ...   (boundary between 31 and 1)
 *    - outer ring:  ... AQUARIUS | PISCES | ARIES | TAURUS ...
 *
 *  The hand artwork lies horizontal (tip pointing right = 3 o'clock),
 *  so every angle gets ART_OFFSET applied to bring 0deg back to 12 o'clock.
 * ------------------------------------------------------------------- */

const DAY_SLOTS = 31;
const DEG_PER_DAY = 360 / DAY_SLOTS; // 11.6129...
const DEG_PER_MONTH = 30;
const ART_OFFSET = -90;

/** Resolution of the offscreen hit mask. Independent of display size. */
const HIT_SIZE = 458;

/** Tolerance for treating two angles as the same, in degrees. */
const ANGLE_EPSILON = 1e-6;

/* -------------------------------------------------------------------
 *  Ceremony timing — the single source of truth.
 *  These drive both the JS phase timers and the CSS transitions
 *  (injected as custom properties), so they can never drift apart.
 * ------------------------------------------------------------------- */

const TIMING = {
  expand: 800, // corner -> centre, growing
  hold: 350, // beat of stillness before anything turns
  turn: 1400, // hands sweep (the day hand does a near-full lap)
  settle: 600, // let the eye register the new date
  return: 700, // scrim fades as the dial goes home
} as const;

/** Height of the expanded dial, as a percentage of viewport height. */
const EXPANDED_VH = 78;

type Phase =
  | 'idle'
  | 'expanding'
  | 'holding'
  | 'turning'
  | 'settling'
  | 'returning';

/** Phases during which the dial is away from its corner. */
const LIT_PHASES: Phase[] = ['expanding', 'holding', 'turning', 'settling'];

/**
 * Day is 0-indexed: day 0 points at the "1" slot, day 30 points at "31",
 * day 31 wraps back around to "1".
 */
export function dayAngle(day: number): number {
  return (day + 0.5) * DEG_PER_DAY + ART_OFFSET;
}

/**
 * Month is a monotonic counter; month 0 = Pisces.
 * Pisces occupies the segment ENDING at twelve o'clock (-30deg -> 0deg),
 * so segment start for month index m is (m - 1) * 30.
 *
 * The hand drifts across its sign as the days pass. The fraction is clamped
 * so months longer than 31 days can't push the hand into the next sign.
 */
export function monthAngle(month: number, day: number): number {
  const m = ((month % 12) + 12) % 12;
  const fraction = Math.min(Math.max(day / DAY_SLOTS, 0), 1);
  return (m - 1) * DEG_PER_MONTH + fraction * DEG_PER_MONTH + ART_OFFSET;
}

/**
 * Keeps an ever-increasing rotation value so hands ALWAYS travel clockwise.
 *
 * Without this, going from month 11 back to month 0 (or day 30 back to day 0)
 * would make CSS take the short route and spin the hand backwards. Accumulating
 * forward is what produces the near-full unwinding lap on a month rollover.
 *
 * Written to be idempotent so React StrictMode's double render is harmless.
 *
 * spin is a token: bumping it guarantees the hand moves, so a month change
 * still shows a full revolution even when the date lands on the slot the hand
 * is already sitting on.
 */
function useForwardAngle(target: number, spin = 0): number {
  const state = useRef<{
    target: number;
    spin: number;
    accumulated: number;
  } | null>(null);

  if (state.current === null) {
    // First render: adopt the target as-is, no animation.
    state.current = { target, spin, accumulated: target };
    return state.current.accumulated;
  }

  const spinChanged = state.current.spin !== spin;

  if (state.current.target !== target || spinChanged) {
    let delta = (((target - state.current.accumulated) % 360) + 360) % 360;

    // Collapse floating-point noise, so a hand that shouldn't move can't creep
    // a spurious full lap when the delta lands just under 360.
    if (delta < ANGLE_EPSILON || delta > 360 - ANGLE_EPSILON) {
      delta = 0;
    }

    // A forced spin always shows a full revolution rather than nothing.
    if (spinChanged && delta === 0) {
      delta = 360;
    }

    state.current = {
      target,
      spin,
      accumulated: state.current.accumulated + delta,
    };
  }

  return state.current.accumulated;
}

/**
 * Builds a single alpha mask from all three layers, with the hands drawn at
 * their current rotations. One mask means one hit test covering the union of
 * dial + both hands, including the month hand's tip where it overhangs the rim.
 *
 * Redrawn only when a hand actually moves, never on mouse movement.
 */
function useCompositeHitMask(monthRotation: number, dayRotation: number) {
  const imagesRef = useRef<HTMLImageElement[] | null>(null);
  const maskRef = useRef<Uint8ClampedArray | null>(null);
  const [imagesReady, setImagesReady] = useState(false);

  // Load the three layers once. App already preloads them, so in practice
  // this resolves straight from cache.
  useEffect(() => {
    let cancelled = false;

    Promise.all(
      [baseSrc, monthHandSrc, dayHandSrc].map(
        (src) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
          })
      )
    )
      .then((images) => {
        if (cancelled) return;
        imagesRef.current = images;
        setImagesReady(true);
      })
      .catch(() => {
        // If a layer fails to load, the dial simply stays unclickable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Redraw the mask whenever a hand moves.
  useEffect(() => {
    const images = imagesRef.current;
    if (!images) return;

    const canvas = document.createElement('canvas');
    canvas.width = HIT_SIZE;
    canvas.height = HIT_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centre = HIT_SIZE / 2;
    const rotations = [0, monthRotation, dayRotation];

    images.forEach((image, index) => {
      ctx.save();
      ctx.translate(centre, centre);
      ctx.rotate((rotations[index] * Math.PI) / 180);
      ctx.drawImage(image, -centre, -centre, HIT_SIZE, HIT_SIZE);
      ctx.restore();
    });

    maskRef.current = ctx.getImageData(0, 0, HIT_SIZE, HIT_SIZE).data;
  }, [imagesReady, monthRotation, dayRotation]);

  return maskRef;
}

export function CalendarDial() {
  const { currentEstate, handleLoadEstate, runExclusive } = useEstateContext();

  const [phase, setPhase] = useState<Phase>('idle');
  const [stageTransform, setStageTransform] = useState<string | null>(null);
  const [isHot, setIsHot] = useState(false);

  /** Failure notice for the last attempt. Cleared when a new one starts. */
  const [error, setError] = useState<string | null>(null);

  /**
   * Optimistic time shown while the server catches up.
   * Deliberately NOT cleared when the ceremony ends — only when the review
   * resolves. Clearing it early would make the hands move a second time if
   * the LLM outlasts the animation.
   */
  const [optimistic, setOptimistic] = useState<{
    month: number;
    day: number;
  } | null>(null);

  /**
   * Bumped once per month advance. Forces the day hand to complete a lap even
   * when the day resets from 0 to 0 and the computed travel would be nothing.
   * The month hand doesn't take it — that hand always has real travel.
   */
  const [spin, setSpin] = useState(0);

  const month = optimistic?.month ?? currentEstate?.time.month ?? 0;
  const day = optimistic?.day ?? currentEstate?.time.day ?? 0;

  const monthRotation = useForwardAngle(monthAngle(month, day));
  const dayRotation = useForwardAngle(dayAngle(day), spin);

  const maskRef = useCompositeHitMask(monthRotation, dayRotation);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Phase timers. Declared before clearTimers so nothing can reach the ref
  // before it exists.
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  // Drop any pending phase change if the manor view unmounts mid-ceremony.
  useEffect(() => clearTimers, [clearTimers]);

  /**
   * Cuts the ceremony short and sends the dial home.
   *
   * Clearing the timers FIRST is the whole point: a fast failure would
   * otherwise be overwritten by the pending optimistic advance at tTurn, and
   * the dial would end up showing a month the server never accepted.
   */
  const abortCeremony = useCallback(
    (message: string) => {
      clearTimers();
      setOptimistic(null); // guaranteed to be the last write to the clock
      setError(message);
      setPhase('returning');
      setStageTransform('translate(0px, 0px) scale(1)');

      timersRef.current.push(
        window.setTimeout(() => {
          setPhase('idle');
          setStageTransform(null);
          timersRef.current = [];
        }, TIMING.return)
      );
    },
    [clearTimers]
  );

  /** True when the pointer is over a non-transparent pixel of the assembly. */
  const isOverArtwork = useCallback(
    (clientX: number, clientY: number) => {
      const mask = maskRef.current;
      const stage = stageRef.current;
      if (!mask || !stage) return false;

      // Post-transform box, so this stays correct while the dial is scaled.
      const rect = stage.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;

      const x = Math.floor(((clientX - rect.left) / rect.width) * HIT_SIZE);
      const y = Math.floor(((clientY - rect.top) / rect.height) * HIT_SIZE);
      if (x < 0 || y < 0 || x >= HIT_SIZE || y >= HIT_SIZE) return false;

      return mask[(y * HIT_SIZE + x) * 4 + 3] > 0;
    },
    [maskRef]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (phase !== 'idle') return;
      setIsHot(isOverArtwork(event.clientX, event.clientY));
    },
    [isOverArtwork, phase]
  );

  const handleMouseLeave = useCallback(() => setIsHot(false), []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (phase !== 'idle' || !currentEstate) return;
      if (!isOverArtwork(event.clientX, event.clientY)) return;

      const shell = shellRef.current;
      if (!shell) return;

      // Measure the untransformed shell so hover scale can't skew the maths.
      const rect = shell.getBoundingClientRect();
      const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
      const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);
      const scale = (window.innerHeight * (EXPANDED_VH / 100)) / rect.width;

      const estateName = currentEstate.name;
      const nextMonth = month + 1;

      setIsHot(false);
      setError(null);
      setStageTransform(`translate(${dx}px, ${dy}px) scale(${scale})`);
      setPhase('expanding');

      // Fire and forget: the ceremony runs on its own clock, and only a
      // failure reaches back in to stop it.
      void (async () => {
        try {
          // Queued behind any town event or recruitment already in flight. The
          // ceremony runs on its own clock either way — the dial does not wait
          // for its turn, only the request does.
          await runExclusive('the month-end review', () => runReview(estateName));
        } catch (err: any) {
          console.error('[calendar] review failed:', err);
          abortCeremony(err?.message ?? 'Unknown error');
          return;
        }

        // The review itself succeeded past this point, so a failure here is a
        // different problem and gets its own message.
        try {
          await handleLoadEstate(estateName);
          // Server time now matches what's on screen, so this is invisible.
          setOptimistic(null);
        } catch (err: any) {
          console.error('[calendar] reload failed:', err);
          abortCeremony(
            err?.message ?? 'The estate could not be reloaded. Refresh to see the new month.'
          );
        }
      })();

      const at = (ms: number, fn: () => void) => {
        timersRef.current.push(window.setTimeout(fn, ms));
      };

      const tHold = TIMING.expand;
      const tTurn = tHold + TIMING.hold;
      const tSettle = tTurn + TIMING.turn;
      const tReturn = tSettle + TIMING.settle;
      const tDone = tReturn + TIMING.return;

      at(tHold, () => setPhase('holding'));
      at(tTurn, () => {
        // Class and angles land in the same commit, so the hands pick up the
        // slower ceremony transition rather than the everyday one.
        setPhase('turning');
        setOptimistic({ month: nextMonth, day: 0 });
        setSpin((value) => value + 1);
      });
      at(tSettle, () => setPhase('settling'));
      at(tReturn, () => {
        setPhase('returning');
        setStageTransform('translate(0px, 0px) scale(1)');
      });
      at(tDone, () => {
        setPhase('idle');
        setStageTransform(null);
        timersRef.current = [];
      });
    },
    [phase, currentEstate, isOverArtwork, month, handleLoadEstate, abortCeremony, runExclusive]
  );

  const overlayRoot = document.getElementById('overlay-root');
  if (!overlayRoot || !currentEstate) return null;

  const cssVars = {
    '--cal-expand-duration': `${TIMING.expand}ms`,
    '--cal-turn-duration': `${TIMING.turn}ms`,
    '--cal-return-duration': `${TIMING.return}ms`,
  } as CSSProperties;

  const isLit = LIT_PHASES.includes(phase);

  return createPortal(
    <div
      className={`calendar-overlay phase-${phase}${isLit ? ' is-lit' : ''}`}
      style={cssVars}
    >
      <div className="calendar-scrim" />

      {error && (
        <ErrorNotice
          variant="toast"
          title="The month could not be advanced."
          message={error}
          onDismiss={() => setError(null)}
          dismissLabel="Dismiss"
          autoDismissMs={10000}
        />
      )}

      <div className="calendar-dial" ref={shellRef}>
        <div
          ref={stageRef}
          className={`calendar-stage${isHot ? ' is-hot' : ''}`}
          style={stageTransform ? { transform: stageTransform } : undefined}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          <img
            className="calendar-layer"
            src={baseSrc}
            alt=""
            draggable={false}
          />
          <img
            className="calendar-layer calendar-hand"
            src={monthHandSrc}
            alt=""
            draggable={false}
            style={{ transform: `rotate(${monthRotation}deg)` }}
          />
          <img
            className="calendar-layer calendar-hand"
            src={dayHandSrc}
            alt=""
            draggable={false}
            style={{ transform: `rotate(${dayRotation}deg)` }}
          />
        </div>
      </div>
    </div>,
    overlayRoot
  );
}