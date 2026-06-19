import type { Gesture } from './hand/gestures';

export type ElementKey = 'earth' | 'wind' | 'water' | 'fire' | 'lightning';

export interface ElementDef {
  key: ElementKey;
  emoji: string;
  gesture: Gesture;
  gestureHint: string;
  label: string;
  color: string;
}

/** Element ↔ gesture mapping, ported from the legacy game. */
export const ELEMENTS: Record<ElementKey, ElementDef> = {
  earth: { key: 'earth', emoji: '⛰️', gesture: 'three-finger', gestureHint: '🤟 Three fingers', label: 'Earth', color: '#a8956c' },
  wind: { key: 'wind', emoji: '💨', gesture: 'draw', gestureHint: '☝️ Point', label: 'Wind', color: '#5de8b8' },
  water: { key: 'water', emoji: '💧', gesture: 'two-finger', gestureHint: '✌️ Two fingers', label: 'Water', color: '#7cb9ff' },
  fire: { key: 'fire', emoji: '🔥', gesture: 'thumb', gestureHint: '👍 Thumb', label: 'Fire', color: '#ff6b35' },
  lightning: { key: 'lightning', emoji: '⚡', gesture: 'palm', gestureHint: '🖐️ Open palm', label: 'Lightning', color: '#ffc844' },
};

export const ELEMENT_LIST: ElementDef[] = Object.values(ELEMENTS);

/** ELEMENT_BEATS[a] = elements that `a` defeats. */
export const ELEMENT_BEATS: Record<ElementKey, ElementKey[]> = {
  fire: ['wind', 'earth'],
  water: ['fire', 'lightning'],
  wind: ['water', 'earth'],
  earth: ['lightning', 'fire'],
  lightning: ['wind', 'water'],
};

export function elementBeats(a: ElementKey, b: ElementKey): boolean {
  return ELEMENT_BEATS[a].includes(b);
}

/** Flavor verb for how `winner` defeats `loser` — used to teach the matchup at reveal. */
export const BEATS_VERB: Record<ElementKey, Partial<Record<ElementKey, string>>> = {
  fire: { wind: 'feeds on', earth: 'scorches' },
  water: { fire: 'douses', lightning: 'grounds' },
  wind: { water: 'whips up', earth: 'erodes' },
  earth: { lightning: 'grounds', fire: 'smothers' },
  lightning: { wind: 'splits', water: 'electrifies' },
};

/** e.g. describeBeat('fire','wind') → "Fire feeds on Wind". Empty string if not a beat. */
export function describeBeat(winner: ElementKey, loser: ElementKey): string {
  const verb = BEATS_VERB[winner]?.[loser];
  if (!verb) return '';
  return `${ELEMENTS[winner].label} ${verb} ${ELEMENTS[loser].label}`;
}

/**
 * Human-readable reason for a resolved round, covering missing picks (a player
 * who didn't summon in time). Used by the round-result popup.
 */
export function roundReason(
  outcome: Outcome,
  you: ElementKey | null,
  opp: ElementKey | null,
): string {
  if (outcome === 'tie') {
    return you ? `Both summoned ${ELEMENTS[you].label} — a perfect clash.` : 'Neither of you summoned in time.';
  }
  if (outcome === 'win') {
    if (!opp) return 'Your rival never summoned — the round is yours.';
    if (you) return describeBeat(you, opp);
    return 'You take the round.';
  }
  // lose
  if (!you) return "You didn't summon in time.";
  if (opp) return describeBeat(opp, you);
  return 'Your rival takes the round.';
}

export function gestureToElement(gesture: Gesture): ElementKey | null {
  // A full open hand (thumb splayed) now classifies as 'open'; treat it as the
  // open-palm lightning pose so a natural high-five still summons lightning.
  const g = gesture === 'open' ? 'palm' : gesture;
  const def = ELEMENT_LIST.find((e) => e.gesture === g);
  return def ? def.key : null;
}

export type Outcome = 'win' | 'lose' | 'tie';

export function resolveRound(you: ElementKey, cpu: ElementKey): Outcome {
  if (elementBeats(you, cpu)) return 'win';
  if (elementBeats(cpu, you)) return 'lose';
  return 'tie';
}

export function randomElement(): ElementKey {
  const keys = Object.keys(ELEMENTS) as ElementKey[];
  return keys[Math.floor(Math.random() * keys.length)];
}

export const BEST_OF = 5;
export const WIN_THRESHOLD = Math.ceil(BEST_OF / 2); // first to 3
// Summon window. Gesture input needs more time than tapping: a player must raise
// their hand into frame, form the pose, and hold it long enough for the tracker's
// hysteresis to commit. 3s routinely expired mid-gesture (the unfair "Time's up"
// loss); 6s is comfortable for gestures while tap players still lock instantly.
export const CHARGE_SECS = 6;
