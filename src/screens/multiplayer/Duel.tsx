import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { useNet } from '@/state/net';
import { DrawingCanvas } from '@/game/drawing/DrawingCanvas';
import { DrawingEngine } from '@/game/drawing/DrawingEngine';
import { DEFAULT_COLOR, DEFAULT_SIZE } from '@/game/drawing/palette';
import type { Tool } from '@/game/drawing/types';
import { Toolbar, type ToolbarState } from '@/components/Toolbar';
import { Button } from '@/components/Button';
import { GestureRadialMenu } from '@/components/GestureRadialMenu';
import { GestureGuide } from '@/components/GestureGuide';
import { useDuelGestures, type HoldState } from './useDuelGestures';
import type { Gesture } from '@/game/hand/gestures';
import type { CursorState } from '@/game/hand/HandTracker';
import { useHandTracking } from '@/game/hand/useHandTracking';
import { HandCursor } from '@/game/hand/HandCursor';
import { CameraPip } from '@/game/hand/CameraPip';
import { useToasts } from '@/components/Toast';
import { Countdown } from '@/screens/match/Countdown';
import { pickPrompts } from '@/game/prompts';
import { BEST_OF, ROUNDS_TO_WIN, resolveVotes } from '@/game/net/protocol';
import type { CountdownValue } from '@/state/match';
import { ROUND_SECONDS, COUNTDOWN_STEP_MS } from '@/state/match';
import { audio } from '@/lib/audio';
import { requestJudge } from '@/lib/aiJudge';
import type { JudgeVerdict } from '@/lib/judgeTypes';
import './Duel.css';

type Phase = 'countdown' | 'drawing' | 'reveal' | 'result';
const CD_SEQ: CountdownValue[] = [3, 2, 1, 'GO'];

