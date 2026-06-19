import { CANVAS_PAPER } from '@/game/drawing/palette';
import { hitShape, norm, traceShape } from './drawShape';
import type { SandboxCallbacks, SandboxChange, SandboxMode, SandboxTool, SceneShape } from './types';

export interface SandboxRefs {
  main: HTMLCanvasElement;
  active: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se';
type Drag = null | { kind: 'create' } | { kind: 'move'; ox: number; oy: number } | { kind: 'resize'; handle: Handle };

const HANDLE_HIT = 14;
const MIN_SIZE = 6;
const ACCENT = '#7cb9ff';

/**
 * Retained-mode vector scene for the Sandbox. Holds editable shapes with
 * move/resize/recolour + undo/redo. Pointer and hand input share one pipeline
 * (`pointerDown/Move/Up`, aliased by `handStart/Move/End` for the hand bridge).
 *  - main    : committed shapes
 *  - active  : the in-progress create draft
 *  - overlay : selection box + handles (+ gesture cursor, drawn by the UI)
 */
export class SandboxScene {
  private mainCtx: CanvasRenderingContext2D;
  private activeCtx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;
  private refs: SandboxRefs;
  private cb: SandboxCallbacks;

  private dpr = 1;
  w = 0;
  h = 0;

  mode: SandboxMode = 'create';
  tool: SandboxTool = 'path';
  color = '#1a1410';
  strokeWidth = 6;
  fillColor = '#7cb9ff';

  inputEnabled = true;

  private shapes: SceneShape[] = [];
  private selectedId: string | null = null;
  private past: SceneShape[][] = [];
  private future: SceneShape[][] = [];

  private drag: Drag = null;
  private startX = 0;
  private startY = 0;
  private draft: SceneShape | null = null;
  private idn = 0;
  private firstFired = false;

  private resizeObserver?: ResizeObserver;
  private boundResize = () => this.resize();

  constructor(refs: SandboxRefs, cb: SandboxCallbacks = {}) {
    this.refs = refs;
    this.cb = cb;
    const get = (c: HTMLCanvasElement) => c.getContext('2d') as CanvasRenderingContext2D;
    this.mainCtx = get(refs.main);
    this.activeCtx = get(refs.active);
    this.overlayCtx = get(refs.overlay);
    this.resize();
    window.addEventListener('resize', this.boundResize);
    this.resizeObserver = new ResizeObserver(this.boundResize);
    this.resizeObserver.observe(refs.main);
  }

  destroy() {
    window.removeEventListener('resize', this.boundResize);
    this.resizeObserver?.disconnect();
  }

  resize() {
    const rect = this.refs.main.getBoundingClientRect();
    const w = Math.round(rect.width) || this.refs.main.clientWidth;
    const h = Math.round(rect.height) || this.refs.main.clientHeight;
    if (!w || !h) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w;
    this.h = h;
    for (const c of [this.refs.main, this.refs.active, this.refs.overlay]) {
      c.width = Math.floor(w * this.dpr);
      c.height = Math.floor(h * this.dpr);
    }
    for (const ctx of [this.mainCtx, this.activeCtx, this.overlayCtx]) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    this.renderMain();
    this.renderOverlay();
  }

  // ── config ──────────────────────────────────────────────────
  setMode(m: SandboxMode) {
    this.mode = m;
    if (m === 'fill') this.selectedId = null;
    this.renderOverlay();
    this.emit();
  }
  setTool(t: SandboxTool) {
    this.tool = t;
    if (t !== 'select') {
      this.selectedId = null;
      this.renderOverlay();
    }
    this.emit();
  }
  setColor(c: string) {
    this.color = c;
  }
  setStrokeWidth(s: number) {
    this.strokeWidth = s;
  }
  setFillColor(c: string) {
    this.fillColor = c;
    this.fillSelected(c);
  }

  // ── input pipeline (pointer + hand share this) ──────────────
  handStart(x: number, y: number) {
    this.pointerDown(x, y);
  }
  handMove(x: number, y: number) {
    this.pointerMove(x, y);
  }
  handEnd() {
    this.pointerUp();
  }

