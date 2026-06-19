import { motion } from 'framer-motion';
import { BRUSH_COLORS, BRUSH_SIZES } from '@/game/drawing/palette';
import type { Tool } from '@/game/drawing/types';
import { audio } from '@/lib/audio';
import type { MenuKind } from '@/screens/multiplayer/useDuelGestures';
import './GestureRadialMenu.css';

/** Tools offered in the 4-finger ring (Brush is reached by picking any colour). */
const TOOL_ITEMS: { tool: Exclude<Tool, 'brush'>; emoji: string; label: string }[] = [
  { tool: 'eraser', emoji: '🩹', label: 'Eraser' },
  { tool: 'fill', emoji: '🪣', label: 'Bucket' },
];

const RING_RADIUS = 96;
const TITLES: Record<MenuKind, string> = { color: 'Colour', size: 'Size', tool: 'Tool' };

/** Friendly labels + amplified display diameters (px) aligned to BRUSH_SIZES,
 *  so even the smallest brush reads clearly in the wheel. */
const SIZE_LABELS = ['S', 'M', 'L', 'XL'];
const SIZE_DISPLAY = [12, 20, 30, 42];

interface Props {
  kind: MenuKind;
  anchor: { x: number; y: number };
  color: string;
  size: number;
  tool: Tool;
  onColor: (c: string) => void;
  onSize: (s: number) => void;
  onTool: (t: Tool) => void;
}

/**
 * Radial pop-up menu anchored at the hand cursor. Items reuse the toolbar's
 * `tb-swatch` / `tb-size` / `tb-tool` classes so the HandTracker's dwell-to-click
 * (default `dwellSelector`) selects them with no tracker changes.
 */
export function GestureRadialMenu({ kind, anchor, color, size, tool, onColor, onSize, onTool }: Props) {
  const items =
    kind === 'color'
      ? BRUSH_COLORS.map((c) => ({ key: c }))
      : kind === 'size'
        ? BRUSH_SIZES.map((s) => ({ key: String(s) }))
        : TOOL_ITEMS.map((t) => ({ key: t.tool }));
  const n = items.length;

  // Keep the whole ring on-screen.
  const pad = RING_RADIUS + 44;
  const cx = Math.max(pad, Math.min(window.innerWidth - pad, anchor.x));
  const cy = Math.max(pad, Math.min(window.innerHeight - pad, anchor.y));

  const pos = (i: number) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2; // first item at top
    return { left: cx + Math.cos(angle) * RING_RADIUS, top: cy + Math.sin(angle) * RING_RADIUS };
  };

  const click = (fn: () => void) => () => {
    audio.click();
    fn();
  };

  // Keep items centred on their ring point: Framer writes an inline transform
  // (for the scale animation) that would otherwise drop the CSS centering.
  const centered = (_: unknown, generated: string) => `translate(-50%, -50%) ${generated}`;

  // Active stroke-size index (for the hub preview), clamped to a valid slot.
  const sizeIdx = Math.max(0, BRUSH_SIZES.indexOf(size as (typeof BRUSH_SIZES)[number]));
  const hubDot = Math.min(SIZE_DISPLAY[sizeIdx], 26);

  return (
    <div className="gmenu" aria-label={`${TITLES[kind]} selector`}>
      <motion.div
        className={`gmenu-hub glass-strong ${kind === 'size' ? 'gmenu-hub--size' : ''}`}
        style={{ left: cx, top: cy }}
        transformTemplate={centered}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      >
        {kind === 'size' ? (
          <>
            <span className="gmenu-hub-dot" style={{ width: hubDot, height: hubDot, background: color }} />
            <span>{SIZE_LABELS[sizeIdx]}</span>
          </>
        ) : (
          TITLES[kind]
        )}
      </motion.div>

      {kind === 'color' &&
        BRUSH_COLORS.map((c, i) => (
          <motion.button
            key={c}
            className={`gmenu-item tb-swatch ${color === c && tool === 'brush' ? 'is-active' : ''}`}
            style={{ ...pos(i), background: c }}
            transformTemplate={centered}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: color === c && tool === 'brush' ? 1.15 : 1, opacity: 1 }}
            transition={{ delay: i * 0.012, type: 'spring', stiffness: 360, damping: 22 }}
            onClick={click(() => onColor(c))}
            aria-label={`Colour ${c}`}
          />
        ))}

      {kind === 'size' &&
        BRUSH_SIZES.map((s, i) => (
          <motion.button
            key={s}
            className={`gmenu-item gmenu-size tb-size ${size === s ? 'is-active' : ''}`}
            style={pos(i)}
            transformTemplate={centered}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: size === s ? 1.1 : 1, opacity: 1 }}
            transition={{ delay: i * 0.02, type: 'spring', stiffness: 360, damping: 22 }}
            onClick={click(() => onSize(s))}
            aria-label={`Brush size ${SIZE_LABELS[i]}`}
          >
            <span className="gmenu-size-dot" style={{ width: SIZE_DISPLAY[i], height: SIZE_DISPLAY[i], background: color }} />
            <span className="gmenu-size-label">{SIZE_LABELS[i]}</span>
          </motion.button>
        ))}

      {kind === 'tool' &&
        TOOL_ITEMS.map((t, i) => (
          <motion.button
            key={t.tool}
            className={`gmenu-item tb-tool ${tool === t.tool ? 'is-active' : ''}`}
            style={pos(i)}
            transformTemplate={centered}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: tool === t.tool ? 1.1 : 1, opacity: 1 }}
            transition={{ delay: i * 0.03, type: 'spring', stiffness: 360, damping: 22 }}
            onClick={click(() => onTool(t.tool))}
            aria-label={t.label}
            title={t.label}
          >
            {t.emoji}
          </motion.button>
        ))}
    </div>
  );
}
