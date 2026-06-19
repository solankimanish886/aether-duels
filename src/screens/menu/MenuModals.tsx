import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { getLeaderboard, type ScoreEntry } from '@/lib/api';
import { ACHIEVEMENTS } from '@/game/achievements';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { HandCalibration } from '@/game/hand/HandCalibration';
import './MenuModals.css';

export function MenuModals() {
  const modal = useUI((s) => s.modal);
  const close = useUI((s) => s.closeModal);
  const profile = useProfile();
  const [calOpen, setCalOpen] = useState(false);
  const [board, setBoard] = useState<ScoreEntry[] | null>(null);

  useEffect(() => {
    if (modal !== 'leaderboard') return;
    setBoard(null);
    getLeaderboard({ name: profile.name, xp: profile.xp, level: profile.level() }).then(setBoard);
  }, [modal, profile]);

  return (
    <>
      <Modal open={modal === 'achievements'} title="Achievements" onClose={close}>
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = profile.achievements.includes(a.id);
            return (
              <div key={a.id} className={`ach-cell ${unlocked ? 'is-unlocked' : ''}`}>
                <span className="ach-cell-icon">{a.icon}</span>
                <div>
                  <b>{a.name}</b>
                  <span className="ach-cell-desc">{a.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <Modal open={modal === 'leaderboard'} title="Leaderboard" onClose={close}>
        {!board ? (
          <p className="lb-loading">Loading…</p>
        ) : (
          <ol className="lb-list">
            {board.map((e, i) => {
              const isMe = e.name === (profile.name || 'You');
              return (
                <li key={`${e.name}-${i}`} className={`lb-row ${isMe ? 'is-me' : ''}`}>
                  <span className="lb-rank mono">{i + 1}</span>
                  <span className="lb-name">{e.name}</span>
                  <span className="lb-lvl">Lv {e.level}</span>
                  <span className="lb-xp mono">{e.xp.toLocaleString()} XP</span>
                </li>
              );
            })}
          </ol>
        )}
      </Modal>

      <Modal open={modal === 'stats'} title="Your Stats" onClose={close}>
        <div className="stats-grid">
          <Stat label="Matches Played" value={profile.stats.matchesPlayed} />
          <Stat label="Matches Won" value={profile.stats.matchesWon} />
          <Stat label="Rounds Won" value={profile.stats.roundsWon} />
          <Stat label="Best Streak" value={profile.stats.bestStreak} />
          <Stat label="Level" value={profile.level()} />
          <Stat label="Total XP" value={profile.xp} />
        </div>
      </Modal>

      <Modal open={modal === 'howto'} title="How to Play" onClose={close}>
        <div className="howto">
          <p>
            <b>⚔️ Duels.</b> You and a rival get the same prompt and 60 seconds to draw it. Then you
            vote on the better drawing. Best of three wins the match.
          </p>
          <p>
            <b>✏️ Practice.</b> Draw solo against the clock to warm up and earn XP — no pressure, no
            opponent.
          </p>
          <p>
            <b>🜂 Elemental Showdown.</b> A gesture battle of the elements — summon earth, wind,
            water, fire, or lightning with your hand and outwit your opponent.
          </p>
          <p>
            <b>🖐️ Hand tracking.</b> Pinch to draw, open your hand to hover a tool, make a fist to
            confirm. Everything runs on-device — your camera never leaves the browser.
          </p>
        </div>
      </Modal>

      <Modal open={modal === 'profile'} title="Edit Profile" onClose={close}>
        <div className="editprofile">
          <label className="ep-field">
            <span>Display name</span>
            <input
              className="ep-input"
              defaultValue={profile.name}
              maxLength={18}
              onChange={(e) => profile.setName(e.target.value)}
            />
          </label>
          <Toggle
            label="Sound effects"
            checked={profile.prefs.audio}
            onChange={(v) => profile.setPref('audio', v)}
          />
          <Toggle
            label="Reduced motion"
            checked={profile.prefs.reducedMotion}
            onChange={(v) => profile.setPref('reducedMotion', v)}
          />
          <button className="ep-toggle" onClick={() => setCalOpen(true)}>
            <span>
              🖐️ Calibrate hand tracking
              <span className="ep-cal-status">
                {profile.handCalibrated ? ' · calibrated' : ' · using defaults'}
              </span>
            </span>
            <span className="ep-cal-go">→</span>
          </button>
          <Button variant="primary" onClick={close} className="ep-save">
            Done
          </Button>
        </div>
      </Modal>

      <AnimatePresence>
        {calOpen && <HandCalibration onClose={() => setCalOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-cell">
      <div className="stat-value display">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button className="ep-toggle" onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
      <span>{label}</span>
      <span className={`ep-switch ${checked ? 'is-on' : ''}`}>
        <span className="ep-knob" />
      </span>
    </button>
  );
}
