import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { useNet } from '@/state/net';
import {
  BEST_OF,
  CHARGE_SECS,
  ELEMENT_LIST,
  ELEMENTS,
  WIN_THRESHOLD,
  gestureToElement,
  randomElement,
  resolveRound,
  type ElementKey,
  type Outcome,
} from '@/game/elemental';
import { HandTracker } from '@/game/hand/HandTracker';
import { GestureStatus } from '@/game/hand/GestureStatus';
import { CameraPip } from '@/game/hand/CameraPip';
import type { Gesture } from '@/game/hand/gestures';
import { Button } from '@/components/Button';
import { RoundResultPopup } from './elemental/RoundResultPopup';
import { audio } from '@/lib/audio';
import './Elemental.css';

type Phase = 'intro' | 'charging' | 'reveal' | 'over';

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;
const ORB_R = 58;
const ORB_C = 2 * Math.PI * ORB_R;
const BURST_N = 10;

/** Outcome of a networked round where either pick may be missing (timed out). */
function netOutcome(my: ElementKey | null, opp: ElementKey | null): Outcome {
  if (!my && !opp) return 'tie';
  if (!my) return 'lose';
  if (!opp) return 'win';
  return resolveRound(my, opp);
}

export function Elemental() {
  const go = useUI((s) => s.go);
  const profile = useProfile();
  const ns = useNet();

  // Networked "Friends Mode" vs solo-vs-CPU. Constant for the component's life.
  const net = ns.net;
  const isNet = ns.mode === 'elemental' && !!net && ns.status === 'in-match';
  const isHost = net?.role === 'host';
  const oppName = isNet ? ns.opponent?.name ?? 'Rival' : 'Rival';
  const myName = profile.name || 'You';

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(1);
  const [youWins, setYouWins] = useState(0);
  const [oppWins, setOppWins] = useState(0);
  const [charge, setCharge] = useState(CHARGE_SECS);
  const [youPick, setYouPick] = useState<ElementKey | null>(null);
  const [cpuPick, setCpuPick] = useState<ElementKey | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [reward, setReward] = useState<{ won: boolean; tie: boolean; xp: number } | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [history, setHistory] = useState<Outcome[]>([]);
  const [burst, setBurst] = useState<string | null>(null);
  // Gated round-result popup: shown after the clash settles; the next round is
  // gated on the player(s) pressing "Ready" rather than a timer.
  const [showResult, setShowResult] = useState(false);
  const [waitingReady, setWaitingReady] = useState(false);

  // Gesture-recognition status (surfaced via the GestureStatus badge).
  const [handReady, setHandReady] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [gesture, setGesture] = useState<Gesture>('none');
  const [gestureProgress, setGestureProgress] = useState(0);
  const [delegate, setDelegate] = useState<'GPU' | 'CPU' | null>(null);
  const [fallbackHint, setFallbackHint] = useState<string | null>(null);

  // Refs read inside timers / tracker & net callbacks (avoid stale closures).
  const phaseRef = useRef<Phase>('intro');
  const lockedRef = useRef<ElementKey | null>(null);
  const winsRef = useRef({ you: 0, opp: 0 });
  const roundRef = useRef(1);
  const chargeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const startedRef = useRef(false);
  // Net handshake refs.
  const isNetRef = useRef(isNet);
  const netRef = useRef(net);
  const oppPickRef = useRef<ElementKey | null>(null);
  const oppLockedRef = useRef(false);
  const oppRevealedRef = useRef(false);
  const sentRevealRef = useRef(false);
  const resolvedRef = useRef(false);
  // Both-ready handshake for advancing past the round-result popup.
  const myReadyRef = useRef(false);
  const oppReadyRef = useRef(false);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const stopChargeTimer = () => {
    if (chargeTimer.current) clearInterval(chargeTimer.current);
    chargeTimer.current = null;
  };

  // Shared scoring / flash / audio for a resolved round.
  const applyOutcome = (result: Outcome, my: ElementKey | null) => {
    audio.clash();
    if (result === 'win') {
      winsRef.current.you++;
      setYouWins(winsRef.current.you);
      setFlash('✨');
      audio.roundWon();
    } else if (result === 'lose') {
      winsRef.current.opp++;
      setOppWins(winsRef.current.opp);
      setFlash(my ? '💥' : '⌛');
      audio.roundLost();
    } else {
      setFlash('🌀');
      audio.click();
    }
    setHistory((h) => [...h, result]);
    setOutcome(result);
    setPhaseBoth('reveal');
    setTimeout(() => setFlash(null), 700);
    // Let the clash + flash play out first, then slide the result popup in so the
    // two are never on screen at once.
    setTimeout(() => setShowResult(true), 900);
  };

  const finishMatch = useCallback(() => {
    const { you, opp } = winsRef.current;
    const won = you > opp;
    const tie = you === opp;
    const xp = won ? 20 : tie ? 10 : 5;
    profile.addXP(xp);
    if (won) profile.unlock('elementalist');
    if (won) audio.matchWon();
    else if (!tie) audio.matchLost();
    setReward({ won, tie, xp });
    setPhaseBoth('over');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── solo (vs CPU) reveal ──
  const reveal = useCallback(() => {
    const my = lockedRef.current;
    const cpu = randomElement();
    setCpuPick(cpu);
    const result = my ? resolveRound(my, cpu) : 'lose';
    applyOutcome(result, my);
    // Advancement is gated on the result popup's "Ready" button (see onReady).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishMatch]);

  // ── networked resolve (both picks in hand) ──
  const tryResolve = useCallback(() => {
    if (!sentRevealRef.current || !oppRevealedRef.current || resolvedRef.current) return;
    resolvedRef.current = true;
    stopChargeTimer();
    const my = lockedRef.current;
    const opp = oppPickRef.current;
    setCpuPick(opp);
    applyOutcome(netOutcome(my, opp), my);
    // Advancement is gated on both players pressing "Ready" (see onReady).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishMatch, isHost]);

  const netRevealSend = useCallback(() => {
    if (sentRevealRef.current) return;
    sentRevealRef.current = true;
    stopChargeTimer();
    netRef.current!.send('elemReveal', { index: roundRef.current, pick: lockedRef.current });
    tryResolve();
  }, [tryResolve]);

  const netMaybeReveal = useCallback(() => {
    if (lockedRef.current && oppLockedRef.current) netRevealSend();
  }, [netRevealSend]);

  const lock = useCallback(
    (key: ElementKey) => {
      if (phaseRef.current !== 'charging' || lockedRef.current) return;
      lockedRef.current = key;
      setYouPick(key);
      // Summon payoff: burst + zap + a haptic tick.
      setBurst(ELEMENTS[key].color);
      audio.summon();
      navigator.vibrate?.(30);
      setTimeout(() => setBurst(null), 600);
      if (isNetRef.current) {
        netRef.current!.send('elemLock', { index: roundRef.current });
        netMaybeReveal();
      }
    },
    [netMaybeReveal],
  );

  const startRound = useCallback(() => {
    lockedRef.current = null;
    oppPickRef.current = null;
    oppLockedRef.current = false;
    oppRevealedRef.current = false;
    sentRevealRef.current = false;
    resolvedRef.current = false;
    myReadyRef.current = false;
    oppReadyRef.current = false;
    setShowResult(false);
    setWaitingReady(false);
    setYouPick(null);
    setCpuPick(null);
    setOutcome(null);
    setPhaseBoth('charging');
    setCharge(CHARGE_SECS);
    let remain = CHARGE_SECS;
    stopChargeTimer();
    chargeTimer.current = setInterval(() => {
      remain--;
      setCharge(remain);
      if (remain <= 0) {
        stopChargeTimer();
        if (isNetRef.current) netRevealSend();
        else reveal();
      }
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, netRevealSend]);

  // True when the just-resolved round decides the match.
  const matchDecided = () => {
    const { you: yw, opp: ow } = winsRef.current;
    return yw >= WIN_THRESHOLD || ow >= WIN_THRESHOLD || roundRef.current >= BEST_OF;
  };

  // Close the popup and either end the match or start the next round.
  const advanceRound = useCallback(() => {
    setShowResult(false);
    if (matchDecided()) {
      finishMatch();
      return;
    }
    roundRef.current++;
    setRound(roundRef.current);
    if (isNetRef.current) netRef.current!.send('elemRoundStart', { index: roundRef.current });
    startRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishMatch]);

  // Networked: advance once both players are ready (host drives the round start).
  const maybeAdvanceNet = useCallback(() => {
    if (!myReadyRef.current || !oppReadyRef.current) return;
    if (isHost) advanceRound();
    // guest waits for the host's elemRoundStart
  }, [advanceRound, isHost]);

  // "Ready for Next Round" / "See Final Results" button handler.
  const onReady = useCallback(() => {
    // Solo, or the deciding round in any mode → advance/finish immediately.
    if (!isNetRef.current || matchDecided()) {
      advanceRound();
      return;
    }
    // Networked non-deciding round → both-ready handshake.
    myReadyRef.current = true;
    setWaitingReady(true);
    netRef.current!.send('elemReady', { index: roundRef.current });
    maybeAdvanceNet();
  }, [advanceRound, maybeAdvanceNet]);

  // Solo: leave the VS intro and begin the first round (hand raised or Start tapped).
  const beginFirstRound = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setHistory([]);
    startRound();
  }, [startRound]);

  const startNetMatch = useCallback(() => {
    winsRef.current = { you: 0, opp: 0 };
    roundRef.current = 1;
    setYouWins(0);
    setOppWins(0);
    setRound(1);
    setReward(null);
    setHistory([]);
    netRef.current!.send('elemMatchStart', { bestOf: BEST_OF, winThreshold: WIN_THRESHOLD });
    netRef.current!.send('elemRoundStart', { index: 1 });
    startRound();
  }, [startRound]);

  // ── mount: hand tracking + (solo) wait on intro gate / (net) wire handlers ──
  useEffect(() => {
    isNetRef.current = isNet;
    netRef.current = net;

    const TAP_HINT = 'Hand tracking unavailable — tap an element to summon.';
    const ERROR_HINT: Record<string, string> = {
      'camera-denied': 'Camera blocked — tap an element to summon.',
      'worker-failed': TAP_HINT,
    };
    const watchdog = setTimeout(() => {
      setHandReady((ready) => {
        if (!ready) setFallbackHint(TAP_HINT);
        return ready;
      });
    }, 9000);

    const tracker = new HandTracker({
      onStream: setStream,
      onReady: (d) => {
        setHandReady(true);
        setDelegate(d);
        setFallbackHint(null);
      },
      onStatus: (kind) => {
        setHandDetected(kind !== 'searching' && kind !== 'loading');
      },
      onError: (msg) => {
        console.warn('[Elemental] hand tracking error:', msg);
        setFallbackHint(ERROR_HINT[msg] ?? TAP_HINT);
      },
      onGesture: (g) => {
        setGesture(g);
        setHandDetected(g !== 'none');
        const el = gestureToElement(g);
        if (el) lock(el);
      },
      onGestureProgress: (_pending, frames, needed) =>
        setGestureProgress(needed ? frames / needed : 0),
    });
    trackerRef.current = tracker;
    const testMode = new URLSearchParams(location.search).has('handtest');
    if (testMode) (window as unknown as { __elemTracker: HandTracker }).__elemTracker = tracker;
    tracker.enable({ testMode }).catch(() => {});

    if (isNet && net) {
      net.on('elemMatchStart', () => {
        winsRef.current = { you: 0, opp: 0 };
        setYouWins(0);
        setOppWins(0);
        setReward(null);
        setHistory([]);
      });
      net.on('elemRoundStart', (d) => {
        roundRef.current = d.index;
        setRound(d.index);
        startRound();
      });
      net.on('elemLock', () => {
        oppLockedRef.current = true;
        netMaybeReveal();
      });
      net.on('elemReveal', (d) => {
        oppPickRef.current = d.pick;
        oppRevealedRef.current = true;
        tryResolve();
      });
      net.on('elemReady', () => {
        oppReadyRef.current = true;
        maybeAdvanceNet();
      });
      net.on('elemRematchReq', () => {
        if (isHost) startNetMatch();
      });
      net.on('elemRematchOk', () => {});
      net.onClose(() => {
        stopChargeTimer();
        setDisconnected(true);
      });
      // Host opens with a brief VS splash, then drives the match.
      if (isHost) setTimeout(startNetMatch, 1600);
      // guest stays on the VS intro until the host's elemRoundStart arrives.
    }
    // Solo: stay on the VS intro until the player raises a hand or taps Start.

    return () => {
      clearTimeout(watchdog);
      tracker.disable();
      stopChargeTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo intro gate: auto-begin once a hand is detected.
  useEffect(() => {
    if (!isNet && phase === 'intro' && handDetected) beginFirstRound();
  }, [isNet, phase, handDetected, beginFirstRound]);

  const restart = () => {
    if (isNet) {
      if (isHost) startNetMatch();
      else netRef.current!.send('elemRematchReq', {});
      return;
    }
    winsRef.current = { you: 0, opp: 0 };
    roundRef.current = 1;
    setYouWins(0);
    setOppWins(0);
    setRound(1);
    setReward(null);
    setHistory([]);
    startRound();
  };

  const quit = () => {
    if (isNet) useNet.getState().teardown();
    go(isNet ? 'menu' : 'elemental-intro');
  };

  const youDef = youPick ? ELEMENTS[youPick] : null;
  const cpuDef = cpuPick ? ELEMENTS[cpuPick] : null;
  const chargeFrac = Math.max(0, Math.min(1, charge / CHARGE_SECS));

  const rivalThinking = phase === 'charging' && (!isNet || !cpuPick) && !outcome;
  const matchPoint = youWins >= WIN_THRESHOLD || oppWins >= WIN_THRESHOLD || round >= BEST_OF;

  return (
    <div className="elem">
      <button className="elem-quit" onClick={quit} aria-label="Quit">
        ✕
      </button>

      {phase === 'intro' ? (
        /* ── VS / ready gate ───────────────────────────────── */
        <motion.div
          className="elem-intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="elem-intro-round mono">Round 1 · First to {WIN_THRESHOLD}</div>
          <div className="elem-vsrow">
            <motion.div
              className="elem-fighter elem-fighter--you"
              initial={{ x: -60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            >
              <div className="elem-fighter-avatar">{myName.charAt(0).toUpperCase()}</div>
              <div className="elem-fighter-name">{myName}</div>
            </motion.div>
            <motion.div
              className="elem-vsbadge display"
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: [0, -6, 6, 0] }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 14 }}
            >
              VS
            </motion.div>
            <motion.div
              className="elem-fighter elem-fighter--opp"
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            >
              <div className="elem-fighter-avatar elem-fighter-avatar--opp">
                {oppName.charAt(0).toUpperCase()}
              </div>
              <div className="elem-fighter-name">{oppName}</div>
            </motion.div>
          </div>

          <p className="elem-intro-objective">
            Make a gesture to <b>summon</b> an element — beat your rival’s. First to {WIN_THRESHOLD} wins.
          </p>

          <div className="elem-intro-ready">
            <span className={`elem-ready-dot ${handReady ? 'ok' : 'idle'}`} />
            {fallbackHint
              ? fallbackHint
              : handReady
                ? isNet
                  ? 'Get ready…'
                  : 'Camera ready ✓ — raise your hand to begin'
                : 'Starting camera…'}
          </div>

          {!isNet && (
            <Button variant="primary" onClick={beginFirstRound}>
              Start Duel →
            </Button>
          )}
        </motion.div>
      ) : phase !== 'over' ? (
        <>
          {/* ── top bar: HP + round + history ── */}
          <div className="elem-topbar">
            <HpBar name={myName} total={WIN_THRESHOLD} lost={oppWins} side="you" />
            <div className="elem-topcenter">
              <div className="elem-round mono">
                Round {round}
                {isNet && ' · Friends'}
              </div>
              <div className="elem-history" aria-hidden>
                {history.map((o, i) => (
                  <span key={i} className={`elem-hist is-${o}`} />
                ))}
              </div>
            </div>
            <HpBar name={oppName} total={WIN_THRESHOLD} lost={youWins} side="opp" />
          </div>

          <div className="elem-arena">
            {/* YOU */}
            <div className="elem-side">
              <div className="elem-orb-wrap">
                {phase === 'charging' && !youPick && handDetected && gestureProgress > 0 && (
                  <svg className="elem-orb-lockring" viewBox="0 0 120 120" aria-hidden>
                    <circle className="elem-orb-lockring-bg" cx="60" cy="60" r={ORB_R} />
                    <circle
                      className="elem-orb-lockring-fg"
                      cx="60"
                      cy="60"
                      r={ORB_R}
                      style={{ strokeDasharray: ORB_C, strokeDashoffset: ORB_C * (1 - gestureProgress) }}
                    />
                  </svg>
                )}
                <motion.div
                  className={`elem-orb elem-orb--you ${outcome ? `is-${outcome}` : youPick ? 'is-locked' : ''}`}
                  animate={
                    phase === 'reveal'
                      ? { x: [0, 34, 12], scale: outcome === 'win' ? 1.08 : 1 }
                      : youPick && phase === 'charging'
                        ? { scale: [1, 1.06, 1], x: 0 }
                        : { scale: 1, x: 0 }
                  }
                  transition={{
                    repeat: youPick && phase === 'charging' ? Infinity : 0,
                    duration: phase === 'reveal' ? 0.45 : 1,
                  }}
                  style={youDef ? ({ ['--elem-color' as string]: youDef.color } as object) : undefined}
                >
                  {youDef ? youDef.emoji : '✋'}
                </motion.div>
                <AnimatePresence>
                  {burst && (
                    <div className="elem-summon-burst" style={{ ['--burst' as string]: burst } as object}>
                      {Array.from({ length: BURST_N }).map((_, i) => (
                        <span
                          key={i}
                          className="elem-spark"
                          style={{ ['--a' as string]: `${(360 / BURST_N) * i}deg` } as object}
                        />
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>
              <div className="elem-name">{youDef ? youDef.label : myName}</div>
            </div>

            {/* center: charge ring / VS */}
            <div className="elem-center">
              {phase === 'charging' ? (
                <div className="elem-charge">
                  <svg className="elem-charge-ring" viewBox="0 0 120 120" aria-hidden>
                    <circle className="elem-charge-ring-bg" cx="60" cy="60" r={RING_R} />
                    <circle
                      className="elem-charge-ring-fg"
                      cx="60"
                      cy="60"
                      r={RING_R}
                      style={{ strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - chargeFrac) }}
                    />
                  </svg>
                  <div className="elem-charge-num display">{charge}</div>
                  <div className="elem-charge-label">summon!</div>
                </div>
              ) : (
                <div className="elem-vs display">vs</div>
              )}
            </div>

            {/* RIVAL */}
            <div className="elem-side">
              <div className="elem-orb-wrap">
                <motion.div
                  className={`elem-orb elem-orb--opp ${rivalThinking ? 'is-thinking' : ''} ${
                    outcome === 'win' ? 'is-lose' : outcome === 'lose' ? 'is-win' : outcome ? 'is-tie' : ''
                  }`}
                  animate={
                    phase === 'reveal'
                      ? { x: [0, -34, -12], scale: outcome === 'lose' ? 1.08 : 1 }
                      : { x: 0, scale: 1 }
                  }
                  transition={{ duration: phase === 'reveal' ? 0.45 : 0.3 }}
                  style={cpuDef ? ({ ['--elem-color' as string]: cpuDef.color } as object) : undefined}
                >
                  {cpuDef ? cpuDef.emoji : '❓'}
                </motion.div>
              </div>
              <div className="elem-name">
                {cpuDef ? cpuDef.label : oppName}
                {rivalThinking && <span className="elem-thinking"> · summoning…</span>}
              </div>
            </div>
          </div>

          <div className="elem-status">
            {phase === 'charging' &&
              (youPick
                ? isNet && !cpuPick
                  ? `${youDef?.label} locked — waiting for ${oppName}…`
                  : `${youDef?.label} charging…`
                : 'Summon an element to beat your rival!')}
          </div>

          {/* element chips — gesture or tap */}
          <div className="elem-chips">
            {ELEMENT_LIST.map((el) => (
              <button
                key={el.key}
                className={`elem-chip ${youPick === el.key ? 'is-picked' : ''}`}
                disabled={phase !== 'charging' || !!youPick}
                onClick={() => lock(el.key)}
                style={{ ['--elem-color' as string]: el.color } as object}
              >
                <span className="elem-chip-emoji">{el.emoji}</span>
                <span className="elem-chip-label">{el.label}</span>
                <span className="elem-chip-gesture">{el.gestureHint}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        reward && (
          <motion.div
            className="elem-result"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 20 }}
          >
            <motion.div
              className="elem-result-emoji"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 12 }}
            >
              {reward.won ? '🏆' : reward.tie ? '🤝' : '💀'}
            </motion.div>
            <h1 className="display elem-result-title">
              {reward.won ? 'Elemental Mastery!' : reward.tie ? 'Evenly Matched' : 'Overpowered'}
            </h1>
            <p className="elem-result-sub">
              {myName} {youWins} · {oppName} {oppWins}
            </p>
            <div className="elem-history elem-history--result" aria-hidden>
              {history.map((o, i) => (
                <span key={i} className={`elem-hist is-${o}`} />
              ))}
            </div>
            <div className="elem-result-xp">✨ +{reward.xp} XP</div>
            <div className="elem-result-actions">
              <Button variant="ghost" onClick={quit}>
                Menu
              </Button>
              <Button variant="primary" onClick={restart}>
                {isNet && !isHost ? 'Request Rematch' : 'Rematch'}
              </Button>
            </div>
          </motion.div>
        )
      )}

      <GestureStatus
        ready={handReady}
        detected={handDetected}
        gesture={gesture}
        progress={gestureProgress}
        delegate={delegate}
        fallback={fallbackHint}
      />
      <CameraPip stream={stream} />

      <RoundResultPopup
        open={showResult && phase === 'reveal'}
        outcome={outcome ?? 'tie'}
        youPick={youPick}
        oppPick={cpuPick}
        youName={myName}
        oppName={oppName}
        youWins={youWins}
        oppWins={oppWins}
        history={history}
        deciding={matchPoint}
        waiting={waitingReady}
        onReady={onReady}
      />

      <AnimatePresence>
        {flash && (
          <motion.div
            className="elem-flash"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.2 }}
            exit={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 0.5 }}
          >
            {flash}
          </motion.div>
        )}
      </AnimatePresence>

      {disconnected && (
        <div className="elem-disconnect">
          <div className="elem-disconnect-card glass-strong">
            <h2 className="display">Opponent left</h2>
            <p>The connection was lost.</p>
            <Button variant="primary" onClick={quit}>
              Back to Menu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A segmented life bar — full segments = rounds not yet lost. */
function HpBar({ name, total, lost, side }: { name: string; total: number; lost: number; side: 'you' | 'opp' }) {
  const remaining = Math.max(0, total - lost);
  return (
    <div className={`elem-hpbar elem-hpbar--${side}`}>
      <div className="elem-hpbar-name mono">{name}</div>
      <div className="elem-hpbar-track">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`elem-hpseg ${i < remaining ? 'is-full' : 'is-lost'} ${i === remaining ? 'just-lost' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
