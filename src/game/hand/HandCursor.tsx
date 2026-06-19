import type { CursorState } from './HandTracker';
import './hand-ui.css';

/** Floating cursor that follows the index fingertip; shows draw + dwell states. */
export function HandCursor({ cursor, color }: { cursor: CursorState; color: string }) {
  if (!cursor.visible) return null;
  const R = 26;
  const circ = 2 * Math.PI * (R - 2);
  return (
    <div
      className={`hand-cursor ${cursor.drawing ? 'is-drawing' : ''}`}
      style={{ left: cursor.x, top: cursor.y, ['--cursor-color' as string]: color }}
    >
      {cursor.dwell > 0 && (
        <svg className="hand-cursor-ring" width={R * 2} height={R * 2}>
          <circle
            cx={R}
            cy={R}
            r={R - 2}
            fill="none"
            stroke="var(--accent-3)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - cursor.dwell)}
            transform={`rotate(-90 ${R} ${R})`}
          />
        </svg>
      )}
      <span className="hand-cursor-dot" />
    </div>
  );
}
