import type { HandCalibration } from './constants';

/** A normalized MediaPipe hand landmark (x,y in [0,1], z relative). */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export type Gesture =
  | 'none'
  | 'pinch'
  | 'thumb'
  | 'shaka'
  | 'two-finger'
  | 'three-finger'
  | 'draw'
  | 'palm'
  | 'open'
  | 'fist'
  | 'unknown';

const TIP_IDS = [4, 8, 12, 16, 20];
const PIP_IDS = [2, 6, 10, 14, 18];

/** Which fingers are extended: [thumb, index, middle, ring, pinky]. */
export function fingersExtended(lm: Landmark[]): boolean[] {
  const ext: boolean[] = [];
  for (let i = 0; i < 5; i++) {
    if (i === 0) {
      const tip = lm[4];
      const mcp = lm[2];
      ext.push(
        Math.hypot(tip.x - lm[0].x, tip.y - lm[0].y) >
          Math.hypot(mcp.x - lm[0].x, mcp.y - lm[0].y) * 1.2,
      );
    } else {
      ext.push(lm[TIP_IDS[i]].y < lm[PIP_IDS[i]].y - 0.015);
    }
  }
  return ext;
}

/** Thumb-tip ↔ index-tip distance normalized by hand size. Lower = more pinched. */
export function pinchRatio(lm: Landmark[]): number {
  const handSize = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-6;
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) / handSize;
}

/**
 * Classify a hand pose into a gesture. `prevPinch` enables pinch hysteresis
 * (wider exit threshold) so a held pinch doesn't flicker.
 */
export function detectGesture(
  lm: Landmark[],
  prevPinch: boolean,
  cal: HandCalibration,
): Gesture {
  const [thumb, index, middle, ring, pinky] = fingersExtended(lm);
  const ratio = pinchRatio(lm);
  const pinching = prevPinch ? ratio < cal.pinchExit : ratio < cal.pinchEnter;

  if (pinching && !middle && !ring && !pinky) return 'pinch';
  // 🤙 thumb + pinky only (Redo). Checked before the thumb-only case (which
  // requires !pinky) so the two never collide.
  if (thumb && pinky && !index && !middle && !ring) return 'shaka';
  if (thumb && !index && !middle && !ring && !pinky) return 'thumb';
  if (index && middle && !ring && !pinky) return 'two-finger';
  if (index && middle && ring && !pinky) return 'three-finger';
  if (index && !middle && !ring && !pinky) return 'draw';
  // 🖐 full open hand incl. thumb (Done) — checked before 'palm', which is now
  // the four-finger pose with the thumb tucked.
  if (thumb && index && middle && ring && pinky) return 'open';
  if (index && middle && ring && pinky) return 'palm';
  if (!index && !middle && !ring && !pinky) return 'fist';
  return 'unknown';
}
