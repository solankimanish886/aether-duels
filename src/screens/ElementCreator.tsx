import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { CameraPip } from '@/game/hand/CameraPip';
import { WorldCanvas } from '@/game/world/WorldCanvas';
import { useWorldBrushes } from '@/game/world/useWorldBrushes';
import { useWorldEngine } from '@/game/world/useWorldEngine';
import { makeBrushInput } from '@/game/world/brushInput';
import { BRUSHES, HUD_BRUSHES, type BrushKind } from '@/game/world/brushes';
import { DEFAULT_QUALITY } from '@/game/world/constants';
import { audio } from '@/lib/audio';
import './ElementCreator.css';

const LEGEND: { pose: string; brush: Exclude<BrushKind, 'none'> }[] = [
  { pose: '🖐', brush: 'raise' },
  { pose: '✊', brush: 'dig' },
  { pose: '☝', brush: 'forest' },
  { pose: '👍', brush: 'volcano' },
  { pose: '✌', brush: 'rain' },
  { pose: '🙌🙌', brush: 'storm' },
];

/** Element Creator — shape a living world with your hands (solo sandbox). */
export function ElementCreator() {
  const go = useUI((s) => s.go);
  const calibration = useProfile((s) => s.handCalibration);

  const engine = useWorldEngine(DEFAULT_QUALITY);
  const inputRef = useRef(makeBrushInput());
  const stageRef = useRef<HTMLDivElement>(null);

  const [armed, setArmed] = useState<Exclude<BrushKind, 'none' | 'storm'>>('raise');
  const [fallback, setFallback] = useState<string | null>(null);
  const [worldError, setWorldError] = useState<string | null>(null);

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
    hb.start().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Camera watchdog: if the hand tracker hasn't reported a delegate in time,
  // surface the mouse-fallback hint (the world itself still runs).
  useEffect(() => {
    const t = setTimeout(() => {
      if (!hb.delegate) setFallback('Camera unavailable — pick a tool below and drag to shape the world.');
    }, 9000);
    return () => clearTimeout(t);
  }, [hb.delegate]);

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

  const activeBrush = hb.brush !== 'none' ? hb.brush : null;
  const camReady = !!hb.delegate;

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

      <button className="ecreate-back" onClick={() => go('menu')}>
        ← Menu
      </button>

      <motion.div
        className="ecreate-title display"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Element <span className="ecreate-title-accent">Creator</span>
      </motion.div>

      <div className="ecreate-status glass">
        <span className={`ecreate-dot ${fallback ? 'warn' : camReady ? 'ok' : 'idle'}`} />
        {fallback ? (
          <span>{fallback}</span>
        ) : activeBrush ? (
          <span>
            {BRUSHES[activeBrush].emoji} {BRUSHES[activeBrush].label}
          </span>
        ) : camReady ? (
          <span>Make a gesture to shape the world</span>
        ) : (
          <span>Starting camera…</span>
        )}
      </div>

      {/* gesture legend */}
      <div className="ecreate-legend glass">
        {LEGEND.map((l) => (
          <div key={l.brush} className={`ecreate-legend-row ${activeBrush === l.brush ? 'active' : ''}`}>
            <span className="ecreate-legend-pose">{l.pose}</span>
            <span className="ecreate-legend-name">
              {BRUSHES[l.brush].emoji} {BRUSHES[l.brush].label}
            </span>
          </div>
        ))}
      </div>

      {/* mouse-fallback tool picker + reset */}
      <div className="ecreate-tools glass">
        {HUD_BRUSHES.map((b) => (
          <button
            key={b}
            className={`ecreate-tool ${armed === b ? 'sel' : ''}`}
            title={BRUSHES[b].label}
            onClick={() => {
              audio.click();
              setArmed(b);
            }}
          >
            {BRUSHES[b].emoji}
          </button>
        ))}
        <button
          className="ecreate-tool ecreate-reset"
          title="New world"
          onClick={() => {
            audio.click();
            engine.reset();
          }}
        >
          🔄
        </button>
      </div>

      <CameraPip stream={hb.stream} />
    </div>
  );
}
