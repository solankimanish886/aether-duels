import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { HandTracker } from './HandTracker';
import { pinchRatio } from './gestures';
import type { HandCalibration as Cal } from './constants';
import { useProfile } from '@/state/profile';
import { Button } from '@/components/Button';
import { CameraPip } from './CameraPip';
import './HandCalibration.css';

type Step = 'loading' | 'detect' | 'pinch' | 'open' | 'done' | 'error';
const SAMPLE_MS = 2600;

const COPY: Record<Step, { title: string; body: string }> = {
  loading: { title: 'Starting camera…', body: 'Allow camera access to calibrate.' },
  detect: { title: 'Show your hand', body: 'Hold your hand up, palm to the camera.' },
  pinch: { title: 'Now pinch', body: 'Touch your thumb and index finger together and hold.' },
  open: { title: 'Open wide', body: 'Spread your thumb and index finger far apart.' },
  done: { title: 'Calibrated!', body: 'Your pinch is dialed in. You can draw with your hand now.' },
  error: { title: 'Camera unavailable', body: 'We could not access your camera. You can still draw with mouse or touch.' },
};

export function HandCalibration({ onClose }: { onClose: () => void }) {
  const setHandCalibration = useProfile((s) => s.setHandCalibration);
  const [step, setStep] = useState<Step>('loading');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [progress, setProgress] = useState(0);

  const trackerRef = useRef<HandTracker | null>(null);
  const minPinch = useRef(Infinity);
  const maxPinch = useRef(0);
  const sampling = useRef<'pinch' | 'open' | null>(null);
  const sawHand = useRef(false);

  useEffect(() => {
    const tracker = new HandTracker({
      onStream: setStream,
      onError: () => setStep('error'),
      onLandmarks: (lm) => {
        sawHand.current = true;
        const r = pinchRatio(lm);
        if (sampling.current === 'pinch') minPinch.current = Math.min(minPinch.current, r);
        if (sampling.current === 'open') maxPinch.current = Math.max(maxPinch.current, r);
      },
    });
    trackerRef.current = tracker;
    tracker.enable().then((ok) => {
      if (ok) setStep('detect');
    });
    return () => tracker.disable();
  }, []);

  // Advance from detect → pinch once a hand is seen.
  useEffect(() => {
    if (step !== 'detect') return;
    const id = setInterval(() => {
      if (sawHand.current) {
        clearInterval(id);
        setStep('pinch');
      }
    }, 150);
    return () => clearInterval(id);
  }, [step]);

  // Timed sampling for pinch / open.
  useEffect(() => {
    if (step !== 'pinch' && step !== 'open') return;
    sampling.current = step;
    setProgress(0);
    const start = performance.now();
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / SAMPLE_MS);
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
        sampling.current = null;
        if (step === 'pinch') setStep('open');
        else {
          // Compute personalized thresholds between the observed min/max.
          const lo = Number.isFinite(minPinch.current) ? minPinch.current : 0.2;
          const hi = maxPinch.current > lo ? maxPinch.current : lo + 0.4;
          const cal: Cal = {
            pinchEnter: +(lo + (hi - lo) * 0.35).toFixed(3),
            pinchExit: +(lo + (hi - lo) * 0.6).toFixed(3),
          };
          setHandCalibration(cal);
          setStep('done');
        }
      }
    }, 60);
    return () => clearInterval(id);
  }, [step, setHandCalibration]);

  const c = COPY[step];
  const showProgress = step === 'pinch' || step === 'open';

  return (
    <motion.div
      className="cal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="cal-card glass-strong">
        <div className="cal-emoji">
          {step === 'pinch' ? '🤏' : step === 'open' ? '🖐️' : step === 'done' ? '✅' : step === 'error' ? '📷' : '👋'}
        </div>
        <h2 className="display cal-title">{c.title}</h2>
        <p className="cal-body">{c.body}</p>

        {stream && step !== 'done' && step !== 'error' && (
          <div className="cal-pip-holder">
            <CameraPip stream={stream} />
          </div>
        )}

        {showProgress && (
          <div className="cal-progress">
            <div className="cal-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        <div className="cal-actions">
          {step === 'done' || step === 'error' ? (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
