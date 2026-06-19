import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { SandboxCanvas } from '@/game/sandbox/SandboxCanvas';
import { SandboxScene } from '@/game/sandbox/SandboxScene';
import { CREATE_TOOLS, FILL_PRESETS } from '@/game/sandbox/shapeKinds';
import type { SandboxChange, SandboxMode, SandboxTool } from '@/game/sandbox/types';
import { BRUSH_COLORS, BRUSH_SIZES } from '@/game/drawing/palette';
import { Button } from '@/components/Button';
import { GestureGuide } from '@/components/GestureGuide';
import { HoldRing } from '@/components/HoldRing';
import { useHandTracking } from '@/game/hand/useHandTracking';
import { HandCursor } from '@/game/hand/HandCursor';
import { CameraPip } from '@/game/hand/CameraPip';
import { useToasts } from '@/components/Toast';
import { audio } from '@/lib/audio';
import type { Gesture } from '@/game/hand/gestures';
import { useSandboxGestures } from './sandbox/useSandboxGestures';
import { SandboxRadialMenu } from './sandbox/SandboxRadialMenu';
import { SANDBOX_GESTURES, SANDBOX_GUIDE_NOTE } from './sandbox/sandboxGuide';
import './Sandbox.css';

const DEFAULT_STROKE = '#1a1410';

