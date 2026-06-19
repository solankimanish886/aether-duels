import { renderStroke } from './renderStroke';
import { floodFill } from './floodFill';
import { CANVAS_PAPER, DEFAULT_COLOR, DEFAULT_SIZE, STROKE_THROTTLE_MS } from './palette';
import type { DrawAction, EngineCallbacks, Point, Stroke, Tool } from './types';

export interface CanvasRefs {
  main: HTMLCanvasElement;
  active: HTMLCanvasElement;
  cursor: HTMLCanvasElement;
}

const now = () => performance.now();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Framework-agnostic drawing engine.
 * - `main`   : committed artwork
 * - `active` : the in-progress stroke (cleared & repainted each move)
 * - `cursor` : brush-size indicator
 * Pointer and hand input share the same internal begin/extend/end pipeline.
 */
export class DrawingEngine {
  private mainCtx: CanvasRenderingContext2D;
  private activeCtx: CanvasRenderingContext2D;
  private cursorCtx: CanvasRenderingContext2D;
  private refs: CanvasRefs;
  private cb: EngineCallbacks;

  private dpr = 1;
  w = 0;
  h = 0;

  color: string = DEFAULT_COLOR;
  size: number = DEFAULT_SIZE;
  tool: Tool = 'brush';

  private actions: DrawAction[] = [];
  private redoStack: DrawAction[] = [];
  private current: Stroke | null = null;
  private isDown = false;
  private firstStrokeFired = false;
  private lastSendTs = 0;

  /** When true, pointer/hand input is ignored (e.g. between rounds). */
  inputEnabled = true;

  private resizeObserver?: ResizeObserver;
  private boundResize = () => this.resize();

  constructor(refs: CanvasRefs, cb: EngineCallbacks = {}) {
    this.refs = refs;
    this.cb = cb;
    const opts: CanvasRenderingContext2DSettings = { desynchronized: true };
    const get = (c: HTMLCanvasElement) => c.getContext('2d', opts) as CanvasRenderingContext2D;
    this.mainCtx = get(refs.main);
    this.activeCtx = get(refs.active);
    this.cursorCtx = get(refs.cursor);
    this.resize();
    this.attach();
  }

  // ── lifecycle ───────────────────────────────────────────────
  private attach() {
    const s = this.refs.active;
    s.addEventListener('pointerdown', this.onPointerDown);
    s.addEventListener('pointermove', this.onPointerMove);
    s.addEventListener('pointerup', this.onPointerUp);
    s.addEventListener('pointercancel', this.onPointerUp);
    s.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('resize', this.boundResize);
    this.resizeObserver = new ResizeObserver(this.boundResize);
    this.resizeObserver.observe(this.refs.main);
  }

  destroy() {
    const s = this.refs.active;
    s.removeEventListener('pointerdown', this.onPointerDown);
    s.removeEventListener('pointermove', this.onPointerMove);
    s.removeEventListener('pointerup', this.onPointerUp);
    s.removeEventListener('pointercancel', this.onPointerUp);
    s.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('resize', this.boundResize);
    this.resizeObserver?.disconnect();
  }

  resize() {
    const rect = this.refs.main.getBoundingClientRect();
    const w = Math.round(rect.width) || this.refs.main.clientWidth;
    const h = Math.round(rect.height) || this.refs.main.clientHeight;
    if (w === 0 || h === 0) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w;
    this.h = h;
    for (const c of [this.refs.main, this.refs.active, this.refs.cursor]) {
      c.width = Math.floor(w * this.dpr);
      c.height = Math.floor(h * this.dpr);
    }
    for (const ctx of [this.mainCtx, this.activeCtx, this.cursorCtx]) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    this.redrawAll();
  }

  // ── tools ───────────────────────────────────────────────────
  setColor(c: string) {
    this.color = c;
    this.tool = 'brush';
  }
  setSize(s: number) {
    this.size = s;
  }
  setTool(t: Tool) {
    this.tool = t;
  }
  get isEraser() {
    return this.tool === 'eraser';
  }

