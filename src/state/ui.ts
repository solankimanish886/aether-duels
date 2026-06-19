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
  | 'duel';

export type ModalId = 'achievements' | 'stats' | 'howto' | 'profile' | 'leaderboard' | null;

interface UIState {
  screen: Screen;
  modal: ModalId;
  /** True while a screen transition animation is in flight. */
  go: (screen: Screen) => void;
  openModal: (modal: Exclude<ModalId, null>) => void;
  closeModal: () => void;
}

export const useUI = create<UIState>((set) => ({
  screen: 'splash',
  modal: null,
  go: (screen) => set({ screen, modal: null }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
}));
