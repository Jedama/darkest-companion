// src/components/CharacterPanel/Bookmark.tsx
import './Bookmark.css';

interface BookmarkProps {
  /** 0–100. */
  value: number;
  ribbonSrc: string;
  stubSrc: string;
  /** Placement class — .health-bookmark or .mental-bookmark. */
  className?: string;
}

/**
 * How much of the ribbon stays out at value 1, as a percentage of its length.
 * The tail begins around 89% down the canvas, so anything above ~11% keeps it
 * whole. Raise if the tail looks cut off at low values.
 */
const MIN_EXTENT = 14;

export function Bookmark({ value, ribbonSrc, stubSrc, className = '' }: BookmarkProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const dead = clamped <= 0;

  // At 100 the ribbon sits at rest; at 1 it has withdrawn all but MIN_EXTENT.
  // The window clips whatever rises above its top edge.
  const hidden = ((100 - clamped) / 100) * (100 - MIN_EXTENT);

  return (
    <div className={`bookmark ${className}`}>
      <div className={`bookmark-window${dead ? ' is-hidden' : ''}`}>
        <img
          className="bookmark-ribbon"
          src={ribbonSrc}
          alt=""
          style={{ transform: `translateY(-${hidden}%)` }}
        />
      </div>

      <img
        className={`bookmark-stub${dead ? '' : ' is-hidden'}`}
        src={stubSrc}
        alt=""
      />
    </div>
  );
}