export function Duel() {
  const go = useUI((s) => s.go);
  const profile = useProfile();
  const ns = useNet();
  const net = ns.net!;

  const engineRef = useRef<DrawingEngine | null>(null);
  const cursorRef = useRef({ x: 0, y: 0 });
  const handGestureRef = useRef<(g: Gesture) => void>(() => {});
  const autoHandTried = useRef(false);

  const [phase, setPhase] = useState<Phase>('countdown');
  const [cd, setCd] = useState<CountdownValue | null>(3);
  const [roundIndex, setRoundIndex] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [reveal, setReveal] = useState<{ me: string; opp: string } | null>(null);
  const [outcome, setOutcome] = useState<'me' | 'opp' | 'tie' | null>(null);
  const [verdict, setVerdict] = useState<JudgeVerdict | null>(null);
  const [myVoted, setMyVoted] = useState(false);
  const [tb, setTb] = useState<ToolbarState>({ color: DEFAULT_COLOR, size: DEFAULT_SIZE, tool: 'brush', canUndo: false, canRedo: false });
  const [disconnected, setDisconnected] = useState(false);
  const [matchResult, setMatchResult] = useState<'win' | 'lose' | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Refs read inside net handlers / timers (avoid stale closures).
  const prompts = useRef<string[]>([]);
  const idx = useRef(0);
  const scores = useRef({ me: 0, opp: 0 });
  const myReveal = useRef('');
  const oppReveal = useRef('');
  const myVote = useRef<'self' | 'opp' | null>(null);
  const oppVote = useRef<'self' | 'opp' | null>(null);
  const revealedSelf = useRef(false);
  const resolved = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHost = net.role === 'host';
  const toast = useToasts((s) => s.push);

  const e = () => engineRef.current;

  // ── optional hand-drawing (same integration as Practice) ──
  const hand = useHandTracking({
    getEngine: () => engineRef.current,
    getSurfaceRect: () => document.querySelector('.draw-surface')?.getBoundingClientRect() ?? null,
    calibration: profile.handCalibration,
    onGesture: (g) => handGestureRef.current(g),
  });
  cursorRef.current = { x: hand.cursor.x, y: hand.cursor.y };
  const toggleHand = async () => {
    audio.click();
    if (hand.enabled) {
      hand.stop();
      return;
    }
    const ok = await hand.start();
    if (ok) toast('Pinch to draw · 2/3/4 fingers = colour, size, tools');
  };
  useEffect(() => {
    if (hand.error === 'camera-denied') toast('Camera blocked — drawing with mouse instead');
    else if (hand.error) toast('Hand tracking unavailable — use mouse or touch');
  }, [hand.error, toast]);

  // Auto-enable hand tracking once the drawing phase opens (Forge a Duel is
  // gesture-native); silently fall back to the mouse toolbar if the camera is denied.
  useEffect(() => {
    if (phase !== 'drawing' || hand.enabled || autoHandTried.current || hand.error) return;
    autoHandTried.current = true;
    void hand.start().then((ok) => {
      if (ok) toast('Pinch to draw · 2/3/4 fingers = colour, size, tools');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hand.enabled, hand.error]);

  // ── gesture → drawing-control mapping (menus + undo/redo/clear/done) ──
  const gestures = useDuelGestures({
    getCursor: () => cursorRef.current,
    enabled: hand.enabled && phase === 'drawing',
    onUndo: () => e()?.undo(),
    onRedo: () => e()?.redo(),
    onClear: () => e()?.clear(),
    onDone: () => finishDrawing(),
  });
  handGestureRef.current = gestures.handleGesture;

  // ── round lifecycle ──
  const beginRound = useCallback((index: number, word: string) => {
    idx.current = index;
    myReveal.current = '';
    oppReveal.current = '';
    myVote.current = null;
    oppVote.current = null;
    revealedSelf.current = false;
    resolved.current = false;
    setRoundIndex(index);
    setPrompt(word);
    setReveal(null);
    setOutcome(null);
    setVerdict(null);
    setMyVoted(false);
    setPhase('countdown');
    setCd(CD_SEQ[0]);
    audio.countdownTick();
    e()?.reset();
    if (e()) e()!.inputEnabled = false;

    let i = 0;
    const cdId = setInterval(() => {
      i++;
      if (i < CD_SEQ.length) {
        setCd(CD_SEQ[i]);
        if (CD_SEQ[i] === 'GO') audio.countdownGo();
        else audio.countdownTick();
      } else {
        clearInterval(cdId);
        setCd(null);
        if (e()) e()!.inputEnabled = true;
        setPhase('drawing');
        setSecondsLeft(ROUND_SECONDS);
        startTimer();
      }
    }, COUNTDOWN_STEP_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    let s = ROUND_SECONDS;
    timer.current = setInterval(() => {
      s--;
      setSecondsLeft(s);
      if (s <= 0) {
        clearInterval(timer.current!);
        finishDrawing();
      }
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishDrawing = useCallback(() => {
    if (revealedSelf.current) return;
    revealedSelf.current = true;
    if (timer.current) clearInterval(timer.current);
    if (e()) e()!.inputEnabled = false;
    const dataUrl = e() ? e()!.toDataURL(720) : '';
    myReveal.current = dataUrl;
    net.send('revealDraw', { index: idx.current, dataUrl });
    checkBothRevealed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net]);

  const checkBothRevealed = useCallback(() => {
    if (!myReveal.current || !oppReveal.current) return;
    setReveal({ me: myReveal.current, opp: oppReveal.current });
    setPhase('reveal');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const castVote = (choice: 'self' | 'opp') => {
    if (myVote.current) return;
    audio.click();
    myVote.current = choice;
    setMyVoted(true);
    net.send('vote', { index: idx.current, choice });
    checkBothVoted();
  };

  const checkBothVoted = useCallback(() => {
    if (!myVote.current || !oppVote.current || resolved.current) return;
    resolved.current = true;
    void resolveRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveRound = useCallback(async () => {
    let result = resolveVotes(myVote.current!, oppVote.current!);
    // Tie → AI judge breaks it (images ordered [me, opp]).
    if (result === 'tie') {
      const v = await requestJudge({
        mode: 'duel',
        prompt: prompts.current[idx.current] ?? prompt,
        images: [
          { label: 'You', dataUrl: myReveal.current },
          { label: ns.opponent?.name ?? 'Rival', dataUrl: oppReveal.current },
        ],
      });
      setVerdict(v);
      result = v.winner === 0 ? 'me' : v.winner === 1 ? 'opp' : 'tie';
    }
    if (result === 'me') {
      scores.current.me++;
      setMyScore(scores.current.me);
      audio.roundWon();
    } else if (result === 'opp') {
      scores.current.opp++;
      setOppScore(scores.current.opp);
      audio.roundLost();
    }
    setOutcome(result);

    // Advance after a beat (host drives the next round).
    setTimeout(() => {
      const done =
        scores.current.me >= ROUNDS_TO_WIN ||
        scores.current.opp >= ROUNDS_TO_WIN ||
        idx.current + 1 >= BEST_OF;
      if (done) {
        endMatch();
      } else if (isHost) {
        const next = idx.current + 1;
        net.send('roundStart', { index: next, prompt: prompts.current[next] });
        beginRound(next, prompts.current[next]);
      }
    }, 2600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, isHost, beginRound]);

  const endMatch = useCallback(() => {
    const won = scores.current.me > scores.current.opp;
    setMatchResult(won ? 'win' : 'lose');
    setPhase('result');
    if (won) audio.matchWon();
    else audio.matchLost();
    // Progression
    const xp = won ? 30 : 12;
    profile.addXP(xp);
    profile.recordStats({
      matchesPlayed: profile.stats.matchesPlayed + 1,
      matchesWon: profile.stats.matchesWon + (won ? 1 : 0),
      roundsWon: profile.stats.roundsWon + scores.current.me,
      roundsLost: profile.stats.roundsLost + scores.current.opp,
    });
    if (scores.current.me > 0) profile.unlock('firstBlood');
    if (won && scores.current.opp === 0) profile.unlock('sweep');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── mount: wire net + kick off ──
  useEffect(() => {
    net.on('roundStart', (d) => {
      prompts.current[d.index] = d.prompt;
      beginRound(d.index, d.prompt);
    });
    net.on('matchStart', (d) => {
      prompts.current = d.prompts;
      scores.current = { me: 0, opp: 0 };
      setMyScore(0);
      setOppScore(0);
    });
    net.on('revealDraw', (d) => {
      oppReveal.current = d.dataUrl;
      checkBothRevealed();
    });
    net.on('vote', (d) => {
      oppVote.current = d.choice;
      checkBothVoted();
    });
    net.on('rematchReq', () => {
      if (isHost) startMatch();
    });
    net.on('rematchOk', () => {});
    net.onClose(() => setDisconnected(true));

    // Host generates the match; guest waits for matchStart + roundStart.
    if (isHost) startMatch();

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startMatch = useCallback(() => {
    const words = pickPrompts(BEST_OF);
    prompts.current = words;
    scores.current = { me: 0, opp: 0 };
    setMyScore(0);
    setOppScore(0);
    setMatchResult(null);
    net.send('matchStart', { prompts: words, bestOf: BEST_OF });
    net.send('roundStart', { index: 0, prompt: words[0] });
    beginRound(0, words[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, beginRound]);

  const rematch = () => {
    if (isHost) startMatch();
    else {
      net.send('rematchReq', {});
    }
  };

  const quit = () => {
    useNet.getState().teardown();
    go('menu');
  };

  const urgent = secondsLeft <= 10;
  const oppName = ns.opponent?.name ?? 'Rival';
  const handDetected = hand.cursor.visible;
  const handHint = !hand.enabled
    ? 'Tap 🖐 to draw by hand'
    : urgent
      ? `${secondsLeft}s left!`
      : !handDetected
        ? 'Show your hand to the camera'
        : hand.cursor.drawing
          ? '🤏 Drawing…'
          : `🤏 Pinch to draw your ${prompt}`;

  return (
    <div className="duel">
      <DrawingCanvas
        onReady={(engine) => {
          engineRef.current = engine;
          engine.inputEnabled = false;
        }}
        sparkles={false}
        callbacks={{
          onChange: ({ canUndo, canRedo }) => setTb((s) => ({ ...s, canUndo, canRedo })),
          onStrokePoint: (phaseP, nx, ny, color, size, p) =>
            net.send('stroke', { phase: phaseP, x: nx, y: ny, color, size, p }),
          onUndo: () => net.send('strokeUndo', {}),
          onClear: () => net.send('strokeClear', {}),
        }}
      />

      {phase === 'drawing' && (
        <>
          <div className="match-timerbar">
            <div className={`match-timerbar-fill ${urgent ? 'is-urgent' : ''}`} style={{ width: `${(secondsLeft / ROUND_SECONDS) * 100}%` }} />
          </div>

          {/* TOP · status */}
          <div className="duel-top">
            <div className="duel-top-left">
              <button className="duel-iconbtn" onClick={quit} aria-label="Quit">✕</button>
              <div className="duel-score mono" aria-label={`Score: you ${myScore}, rival ${oppScore}`}>
                {myScore} · {oppScore}
              </div>
            </div>
            <div className="duel-prompt">
              <span className="duel-prompt-kicker mono">DRAW</span>
              <span className="duel-prompt-word display">{prompt}</span>
            </div>
            <div className="duel-top-right">
              <div className="duel-rounds" aria-label={`Round ${roundIndex + 1} of ${BEST_OF}`}>
                {Array.from({ length: BEST_OF }).map((_, i) => (
                  <span key={i} className={`duel-pip ${i <= roundIndex ? 'is-on' : ''}`} />
                ))}
              </div>
              <div className={`duel-timer mono ${urgent ? 'is-urgent' : ''}`}>
                0:{String(secondsLeft).padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Mouse-fallback toolbar — only when hand tracking is off; otherwise
              colour/size/tool are chosen via the gesture radial menus. */}
          {!hand.enabled && (
            <Toolbar
              state={tb}
              onColor={(c) => { e()?.setColor(c); setTb((s) => ({ ...s, color: c, tool: 'brush' })); }}
              onSize={(sz) => { e()?.setSize(sz); setTb((s) => ({ ...s, size: sz })); }}
              onTool={(t: Tool) => { const next = tb.tool === t ? 'brush' : t; e()?.setTool(next); setTb((s) => ({ ...s, tool: next })); }}
              onUndo={() => e()?.undo()}
              onRedo={() => e()?.redo()}
              onClear={() => e()?.clear()}
            />
          )}

          {/* BOTTOM · hand strip */}
          <div className="duel-handbar">
            <div className="duel-gguide" aria-hidden>
              <span>🤏 Draw</span>
              <span className="duel-gguide-sep">·</span>
              <span>2 Colour</span>
              <span className="duel-gguide-sep">·</span>
              <span>3 Size</span>
              <span className="duel-gguide-sep">·</span>
              <span>4 Tools</span>
              <span className="duel-gguide-sep">·</span>
              <span>👍 Undo</span>
              <span className="duel-gguide-sep">·</span>
              <span>🤙 Redo</span>
              <span className="duel-gguide-sep">·</span>
              <span>✊ Clear</span>
              <span className="duel-gguide-sep">·</span>
              <span>🙌 Done</span>
            </div>
            <span
              className={`duel-confdot ${!hand.enabled ? 'is-off' : handDetected ? 'is-ok' : 'is-warn'}`}
              title={!hand.enabled ? 'Hand tracking off' : handDetected ? 'Hand detected' : 'Searching for hand'}
            />
            <span className="duel-hint">{handHint}</span>
            <button
              className={`duel-hand-toggle ${hand.enabled ? 'is-active' : ''}`}
              onClick={toggleHand}
              aria-label="Toggle hand tracking"
              title="Draw with your hand"
            >
              🖐️
            </button>
            <button
              className="duel-hand-toggle"
              onClick={() => { audio.click(); setShowHelp(true); }}
              aria-label="Gesture guide"
              title="Gesture guide"
            >
              ❓
            </button>
            <Button size="sm" variant="primary" onClick={finishDrawing}>Done</Button>
          </div>
        </>
      )}

      {/* reopenable gesture cheat-sheet */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className="duel-help"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              className="duel-help-card glass-strong"
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <h2 className="display duel-help-title">Gesture guide</h2>
              <GestureGuide />
              <Button variant="primary" onClick={() => { audio.click(); setShowHelp(false); }}>Got it</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Countdown value={cd} prompt={prompt} />

      {/* hand-tracking overlays (when enabled) — camera bottom-right, pen cursor */}
      {hand.enabled && phase === 'drawing' && (
        <>
          <CameraPip stream={hand.stream} />
          <HandCursor cursor={hand.cursor} color={tb.tool === 'eraser' ? '#888' : tb.color} />
          {gestures.menu && (
            <GestureRadialMenu
              kind={gestures.menu}
              anchor={gestures.anchor}
              color={tb.color}
              size={tb.size}
              tool={tb.tool}
              onColor={(c) => { e()?.setColor(c); setTb((s) => ({ ...s, color: c, tool: 'brush' })); gestures.closeMenu(); }}
              onSize={(sz) => { e()?.setSize(sz); setTb((s) => ({ ...s, size: sz })); gestures.closeMenu(); }}
              onTool={(t) => { e()?.setTool(t); setTb((s) => ({ ...s, tool: t })); gestures.closeMenu(); }}
            />
          )}
          {gestures.hold && <HoldRing cursor={hand.cursor} hold={gestures.hold} />}
        </>
      )}

      {/* reveal + vote */}
      <AnimatePresence>
        {phase === 'reveal' && reveal && (
          <motion.div className="duel-reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="display duel-reveal-title">The prompt was “{prompt}”</h2>
            <p className="duel-reveal-sub">
              {outcome ? (outcome === 'me' ? 'You win the round!' : outcome === 'opp' ? `${oppName} wins the round` : 'Dead heat!') : 'Vote for the better drawing'}
            </p>
            <div className="duel-reveal-grid">
              <VoteCard
                label="You"
                src={reveal.me}
                accent="blue"
                voted={myVoted}
                win={outcome === 'me'}
                onVote={() => castVote('self')}
                disabled={myVoted || !!outcome}
              />
              <VoteCard
                label={oppName}
                src={reveal.opp}
                accent="pink"
                voted={myVoted}
                win={outcome === 'opp'}
                onVote={() => castVote('opp')}
                disabled={myVoted || !!outcome}
              />
            </div>
            {verdict && (
              <div className="duel-verdict">🤖 <b>AI Judge:</b> {verdict.title} — {verdict.critique}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* match result */}
      {phase === 'result' && matchResult && (
        <motion.div className="duel-result" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="duel-result-emoji">{matchResult === 'win' ? '🏆' : '🥈'}</div>
          <h1 className="display duel-result-title">{matchResult === 'win' ? 'Victory!' : 'Defeated'}</h1>
          <p className="duel-result-sub">{myScore} · {oppScore}</p>
          <div className="duel-result-actions">
            <Button variant="ghost" onClick={quit}>Menu</Button>
            <Button variant="primary" onClick={rematch}>{isHost ? 'Rematch' : 'Request Rematch'}</Button>
          </div>
        </motion.div>
      )}

      {disconnected && (
        <div className="duel-disconnect">
          <div className="duel-disconnect-card glass-strong">
            <h2 className="display">Opponent left</h2>
            <p>The connection was lost.</p>
            <Button variant="primary" onClick={quit}>Back to Menu</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function VoteCard({
  label,
  src,
  accent,
  voted,
  win,
  onVote,
  disabled,
}: {
  label: string;
  src: string;
  accent: 'blue' | 'pink';
  voted: boolean;
  win: boolean;
  onVote: () => void;
  disabled: boolean;
}) {
  return (
    <button className={`duel-vote-card duel-vote-card--${accent} ${win ? 'is-win' : ''}`} onClick={onVote} disabled={disabled}>
      <span className="duel-vote-name">{label}</span>
      <img src={src} alt={`${label}'s drawing`} />
      <span className="duel-vote-badge">{voted ? 'Voted' : 'Vote'}</span>
    </button>
  );
}

/** Progress ring shown at the cursor while a hold-to-confirm gesture charges. */
function HoldRing({ cursor, hold }: { cursor: CursorState; hold: HoldState }) {
  if (!cursor.visible) return null;
  const R = 42;
  const circ = 2 * Math.PI * (R - 3);
  const isClear = hold.action === 'clear';
  return (
    <div className="duel-holdring" style={{ left: cursor.x, top: cursor.y }}>
      <svg width={R * 2} height={R * 2}>
        <circle cx={R} cy={R} r={R - 3} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={4} />
        <circle
          cx={R}
          cy={R}
          r={R - 3}
          fill="none"
          stroke={isClear ? '#ff5c5c' : '#5de8b8'}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - hold.progress)}
          transform={`rotate(-90 ${R} ${R})`}
        />
      </svg>
      <span className="duel-holdring-label">{isClear ? '✊ Clearing…' : '🙌 Finishing…'}</span>
    </div>
  );
}
