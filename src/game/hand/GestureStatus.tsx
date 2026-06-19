import { motion } from 'framer-motion';
import { ELEMENTS, gestureToElement } from '@/game/elemental';
import type { Gesture } from './gestures';
import './hand-ui.css';

export interface GestureStatusProps {
  /** Tracker has finished loading the model/camera. */
  ready: boolean;
  /** A hand is currently visible to the camera. */
  detected: boolean;
  /** The committed gesture this frame. */
  gesture: Gesture;
  /** 0..1 lock progress toward a pending (not-yet-committed) gesture. */
  progress: number;
  delegate?: 'GPU' | 'CPU' | null;
  /** Overrides the message when hand tracking is unavailable (e.g. tap fallback). */
  fallback?: string | null;
}

/**
 * Live gesture-recognition readout: is your hand seen, which element is being
 * recognized, and a small "locking…" bar. Sibling to HandCoach, reusing its
 * glass-badge styling.
 */
export function GestureStatus({ ready, detected, gesture, progress, delegate, fallback }: GestureStatusProps) {
  const el = gestureToElement(gesture);
  const def = el ? ELEMENTS[el] : null;

  let dot: 'ok' | 'warn' | 'idle' = 'idle';
  let label: string;
  if (fallback) {
    dot = 'warn';
    label = fallback;
  } else if (!ready) {
    dot = 'idle';
    label = 'Loading camera…';
  } else if (!detected) {
    dot = 'warn';
    label = 'Show your hand to the camera';
  } else if (def) {
    dot = 'ok';
    label = `${def.emoji} ${def.label}`;
  } else {
    dot = 'ok';
    label = 'Hand detected — form a pose';
  }

  return (
    <motion.div
      className="gesture-status glass-strong"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
    >
      <span className={`gesture-status-dot is-${dot}`} />
      <span className="gesture-status-label">{label}</span>
      {delegate && <span className="gesture-status-badge mono">{delegate}</span>}
      {ready && detected && !fallback && (
        <span className="gesture-status-bar">
          <span className="gesture-status-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      )}
    </motion.div>
  );
}
