import { motion } from 'framer-motion';
import type { Gesture } from '@/game/hand/gestures';
import './GestureGuide.css';

export interface GuideItem {
  pose: Gesture;
  emoji: string;
  label: string;
  how: string;
}
/** @deprecated alias kept for back-compat. */
export type DuelGestureItem = GuideItem;

/** Every Forge a Duel control, in the order players meet them. */
export const DUEL_GESTURES: GuideItem[] = [
  { pose: 'pinch', emoji: '🤏', label: 'Draw', how: 'Pinch thumb + index, move to draw' },
  { pose: 'two-finger', emoji: '✌️', label: 'Colour', how: '2 fingers → colour wheel' },
  { pose: 'three-finger', emoji: '🤟', label: 'Size', how: '3 fingers → brush-size wheel' },
  { pose: 'palm', emoji: '🖐️', label: 'Tools', how: '4 fingers → 🩹 Eraser · 🪣 Bucket' },
  { pose: 'thumb', emoji: '👍', label: 'Undo', how: 'Thumb out' },
  { pose: 'shaka', emoji: '🤙', label: 'Redo', how: 'Thumb + pinky out' },
  { pose: 'fist', emoji: '✊', label: 'Clear', how: 'Hold a fist to wipe the canvas' },
  { pose: 'open', emoji: '🙌', label: 'Done', how: 'Hold open hand to finish' },
];

interface Props {
  /** When set, the card whose pose matches lights up (live camera teaching). */
  live?: Gesture;
  /** Gesture set to show (defaults to the Forge a Duel set). */
  items?: GuideItem[];
  /** Footer hint under the grid. */
  note?: string;
}

/**
 * Visual cheat-sheet of hand gestures. Reused by the first-time tutorials
 * (with a live-detected `live` pose) and the in-canvas "❓ Gestures" overlays.
 */
export function GestureGuide({ live, items = DUEL_GESTURES, note }: Props) {
  return (
    <div className="gguide">
      <div className="gguide-grid">
        {items.map((g) => (
          <motion.div
            key={`${g.pose}-${g.label}`}
            className={`gguide-card ${live === g.pose ? 'is-live' : ''}`}
            whileHover={{ y: -3 }}
          >
            <span className="gguide-emoji">{g.emoji}</span>
            <span className="gguide-label">{g.label}</span>
            <span className="gguide-how">{g.how}</span>
          </motion.div>
        ))}
      </div>
      <p className="gguide-note">{note ?? 'Open a menu (2 / 3 / 4 fingers), then hover a choice and hold to pick it.'}</p>
    </div>
  );
}
