import { create } from 'zustand';
import { DuelNet } from '@/game/net/DuelNet';
import type { PlayerInfo } from '@/game/net/protocol';

export type NetStatus =
  | 'idle'
  | 'hosting' // waiting for an opponent to join
  | 'joining'
  | 'lobby' // both connected, readying up
  | 'in-match'
  | 'disconnected';

export interface ChatMsg {
  from: 'me' | 'opp';
  text: string;
}

/** Which game the lobby is brokering a session for. */
export type LobbyMode = 'duel' | 'elemental';

interface NetState {
  net: DuelNet | null;
  status: NetStatus;
  isBot: boolean;
  /** What the connected session is for — routes the lobby on both-ready. */
  mode: LobbyMode;
  code: string;
  /** A room code to auto-join (set by an invite link). */
  pendingJoin: string;
  error: string;
  opponent: PlayerInfo | null;
  myReady: boolean;
  oppReady: boolean;
  chat: ChatMsg[];

  set: (patch: Partial<NetState>) => void;
  addChat: (m: ChatMsg) => void;
  resetLobby: () => void;
  teardown: () => void;
}

export const useNet = create<NetState>((set, get) => ({
  net: null,
  status: 'idle',
  isBot: false,
  mode: 'duel',
  code: '',
  pendingJoin: '',
  error: '',
  opponent: null,
  myReady: false,
  oppReady: false,
  chat: [],

  set: (patch) => set(patch),
  addChat: (m) => set((s) => ({ chat: [...s.chat, m] })),
  resetLobby: () => set({ myReady: false, oppReady: false }),
  teardown: () => {
    get().net?.close();
    set({
      net: null,
      status: 'idle',
      isBot: false,
      mode: 'duel',
      code: '',
      pendingJoin: '',
      error: '',
      opponent: null,
      myReady: false,
      oppReady: false,
      chat: [],
    });
  },
}));