  pointerDown(x: number, y: number) {
    if (!this.inputEnabled) return;
    this.startX = x;
    this.startY = y;

    if (this.mode === 'fill') {
      const hit = this.topAt(x, y);
      if (hit) {
        this.pushHistory();
        hit.fill = this.fillColor;
        this.selectedId = hit.id;
        this.renderMain();
        this.renderOverlay();
        this.emit();
      }
      return;
    }

    // CREATE mode
    if (this.tool === 'select') {
      const sel = this.selected();
      const handle = sel ? this.handleAt(sel, x, y) : null;
      if (sel && handle) {
        this.pushHistory();
        this.drag = { kind: 'resize', handle };
        return;
      }
      const hit = this.topAt(x, y);
      if (hit) {
        this.selectedId = hit.id;
        this.pushHistory();
        this.drag = { kind: 'move', ox: x, oy: y };
        this.renderOverlay();
        this.emit();
      } else {
        this.selectedId = null;
        this.renderOverlay();
        this.emit();
      }
      return;
    }

    // start a new shape / freehand
    this.draft = {
      id: 's' + ++this.idn,
      kind: this.tool,
      x,
      y,
      w: 0,
      h: 0,
      points: this.tool === 'path' ? [{ x, y }] : undefined,
      stroke: this.color,
      strokeWidth: this.strokeWidth,
      fill: null,
    };
    this.drag = { kind: 'create' };
    this.renderDraft();
  }

  pointerMove(x: number, y: number) {
    if (!this.drag) return;
    if (this.drag.kind === 'create' && this.draft) {
      if (this.draft.kind === 'path') {
        this.draft.points!.push({ x, y });
      } else {
        this.draft.w = x - this.startX;
        this.draft.h = y - this.startY;
      }
      this.renderDraft();
    } else if (this.drag.kind === 'move') {
      const sel = this.selected();
      if (!sel) return;
      const dx = x - this.drag.ox;
      const dy = y - this.drag.oy;
      this.translate(sel, dx, dy);
      this.drag.ox = x;
      this.drag.oy = y;
      this.renderMain();
      this.renderOverlay();
    } else if (this.drag.kind === 'resize') {
      const sel = this.selected();
      if (sel) {
        this.applyResize(sel, this.drag.handle, x, y);
        this.renderMain();
        this.renderOverlay();
      }
    }
  }

  pointerUp() {
    if (this.drag?.kind === 'create' && this.draft) {
      const d = this.draft;
      const big = d.kind === 'path' ? (d.points?.length ?? 0) > 1 : Math.abs(d.w) > MIN_SIZE || Math.abs(d.h) > MIN_SIZE;
      this.activeCtx.clearRect(0, 0, this.w, this.h);
      if (big) {
        this.pushHistory();
        if (d.kind !== 'line' && d.kind !== 'path') {
          const n = norm(d);
          d.x = n.x;
          d.y = n.y;
          d.w = n.w;
          d.h = n.h;
        }
        this.shapes.push(d);
        this.selectedId = d.id;
        if (!this.firstFired) {
          this.firstFired = true;
          this.cb.onFirstShape?.();
        }
        this.renderMain();
        this.renderOverlay();
        this.emit();
      }
    }
    this.draft = null;
    this.drag = null;
  }

  // ── actions ─────────────────────────────────────────────────
  selectAt(x: number, y: number) {
    const hit = this.topAt(x, y);
    this.selectedId = hit?.id ?? null;
    this.renderOverlay();
    this.emit();
  }
  deleteSelected() {
    if (!this.selectedId) return;
    this.pushHistory();
    this.shapes = this.shapes.filter((s) => s.id !== this.selectedId);
    this.selectedId = null;
    this.renderMain();
    this.renderOverlay();
    this.emit();
  }
  private fillSelected(c: string) {
    const sel = this.selected();
    if (!sel) return;
    this.pushHistory();
    sel.fill = c;
    this.renderMain();
    this.emit();
  }
  undo() {
    if (!this.past.length) return;
    this.future.push(this.clone(this.shapes));
    this.shapes = this.past.pop()!;
    this.ensureSelection();
    this.renderMain();
    this.renderOverlay();
    this.emit();
  }
  redo() {
    if (!this.future.length) return;
    this.past.push(this.clone(this.shapes));
    this.shapes = this.future.pop()!;
    this.ensureSelection();
    this.renderMain();
    this.renderOverlay();
    this.emit();
  }
  clear() {
    if (!this.shapes.length) return;
    this.pushHistory();
    this.shapes = [];
    this.selectedId = null;
    this.renderMain();
    this.renderOverlay();
    this.emit();
  }

