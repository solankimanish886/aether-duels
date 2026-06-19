import { getStroke } from 'perfect-freehand';
import type { Stroke } from './types';

/** perfect-freehand tuning — pressure-aware variable width, gentle smoothing. */
const STROKE_OPTS = {
  thinning: 0.55,
  smoothing: 0.55,
  streamline: 0.5,
  easing: (t: number) => t,
};

function toSvgPath(outline: number[][]): Path2D {
  const path = new Path2D();
  if (outline.length === 0) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    path.lineTo(outline[i][0], outline[i][1]);
  }
  path.closePath();
  return path;
}

/**
 * Render a stroke onto a 2D context.
 * @param last  false while the stroke is still in progress (live layer),
 *              true once committed — controls perfect-freehand's end cap.
 */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  last = true,
): void {
  const pts = stroke.points;
  if (pts.length === 0) return;

  const inputs = pts.map((p) => [p.x, p.y, p.p] as [number, number, number]);
  const outline = getStroke(inputs, { size: stroke.size, last, ...STROKE_OPTS });
  if (!outline || outline.length === 0) return;

  ctx.save();
  ctx.fillStyle = stroke.color;
  ctx.fill(toSvgPath(outline));
  ctx.restore();
}
