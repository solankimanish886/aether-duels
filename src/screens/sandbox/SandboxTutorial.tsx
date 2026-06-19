import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { SandboxCanvas } from '@/game/sandbox/SandboxCanvas';
import { SandboxScene } from '@/game/sandbox/SandboxScene';
import { useHandTracking } from '@/game/hand/useHandTracking';
import { CameraPip } from '@/game/hand/CameraPip';
import { HandCursor } from '@/game/hand/HandCursor';
import type { Gesture } from '@/game/hand/gestures';
import { GestureGuide } from '@/components/GestureGuide';
import { Button } from '@/components/Button';
import { audio } from '@/lib/audio';
import { SANDBOX_GESTURES, SANDBOX_GUIDE_NOTE } from './sandboxGuide';
import '@/screens/multiplayer/DuelTutorial.css';

const STEPS = 6; // 0..5

/** First-time onboarding for the Creative Sandbox — mirrors DuelTutorial. */
export function SandboxTutorial() {
  const go = useUI((s) => s.go);
  const profile = useProfile();
  const reducedMotion = useProfile((s) => s.prefs.reducedMotion);

  const [step, setStep] = useState(0);
  const [camChoice, setCamChoice] = useState<'idle' | 'camera' | 'mouse'>('idle');
  const [gesture, setGesture] = useState<Gesture>('none');
  const [practiceOk, setPracticeOk] = useState(false);
  const [dontShow, setDontShow] = useState(true);

  const practiceScene = useRef<SandboxScene | null>(null);
  const camPreviewRef = useRef<HTMLVideoElement | null>(null);

  const hand = useHandTracking({
    getEngine: () => practiceScene.current,
    getSurfaceRect: () => document.querySelector('.dt-practice .sandbox-surface')?.getBoundingClientRect() ?? null,
    calibration: profile.handCalibration,
    onGesture: setGesture,
  });

  const detected = hand.cursor.visible;
  const confidence = camChoice !== 'camera' ? 0 : detected ? 3 : 1;
  const camStarting = camChoice === 'camera' && !hand.enabled && !hand.error;

  const finish = useCallback(
    (markDone: boolean) => {
      if (markDone) profile.completeSandboxTutorial();
      hand.stop();
      go('sandbox');
    },
    [go, hand, profile],
  );

  useEffect(() => () => hand.stop(), [hand]);
  useEffect(() => {
    if (step !== 4) practiceScene.current = null;
  }, [step]);

  // Callback ref: attach the stream when the <video> actually mounts (AnimatePresence
  // mode="wait" delays the mount, so an effect would run with a null ref).
  const attachPreview = useCallback(
    (v: HTMLVideoElement | null) => {
      camPreviewRef.current = v;
      if (v) {
        v.srcObject = hand.stream;
        if (hand.stream) v.play().catch(() => {});
      }
    },
    [hand.stream],
  );

  const enableCamera = async () => {
    audio.click();
    setCamChoice('camera');
    const ok = await hand.start();
    if (ok) setStep((s) => s + 1);
  };
  const useMouse = () => {
    audio.click();
    hand.stop();
    setCamChoice('mouse');
    setStep((s) => s + 1);
  };
  const next = () => {
    audio.click();
    if (step < STEPS - 1) setStep((s) => s + 1);
    else finish(dontShow);
  };
  const back = () => {
    audio.click();
    setStep((s) => Math.max(0, s - 1));
  };

  const anim = () =>
    reducedMotion
      ? { initial: false as const }
      : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

  return (
    <div className="dt">
      <button className="dt-skip" onClick={() => finish(true)}>
        Skip ›
      </button>

      <div className="dt-progress" aria-hidden>
        {Array.from({ length: STEPS }).map((_, i) => (
          <span key={i} className={`dt-dot ${i === step ? 'is-current' : i < step ? 'is-done' : ''}`} />
        ))}
      </div>

      <div className="dt-stage">
        <AnimatePresence mode="wait">
          <motion.div key={step} className="dt-step" {...anim()} transition={{ duration: reducedMotion ? 0 : 0.3 }}>
            {step === 0 && (
              <>
                <div className="dt-art">🎨</div>
                <h1 className="display dt-title">Creative Sandbox</h1>
                <p className="dt-body">
                  A calm space to <b>make things</b>. Draw freehand, drop in <b>shapes</b>, then <b>colour them in</b> —
                  all by hand or mouse. No timer, no rival. Just create.
                </p>
              </>
            )}

            {step === 1 && (
              <>
                <div className="dt-art">{camChoice === 'camera' ? '📷' : '🖐️'}</div>
                <h1 className="display dt-title">Create with your hand</h1>
                <p className="dt-body">
                  Use your webcam to sculpt in the air. The camera runs <b>only on your device</b> — it is{' '}
                  <b>never recorded or uploaded</b>.
                </p>
                <div className="dt-choices">
                  <Button variant="primary" onClick={enableCamera} disabled={camStarting}>
                    {hand.error && camChoice === 'camera'
                      ? '📷 Retry'
                      : camChoice === 'camera' && hand.enabled
                        ? 'Camera on ✓'
                        : camStarting
                          ? 'Starting…'
                          : '📷 Enable camera'}
                  </Button>
                  <Button variant="ghost" onClick={useMouse}>
                    Use mouse instead
                  </Button>
                </div>
                {camChoice === 'camera' && hand.error && (
                  <p className="dt-warn">Camera unavailable — you can still create with your mouse.</p>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="display dt-title">Hold your hand up</h1>
                <p className="dt-body">
                  Keep your <b>palm to the camera</b>, about an <b>arm's length</b> away, with your whole hand in frame.
                </p>
                {camChoice === 'camera' && (
                  <div className={`dt-campreview ${detected ? 'is-ok' : ''}`}>
                    <video ref={attachPreview} autoPlay playsInline muted />
                    {detected && <span className="dt-campreview-tag">Hand detected ✓</span>}
                  </div>
                )}
                <div className={`dt-detect ${detected ? 'is-ok' : ''}`}>
                  <div className="dt-confbar">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span key={i} className={`dt-confseg ${i < confidence ? 'is-on' : ''}`} />
                    ))}
                  </div>
                  <span className="dt-detect-label">
                    {camChoice !== 'camera'
                      ? 'Camera off — using mouse'
                      : detected
                        ? 'Hand detected ✓'
                        : 'Searching for your hand… (you can continue anytime)'}
                  </span>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="display dt-title">Your hand is the studio</h1>
                <p className="dt-body dt-body--sm">
                  Every control is a hand pose.{' '}
                  {camChoice === 'camera' ? 'Try one — its card lights up when recognised.' : 'Here is the full set:'}
                </p>
                <GestureGuide live={camChoice === 'camera' ? gesture : undefined} items={SANDBOX_GESTURES} note={SANDBOX_GUIDE_NOTE} />
              </>
            )}

            {step === 4 && (
              <>
                <h1 className="display dt-title">Try it — {camChoice === 'camera' ? 'pinch and draw' : 'draw a line'}</h1>
                <div className="dt-practice">
                  <SandboxCanvas
                    onReady={(scene) => {
                      practiceScene.current = scene;
                      scene.setTool('path');
                    }}
                    callbacks={{ onFirstShape: () => { setPracticeOk(true); audio.roundWon(); } }}
                  />
                  <AnimatePresence>
                    {!practiceOk ? (
                      <motion.div className="dt-practice-hint" {...anim()}>
                        {camChoice === 'camera' ? '🤏 Pinch and move to draw' : '✏️ Draw a line with your mouse'}
                      </motion.div>
                    ) : (
                      <motion.div className="dt-practice-ok" {...anim()}>
                        Nice! ✓
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <div className="dt-art">✨</div>
                <h1 className="display dt-title">You're ready</h1>
                <p className="dt-body">
                  <b>Pinch</b> to draw & shape · <b>2 fingers</b> for shapes/colours · <b>3 fingers</b> switches Create ⇄
                  Fill · <b>🙌 hold</b> to save your art.
                </p>
                <ul className="dt-tips">
                  <li>👍 thumb = undo · 🤙 thumb+pinky = redo · ✊ hold a fist = clear.</li>
                  <li>Pick <b>Select 👆</b> to move or resize a shape by its corners.</li>
                  <li>Tap <b>❓ Gestures</b> any time to see this guide again.</li>
                </ul>
                <label className="dt-checkbox">
                  <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
                  Don't show this again
                </label>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="dt-nav">
        <Button variant="ghost" onClick={back} disabled={step === 0}>
          ← Back
        </Button>
        {step !== 1 && (
          <Button variant="primary" onClick={next}>
            {step === STEPS - 1 ? 'Start creating →' : 'Next →'}
          </Button>
        )}
      </div>

      {camChoice === 'camera' && hand.enabled && step === 4 && (
        <>
          <CameraPip stream={hand.stream} />
          <HandCursor cursor={hand.cursor} color="#1a1410" />
        </>
      )}
    </div>
  );
}
