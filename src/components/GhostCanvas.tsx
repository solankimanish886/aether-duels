import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { CANVAS_PAPER } from '@/game/drawing/palette';
import type { PayloadOf } from '@/game/net/protocol';
import './GhostCanvas.css';

interface GhostProps {
  /** Opponent display name. */
  name: string;
  /** Connection state (drives the status dot). */
  connected?: boolean;
  /** Short phase/status line, e.g. "Drawing…". */
  status?: string;
}

interface GhostStroke {
  color: string;
  size: number;
  pts: { x: number; y: number }[];
}

export interface GhostHandle {
  apply: (s: PayloadOf<'stroke'>) => void;
  undo: () => void;
  clear: () => void;
  reset: () => void;
}

/**
 * Small live preview of the opponent's drawing. Receives normalized [0,1]
 * stroke points over the network and renders them with simple round-capped
 * lines (perfect-freehand isn't needed at this size).
 */
export const GhostCanvas = forwardRef<GhostHandle, GhostProps>(({ name, connected = true, status }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<GhostStroke[]>([]);
  const current = useRef<GhostStroke | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  const ctxOf = () => canvasRef.current?.getContext('2d') ?? null;

  const redraw = () => {
    const ctx = ctxOf();
    const c = canvasRef.current;
    if (!ctx || !c) return;
    ctx.fillStyle = CANVAS_PAPER;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokes.current) drawStroke(ctx, c, s);
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, s: GhostStroke) => {
    if (s.pts.length === 0) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.size * (c.width / 480));
    ctx.beginPath();
    s.pts.forEach((p, i) => {
      const x = p.x * c.width;
      const y = p.y * c.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  useImperativeHandle(ref, () => ({
    apply(s) {
      const c = canvasRef.current;
      const ctx = ctxOf();
      if (!c || !ctx) return;
      if (s.phase === 'start') {
        current.current = { color: s.color || '#7cb9ff', size: s.size || 8, pts: [{ x: s.x, y: s.y }] };
        strokes.current.push(current.current);
        setHasDrawn(true);
      } else if (s.phase === 'add' && current.current) {
        current.current.pts.push({ x: s.x, y: s.y });
        // incremental draw of the last segment
        const pts = current.current.pts;
        if (pts.length >= 2) {
          ctx.strokeStyle = current.current.color;
          ctx.lineWidth = Math.max(1, current.current.size * (c.width / 480));
          ctx.lineCap = 'round';
          const a = pts[pts.length - 2];
          const b = pts[pts.length - 1];
          ctx.beginPath();
          ctx.moveTo(a.x * c.width, a.y * c.height);
          ctx.lineTo(b.x * c.width, b.y * c.height);
          ctx.stroke();
        }
      } else if (s.phase === 'end') {
        current.current = null;
      }
    },
    undo() {
      strokes.current.pop();
      current.current = null;
      redraw();
    },
    clear() {
      strokes.current = [];
      current.current = null;
      redraw();
    },
    reset() {
      strokes.current = [];
      current.current = null;
      setHasDrawn(false);
      const ctx = ctxOf();
      const c = canvasRef.current;
      if (ctx && c) {
        ctx.fillStyle = CANVAS_PAPER;
        ctx.fillRect(0, 0, c.width, c.height);
      }
    },
  }));

  return (
    <div className="ghost-panel">
      <div className="ghost-header">
        <span className="ghost-chip">RIVAL</span>
        <span className="ghost-name">{name}</span>
        <span className={`ghost-dot ${connected ? 'is-on' : 'is-off'}`} />
        <span className="ghost-status">{connected ? status ?? 'Connected' : 'Disconnected'}</span>
      </div>
      <div className="ghost-canvas">
        <canvas ref={canvasRef} width={220} height={150} />
        {!hasDrawn && <div className="ghost-empty">Waiting for their first stroke…</div>}
      </div>
    </div>
  );
});

GhostCanvas.displayName = 'GhostCanvas';
