import { useCallback, useEffect, useRef, useState } from 'react';
import { HandTracker, type CursorState } from '@/game/hand/HandTracker';
import type { Gesture } from '@/game/hand/gestures';
import type { HandCalibration } from '@/game/hand/constants';
import type { BrushInput } from './brushInput';
import { GESTURE_TO_BRUSH, type BrushKind } from './brushes';
import { detectStorm } from './storm';
import { STORM_HYST } from './constants';

interface Params {
  input: React.MutableRefObject<BrushInput>;
  getRect: () => DOMRect | null;
  calibration: HandCalibration;
}

/**
 * Owns the two-hand HandTracker and translates poses into the shared brush
 * input (read by BrushTarget). The single-hand pose selects the brush; the
 * cursor positions it; a two-hand spread overrides with the storm brush. No
 * engine/pixel math here — BrushTarget raycasts the cursor into a grid cell.
 */
export function useWorldBrushes({ input, getRect, calibration }: Params) {
  const trackerRef = useRef<HandTracker | null>(null);
  const visibleRef = useRef(false);
  const stormFrames = useRef(0);

  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<{ kind: string; text: string } | null>(null);
  const [gesture, setGesture] = useState<Gesture>('none');
  const [brush, setBrush] = useState<BrushKind>('none');
  const [delegate, setDelegate] = useState<'GPU' | 'CPU' | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<CursorState>({ x: 0, y: 0, visible: false, drawing: false, dwell: 0 });
  /** 0..1 progress toward locking a new gesture (for HUD feedback). */
  const [progress, setProgress] = useState(0);

  const refresh = useCallback(() => {
    const inp = input.current;
    inp.handActive = !inp.storm && inp.handKind !== 'none' && visibleRef.current;
    const shown: BrushKind = inp.storm ? 'storm' : inp.handActive ? inp.handKind : 'none';
    setBrush(shown);
  }, [input]);

  if (!trackerRef.current) {
    trackerRef.current = new HandTracker({
      onReady: (d) => {
        setDelegate(d);
        setError(null);
      },
      onStream: (s) => setStream(s),
      onError: (m) => {
        setError(m);
        setEnabled(false);
      },
      onStatus: (kind, text) => setStatus({ kind, text }),
      onCursor: (c: CursorState) => {
        visibleRef.current = c.visible;
        setCursor(c);
        if (c.visible) {
          const r = getRect();
          input.current.px = r ? c.x - r.left : c.x;
          input.current.py = r ? c.y - r.top : c.y;
        }
        refresh();
      },
      onGesture: (g) => {
        setGesture(g);
        input.current.handKind = GESTURE_TO_BRUSH[g] ?? 'none';
        refresh();
      },
      onGestureProgress: (_pending, frames, needed) => setProgress(needed ? frames / needed : 0),
      onHands: (hands) => {
        const hit = detectStorm(hands);
        if (hit) {
          stormFrames.current++;
          if (stormFrames.current >= STORM_HYST) {
            input.current.storm = true;
            input.current.stormCx = hit.cx;
            input.current.stormCy = hit.cy;
            refresh();
          }
        } else if (stormFrames.current !== 0 || input.current.storm) {
          stormFrames.current = 0;
          input.current.storm = false;
          refresh();
        }
      },
    });
  }

  useEffect(() => {
    trackerRef.current?.setCalibration(calibration);
  }, [calibration]);

  const start = useCallback(async () => {
    setError(null);
    const ok = await trackerRef.current!.enable({ numHands: 2 });
    setEnabled(ok);
    return ok;
  }, []);

  const stop = useCallback(() => {
    trackerRef.current?.disable();
    setEnabled(false);
    visibleRef.current = false;
    input.current.handActive = false;
    input.current.storm = false;
    input.current.handKind = 'none';
    setCursor({ x: 0, y: 0, visible: false, drawing: false, dwell: 0 });
    setBrush('none');
    setStatus(null);
  }, [input]);

  useEffect(() => () => trackerRef.current?.disable(), []);

  return { enabled, status, gesture, brush, delegate, stream, error, cursor, progress, start, stop };
}
