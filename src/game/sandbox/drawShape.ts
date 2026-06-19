import type { Pt, SceneShape } from './types';

/** Normalised (positive-size) bounding box. */
export function norm(s: SceneShape) {
  return {
    x: Math.min(s.x, s.x + s.w),
    y: Math.min(s.y, s.y + s.h),
    w: Math.abs(s.w),
    h: Math.abs(s.h),
  };
}

function regularPoly(cx: number, cy: number, rx: number, ry: number, sides: number, rot: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    out.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return out;
}

function starPoly(cx: number, cy: number, rx: number, ry: number, points: number, rot: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const outer = i % 2 === 0;
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const fr = outer ? 1 : 0.46;
    out.push({ x: cx + rx * fr * Math.cos(a), y: cy + ry * fr * Math.sin(a) });
  }
  return out;
}

function arrowPoly(x: number, y: number, w: number, h: number): Pt[] {
  const headX = x + w * 0.6;
  const st = y + h * 0.3; // shaft top
  const sb = y + h * 0.7; // shaft bottom
  return [
    { x, y: st },
    { x: headX, y: st },
    { x: headX, y },
    { x: x + w, y: y + h / 2 },
    { x: headX, y: y + h },
    { x: headX, y: sb },
    { x, y: sb },
  ];
}

/** Polygon vertices for the angular kinds (used by render + hit-test); null otherwise. */
export function shapeVertices(s: SceneShape): Pt[] | null {
  const { x, y, w, h } = norm(s);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  switch (s.kind) {
    case 'triangle':
      return regularPoly(cx, cy, rx, ry, 3, -Math.PI / 2);
    case 'pentagon':
      return regularPoly(cx, cy, rx, ry, 5, -Math.PI / 2);
    case 'hexagon':
      return regularPoly(cx, cy, rx, ry, 6, -Math.PI / 2);
    case 'star':
      return starPoly(cx, cy, rx, ry, 5, -Math.PI / 2);
    case 'arrow':
      return arrowPoly(x, y, w, h);
    default:
      return null;
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function polyPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** Trace a shape onto `ctx` (caller does beginPath + fill/stroke). */
export function traceShape(ctx: CanvasRenderingContext2D, s: SceneShape) {
  if (s.kind === 'line') {
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.w, s.y + s.h);
    return;
  }
  if (s.kind === 'path') {
    const p = s.points ?? [];
    if (!p.length) return;
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    return;
  }

  const { x, y, w, h } = norm(s);
  switch (s.kind) {
    case 'rect':
      ctx.rect(x, y, w, h);
      break;
    case 'roundRect':
      roundRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.2);
      break;
    case 'circle':
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'triangle':
    case 'pentagon':
    case 'hexagon':
    case 'star':
    case 'arrow':
      polyPath(ctx, shapeVertices(s)!);
      break;
    case 'heart': {
      const cx = x + w / 2;
      ctx.moveTo(cx, y + h);
      ctx.bezierCurveTo(x - w * 0.1, y + h * 0.55, x + w * 0.05, y, cx, y + h * 0.3);
      ctx.bezierCurveTo(x + w * 0.95, y, x + w * 1.1, y + h * 0.55, cx, y + h);
      break;
    }
    case 'speech': {
      const bh = h * 0.78;
      roundRectPath(ctx, x, y, w, bh, Math.min(w, bh) * 0.22);
      ctx.moveTo(x + w * 0.26, y + bh);
      ctx.lineTo(x + w * 0.16, y + h);
      ctx.lineTo(x + w * 0.44, y + bh);
      ctx.closePath();
      break;
    }
  }
}

function pointInPoly(pts: Pt[], px: number, py: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** True when (px,py) is on/inside the shape (used for selection + fill). */
export function hitShape(s: SceneShape, px: number, py: number): boolean {
  if (s.kind === 'line') {
    return distToSeg(px, py, s.x, s.y, s.x + s.w, s.y + s.h) <= Math.max(8, s.strokeWidth);
  }
  if (s.kind === 'path') {
    const p = s.points ?? [];
    const tol = Math.max(8, s.strokeWidth);
    for (let i = 1; i < p.length; i++) {
      if (distToSeg(px, py, p[i - 1].x, p[i - 1].y, p[i].x, p[i].y) <= tol) return true;
    }
    return false;
  }
  const { x, y, w, h } = norm(s);
  if (s.kind === 'circle') {
    const nx = (px - (x + w / 2)) / (w / 2 || 1);
    const ny = (py - (y + h / 2)) / (h / 2 || 1);
    return nx * nx + ny * ny <= 1;
  }
  const verts = shapeVertices(s);
  if (verts) return pointInPoly(verts, px, py);
  // rect / roundRect / heart / speech → bounding box
  return px >= x && px <= x + w && py >= y && py <= y + h;
}
