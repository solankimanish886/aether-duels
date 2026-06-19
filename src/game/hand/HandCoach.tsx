import { motion } from 'framer-motion';
import type { HandUIStatus } from './useHandTracking';
import './hand-ui.css';

const HINTS: Record<string, string> = {
  searching: 'Hold your hand up to the camera',
  drawing: 'Pinch to draw · open your hand to stop',
  lifted: 'Point at a tool, then hold to pick it',
  control: 'Keep holding…',
  loading: 'Warming up the camera…',
};

/** Unobtrusive in-match coaching badge: gesture state + a contextual hint. */
export function HandCoach({
  status,
  delegate,
}: {
  status: HandUIStatus;
  delegate: 'GPU' | 'CPU' | null;
}) {
  if (!status) return null;
  return (
    <motion.div
      className="hand-coach glass-strong"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
    >
      <span className={`hand-coach-state hand-coach-state--${status.kind}`}>{status.text}</span>
      <span className="hand-coach-hint">{HINTS[status.kind] ?? ''}</span>
      {delegate && <span className="hand-coach-badge mono">{delegate}</span>}
    </motion.div>
  );
}
