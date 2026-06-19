import { create } from 'zustand';
import { loadJSON, saveJSON } from '@/lib/storage';
import { audio } from '@/lib/audio';
import { DEFAULT_CALIBRATION, type HandCalibration } from '@/game/hand/constants';

export interface Stats {
  matchesPlayed: number;
  matchesWon: number;
  roundsWon: number;
  roundsLost: number;
  ties: number;
  bestStreak: number;
  currentStreak: number;
}

export interface Prefs {
  audio: boolean;
  handTracking: boolean;
  reducedMotion: boolean;
}

export interface Profile {
  name: string;
  xp: number;
  onboarded: boolean;
  stats: Stats;
  prefs: Prefs;
  achievements: string[];
  handCalibration: HandCalibration;
  handCalibrated: boolean;
  /** First-time gate for the Elemental interactive tutorial (one-shot). */
  elementalTutorialDone: boolean;
  /** First-time gate for the Forge a Duel onboarding tutorial (one-shot). */
  duelTutorialDone: boolean;
  /** First-time gate for the Sandbox gesture onboarding (one-shot). */
  sandboxTutorialDone: boolean;
}

const DEFAULT_PROFILE: Profile = {
  name: '',
  xp: 0,
  onboarded: false,
  stats: {
    matchesPlayed: 0,
    matchesWon: 0,
    roundsWon: 0,
    roundsLost: 0,
    ties: 0,
    bestStreak: 0,
    currentStreak: 0,
  },
  prefs: { audio: true, handTracking: false, reducedMotion: false },
  achievements: [],
  handCalibration: { ...DEFAULT_CALIBRATION },
  handCalibrated: false,
  elementalTutorialDone: false,
  duelTutorialDone: false,
  sandboxTutorialDone: false,
};

/** XP needed to *reach* a given level. Level 1 starts at 0 XP. */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  // Smooth escalating curve (ported from legacy progression feel).
  return Math.round(60 * Math.pow(level - 1, 1.45));
}

export function levelForXP(xp: number): number {
  let level = 1;
  while (xp >= xpRequiredForLevel(level + 1)) level++;
  return level;
}

export interface XPResult {
  leveledUp: boolean;
  fromLevel: number;
  toLevel: number;
}

interface ProfileState extends Profile {
  setName: (name: string) => void;
  addXP: (amount: number) => XPResult;
  completeOnboarding: () => void;
  completeElementalTutorial: () => void;
  completeDuelTutorial: () => void;
  completeSandboxTutorial: () => void;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  unlock: (id: string) => boolean;
  recordStats: (patch: Partial<Stats>) => void;
  setHandCalibration: (cal: HandCalibration) => void;
  level: () => number;
}

export const useProfile = create<ProfileState>((set, get) => {
  const persisted = loadJSON<Profile>('profile', DEFAULT_PROFILE);
  audio.setEnabled(persisted.prefs.audio);

  const persist = () => {
    const { name, xp, onboarded, stats, prefs, achievements, elementalTutorialDone, duelTutorialDone, sandboxTutorialDone } =
      get();
    saveJSON('profile', {
      name,
      xp,
      onboarded,
      stats,
      prefs,
      achievements,
      elementalTutorialDone,
      duelTutorialDone,
      sandboxTutorialDone,
    });
  };

  return {
    ...persisted,
    setName: (name) => {
      set({ name });
      persist();
    },
    addXP: (amount) => {
      const fromLevel = levelForXP(get().xp);
      set({ xp: get().xp + amount });
      const toLevel = levelForXP(get().xp);
      persist();
      return { leveledUp: toLevel > fromLevel, fromLevel, toLevel };
    },
    completeOnboarding: () => {
      set({ onboarded: true });
      persist();
    },
    completeElementalTutorial: () => {
      set({ elementalTutorialDone: true });
      persist();
    },
    completeDuelTutorial: () => {
      set({ duelTutorialDone: true });
      persist();
    },
    completeSandboxTutorial: () => {
      set({ sandboxTutorialDone: true });
      persist();
    },
    setPref: (key, value) => {
      set({ prefs: { ...get().prefs, [key]: value } });
      if (key === 'audio') audio.setEnabled(value as boolean);
      persist();
    },
    unlock: (id) => {
      if (get().achievements.includes(id)) return false;
      set({ achievements: [...get().achievements, id] });
      persist();
      return true;
    },
    recordStats: (patch) => {
      set({ stats: { ...get().stats, ...patch } });
      persist();
    },
    setHandCalibration: (cal) => {
      set({ handCalibration: cal, handCalibrated: true });
      persist();
    },
    level: () => levelForXP(get().xp),
  };
});
