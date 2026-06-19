import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { DrawingCanvas } from '@/game/drawing/DrawingCanvas';
import { DrawingEngine } from '@/game/drawing/DrawingEngine';
import { useHandTracking } from '@/game/hand/useHandTracking';
import { CameraPip } from '@/game/hand/CameraPip';
import { HandCursor } from '@/game/hand/HandCursor';
import type { Gesture } from '@/game/hand/gestures';
import { Button } from '@/components/Button';
import { GestureGuide } from '@/components/GestureGuide';
import { audio } from '@/lib/audio';
import './DuelTutorial.css';

const STEPS = 6; // 0..5

/**
 * Dedicated first-time onboarding for Forge a Duel: a 6-step carousel that
 * explains the mode, camera/privacy, hand position, the pinch-to-draw gestures,
 * an interactive practice canvas, and the win rules — then launches the lobby.
 * Shown once (gated by profile.duelTutorialDone); re-openable from a Help button.
 */
export function DuelTutorial() {
  const go = useUI((s) => s.go);
  const profile = useProfile();
  const reducedMotion = useProfile((s) => s.prefs.reducedMotion);

  const [step, setStep] = useState(0);
  const [camChoice, setCamChoice] = useState<'idle' | 'camera' | 'mouse'>('idle');
  const [gesture, setGesture] = useState<Gesture>('none');
  const [practiceOk, setPracticeOk] = useState(false);
  const [dontShow, setDontShow] = useState(true);

  const practiceEngine = useRef<DrawingEngine | null>(null);
  const camPreviewRef = useRef<HTMLVideoElement | null>(null);

  const hand = useHandTracking({
    getEngine: () => practiceEngine.current,
    getSurfaceRect: () => document.querySelector('.dt-practice .draw-surface')?.getBoundingClientRect() ?? null,
    calibration: profile.handCalibration,
    onGesture: setGesture,
  });

  const detected = hand.cursor.visible;

  // Confidence: none (no cam) / weak (cam, no hand) / strong (hand seen).
  const confidence = camChoice !== 'camera' ? 0 : detected ? 3 : 1;
  const camStarting = camChoice === 'camera' && !hand.enabled && !hand.error;

  const finish = useCallback(
    (markDone: boolean) => {
      if (markDone) profile.completeDuelTutorial();
      hand.stop();
      go('lobby');
    },
    [go, hand, profile],
  );

  // Tidy the tracker if the screen unmounts mid-flow.
  useEffect(() => () => hand.stop(), [hand]);

  // The practice canvas only exists on step 4; drop the engine ref when we leave
  // so a stray pinch never draws into a destroyed engine.
  useEffect(() => {
    if (step !== 4) practiceEngine.current = null;
  }, [step]);

  // Feed the live camera into the centered preview on the hand-position step.
  // A callback ref attaches the stream the moment the <video> actually mounts —
  // an effect can't, because AnimatePresence mode="wait" delays mounting the new
  // step until the old one finishes exiting, so the ref is still null when an
  // effect would run (the cause of the black box).
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
    // Advance to the hand-position step once the camera is up. On failure, stay
    // here — the inline warning + "Use mouse instead" let the player continue.
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

  const anim = (extra?: object) =>
    reducedMotion
      ? { initial: false as const }
      : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, ...extra };

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
                <div className="dt-art dt-art-vs">
                  <span className="dt-mini">🎨</span>
                  <span className="dt-vs">VS</span>
                  <span className="dt-mini dt-mini--pink">🎨</span>
                </div>
                <h1 className="display dt-title">Forge a Duel</h1>
                <p className="dt-body">
                  A <b>1v1 art battle</b>. You and a rival draw the <b>same prompt</b> in 60 seconds, then
                  vote on the best drawing. <b>Best of 3 wins</b> the match. 🏆
                </p>
              </>
            )}

            {step === 1 && (
              <>
                <div className="dt-art">{camChoice === 'camera' ? '📷' : '🖐️'}</div>
                <h1 className="display dt-title">Draw with your hand</h1>
                <p className="dt-body">
                  Use your webcam to draw in the air. Your camera runs <b>only on your device</b> to track
                  your hand — it is <b>never recorded or uploaded</b>.
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
                  <p className="dt-warn">Camera unavailable — you can still play with your mouse.</p>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="display dt-title">Hold your hand up</h1>
                <p className="dt-body">
                  Keep your <b>palm to the camera</b>, about an <b>arm's length</b> away, with your whole hand
                  in frame.
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
                <h1 className="display dt-title">Your hand is the controller</h1>
                <p className="dt-body dt-body--sm">
                  Every control is a hand pose.{' '}
                  {camChoice === 'camera' ? 'Try one — its card lights up when recognised.' : 'Here is the full set:'}
                </p>
                <GestureGuide live={camChoice === 'camera' ? gesture : undefined} />
              </>
            )}

            {step === 4 && (
              <>
                <h1 className="display dt-title">Try it — {camChoice === 'camera' ? 'pinch and draw' : 'draw a line'}</h1>
                <div className="dt-practice">
                  <DrawingCanvas
                    onReady={(engine) => {
                      practiceEngine.current = engine;
                      engine.inputEnabled = true;
                    }}
                    sparkles
                    callbacks={{
                      onChange: ({ canUndo }) => {
                        if (canUndo && !practiceOk) {
                          setPracticeOk(true);
                          audio.roundWon();
                        }
                      },
                    }}
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
                <div className="dt-art">🏆</div>
                <h1 className="display dt-title">You're ready</h1>
                <p className="dt-body">
                  <b>Pinch to draw</b> the prompt; hold up <b>2 / 3 / 4 fingers</b> for colour, size and tools.
                  Then <b>🙌 hold an open hand</b> to finish (or let the timer run out). You both vote —
                  <b> first to win 2 rounds</b> takes it.
                </p>
                <ul className="dt-tips">
                  <li>👍 thumb = undo · 🤙 thumb+pinky = redo · ✊ hold a fist = clear.</li>
                  <li>Keep your hand fully in frame, in good light, an arm's length away.</li>
                  <li>Tap <b>❓ Gestures</b> during a duel to see this guide again.</li>
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
        {/* Step 1 routes via its own camera/mouse buttons. */}
        {step !== 1 && (
          <Button variant="primary" onClick={next}>
            {step === STEPS - 1 ? 'Start Duel →' : 'Next →'}
          </Button>
        )}
      </div>

      {/* practice step: corner camera + pen cursor (step 2 has its own centered preview) */}
      {camChoice === 'camera' && hand.enabled && step === 4 && (
        <>
          <CameraPip stream={hand.stream} />
          <HandCursor cursor={hand.cursor} color="#7cb9ff" />
        </>
      )}
    </div>
  );
}
