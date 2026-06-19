import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { OneEuroFilter } from './oneEuro';
import { detectGesture, type Gesture, type Landmark } from './gestures';
import {
  DEFAULT_CALIBRATION,
  DWELL_TOOLBAR_MS,
  HAND_MODEL_URL,
  HYST_FRAMES,
  PEN_UP_GRACE_MS,
  WASM_BASE,
  type HandCalibration,
} from './constants';

export type HandStatusKind = 'loading' | 'searching' | 'drawing' | 'lifted' | 'control';

export interface CursorState {
  x: number;
  y: number;
  visible: boolean;
  drawing: boolean;
  /** dwell progress 0..1 (0 = not dwelling). */
  dwell: number;
}

export interface HandEvents {
  onReady?: (delegate: 'GPU' | 'CPU') => void;
  onError?: (message: string) => void;
  /** The live camera stream (for a preview PIP), or null when stopped. */
  onStream?: (stream: MediaStream | null) => void;
  onStatus?: (state: HandStatusKind, text: string) => void;
  onCursor?: (c: CursorState) => void;
  /** Draw events in VIEWPORT pixels — caller maps to canvas space. */
  onDraw?: (phase: 'start' | 'move' | 'end', x: number, y: number) => void;
  /** Committed gesture (for Elemental Showdown etc.). */
  onGesture?: (g: Gesture) => void;
  /**
   * Lock progress toward committing a *new* gesture: the pending gesture (or
   * null when the committed one is stable), how many consecutive frames it has
   * held, and how many are needed. Lets the UI show an honest "locking…" bar
   * instead of a fabricated confidence percentage.
   */
  onGestureProgress?: (pending: Gesture | null, frames: number, needed: number) => void;
  /** Raw landmarks each frame (for calibration sampling). */
  onLandmarks?: (lm: Landmark[], ts: number) => void;
  /**
   * All detected hands each frame (empty when none). Only useful when the
   * tracker was enabled with `numHands: 2` — e.g. Element Creator's two-hand
   * storm gesture. The single-hand `onGesture`/`onCursor`/`onDraw` events still
   * track the first hand exactly as before.
   */
  onHands?: (hands: Landmark[][], ts: number) => void;
}

export interface EnableOptions {
  /** Skip camera + model; feed landmarks manually via feed() (tests). */
  testMode?: boolean;
  /** CSS selector for dwell-clickable toolbar targets. */
  dwellSelector?: string;
  /** How many hands to track (default 1). Use 2 for two-hand gestures. */
  numHands?: 1 | 2;
}

const STATUS_TEXT: Record<HandStatusKind, string> = {
  loading: 'Loading hand tracking…',
  searching: 'Show your hand',
  drawing: '🤏 Drawing',
  lifted: '🖐 Point at a tool',
  control: '🖐 Hold to select…',
};

/**
 * Main-thread hand-tracking controller. Owns the camera, the MediaPipe
 * HandLandmarker, One-Euro smoothing, the gesture state machine, and
 * dwell-to-click. Emits viewport-space events; the UI/integration layer maps
 * them to the canvas.
 *
 * Inference runs on the main thread: MediaPipe tasks-vision fails to initialize
 * inside a Vite-bundled ES module worker ("ModuleFactory not set", in both dev
 * and production builds), so a worker is not used.
 */
export class HandTracker {
  active = false;
  delegate: 'GPU' | 'CPU' | null = null;

  private events: HandEvents;
  private cal: HandCalibration = { ...DEFAULT_CALIBRATION };
  private dwellSelector = '.tb-swatch, .tb-size, .tb-tool';
  private numHands: 1 | 2 = 1;

  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private landmarker: HandLandmarker | null = null;
  private frameHandle: number | null = null;
  private frameInFlight = false;

  private fx = new OneEuroFilter(1.0, 0.05, 1.0);
  private fy = new OneEuroFilter(1.0, 0.05, 1.0);

  private gesture: Gesture = 'none';
  private pinchActive = false;
  private pending: Gesture | null = null;
  private pendingFrames = 0;
  private lastTs = 0;
  private isDrawing = false;
  private penUpAt = 0;

  private dwellEl: Element | null = null;
  private dwellStart = 0;
  private dwellFired = false;
  private lastStatus: HandStatusKind | null = null;

  constructor(events: HandEvents = {}) {
    this.events = events;
  }

  setCalibration(cal: HandCalibration) {
    this.cal = { ...cal };
  }

