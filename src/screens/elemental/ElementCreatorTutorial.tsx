import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { useHandTracking } from '@/game/hand/useHandTracking';
import { CameraView } from '@/game/hand/CameraView';
import type { Gesture } from '@/game/hand/gestures';
import { GestureGuide } from '@/components/GestureGuide';
import { Button } from '@/components/Button';
import { audio } from '@/lib/audio';
import { EC_GESTURES, EC_GUIDE_NOTE } from '@/game/world/ecGestures';
import '@/screens/multiplayer/DuelTutorial.css';

const STEPS = 5; // 0..4

/** First-time onboarding for Element Creator — a lean gesture-teaching carousel. */
export function ElementCreatorTutorial() {
  const go = useUI((s) => s.go);
  const prevScreen = useUI((s) => s.prevScreen);
  const profile = useProfile();
  const reducedMotion = useProfile((s) => s.prefs.reducedMotion);

  const [step, setStep] = useState(0);
  const [camChoice, setCamChoice] = useState<'idle' | 'camera' | 'mouse'>('idle');
  const [gesture, setGesture] = useState<Gesture>('none');
  const [dontShow, setDontShow] = useState(true);

  // Camera + gestures only (no drawing engine needed here).
  const hand = useHandTracking({
    getEngine: () => null,
    getSurfaceRect: () => null,
    calibration: profile.handCalibration,
    onGesture: setGesture,
  });

  const detected = hand.cursor.visible;
  const confidence = camChoice !== 'camera' ? 0 : detected ? 3 : 1;
  const camStarting = camChoice === 'camera' && !hand.enabled && !hand.error;

  const finish = useCallback(
    (markDone: boolean) => {
      if (markDone) profile.completeElementCreatorTutorial();
      hand.stop();
      go('element-creator');
    },
    [go, hand, profile],
  );

  useEffect(() => () => hand.stop(), [hand]);

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
    if (step === 0) {
      hand.stop();
      go(prevScreen && prevScreen !== 'element-creator-tutorial' ? prevScreen : 'menu');
      return;
    }
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
                <div className="dt-art">🌍</div>
                <h1 className="display dt-title">Element Creator</h1>
                <p className="dt-body">
                  You're a tiny god. <b>Shape a living 3D world</b> with your hands — raise mountains, carve
                  oceans, grow forests, and call down storms. No timer, no rival.
                </p>
              </>
            )}

            {step === 1 && (
              <>
                <div className="dt-art">{camChoice === 'camera' ? '📷' : '🖐️'}</div>
                <h1 className="display dt-title">Sculpt with your hands</h1>
                <p className="dt-body">
                  Use your webcam to shape the world in the air. The camera runs <b>only on your device</b> — it
                  is <b>never recorded or uploaded</b>.
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
                  <p className="dt-warn">Camera unavailable — you can still shape the world with your mouse.</p>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="display dt-title">Hold your hand up</h1>
                <p className="dt-body">
                  Keep your <b>palm to the camera</b>, about an <b>arm's length</b> away, with your whole hand in
                  frame.
                </p>
                {camChoice === 'camera' && (
                  <div className={`dt-campreview ${detected ? 'is-ok' : ''}`}>
                    <CameraView stream={hand.stream} />
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
                <h1 className="display dt-title">Each pose shapes the world</h1>
                <p className="dt-body dt-body--sm">
                  {camChoice === 'camera' ? 'Try one — its card lights up when recognised.' : 'Here is the full set:'}
                </p>
                <GestureGuide
                  live={camChoice === 'camera' ? gesture : undefined}
                  items={EC_GESTURES}
                  note={EC_GUIDE_NOTE}
                />
              </>
            )}

            {step === 4 && (
              <>
                <div className="dt-art">✨</div>
                <h1 className="display dt-title">You're ready</h1>
                <p className="dt-body">
                  Hold a pose over the world to use that tool; the bar at the bottom shows which one is active.
                  Tap <b>❔ Gestures</b> any time, <b>🖐</b> to switch to mouse, or <b>🔄</b> for a fresh world.
                </p>
                <ul className="dt-tips">
                  <li>🖐 Raise land · ✊ Dig water · ☝ Plant forest.</li>
                  <li>👍 Erupt a volcano · ✌ Make rain · 🙌 both hands wide = Storm.</li>
                  <li>Good light and your whole hand in frame help recognition.</li>
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
        <Button variant="ghost" onClick={back}>
          ← Back
        </Button>
        {step !== 1 && (
          <Button variant="primary" onClick={next}>
            {step === STEPS - 1 ? 'Start creating →' : 'Next →'}
          </Button>
        )}
      </div>
    </div>
  );
}
