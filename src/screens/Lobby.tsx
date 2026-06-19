import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { useNet } from '@/state/net';
import { DuelNet } from '@/game/net/DuelNet';
import { isValidRoomCode } from '@/game/net/roomCode';
import { createBotNet } from '@/game/net/botOpponent';
import { createElementalBotNet } from '@/game/net/elementalBot';
import { Button } from '@/components/Button';
import { audio } from '@/lib/audio';
import { useToasts } from '@/components/Toast';
import './Lobby.css';

type View = 'choose' | 'host' | 'join' | 'lobby';

export function Lobby() {
  const go = useUI((s) => s.go);
  const profile = useProfile();
  const toast = useToasts((s) => s.push);
  const ns = useNet();
  const [view, setView] = useState<View>('choose');
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const wired = useRef(false);
  const autoJoined = useRef(false);

  const isElem = ns.mode === 'elemental';
  const myInfo = { name: profile.name || 'You', level: profile.level() };

  // Wire the common lobby handlers onto a freshly created net.
  const wire = (net: DuelNet) => {
    wired.current = true;
    useNet.getState().set({ net });
    net.onOpen(() => net.send('hello', myInfo));
    net.on('hello', (info) => {
      useNet.getState().set({ opponent: info, status: 'lobby' });
      setView('lobby');
    });
    net.on('ready', (d) => useNet.getState().set({ oppReady: d.ready }));
    net.onClose(() => {
      useNet.getState().set({ status: 'disconnected' });
      toast('Opponent disconnected');
    });
  };

  const startHost = async () => {
    setBusy(true);
    setView('host');
    const net = new DuelNet();
    wire(net);
    useNet.getState().set({ status: 'hosting' });
    try {
      const code = await net.host();
      useNet.getState().set({ code });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not reach the signaling server');
      setView('choose');
      useNet.getState().teardown();
      wired.current = false;
    } finally {
      setBusy(false);
    }
  };

  const startJoinWith = async (raw: string) => {
    const code = raw.trim();
    if (!isValidRoomCode(code)) {
      toast('Enter a 6-digit code');
      return;
    }
    setBusy(true);
    const net = new DuelNet();
    wire(net);
    useNet.getState().set({ status: 'joining', code });
    try {
      await net.join(code);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join');
      useNet.getState().teardown();
      wired.current = false;
      setBusy(false);
    }
  };

  const startJoin = () => startJoinWith(codeInput);

  const startBot = () => {
    const level = Math.max(2, profile.level());
    const net = isElem ? createElementalBotNet(level) : createBotNet(level);
    wire(net);
    useNet.getState().set({ status: 'lobby', isBot: true });
  };

  const ready = () => {
    audio.click();
    useNet.getState().net?.send('ready', { ready: true });
    useNet.getState().set({ myReady: true });
  };

  const leave = () => {
    useNet.getState().teardown();
    go(isElem ? 'elemental-intro' : 'menu');
  };

  // Auto-join from an invite link (?room=CODE → pendingJoin in the net store).
  useEffect(() => {
    if (autoJoined.current) return;
    const code = useNet.getState().pendingJoin;
    if (code) {
      autoJoined.current = true;
      useNet.getState().set({ pendingJoin: '' });
      setCodeInput(code);
      setView('join');
      void startJoinWith(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Both ready → enter the match for the chosen mode.
  useEffect(() => {
    if (ns.myReady && ns.oppReady && ns.status === 'lobby') {
      useNet.getState().set({ status: 'in-match' });
      go(ns.mode === 'elemental' ? 'elemental' : 'duel');
    }
  }, [ns.myReady, ns.oppReady, ns.status, ns.mode, go]);

  return (
    <div className="lobby">
      <button className="lobby-back" onClick={leave}>
        ← Menu
      </button>

      {view === 'choose' && (
        <motion.div className="lobby-choose" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="display lobby-title">{isElem ? 'Elemental Showdown' : 'Forge a Duel'}</h1>
          <p className="lobby-sub">
            {isElem
              ? 'Battle a friend with elemental gestures, or warm up against the CPU.'
              : 'Battle a friend in real time, or warm up against the CPU.'}
          </p>
          <div className="lobby-options">
            <Button variant="accent" size="lg" onClick={startHost} disabled={busy}>
              {isElem ? '🜂 Host a Match' : '⚔️ Host a Duel'}
            </Button>
            <Button variant="primary" size="lg" onClick={() => setView('join')} disabled={busy}>
              🔑 Join with a Code
            </Button>
            <Button variant="glass" size="lg" onClick={startBot} disabled={busy}>
              🤖 Quick Duel (vs CPU)
            </Button>
          </div>
          {!isElem && (
            <button className="lobby-help" onClick={() => useUI.getState().go('duel-tutorial')}>
              New here? How to play ›
            </button>
          )}
        </motion.div>
      )}

      {view === 'host' && (
        <motion.div className="lobby-panel glass-strong" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <h2 className="display lobby-title">Awaiting a Challenger</h2>
          <p className="lobby-sub">Share this code with your opponent.</p>
          <div className="lobby-code mono">{ns.code || '······'}</div>
          <div className="lobby-code-actions">
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(ns.code).catch(() => {});
                toast('Code copied');
              }}
              disabled={!ns.code}
            >
              Copy code
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const link = `${location.origin}${location.pathname}?room=${ns.code}&mode=${ns.mode}`;
                navigator.clipboard?.writeText(link).catch(() => {});
                toast('Invite link copied');
              }}
              disabled={!ns.code}
            >
              Copy invite link
            </Button>
          </div>
          <p className="lobby-waiting">
            <span className="lobby-dot" /> Waiting for opponent…
          </p>
        </motion.div>
      )}

      {view === 'join' && (
        <motion.div className="lobby-panel glass-strong" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <h2 className="display lobby-title">Have a Code?</h2>
          <input
            className="lobby-input mono"
            value={codeInput}
            placeholder="Enter 6-digit code"
            inputMode="numeric"
            pattern="\d*"
            maxLength={6}
            aria-label="6-digit room code"
            onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && startJoin()}
            autoFocus
          />
          <Button variant="primary" size="lg" onClick={startJoin} disabled={busy || !isValidRoomCode(codeInput)}>
            {busy ? 'Connecting…' : 'Enter the Arena'}
          </Button>
        </motion.div>
      )}

      {view === 'lobby' && (
        <motion.div className="lobby-vs" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="display lobby-title">Both fighters present</h2>
          <div className="lobby-vs-row">
            <Fighter name={myInfo.name} level={myInfo.level} ready={ns.myReady} side="you" />
            <span className="lobby-vs-divider display">vs</span>
            <Fighter
              name={ns.opponent?.name ?? 'Rival'}
              level={ns.opponent?.level ?? 1}
              ready={ns.oppReady}
              side="opp"
            />
          </div>
          <Button variant="primary" size="lg" onClick={ready} disabled={ns.myReady}>
            {ns.myReady ? 'Waiting for opponent…' : "I'm Ready"}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

function Fighter({
  name,
  level,
  ready,
  side,
}: {
  name: string;
  level: number;
  ready: boolean;
  side: 'you' | 'opp';
}) {
  return (
    <div className="lobby-fighter">
      <div className={`lobby-avatar lobby-avatar--${side}`}>{name.charAt(0).toUpperCase()}</div>
      <div className="lobby-fighter-name">{name}</div>
      <div className="lobby-fighter-lvl mono">LV {level}</div>
      <div className={`lobby-ready ${ready ? 'is-ready' : ''}`}>{ready ? 'Ready' : 'Not ready'}</div>
    </div>
  );
}
