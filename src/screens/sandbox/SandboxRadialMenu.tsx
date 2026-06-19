import { motion } from 'framer-motion';
import { BRUSH_COLORS } from '@/game/drawing/palette';
import { CREATE_TOOLS } from '@/game/sandbox/shapeKinds';
import type { SandboxTool } from '@/game/sandbox/types';
import { audio } from '@/lib/audio';
import type { SandboxMenuKind } from './useSandboxGestures';
import '@/components/Toolbar.css';
import '@/components/GestureRadialMenu.css';

const RING_RADIUS = 118;

interface Props {
  kind: SandboxMenuKind;
  anchor: { x: number; y: number };
  currentTool: SandboxTool;
  currentColor: string;
  onShape: (t: SandboxTool) => void;
  onColor: (c: string) => void;
}

/** Gesture radial menu for the Sandbox — a shape ring or a colour ring. */
export function SandboxRadialMenu({ kind, anchor, currentTool, currentColor, onShape, onColor }: Props) {
  const items = kind === 'shape' ? CREATE_TOOLS.length : BRUSH_COLORS.length;
  const pad = RING_RADIUS + 44;
  const cx = Math.max(pad, Math.min(window.innerWidth - pad, anchor.x));
  const cy = Math.max(pad, Math.min(window.innerHeight - pad, anchor.y));
  const pos = (i: number) => {
    const a = -Math.PI / 2 + (i / items) * Math.PI * 2;
    return { left: cx + Math.cos(a) * RING_RADIUS, top: cy + Math.sin(a) * RING_RADIUS };
  };
  const centered = (_: unknown, generated: string) => `translate(-50%, -50%) ${generated}`;
  const click = (fn: () => void) => () => {
    audio.click();
    fn();
  };

  return (
    <div className="gmenu" aria-label={kind === 'shape' ? 'Shape selector' : 'Colour selector'}>
      <motion.div
        className="gmenu-hub glass-strong"
        style={{ left: cx, top: cy }}
        transformTemplate={centered}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      >
        {kind === 'shape' ? 'Shapes' : 'Colour'}
      </motion.div>

      {kind === 'shape' &&
        CREATE_TOOLS.map((t, i) => (
          <motion.button
            key={t.tool}
            className={`gmenu-item tb-tool ${currentTool === t.tool ? 'is-active' : ''}`}
            style={pos(i)}
            transformTemplate={centered}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: currentTool === t.tool ? 1.1 : 1, opacity: 1 }}
            transition={{ delay: i * 0.012, type: 'spring', stiffness: 360, damping: 22 }}
            onClick={click(() => onShape(t.tool))}
            aria-label={t.label}
            title={t.label}
          >
            {t.emoji}
          </motion.button>
        ))}

      {kind === 'color' &&
        BRUSH_COLORS.map((c, i) => (
          <motion.button
            key={c}
            className={`gmenu-item tb-swatch ${currentColor === c ? 'is-active' : ''}`}
            style={{ ...pos(i), background: c }}
            transformTemplate={centered}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: currentColor === c ? 1.15 : 1, opacity: 1 }}
            transition={{ delay: i * 0.012, type: 'spring', stiffness: 360, damping: 22 }}
            onClick={click(() => onColor(c))}
            aria-label={`Colour ${c}`}
          />
        ))}
    </div>
  );
}
