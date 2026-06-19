/** A single sampled input point in CSS pixels, with timestamp and pressure. */
export interface Point {
  x: number;
  y: number;
  /** epoch ms */
  t: number;
  /** pressure 0..1 */
  p: number;
}

/** A freehand/eraser stroke. */
export interface Stroke {
  kind: 'stroke';
  color: string;
  /** brush diameter in px */
  size: number;
  eraser: boolean;
  points: Point[];
}

/** A flood-fill action, stored in normalized [0,1] coords so it replays at any size. */
export interface Fill {
  kind: 'fill';
  color: string;
  nx: number;
  ny: number;
}

/** Anything the engine can commit and replay. */
export type DrawAction = Stroke | Fill;

export type Tool = 'brush' | 'eraser' | 'fill';

/** Stroke-streaming phase, used for the network broadcast hook. */
export type StrokePhase = 'start' | 'add' | 'end';

export interface EngineCallbacks {
  /** Fired when the committed-action count changes (for undo/redo button state). */
  onChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  /** Fired on the first stroke of a round (to hide the ghost prompt, etc.). */
  onFirstStroke?: () => void;
  /** Network broadcast hook (multiplayer, Phase 7). */
  onStrokePoint?: (
    phase: StrokePhase,
    nx: number,
    ny: number,
    color?: string,
    size?: number,
    pressure?: number,
  ) => void;
  onUndo?: () => void;
  onClear?: () => void;
  /** Fired when a flood-fill successfully paints. */
  onFill?: () => void;
  /** Occasional brush sparkle hook (x/y in CSS px relative to the canvas). */
  onSpark?: (x: number, y: number, color: string) => void;
}
