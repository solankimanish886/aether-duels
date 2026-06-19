import { fingersExtended, type Landmark } from '@/game/hand/gestures';
import { STORM_SPREAD_MIN } from './constants';

/** An open palm: index, middle, ring and pinky all extended. */
export function isOpenPalm(lm: Landmark[]): boolean {
  const ext = fingersExtended(lm);
  return ext[1] && ext[2] && ext[3] && ext[4];
}

export interface StormHit {
  /** normalized palm-to-palm distance (intensity). */
  spread: number;
  /** midpoint in normalized 0..1 space, x mirrored to match the selfie cursor. */
  cx: number;
  cy: number;
}

/**
 * Detect a two-hand "storm" pose: both hands present and open, held wide apart.
 * Returns the midpoint + spread, or null. Caller applies frame hysteresis.
 */
export function detectStorm(hands: Landmark[][]): StormHit | null {
  if (hands.length < 2) return null;
  const a = hands[0];
  const b = hands[1];
  if (!a || !b || a.length < 21 || b.length < 21) return null;
  if (!isOpenPalm(a) || !isOpenPalm(b)) return null;
  const pa = a[9];
  const pb = b[9];
  const spread = Math.hypot(pa.x - pb.x, pa.y - pb.y);
  if (spread < STORM_SPREAD_MIN) return null;
  return { spread, cx: 1 - (pa.x + pb.x) / 2, cy: (pa.y + pb.y) / 2 };
}
