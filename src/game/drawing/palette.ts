/** Canvas paper color — eraser paints with this, must match the canvas background. */
export const CANVAS_PAPER = '#f7f4ed';

/** Brush palette (ink-on-paper friendly, aligned to the Ink & Chrome accents). */
export const BRUSH_COLORS = [
  '#1a1410', // ink black
  '#7cb9ff', // accent blue
  '#ff6eb5', // accent pink
  '#5de8b8', // accent mint
  '#ffc844', // gold
  '#c084fc', // violet
  '#ff5c5c', // red
  '#4ade80', // green
] as const;

/** Brush sizes (px diameter at pressure 1). */
export const BRUSH_SIZES = [4, 8, 14, 22] as const;

export const DEFAULT_COLOR = BRUSH_COLORS[1];
export const DEFAULT_SIZE = BRUSH_SIZES[1];

/** Max outgoing stroke-point rate for network sync (~60Hz). */
export const STROKE_THROTTLE_MS = 16;
