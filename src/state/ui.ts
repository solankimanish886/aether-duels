import { create } from 'zustand';

/** Top-level screens — the app's screen state machine. */
export type Screen =
  | 'splash'
  | 'onboarding'
  | 'menu'
  | 'sandbox'
  | 'sandbox-tutorial'
  | 'lobby'
  | 'duel-tutorial'
  | 'elemental'
  | 'elemental-intro'
  | 'elemental-tutorial'
  | 'elemental-practice'
  | 'element-creator'
  | 'element-creator-tutorial'
  | 'duel';

export type ModalId = 'achievements' | 'stats' | 'howto' | 'profile' | 'leaderboard' | null;

interface UIState {
  screen: Screen;
  /** The screen navigated away from — lets tutorials exit back to their origin. */
  prevScreen: Screen | null;
  modal: ModalId;
  go: (screen: Screen) => void;
  openModal: (modal: Exclude<ModalId, null>) => void;
  closeModal: () => void;
}

export const useUI = create<UIState>((set) => ({
  screen: 'splash',
  prevScreen: null,
  modal: null,
  go: (screen) => set((s) => ({ prevScreen: s.screen, screen, modal: null })),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
}));