  /** Paper-backed PNG of the artwork (for save/export). */
  toDataURL(): string {
    const out = document.createElement('canvas');
    out.width = this.refs.main.width;
    out.height = this.refs.main.height;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = CANVAS_PAPER;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(this.refs.main, 0, 0);
    return out.toDataURL('image/png');
  }

  // ── history / selection helpers ─────────────────────────────
  private pushHistory() {
    this.past.push(this.clone(this.shapes));
    if (this.past.length > 60) this.past.shift();
    this.future = [];
  }
  private clone(arr: SceneShape[]): SceneShape[] {
    return arr.map((s) => ({ ...s, points: s.points ? s.points.map((p) => ({ ...p })) : undefined }));
  }
  private ensureSelection() {
    if (this.selectedId && !this.shapes.some((s) => s.id === this.selectedId)) this.selectedId = null;
  }
  private selected(): SceneShape | null {
    return this.shapes.find((s) => s.id === this.selectedId) ?? null;
  }
  private topAt(x: number, y: number): SceneShape | null {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      if (hitShape(this.shapes[i], x, y)) return this.shapes[i];
    }
    return null;
  }
  private translate(s: SceneShape, dx: number, dy: number) {
    s.x += dx;
    s.y += dy;
    if (s.points) s.points = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
  private applyResize(s: SceneShape, handle: Handle, x: number, y: number) {
    const right = handle === 'ne' || handle === 'se';
    const bottom = handle === 'sw' || handle === 'se';
    const left = !right;
    const top = !bottom;
    const x2 = s.x + s.w;
    const y2 = s.y + s.h;
    const nx = left ? x : s.x;
    const ny = top ? y : s.y;
    const nx2 = right ? x : x2;
    const ny2 = bottom ? y : y2;
    s.x = nx;
    s.y = ny;
    s.w = nx2 - nx;
    s.h = ny2 - ny;
  }

  // ── rendering ───────────────────────────────────────────────
  private paint(ctx: CanvasRenderingContext2D, s: SceneShape) {
    ctx.beginPath();
    traceShape(ctx, s);
    if (s.fill && s.kind !== 'line' && s.kind !== 'path') {
      ctx.fillStyle = s.fill;
      ctx.fill();
    }
    ctx.lineWidth = s.strokeWidth;
    ctx.strokeStyle = s.stroke;
    ctx.stroke();
  }
  private renderMain() {
    this.mainCtx.clearRect(0, 0, this.w, this.h);
    for (const s of this.shapes) this.paint(this.mainCtx, s);
  }
  private renderDraft() {
    this.activeCtx.clearRect(0, 0, this.w, this.h);
    if (this.draft) this.paint(this.activeCtx, this.draft);
  }
  private renderOverlay() {
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.w, this.h);
    const sel = this.selected();
    if (!sel || this.mode === 'fill') return;
    const { x, y, w, h } = norm(sel);
    ctx.save();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
    ctx.setLineDash([]);
    ctx.fillStyle = ACCENT;
    for (const [hx, hy] of this.handlePositions(sel)) {
      ctx.beginPath();
      ctx.rect(hx - 5, hy - 5, 10, 10);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
  private handlePositions(s: SceneShape): [number, number][] {
    const { x, y, w, h } = norm(s);
    return [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ];
  }
  private handleAt(s: SceneShape, x: number, y: number): Handle | null {
    const order: Handle[] = ['nw', 'ne', 'sw', 'se'];
    const pos = this.handlePositions(s);
    for (let i = 0; i < pos.length; i++) {
      if (Math.hypot(x - pos[i][0], y - pos[i][1]) <= HANDLE_HIT) return order[i];
    }
    return null;
  }

  private usedColors(): string[] {
    const set = new Set<string>();
    for (const s of this.shapes) {
      set.add(s.stroke);
      if (s.fill) set.add(s.fill);
    }
    return [...set];
  }
  private emit() {
    const c: SandboxChange = {
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
      hasSelection: !!this.selected(),
      usedColors: this.usedColors(),
    };
    this.cb.onChange?.(c);
  }
}
