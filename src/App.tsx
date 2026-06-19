import { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useNet } from '@/state/net';
import { isValidRoomCode } from '@/game/net/roomCode';
import { ScreenTransition } from '@/components/ScreenTransition';
import { ToastHost } from '@/components/Toast';
import { Splash } from '@/screens/Splash';
import { Menu } from '@/screens/Menu';
import { Onboarding } from '@/screens/Onboarding';
import { Sandbox } from '@/screens/Sandbox';
import { Elemental } from '@/screens/Elemental';
import { ElementalIntro } from '@/screens/elemental/ElementalIntro';
import { ElementalTutorial } from '@/screens/elemental/ElementalTutorial';
import { ElementalPractice } from '@/screens/elemental/ElementalPractice';
import { Lobby } from '@/screens/Lobby';
import { Duel } from '@/screens/multiplayer/Duel';
import { DuelTutorial } from '@/screens/multiplayer/DuelTutorial';
import { SandboxTutorial } from '@/screens/sandbox/SandboxTutorial';
// (Removed dead 'reveal'/'result' Placeholder routes — Duel/Match/Elemental
//  manage those phases internally.)

// Element Creator pulls in three/drei/postprocessing — lazy-load so it only
// ships to players who actually open the 3D mode.
const ElementCreator = lazy(() =>
  import('@/screens/ElementCreator').then((m) => ({ default: m.ElementCreator })),
);

export default function App() {
  const screen = useUI((s) => s.screen);

  // Invite link: ?room=CODE&mode=duel|elemental jumps to the matching lobby and
  // auto-joins. The mode must travel with the code so the guest lands in the same
  // game as the host (defaults to duel).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code && isValidRoomCode(code)) {
      const mode = params.get('mode') === 'elemental' ? 'elemental' : 'duel';
      useNet.getState().set({ mode, pendingJoin: code });
      useUI.getState().go('lobby');
    }
    if (code) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        <ScreenTransition key={screen}>
          {screen === 'splash' && <Splash />}
          {screen === 'onboarding' && <Onboarding />}
          {screen === 'menu' && <Menu />}
          {screen === 'sandbox' && <Sandbox />}
          {screen === 'sandbox-tutorial' && <SandboxTutorial />}
          {screen === 'lobby' && <Lobby />}
          {screen === 'duel' && <Duel />}
          {screen === 'duel-tutorial' && <DuelTutorial />}
          {screen === 'elemental' && <Elemental />}
          {screen === 'elemental-intro' && <ElementalIntro />}
          {screen === 'elemental-tutorial' && <ElementalTutorial />}
          {screen === 'elemental-practice' && <ElementalPractice />}
          {screen === 'element-creator' && (
            <Suspense fallback={null}>
              <ElementCreator />
            </Suspense>
          )}
        </ScreenTransition>
      </AnimatePresence>
      <ToastHost />
    </>
  );
}
