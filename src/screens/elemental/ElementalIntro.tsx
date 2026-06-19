import { motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { useNet } from '@/state/net';
import { BEST_OF, CHARGE_SECS, WIN_THRESHOLD } from '@/game/elemental';
import { Button } from '@/components/Button';
import { audio } from '@/lib/audio';
import { GestureGallery } from './GestureGallery';
import { MatchupWheel } from './MatchupWheel';
import './elemental.css';

/** Pre-match hub: learn the gestures + matchups, then practice, tutorial, or play. */
export function ElementalIntro() {
  const go = useUI((s) => s.go);
  const tutorialDone = useProfile((s) => s.elementalTutorialDone);

  const playFriend = () => {
    audio.click();
    useNet.getState().set({ mode: 'elemental' });
    go('lobby');
  };

  return (
    <div className="escreen">
      <button className="escreen-back" onClick={() => go('menu')}>
        ← Menu
      </button>

      <motion.h1
        className="display escreen-title"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Elemental Showdown
      </motion.h1>
      <p className="escreen-sub">
        Summon an element with a hand gesture (or a tap) and outwit your rival. Earth, Wind, Water,
        Fire, Lightning — each beats two of the others.
      </p>

      <div className="eintro-body">
        {/* Objective / scoring / controls */}
        <section>
          <div className="eintro-section-title">How a match works</div>
          <div className="eintro-rules">
            <div className="eintro-rule">
              <div className="eintro-rule-icon">🎯</div>
              <b>Goal</b>
              <span>
                Best of {BEST_OF}. First to {WIN_THRESHOLD} round wins takes the match.
              </span>
            </div>
            <div className="eintro-rule">
              <div className="eintro-rule-icon">⏱️</div>
              <b>Summon</b>
              <span>You get {CHARGE_SECS} seconds each round to lock in an element.</span>
            </div>
            <div className="eintro-rule">
              <div className="eintro-rule-icon">🖐️</div>
              <b>Controls</b>
              <span>Make the gesture with your hand, or tap the element. Camera optional.</span>
            </div>
            <div className="eintro-rule">
              <div className="eintro-rule-icon">✨</div>
              <b>Rewards</b>
              <span>Win +20 XP · Tie +10 XP · Loss +5 XP. Win to unlock Elementalist.</span>
            </div>
          </div>
        </section>

        {/* Gesture gallery */}
        <section>
          <div className="eintro-section-title">The five gestures</div>
          <GestureGallery showBeats />
        </section>

        {/* Matchup wheel */}
        <section>
          <div className="eintro-section-title">What beats what</div>
          <MatchupWheel />
        </section>

        {/* Tips */}
        <section>
          <div className="eintro-section-title">Tips for new summoners</div>
          <ul className="eintro-tips">
            <li>Hold the pose steady for a beat — the tracker confirms a gesture before it locks.</li>
            <li>Keep your hand centered in the camera box and well lit.</li>
            <li>No camera? Just tap an element chip — it locks instantly.</li>
            <li>When in doubt, a tie is safe: matching elements clash with no loss.</li>
          </ul>
        </section>
      </div>

      <div className="eintro-actions">
        <Button variant="ghost" onClick={() => go('elemental-practice')}>
          🎮 Practice gestures
        </Button>
        <span className={tutorialDone ? '' : 'eintro-pulse'}>
          <Button variant="glass" onClick={() => go('elemental-tutorial')}>
            {tutorialDone ? '↻ Tutorial' : '✨ Try the tutorial'}
          </Button>
        </span>
        <Button variant="accent" onClick={playFriend}>
          🤝 Play a Friend
        </Button>
        <Button variant="primary" size="lg" onClick={() => { audio.click(); go('elemental'); }}>
          Start Match (Solo) →
        </Button>
      </div>
    </div>
  );
}