  // ── lifecycle ───────────────────────────────────────────────
  async enable(opts: EnableOptions = {}): Promise<boolean> {
    if (this.active) return true;
    if (opts.dwellSelector) this.dwellSelector = opts.dwellSelector;
    if (opts.numHands) this.numHands = opts.numHands;
    this.resetState();

    if (opts.testMode) {
      this.active = true;
      this.delegate = 'CPU';
      this.events.onReady?.('CPU');
      this.setStatus('searching');
      return true;
    }

    this.events.onStatus?.('loading', STATUS_TEXT.loading);

    // Camera.
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        // All-`ideal` constraints: the browser picks the closest it can rather
        // than rejecting cameras that can't guarantee them. A hard `min` here
        // (e.g. frameRate) throws OverconstrainedError on many webcams/virtual
        // cameras and silently kills hand tracking.
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 60 },
          facingMode: 'user',
        },
        audio: false,
      });
    } catch {
      this.events.onError?.('camera-denied');
      return false;
    }

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = this.stream;
    try {
      await video.play();
    } catch {
      /* ignore */
    }
    this.video = video;
    this.events.onStream?.(this.stream);

    // MediaPipe HandLandmarker (main thread).
    try {
      this.landmarker = await this.createLandmarker();
    } catch (err) {
      this.events.onError?.(err instanceof Error ? err.message : 'model-failed');
      this.teardown();
      return false;
    }

    this.active = true;
    this.events.onReady?.(this.delegate ?? 'CPU');
    this.setStatus('searching');
    this.startPump();
    return true;
  }

  /** Build the landmarker, preferring the GPU delegate and falling back to CPU. */
  private async createLandmarker(): Promise<HandLandmarker> {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const make = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numHands: this.numHands,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    try {
      const lm = await make('GPU');
      this.delegate = 'GPU';
      return lm;
    } catch {
      const lm = await make('CPU');
      this.delegate = 'CPU';
      return lm;
    }
  }

  disable() {
    if (!this.active) return;
    this.teardown();
    this.events.onStream?.(null);
    this.active = false;
    if (this.isDrawing) {
      this.events.onDraw?.('end', 0, 0);
      this.isDrawing = false;
    }
    this.events.onCursor?.({ x: 0, y: 0, visible: false, drawing: false, dwell: 0 });
  }

  private teardown() {
    if (this.frameHandle !== null && this.video) {
      const v = this.video as any;
      if (typeof v.cancelVideoFrameCallback === 'function') v.cancelVideoFrameCallback(this.frameHandle);
      else cancelAnimationFrame(this.frameHandle);
    }
    this.frameHandle = null;
    this.frameInFlight = false;
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.clearDwell();
  }

  private resetState() {
    this.fx.reset();
    this.fy.reset();
    this.gesture = 'none';
    this.pinchActive = false;
    this.pending = null;
    this.pendingFrames = 0;
    this.lastTs = 0;
    this.isDrawing = false;
    this.penUpAt = 0;
    this.clearDwell();
    this.lastStatus = null;
  }

  private startPump() {
    const video = this.video;
    if (!video) return;
    const v = video as any;
    const hasRVFC = typeof v.requestVideoFrameCallback === 'function';

    const pump = async (nowMs?: number, metadata?: { mediaTime: number }) => {
      if (!this.active || !this.video) return;
      // MediaPipe's detectForVideo requires integer, strictly-increasing
      // millisecond timestamps; floats can collide once floored and make it throw.
      let ts = metadata?.mediaTime ? metadata.mediaTime * 1000 : (nowMs ?? performance.now());
      ts = Math.max(Math.floor(ts), this.lastTs + 1);
      this.lastTs = ts;

      if (!this.frameInFlight && this.landmarker && this.video.readyState >= 2) {
        this.frameInFlight = true;
        try {
          const bitmap = await createImageBitmap(this.video);
          let landmarks: Landmark[] | null = null;
          try {
            const res = this.landmarker.detectForVideo(bitmap, ts);
            landmarks = res.landmarks && res.landmarks.length ? res.landmarks[0] : null;
            if (this.numHands > 1) this.events.onHands?.(res.landmarks ?? [], ts);
          } catch (err) {
            // A single inference error must not wedge the pump.
            this.events.onError?.(err instanceof Error ? err.message : 'inference-failed');
          } finally {
            bitmap.close();
          }
          this.handleLandmarks(landmarks, ts);
        } catch {
          /* createImageBitmap failed for this frame — skip it */
        } finally {
          this.frameInFlight = false;
        }
      }
      schedule();
    };

    const schedule = () => {
      if (!this.active) return;
      if (hasRVFC) this.frameHandle = v.requestVideoFrameCallback(pump);
      else this.frameHandle = requestAnimationFrame((t) => pump(t));
    };
    schedule();
  }

  // ── synthetic input (tests / replay) ────────────────────────
  feed(landmarks: Landmark[] | null, ts?: number) {
    this.handleLandmarks(landmarks, ts ?? performance.now());
  }

  // ── core FSM ────────────────────────────────────────────────
  private handleLandmarks(landmarks: Landmark[] | null, ts: number) {
    if (!this.active) return;
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (!landmarks) {
      // pen-up grace bridges brief dropouts
      if (this.isDrawing) {
        if (!this.penUpAt) this.penUpAt = ts;
        else if (ts - this.penUpAt >= PEN_UP_GRACE_MS) {
          this.events.onDraw?.('end', 0, 0);
          this.isDrawing = false;
          this.penUpAt = 0;
        }
        return;
      }
      this.fx.reset();
      this.fy.reset();
      this.gesture = 'none';
      this.pinchActive = false;
      this.pending = null;
      this.pendingFrames = 0;
      this.clearDwell();
      this.setStatus('searching');
      this.events.onGesture?.('none');
      this.events.onGestureProgress?.(null, 0, HYST_FRAMES);
      this.events.onCursor?.({ x: 0, y: 0, visible: false, drawing: false, dwell: 0 });
      return;
    }

    const lm = landmarks;
    this.events.onLandmarks?.(lm, ts);

    const raw = detectGesture(lm, this.pinchActive, this.cal);

    // Hysteresis (palm/unknown commit immediately so they never stick).
    let next = this.gesture;
    if (raw === this.gesture) {
      this.pending = null;
      this.pendingFrames = 0;
    } else if (raw === 'palm' || raw === 'unknown') {
      next = raw;
      this.pending = null;
      this.pendingFrames = 0;
    } else {
      if (raw === this.pending) this.pendingFrames++;
      else {
        this.pending = raw;
        this.pendingFrames = 1;
      }
      if (this.pendingFrames >= HYST_FRAMES) {
        next = raw;
        this.pending = null;
        this.pendingFrames = 0;
      }
    }
    this.gesture = next;
    this.pinchActive = next === 'pinch';
    this.events.onGesture?.(next);
    this.events.onGestureProgress?.(this.pending, this.pendingFrames, HYST_FRAMES);

    // Smoothed index-finger cursor (x mirrored — selfie view).
    const sx = this.fx.filter((1 - lm[8].x) * w, ts);
    const sy = this.fy.filter(lm[8].y * h, ts);

    // ── DRAW: pinch is pen-down ──
    if (this.pinchActive) {
      this.penUpAt = 0;
      this.clearDwell();
      if (!this.isDrawing) {
        this.events.onDraw?.('start', sx, sy);
        this.isDrawing = true;
      } else {
        this.events.onDraw?.('move', sx, sy);
      }
      this.setStatus('drawing');
      this.events.onCursor?.({ x: sx, y: sy, visible: true, drawing: true, dwell: 0 });
      return;
    }

    // ── pen-up (with grace) ──
    if (this.isDrawing) {
      if (!this.penUpAt) this.penUpAt = ts;
      if (ts - this.penUpAt < PEN_UP_GRACE_MS) {
        this.events.onCursor?.({ x: sx, y: sy, visible: true, drawing: true, dwell: 0 });
        return;
      }
      this.events.onDraw?.('end', 0, 0);
      this.isDrawing = false;
      this.penUpAt = 0;
    }

    // ── command mode: dwell over toolbar ──
    this.updateDwell(sx, sy, ts);
  }

  private updateDwell(sx: number, sy: number, ts: number) {
    const hit = document.elementFromPoint(sx, sy);
    const target = hit?.closest(this.dwellSelector) ?? null;

    if (target !== this.dwellEl) {
      this.dwellEl?.classList.remove('hand-dwell');
      this.dwellEl = target;
      this.dwellStart = target ? ts : 0;
      this.dwellFired = false;
      target?.classList.add('hand-dwell');
    }

    if (!target) {
      this.setStatus('lifted');
      this.events.onCursor?.({ x: sx, y: sy, visible: true, drawing: false, dwell: 0 });
      return;
    }

    const progress = this.dwellFired ? 1 : Math.min(1, (ts - this.dwellStart) / DWELL_TOOLBAR_MS);
    this.setStatus('control');
    this.events.onCursor?.({ x: sx, y: sy, visible: true, drawing: false, dwell: progress });

    if (!this.dwellFired && progress >= 1) {
      this.dwellFired = true;
      (target as HTMLElement).click();
      // brief cool-down before this button can re-fire
      this.dwellStart = ts + 400;
    }
  }

  private clearDwell() {
    this.dwellEl?.classList.remove('hand-dwell');
    this.dwellEl = null;
    this.dwellStart = 0;
    this.dwellFired = false;
  }

  private setStatus(kind: HandStatusKind) {
    if (this.lastStatus === kind) return;
    this.lastStatus = kind;
    this.events.onStatus?.(kind, STATUS_TEXT[kind]);
  }
}
