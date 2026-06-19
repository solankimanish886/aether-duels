import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { ELEMENTS, gestureToElement, randomElement, type ElementKey } from '@/game/elemental';
import { HandTracker } from '@/game/hand/HandTracker';
import { GestureStatus } from '@/game/hand/GestureStatus';
import { CameraPip } from '@/game/hand/CameraPip';
import type { Gesture } from '@/game/hand/gestures';
import { Button } from '@/components/Button';
import { audio } from '@/lib/audio';
import { GestureGallery } from './GestureGallery';
import './elemental.css';

/** No-pressure practice: rehearse the five gestures with live recognition feedback. */
export function ElementalPractice() {
  const go = useUI((s) => s.go);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [delegate, setDelegate] = useState<'GPU' | 'CPU' | null>(null);
  const [gesture, setGesture] = useState<Gesture>('none');
  const [progress, setProgress] = useState(0);
  const [fallback, setFallback] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ElementKey | null>(null);
  const [matched, setMatched] = useState(false);

  const challengeRef = useRef<ElementKey | null>(null);
  const matchedRef = useRef(false);
  const detected = gesture !== 'none';
  const activeKey = gestureToElement(gesture);

  useEffect(() => {
    const TAP_HINT = 'Camera unavailable — tap an element to preview it.';
    const watchdog = setTimeout(() => {
      setReady((r) => {
        if (!r) setFallback(TAP_HINT);
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
        setFallback(msg === 'camera-denied' ? 'Camera blocked — tap an element to preview it.' : TAP_HINT);
      },
      onGesture: (g) => {
        setGesture(g);
        const el = gestureToElement(g);
        // Challenge: celebrate a correct match, then queue the next target.
        if (el && challengeRef.current === el && !matchedRef.current) {
          matchedRef.current = true;
          setMatched(true);
          audio.roundWon();
          setTimeout(() => {
            matchedRef.current = false;
            setMatched(false);
            nextChallenge();
          }, 1100);
        }
      },
      onGestureProgress: (_pending, frames, needed) => setProgress(needed ? frames / needed : 0),
    });
    tracker.enable().catch(() => {});

    return () => {
      clearTimeout(watchdog);
      tracker.disable();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextChallenge = () => {
    let next = randomElement();
    if (next === challengeRef.current) next = randomElement();
    challengeRef.current = next;
    setChallenge(next);
  };

  const startChallenge = () => {
    audio.click();
    nextChallenge();
  };

  const stopChallenge = () => {
    challengeRef.current = null;
    setChallenge(null);
    setMatched(false);
    matchedRef.current = false;
  };

  const challengeDef = challenge ? ELEMENTS[challenge] : null;

  return (
    <div className="escreen">
      <button className="escreen-back" onClick={() => go('elemental-intro')}>
        ← Back
      </button>

      <motion.h1 className="display escreen-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        Practice
      </motion.h1>
      <p className="escreen-sub">
        Make a gesture and watch it light up below. No timer, no score — just get comfortable.
      </p>

      <div className="epractice-stage">
        {challengeDef ? (
          <div className="epractice-prompt">
            {matched ? (
              <span className="etutorial-success">✓ Nice — {challengeDef.label}!</span>
            ) : (
              <>
                Make <b>{challengeDef.emoji} {challengeDef.label}</b>
              </>
            )}
          </div>
        ) : (
          <div className="epractice-readout">
            {activeKey ? (
              <>
                {ELEMENTS[activeKey].emoji} {ELEMENTS[activeKey].label}
              </>
            ) : detected ? (
              'Form a pose…'
            ) : (
              'Show your hand'
            )}
          </div>
        )}

        <GestureGallery activeKey={matched ? challenge : activeKey} />

        <div className="eintro-actions">
          {challenge ? (
            <Button variant="ghost" onClick={stopChallenge}>
              Stop challenge
            </Button>
          ) : (
            <Button variant="glass" onClick={startChallenge}>
              🎯 Set me a challenge
            </Button>
          )}
          <Button variant="primary" onClick={() => { audio.click(); go('elemental'); }}>
            I'm ready — Play →
          </Button>
        </div>
      </div>

      <GestureStatus
        ready={ready}
        detected={detected}
        gesture={gesture}
        progress={progress}
        delegate={delegate}
        fallback={fallback}
      />
      <CameraPip stream={stream} />
    </div>
  );
}
