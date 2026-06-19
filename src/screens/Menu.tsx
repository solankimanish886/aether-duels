import { motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useNet } from '@/state/net';
import { useProfile, xpRequiredForLevel } from '@/state/profile';
import { audio } from '@/lib/audio';
import { MenuModals } from './menu/MenuModals';
import './Menu.css';

type Accent = 'blue' | 'pink' | 'mint';
interface ModeCard {
  key: string;
  title: string;
  desc: string;
  accent: Accent;
  emoji: string;
  action: () => void;
}

export function Menu() {
  const go = useUI((s) => s.go);
  const openModal = useUI((s) => s.openModal);
  const name = useProfile((s) => s.name);
  const xp = useProfile((s) => s.xp);
  const level = useProfile((s) => s.level());

  const floor = xpRequiredForLevel(level);
  const ceil = xpRequiredForLevel(level + 1);
  const xpPct = ceil > floor ? Math.round(((xp - floor) / (ceil - floor)) * 100) : 0;

  const modes: ModeCard[] = [
    {
      key: 'duel',
      title: 'Forge a Duel',
      desc: '1v1 real-time drawing battle',
      accent: 'pink',
      emoji: '⚔️',
      // First-timers see the hand-tracking onboarding; veterans go straight to the lobby.
      // Set the lobby mode explicitly so it never inherits a stale 'elemental'.
      action: () => {
        useNet.getState().set({ mode: 'duel' });
        go(useProfile.getState().duelTutorialDone ? 'lobby' : 'duel-tutorial');
      },
    },
    {
      key: 'elemental',
      title: 'Elemental Showdown',
      desc: 'Learn the gestures, then duel a friend',
      accent: 'mint',
      emoji: '🜂',
      action: () => go('elemental-intro'),
    },
    {
      key: 'element-creator',
      title: 'Element Creator',
      desc: 'Shape a living world with your hands',
      accent: 'mint',
      emoji: '🌍',
      action: () => go('element-creator'),
    },
    {
      key: 'sandbox',
      title: 'Creative Sandbox',
      desc: 'Draw, shape & colour freely',
      accent: 'blue',
      emoji: '🎨',
      // First-timers get the gesture onboarding; veterans go straight in.
      action: () => go(useProfile.getState().sandboxTutorialDone ? 'sandbox' : 'sandbox-tutorial'),
    },
  ];

  return (
    <div className="menu">
      <div className="menu-topbar">
        <button className="glass menu-profile" onClick={() => openModal('profile')}>
          <div className="menu-avatar">{(name || 'A').charAt(0).toUpperCase()}</div>
          <div className="menu-profile-info">
            <div className="menu-profile-name">{name || 'Anonymous'}</div>
            <div className="menu-xpbar">
              <div className="menu-xpbar-fill" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
          <div className="menu-level mono">{level}</div>
        </button>
      </div>

      <motion.h1
        className="display menu-hero"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        Aether <span className="menu-hero-accent">Duels</span>
      </motion.h1>

      <div className="menu-grid">
        {modes.map((mode, i) => (
          <motion.button
            key={mode.key}
            className={`glass menu-card menu-card--${mode.accent}`}
            onClick={() => {
              audio.click();
              mode.action();
            }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07, type: 'spring', stiffness: 260, damping: 24 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="menu-card-emoji">{mode.emoji}</span>
            <span className="menu-card-text">
              <span className="menu-card-title">{mode.title}</span>
              <span className="menu-card-desc">{mode.desc}</span>
            </span>
          </motion.button>
        ))}
      </div>

      <div className="menu-footer">
        <button className="menu-foot-link" onClick={() => openModal('achievements')}>
          Achievements
        </button>
        <button className="menu-foot-link" onClick={() => openModal('stats')}>
          Stats
        </button>
        <button className="menu-foot-link" onClick={() => openModal('leaderboard')}>
          Leaderboard
        </button>
        <button className="menu-foot-link" onClick={() => openModal('howto')}>
          How to Play
        </button>
        <button className="menu-foot-link" onClick={() => openModal('profile')}>
          Edit Profile
        </button>
      </div>

      <MenuModals />
    </div>
  );
}
