import { motion } from 'framer-motion';
import type { ElementDef, ElementKey } from '@/game/elemental';
import type { Gesture } from '@/game/hand/gestures';
import './elemental.css';

/** Big hand emoji + one-line "how to make it" per gesture, for the galleries. */
export const GESTURE_GUIDE: Record<Gesture, { hand: string; how: string }> = {
  fist: { hand: '✊', how: 'Curl all fingers into a fist' },
  draw: { hand: '☝️', how: 'Point with your index finger' },
  'two-finger': { hand: '✌️', how: 'Index + middle finger up' },
  'three-finger': { hand: '🤟', how: 'Index + middle + ring up' },
  thumb: { hand: '👍', how: 'Thumbs-up, other fingers tucked' },
  shaka: { hand: '🤙', how: 'Thumb + pinky out, middle three tucked' },
  palm: { hand: '🖐️', how: 'Open hand, fingers spread' },
  open: { hand: '🙌', how: 'Open hand including the thumb' },
  pinch: { hand: '🤏', how: 'Pinch thumb and index together' },
  none: { hand: '🚫', how: 'No hand detected' },
  unknown: { hand: '❔', how: 'Pose not recognized' },
};

interface GestureCardProps {
  el: ElementDef;
  /** Highlight as the currently recognized / selected element. */
  active?: boolean;
  /** Show a completed checkmark (tutorial step done). */
  done?: boolean;
  onClick?: (key: ElementKey) => void;
  /** What this element beats (label text), shown when provided. */
  beats?: string;
}

/** A single element + its summoning gesture. Reused by gallery, tutorial, practice. */
export function GestureCard({ el, active, done, onClick, beats }: GestureCardProps) {
  const guide = GESTURE_GUIDE[el.gesture];
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      className={`gcard ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
      style={{ ['--elem-color' as string]: el.color } as object}
      onClick={onClick ? () => onClick(el.key) : undefined}
      whileHover={onClick ? { y: -3 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
    >
      <div className="gcard-hand">{guide.hand}</div>
      <div className="gcard-head">
        <span className="gcard-emoji">{el.emoji}</span>
        <span className="gcard-label">{el.label}</span>
        {done && <span className="gcard-check">✓</span>}
      </div>
      <div className="gcard-how">{guide.how}</div>
      {beats && <div className="gcard-beats">Beats {beats}</div>}
    </Comp>
  );
}