export function Sandbox() {
  const go = useUI((s) => s.go);
  const profile = useProfile();
  const toast = useToasts((s) => s.push);

  const sceneRef = useRef<SandboxScene | null>(null);
  const cursorRef = useRef({ x: 0, y: 0 });
  const handGestureRef = useRef<(g: Gesture) => void>(() => {});
  const autoHandTried = useRef(false);
  const s = () => sceneRef.current;

  const [mode, setMode] = useState<SandboxMode>('create');
  const [tool, setTool] = useState<SandboxTool>('path');
  const [stroke, setStroke] = useState<string>(DEFAULT_STROKE);
  const [width, setWidth] = useState<number>(BRUSH_SIZES[1]);
  const [fill, setFill] = useState<string>(BRUSH_COLORS[1]);
  const [ch, setCh] = useState<SandboxChange>({ canUndo: false, canRedo: false, hasSelection: false, usedColors: [] });
  const [showHelp, setShowHelp] = useState(false);

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const onReady = useCallback(
    (scene: SandboxScene) => {
      sceneRef.current = scene;
      scene.setColor(DEFAULT_STROKE);
      scene.setStrokeWidth(BRUSH_SIZES[1]);
      scene.setFillColor(BRUSH_COLORS[1]);
    },
    [],
  );

  const onChange = useCallback(
    (c: SandboxChange) => {
      setCh(c);
      if (c.usedColors.length && BRUSH_COLORS.every((col) => c.usedColors.includes(col))) profile.unlock('palette');
    },
    [profile],
  );
  const onFirstShape = useCallback(() => {
    profile.unlock('firstStrokes');
  }, [profile]);

  // ── actions ──
  const undo = () => s()?.undo();
  const redo = () => s()?.redo();
  const clear = () => s()?.clear();
  const del = () => s()?.deleteSelected();
  const save = useCallback(() => {
    const url = s()?.toDataURL();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `sandbox-${Date.now()}.png`;
    a.click();
    toast('Saved a PNG to your downloads');
  }, [toast]);

  const switchMode = useCallback((m: SandboxMode) => {
    audio.click();
    s()?.setMode(m);
    setMode(m);
  }, []);
  const toggleMode = useCallback(() => switchMode(modeRef.current === 'create' ? 'fill' : 'create'), [switchMode]);

  const pickTool = (t: SandboxTool) => {
    audio.click();
    s()?.setTool(t);
    setTool(t);
  };
  const pickColor = (c: string) => {
    audio.click();
    if (modeRef.current === 'fill') {
      s()?.setFillColor(c);
      setFill(c);
    } else {
      s()?.setColor(c);
      setStroke(c);
    }
  };
  const pickWidth = (w: number) => {
    audio.click();
    s()?.setStrokeWidth(w);
    setWidth(w);
  };

  // ── hand tracking + gesture controller ──
  const hand = useHandTracking({
    getEngine: () => sceneRef.current,
    getSurfaceRect: () => document.querySelector('.sandbox-surface')?.getBoundingClientRect() ?? null,
    calibration: profile.handCalibration,
    onGesture: (g) => handGestureRef.current(g),
  });
  cursorRef.current = { x: hand.cursor.x, y: hand.cursor.y };

  const gestures = useSandboxGestures({
    getCursor: () => cursorRef.current,
    getMode: () => modeRef.current,
    enabled: hand.enabled,
    onUndo: undo,
    onRedo: redo,
    onToggleMode: toggleMode,
    onClear: clear,
    onSave: save,
  });
  handGestureRef.current = gestures.handleGesture;

  const toggleHand = async () => {
    audio.click();
    if (hand.enabled) {
      hand.stop();
      return;
    }
    const ok = await hand.start();
    if (ok) toast('Pinch to draw · 2 fingers = shapes · 3 fingers = switch mode');
  };

  // Auto-enable hand tracking once (gesture-first); silent fallback to mouse.
  useEffect(() => {
    if (hand.enabled || autoHandTried.current || hand.error) return;
    autoHandTried.current = true;
    void hand.start().then((ok) => {
      if (ok) toast('Pinch to draw · 2 fingers = shapes · 3 fingers = switch mode');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand.enabled, hand.error]);
  useEffect(() => {
    if (hand.error === 'camera-denied') toast('Camera blocked — using mouse instead');
  }, [hand.error, toast]);

  const palette = mode === 'fill' ? fill : stroke;

  return (
    <div className="sbx">
      <SandboxCanvas onReady={onReady} callbacks={{ onChange, onFirstShape }} />

      {/* TOP BAR */}
      <div className="sbx-top">
        <Button variant="ghost" size="sm" onClick={() => go('menu')}>
          ← Menu
        </Button>
        <div className="sbx-seg" role="tablist" aria-label="Sandbox mode">
          <button className={`sbx-seg-btn ${mode === 'create' ? 'is-on' : ''}`} onClick={() => switchMode('create')}>
            ✏️ Create
          </button>
          <button className={`sbx-seg-btn ${mode === 'fill' ? 'is-on' : ''}`} onClick={() => switchMode('fill')}>
            🎨 Fill
          </button>
        </div>
        <div className="sbx-top-right">
          <button
            className={`sbx-iconbtn ${hand.enabled ? 'is-active' : ''}`}
            onClick={toggleHand}
            title="Hand tracking"
            aria-label="Toggle hand tracking"
          >
            🖐️
          </button>
          <button className="sbx-iconbtn" onClick={() => { audio.click(); setShowHelp(true); }} title="Gesture guide" aria-label="Gesture guide">
            ❓
          </button>
          <Button variant="primary" size="sm" onClick={save}>
            💾 Save
          </Button>
        </div>
      </div>

      {/* CONTEXTUAL RAIL (mouse fallback; hidden during hand control) */}
      {!hand.enabled && (
        <motion.div className="sbx-rail glass-strong" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
          {mode === 'create' && (
            <>
              <div className="sbx-rail-grid">
                {CREATE_TOOLS.map((t) => (
                  <button
                    key={t.tool}
                    className={`sbx-tool ${tool === t.tool ? 'is-active' : ''}`}
                    onClick={() => pickTool(t.tool)}
                    title={t.label}
                    aria-label={t.label}
                  >
                    {t.emoji}
                  </button>
                ))}
              </div>
              <div className="sbx-rail-sep" />
              <div className="sbx-swatches">
                {BRUSH_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`sbx-swatch ${stroke === c ? 'is-active' : ''}`}
                    style={{ background: c }}
                    onClick={() => pickColor(c)}
                    aria-label={`Stroke ${c}`}
                  />
                ))}
              </div>
              <div className="sbx-sizes">
                {BRUSH_SIZES.map((w) => (
                  <button key={w} className={`sbx-size ${width === w ? 'is-active' : ''}`} onClick={() => pickWidth(w)} aria-label={`Width ${w}`}>
                    <span style={{ width: w, height: w }} />
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === 'fill' && (
            <>
              <div className="sbx-rail-label">Tap a shape to fill</div>
              <div className="sbx-swatches">
                {BRUSH_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`sbx-swatch ${fill === c ? 'is-active' : ''}`}
                    style={{ background: c }}
                    onClick={() => pickColor(c)}
                    aria-label={`Fill ${c}`}
                  />
                ))}
              </div>
              <div className="sbx-rail-sep" />
              <div className="sbx-presets">
                {FILL_PRESETS.map((c) => (
                  <button key={c} className="sbx-preset" style={{ background: c }} onClick={() => pickColor(c)} aria-label={`Preset ${c}`} />
                ))}
              </div>
            </>
          )}

          <div className="sbx-rail-sep" />
          <div className="sbx-actions">
            {mode === 'create' && ch.hasSelection && (
              <button className="sbx-act sbx-danger" onClick={del} title="Delete selected">
                🗑
              </button>
            )}
            <button className="sbx-act" onClick={undo} disabled={!ch.canUndo} title="Undo">
              ↶
            </button>
            <button className="sbx-act" onClick={redo} disabled={!ch.canRedo} title="Redo">
              ↷
            </button>
            <button className="sbx-act sbx-danger" onClick={clear} disabled={!ch.canUndo && !ch.canRedo} title="Clear">
              ✕
            </button>
          </div>
        </motion.div>
      )}

      {/* hint strip */}
      <div className="sbx-hint glass">
        {mode === 'create'
          ? '✏️ Pick a shape, then drag on the canvas · Select to move/resize'
          : '🎨 Tap any shape to fill it with the chosen colour'}
      </div>

      {/* gesture overlays */}
      {hand.enabled && (
        <>
          <CameraPip stream={hand.stream} />
          <HandCursor cursor={hand.cursor} color={palette} />
          {gestures.menu && (
            <SandboxRadialMenu
              kind={gestures.menu}
              anchor={gestures.anchor}
              currentTool={tool}
              currentColor={palette}
              onShape={(t) => { pickTool(t); gestures.closeMenu(); }}
              onColor={(c) => { pickColor(c); gestures.closeMenu(); }}
            />
          )}
          {gestures.hold && (
            <HoldRing
              x={hand.cursor.x}
              y={hand.cursor.y}
              progress={gestures.hold.progress}
              color={gestures.hold.action === 'clear' ? '#ff5c5c' : '#5de8b8'}
              label={gestures.hold.action === 'clear' ? '✊ Clearing…' : '🙌 Saving…'}
            />
          )}
        </>
      )}

      {/* reopenable gesture cheat-sheet */}
      <AnimatePresence>
        {showHelp && (
          <motion.div className="sbx-help" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHelp(false)}>
            <motion.div
              className="sbx-help-card glass-strong"
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <h2 className="display sbx-help-title">Gesture guide</h2>
              <GestureGuide items={SANDBOX_GESTURES} note={SANDBOX_GUIDE_NOTE} />
              <Button variant="primary" onClick={() => { audio.click(); setShowHelp(false); }}>
                Got it
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
