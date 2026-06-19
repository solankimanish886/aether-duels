import { useCallback, useEffect, useRef, useState } from 'react';
import { HandTracker, type CursorState, type HandStatusKind } from './HandTracker';
import type { Gesture } from './gestures';
import type { HandCalibration } from './constants';

export type HandUIStatus = { kind: HandStatusKind; text: string } | null;

/** Anything the hand bridge can drive with pen-down/move/up (DrawingEngine, SandboxScene). */
export interface HandDrawable {
  handStart(x: number, y: number): void;
  handMove(x: number, y: number): void;
  handEnd(): void;
}

interface Params {
  getEngine: () => HandDrawable | null;
  getSurfaceRect: () => DOMRect | null;
  calibration: HandCalibration;
  onGesture?: (g: Gesture) => void;
}

const HIDDEN_CURSOR: CursorState = { x: 0, y: 0, visible: false, drawing: false, dwell: 0 };

/**
 * React wrapper around HandTracker. Maps viewport-space draw events to the
 * drawing engine's canvas space and exposes reactive cursor/status for the UI.
 */
export function useHandTracking({ getEngine, getSurfaceRect, calibration, onGesture }: Params) {
  const trackerRef = useRef<HandTracker | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<HandUIStatus>(null);
  const [cursor, setCursor] = useState<CursorState>(HIDDEN_CURSOR);
  const [delegate, setDelegate] = useState<'GPU' | 'CPU' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  if (!trackerRef.current) {
    trackerRef.current = new HandTracker({
      onReady: (d) => setDelegate(d),
      onStream: (s) => setStream(s),
      onError: (m) => {
        setError(m);
        setEnabled(false);
      },
      onStatus: (kind, text) => setStatus({ kind, text }),
      onCursor: (c) => setCursor(c),
      onGesture,
      onDraw: (phase, vx, vy) => {
        const engine = getEngine();
        if (!engine) return;
        if (phase === 'end') {
          engine.handEnd();
          return;
        }
        if (phase === 'start') rectRef.current = getSurfaceRect();
        const r = rectRef.current;
        const x = r ? vx - r.left : vx;
        const y = r ? vy - r.top : vy;
        if (phase === 'start') engine.handStart(x, y);
        else engine.handMove(x, y);
      },
    });
  }

  useEffect(() => {
    trackerRef.current?.setCalibration(calibration);
  }, [calibration]);

  const start = useCallback(async (testMode = false) => {
    setError(null);
    const ok = await trackerRef.current!.enable({ testMode });
    setEnabled(ok);
    return ok;
  }, []);

  const stop = useCallback(() => {
    trackerRef.current?.disable();
    setEnabled(false);
    setCursor(HIDDEN_CURSOR);
    setStatus(null);
  }, []);

  // Clean up on unmount.
  useEffect(() => () => trackerRef.current?.disable(), []);

  return { tracker: trackerRef.current!, enabled, status, cursor, delegate, error, stream, start, stop };
}
