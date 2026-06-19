import { AnimatePresence, motion } from 'framer-motion';
import {
  ELEMENTS,
  roundReason,
  type ElementKey,
  type Outcome,
} from '@/game/elemental';
import { Button } from '@/components/Button';
import './RoundResultPopup.css';

const OUTCOME_META: Record<Outcome, { emoji: string; title: string; cls: string }> = {
  win: { emoji: '✨', title: 'You Win!', cls: 'is-win' },
  lose: { emoji: '💥', title: 'You Lose', cls: 'is-lose' },
  tie: { emoji: '🌀', title: 'Round Tied', cls: 'is-tie' },
};

interface RoundResultPopupProps {
  open: boolean;
  outcome: Outcome;
  /** The local player's summoned element (null = didn't summon in time). */
  youPick: ElementKey | null;
  /** The opponent's element (null = they didn't summon in time). */
  oppPick: ElementKey | null;
  youName: string;
  oppName: string;
  youWins: number;
  oppWins: number;
  /** Round outcomes so far, for the history dots. */
  history: Outcome[];
  /** True when this round decides the match (advancing leads to final results). */
  deciding: boolean;
  /** Networked match awaiting the opponent's readiness after this player clicked. */
  waiting: boolean;
  onReady: () => void;
}

function Fighter({ pick, label }: { pick: ElementKey | null; label: string }) {
  const def = pick ? ELEMENTS[pick] : null;
  return (
    <div className="rresult-fighter">
      <span
        className="rresult-fighter-emoji"
        style={def ? ({ ['--elem-color' as string]: def.color } as object) : undefined}
      >
        {def ? def.emoji : '❓'}
      </span>
      <span className="rresult-fighter-name">{label}</span>
      <span className="rresult-fighter-elem">{def ? def.label : 'No summon'}</span>
    </div>
  );
}

/**
 * Gated round-result popup. Unlike the shared Modal it has no backdrop-click or
 * Escape dismissal — the next round is gated solely by the CTA button.
 */
export function RoundResultPopup({
  open,
  outcome,
  youPick,
  oppPick,
  youName,
  oppName,
  youWins,
  oppWins,
  history,
  deciding,
  waiting,
  onReady,
}: RoundResultPopupProps) {
  const meta = OUTCOME_META[outcome];
  const cta = deciding ? 'See Final Results →' : 'Ready for Next Round →';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="rresult-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="presentation"
        >
          <motion.div
            className={`glass-strong rresult-card ${meta.cls}`}
            role="dialog"
            aria-modal="true"
            aria-label={`Round result: ${meta.title}`}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <motion.div
              className="rresult-emoji"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 12 }}
            >
              {meta.emoji}
            </motion.div>

            <h2 className="display rresult-title">{meta.title}</h2>
            <p className="rresult-reason">{roundReason(outcome, youPick, oppPick)}</p>

            <div className="rresult-matchup">
              <Fighter pick={youPick} label={youName} />
              <span className="rresult-vs">vs</span>
              <Fighter pick={oppPick} label={oppName} />
            </div>

            <div className="rresult-score">
              <span className="rresult-score-num">{youWins}</span>
              <span className="rresult-score-sep">·</span>
              <span className="rresult-score-num">{oppWins}</span>
            </div>

            {history.length > 0 && (
              <div className="elem-history rresult-history" aria-hidden>
                {history.map((o, i) => (
                  <span key={i} className={`elem-hist is-${o}`} />
                ))}
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              className="rresult-cta"
              onClick={onReady}
              disabled={waiting}
            >
              {waiting ? 'Waiting for opponent…' : cta}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
