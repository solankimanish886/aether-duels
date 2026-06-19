import { motion } from 'framer-motion';
import { BRUSH_COLORS, BRUSH_SIZES } from '@/game/drawing/palette';
import type { Tool } from '@/game/drawing/types';
import { audio } from '@/lib/audio';
import './Toolbar.css';

const clicky = (fn: () => void) => () => {
  audio.click();
  fn();
};

export interface ToolbarState {
  color: string;
  size: number;
  tool: Tool;
  canUndo: boolean;
  canRedo: boolean;
}

interface Props {
  state: ToolbarState;
  onColor: (c: string) => void;
  onSize: (s: number) => void;
  onTool: (t: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

export function Toolbar({ state, onColor, onSize, onTool, onUndo, onRedo, onClear }: Props) {
  const { color, size, tool, canUndo, canRedo } = state;
  return (
    <motion.div
      className="glass-strong toolbar"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
    >
      <div className="toolbar-group toolbar-colors">
        {BRUSH_COLORS.map((c) => (
          <button
            key={c}
            className={`tb-swatch ${color === c && tool === 'brush' ? 'is-active' : ''}`}
            style={{ background: c }}
            onClick={clicky(() => onColor(c))}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group toolbar-sizes">
        {BRUSH_SIZES.map((s) => (
          <button
            key={s}
            className={`tb-size ${size === s ? 'is-active' : ''}`}
            onClick={clicky(() => onSize(s))}
            aria-label={`Brush size ${s}`}
          >
            <span style={{ width: s, height: s }} />
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group toolbar-tools">
        <button
          className={`tb-tool ${tool === 'eraser' ? 'is-active' : ''}`}
          onClick={clicky(() => onTool('eraser'))}
          aria-label="Eraser"
          title="Eraser"
        >
          🩹
        </button>
        <button
          className={`tb-tool ${tool === 'fill' ? 'is-active' : ''}`}
          onClick={clicky(() => onTool('fill'))}
          aria-label="Fill"
          title="Fill"
        >
          🪣
        </button>
        <button className="tb-tool" onClick={clicky(onUndo)} disabled={!canUndo} aria-label="Undo" title="Undo">
          ↶
        </button>
        <button className="tb-tool" onClick={clicky(onRedo)} disabled={!canRedo} aria-label="Redo" title="Redo">
          ↷
        </button>
        <button className="tb-tool tb-danger" onClick={clicky(onClear)} disabled={!canUndo} aria-label="Clear" title="Clear">
          🗑
        </button>
      </div>
    </motion.div>
  );
}