  // ── pointer input ───────────────────────────────────────────
  private eventPoint(e: PointerEvent): Point {
    const rect = this.refs.active.getBoundingClientRect();
    let p = 0.5;
    if (typeof e.pressure === 'number' && e.pressure > 0) p = clamp(e.pressure, 0.15, 1);
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: now(), p };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.inputEnabled) return;
    const p = this.eventPoint(e);
    if (this.tool === 'fill') {
      this.fireFirstStroke();
      this.doFill(p.x, p.y);
      return;
    }
    this.refs.active.setPointerCapture(e.pointerId);
    this.begin(p);
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.eventPoint(e);
    this.drawCursor(p.x, p.y);
    if (!this.isDown || !this.current) return;
    this.extend(p);
  };

  private onPointerUp = () => {
    if (!this.isDown || !this.current) return;
    this.end();
  };

  private onPointerLeave = () => {
    this.cursorCtx.clearRect(0, 0, this.w, this.h);
  };

  // ── hand-input bridge (Phase 4) ─────────────────────────────
  handStart(x: number, y: number) {
    if (!this.inputEnabled) return;
    if (this.tool === 'fill') {
      this.fireFirstStroke();
      this.doFill(x, y);
      return;
    }
    this.begin({ x, y, t: now(), p: 0.65 });
  }
  handMove(x: number, y: number) {
    this.drawCursor(x, y);
    if (!this.isDown || !this.current) return;
    this.extend({ x, y, t: now(), p: 0.65 });
  }
  handEnd() {
    if (!this.isDown || !this.current) return;
    this.end();
  }

  // ── stroke pipeline (shared) ────────────────────────────────
  private begin(p: Point) {
    this.isDown = true;
    this.fireFirstStroke();
    const eraser = this.tool === 'eraser';
    const color = eraser ? CANVAS_PAPER : this.color;
    const size = eraser ? Math.max(this.size * 1.6, 18) : this.size;
    this.current = { kind: 'stroke', color, size, eraser, points: [p] };
    this.renderActive();
    if (this.cb.onStrokePoint) {
      this.cb.onStrokePoint('start', p.x / this.w, p.y / this.h, color, size, p.p);
      this.lastSendTs = now();
    }
  }

  private extend(p: Point) {
    this.current!.points.push(p);
    this.renderActive();
    if (!this.current!.eraser && this.cb.onSpark && Math.random() < 0.1) {
      this.cb.onSpark(p.x, p.y, this.current!.color);
    }
    if (this.cb.onStrokePoint) {
      const t = now();
      if (t - this.lastSendTs >= STROKE_THROTTLE_MS) {
        this.cb.onStrokePoint('add', p.x / this.w, p.y / this.h, undefined, undefined, p.p);
        this.lastSendTs = t;
      }
    }
  }

  private end() {
    const s = this.current!;
    this.commit(s);
    renderStroke(this.mainCtx, s, true);
    this.activeCtx.clearRect(0, 0, this.w, this.h);
    this.current = null;
    this.isDown = false;
    this.cb.onStrokePoint?.('end', 0, 0);
  }

  private renderActive() {
    this.activeCtx.clearRect(0, 0, this.w, this.h);
    if (this.current) renderStroke(this.activeCtx, this.current, false);
  }

  private doFill(x: number, y: number) {
    const filled = floodFill(this.mainCtx, x, y, this.color, this.dpr);
    if (filled) {
      this.commit({ kind: 'fill', color: this.color, nx: x / this.w, ny: y / this.h });
      this.cb.onFill?.();
    }
  }

  // ── undo / redo / clear ─────────────────────────────────────
  private commit(action: DrawAction) {
    this.actions.push(action);
    this.redoStack.length = 0;
    this.emitChange();
  }

  undo() {
    const a = this.actions.pop();
    if (!a) return;
    this.redoStack.push(a);
    this.redrawAll();
    this.emitChange();
    this.cb.onUndo?.();
  }

  redo() {
    const a = this.redoStack.pop();
    if (!a) return;
    this.actions.push(a);
    this.redrawAll();
    this.emitChange();
  }

  clear() {
    if (this.actions.length === 0) return;
    this.actions.length = 0;
    this.redoStack.length = 0;
    this.redrawAll();
    this.emitChange();
    this.cb.onClear?.();
  }

  /** Wipe everything including history — used when (re)starting a round. */
  reset() {
    this.actions.length = 0;
    this.redoStack.length = 0;
    this.current = null;
    this.isDown = false;
    this.firstStrokeFired = false;
    this.tool = 'brush';
    this.redrawAll();
    this.emitChange();
  }

  private redrawAll() {
    this.replay(this.mainCtx, this.actions);
    this.activeCtx.clearRect(0, 0, this.w, this.h);
  }

  private replay(ctx: CanvasRenderingContext2D, actions: DrawAction[]) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const dpr = ctx === this.mainCtx ? this.dpr : ctx.canvas.width / this.w;
    for (const a of actions) {
      if (a.kind === 'fill') floodFill(ctx, a.nx * this.w, a.ny * this.h, a.color, dpr);
      else renderStroke(ctx, a, true);
    }
  }

  private fireFirstStroke() {
    if (this.firstStrokeFired) return;
    this.firstStrokeFired = true;
    this.cb.onFirstStroke?.();
  }

  private emitChange() {
    this.cb.onChange?.({
      canUndo: this.actions.length > 0,
      canRedo: this.redoStack.length > 0,
    });
  }

  get actionCount() {
    return this.actions.length;
  }

  /** Distinct non-eraser colors used across committed actions. */
  usedColors(): Set<string> {
    const set = new Set<string>();
    for (const a of this.actions) {
      if (a.kind === 'fill') set.add(a.color);
      else if (!a.eraser) set.add(a.color);
    }
    return set;
  }

  /** Fraction (0..1) of the main canvas that has ink on it. */
  inkCoverage(): number {
    if (this.w === 0 || this.h === 0) return 0;
    const { width, height } = this.refs.main;
    const data = this.mainCtx.getImageData(0, 0, width, height).data;
    let inked = 0;
    // Sample every 4th pixel for speed; good enough for a coverage estimate.
    const step = 16;
    let sampled = 0;
    for (let i = 3; i < data.length; i += 4 * step) {
      sampled++;
      if (data[i] > 10) inked++;
    }
    return sampled ? inked / sampled : 0;
  }

  // ── cursor ──────────────────────────────────────────────────
  private drawCursor(x: number, y: number) {
    const ctx = this.cursorCtx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.strokeStyle = this.isEraser ? 'rgba(40,30,20,0.5)' : this.color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const r = (this.isEraser ? Math.max(this.size * 1.6, 18) : this.size) / 2 + 1;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ── export (for AI judge / reveal, Phase 6) ─────────────────
  /** Render the artwork (paper + actions) to a fresh canvas at the given pixel width. */
  exportToCanvas(targetWidth = 720): HTMLCanvasElement {
    const aspect = this.h / this.w || 1;
    const out = document.createElement('canvas');
    out.width = targetWidth;
    out.height = Math.round(targetWidth * aspect);
    const ctx = out.getContext('2d')!;
    const scale = out.width / this.w;
    ctx.fillStyle = CANVAS_PAPER;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.replay(ctx, this.actions);
    return out;
  }

  toDataURL(targetWidth = 720, type = 'image/png'): string {
    return this.exportToCanvas(targetWidth).toDataURL(type);
  }
}
