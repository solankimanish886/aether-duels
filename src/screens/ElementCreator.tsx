import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { CameraPip } from '@/game/hand/CameraPip';
import { HandCursor } from '@/game/hand/HandCursor';
import { Button } from '@/components/Button';
import { GestureGuide } from '@/components/GestureGuide';
import { WorldCanvas } from '@/game/world/WorldCanvas';
import { useWorldBrushes } from '@/game/world/useWorldBrushes';
import { useWorldEngine } from '@/game/world/useWorldEngine';
import { makeBrushInput } from '@/game/world/brushInput';
import { BRUSHES, BRUSH_TINT, HUD_BRUSHES, type BrushKind } from '@/game/world/brushes';
import { EC_GESTURES, EC_GUIDE_NOTE } from '@/game/world/ecGestures';
import { DEFAULT_QUALITY } from '@/game/world/constants';
import { audio } from '@/lib/audio';
import './ElementCreator.css';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Element Creator — shape a living world with your hands (solo sandbox). */
export function ElementCreator() {
  const go = useUI((s) => s.go);
  const calibration = useProfile((s) => s.handCalibration);

  const engine = useWorldEngine(DEFAULT_QUALITY);
  const inputRef = useRef(makeBrushInput());
  const stageRef = useRef<HTMLDivElement>(null);

  const [armed, setArmed] = useState<Exclude<BrushKind, 'none' | 'storm'>>('raise');
  const [worldError, setWorldError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [starting, setStarting] = useState(true);

  const hb = useWorldBrushes({
    input: inputRef,
    getRect: () => stageRef.current?.getBoundingClientRect() ?? null,
    calibration,
  });

  // Start hand tracking once mounted; the world renders regardless of camera.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    hb.start()
      .catch(() => {})
      .finally(() => setStarting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleHand = async () => {
    audio.click();
    if (hb.enabled) {
      hb.stop();
      return;
    }
    setStarting(true);
    await hb.start().catch(() => {});
    setStarting(false);
  };

  // ── mouse / touch fallback (writes the shared brush input) ────
  const localXY = (e: React.PointerEvent) => {
    const r = stageRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    stageRef.current?.setPointerCapture(e.pointerId);
    const { x, y } = localXY(e);
    inputRef.current.px = x;
    inputRef.current.py = y;
    inputRef.current.mouseKind = armed;
    inputRef.current.mouseActive = true;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!inputRef.current.mouseActive) return;
    const { x, y } = localXY(e);
    inputRef.current.px = x;
    inputRef.current.py = y;
  };
  const endPointer = () => {
    inputRef.current.mouseActive = false;
  };

  const handOn = hb.enabled;
  const activeBrush = hb.brush !== 'none' ? hb.brush : null;
  const cursorColor = activeBrush ? hex(BRUSH_TINT[activeBrush]) : '#7cb9ff';
  const liveGesture = hb.brush === 'storm' ? 'shaka' : hb.gesture;

  return (
    <div className="ecreate">
      <div
        className="ecreate-stage"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerLeave={endPointer}
      >
        {!worldError && (
          <WorldCanvas engine={engine} input={inputRef} quality={DEFAULT_QUALITY} onError={setWorldError} />
        )}
        {worldError && (
          <div className="ecreate-error">
            Couldn’t start the world renderer ({worldError}). Your browser may lack WebGL.
          </div>
        )}
      </div>

      {/* TOP BAR */}
      <div className="ec-top">
        <Button variant="ghost" size="sm" onClick={() => go('menu')}>
          ← Menu
        </Button>
        <div className="ec-title display">
          Element <span className="ec-title-accent">Creator</span>
        </div>
        <div className="ec-top-right">
          <button
            className={`ec-iconbtn ${handOn ? 'is-active' : ''}`}
            onClick={toggleHand}
            title="Hand tracking"
            aria-label="Toggle hand tracking"
          >
            🖐️
          </button>
          <button
            className="ec-iconbtn"
            onClick={() => { audio.click(); setShowGuide(true); }}
            title="Gesture guide"
            aria-label="Gesture guide"
          >
            ❔
          </button>
          <button
            className="ec-iconbtn"
            onClick={() => { audio.click(); engine.reset(); }}
            title="New world"
            aria-label="New world"
          >
            🔄
          </button>
        </div>
      </div>

      {/* mouse tool rail — only when hand tracking is off */}
      {!handOn && !starting && (
        <motion.div className="ec-rail glass-strong" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
          {HUD_BRUSHES.map((b) => (
            <button
              key={b}
              className={`ec-tool ${armed === b ? 'is-active' : ''}`}
              title={BRUSHES[b].label}
              aria-label={BRUSHES[b].label}
              onClick={() => { audio.click(); setArmed(b); }}
            >
              {BRUSHES[b].emoji}
            </button>
          ))}
        </motion.div>
      )}

      {/* active-brush feedback pill (bottom-center) */}
      <div className="ec-active glass">
        <span className={`ec-active-dot ${hb.error ? 'warn' : starting ? 'idle' : handOn ? (activeBrush ? 'ok' : 'idle') : 'off'}`} />
        <span className="ec-active-text">
          {hb.error ? (
            'Camera off — pick a tool and drag to shape the world'
          ) : starting ? (
            'Starting camera…'
          ) : !handOn ? (
            'Pick a tool, then drag on the world'
          ) : activeBrush ? (
            <>
              {BRUSHES[activeBrush].emoji} {BRUSHES[activeBrush].label}
            </>
          ) : (
            'Make a gesture to shape the world'
          )}
        </span>
        {handOn && hb.progress > 0.02 && hb.progress < 1 && (
          <span className="ec-active-bar">
            <span style={{ width: `${Math.round(hb.progress * 100)}%` }} />
          </span>
        )}
      </div>

      {/* hand-tracking overlays */}
      {handOn && (
        <>
          <CameraPip stream={hb.stream} corner="right" />
          <HandCursor cursor={hb.cursor} color={cursorColor} />
        </>
      )}

      {/* collapsible gesture guide */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            className="ec-help"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowGuide(false)}
          >
            <motion.div
              className="ec-help-card glass-strong"
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <h2 className="display ec-help-title">Gesture guide</h2>
              <GestureGuide items={EC_GESTURES} live={liveGesture} note={EC_GUIDE_NOTE} />
              <Button variant="primary" onClick={() => { audio.click(); setShowGuide(false); }}>
                Got it
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
