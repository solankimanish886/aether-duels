import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { ELEMENTS, gestureToElement, type ElementKey } from '@/game/elemental';
import { HandTracker } from '@/game/hand/HandTracker';
import { GestureStatus } from '@/game/hand/GestureStatus';
import { CameraPip } from '@/game/hand/CameraPip';
import type { Gesture } from '@/game/hand/gestures';
import { Button } from '@/components/Button';
import { audio } from '@/lib/audio';
import { GestureCard } from './GestureCard';
import './elemental.css';

// Walk through all five gestures so players enter the duel knowing every pose.
const STEPS: ElementKey[] = ['earth', 'wind', 'water', 'fire', 'lightning'];

/** First-time interactive tutorial: form each shown gesture once. Skippable. */
export function ElementalTutorial() {
  const go = useUI((s) => s.go);
  const complete = useProfile((s) => s.completeElementalTutorial);

  const [stepIdx, setStepIdx] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [delegate, setDelegate] = useState<'GPU' | 'CPU' | null>(null);
  const [gesture, setGesture] = useState<Gesture>('none');
  const [progress, setProgress] = useState(0);
  const [fallback, setFallback] = useState<string | null>(null);
  const [justMatched, setJustMatched] = useState(false);

  const stepRef = useRef(0);
  const advancingRef = useRef(false);
  const detected = gesture !== 'none';
  const finished = stepIdx >= STEPS.length;
  const target = finished ? null : ELEMENTS[STEPS[stepIdx]];

  const advance = () => {
    advancingRef.current = true;
    setJustMatched(true);
    audio.roundWon();
    setTimeout(() => {
      setJustMatched(false);
      advancingRef.current = false;
      stepRef.current += 1;
      setStepIdx(stepRef.current);
    }, 1000);
  };

  useEffect(() => {
    const watchdog = setTimeout(() => {
      setReady((r) => {
        if (!r) setFallback('Camera unavailable — tap the highlighted gesture to continue.');
        return r;
      });
    }, 9000);

    const tracker = new HandTracker({
      onStream: setStream,
      onReady: (d) => {
        setReady(true);
        setDelegate(d);
        setFallback(null);
      },
      onError: (msg) => {
        setFallback(
          msg === 'camera-denied'
            ? 'Camera blocked — tap the highlighted gesture to continue.'
            : 'Camera unavailable — tap the highlighted gesture to continue.',
        );
      },
      onGesture: (g) => {
        setGesture(g);
        const el = gestureToElement(g);
        const targetKey = STEPS[stepRef.current];
        if (el && el === targetKey && !advancingRef.current && stepRef.current < STEPS.length) {
          advance();
        }
      },
      onGestureProgress: (_p, frames, needed) => setProgress(needed ? frames / needed : 0),
    });
    tracker.enable().catch(() => {});

    return () => {
      clearTimeout(watchdog);
      tracker.disable();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    complete();
    go('elemental-intro');
  };

  // Tap fallback: tapping the highlighted card counts as forming the gesture.
  const tapTarget = () => {
    if (!advancingRef.current && stepRef.current < STEPS.length) advance();
  };

  return (
    <div className="escreen">
      <button className="escreen-skip" onClick={finish}>
        Skip ›
      </button>

      <motion.h1 className="display escreen-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        Quick Tutorial
      </motion.h1>
      <p className="escreen-sub">
        {finished ? "You've got the basics!" : 'Make the gesture below with your hand to summon it.'}
      </p>

      <div className="etutorial-stage">
        <div className="etutorial-progress">
          {STEPS.map((k, i) => (
            <span
              key={k}
              className={`etutorial-pip ${i < stepIdx ? 'is-done' : i === stepIdx ? 'is-current' : ''}`}
            />
          ))}
        </div>

        {finished ? (
          <motion.div
            className="etutorial-target"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="etutorial-success" style={{ fontSize: 22 }}>
              🏆 Tutorial complete!
            </div>
            <Button variant="primary" size="lg" onClick={finish}>
              Back to lobby
            </Button>
          </motion.div>
        ) : (
          target && (
            <div className="etutorial-target">
              {justMatched ? (
                <div className="etutorial-success">✓ {target.label} summoned!</div>
              ) : (
                <div className="epractice-prompt">
                  Summon <b>{target.emoji} {target.label}</b>
                </div>
              )}
              <GestureCard
                el={target}
                active
                done={justMatched}
                onClick={fallback ? tapTarget : undefined}
              />
            </div>
          )
        )}
      </div>

      {!finished && (
        <GestureStatus
          ready={ready}
          detected={detected}
          gesture={gesture}
          progress={progress}
          delegate={delegate}
          fallback={fallback}
        />
      )}
      <CameraPip stream={stream} />
    </div>
  );
}
