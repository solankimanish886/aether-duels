import { describe, it, expect } from 'vitest';
import { detectGesture, type Landmark } from '@/game/hand/gestures';
import { DEFAULT_CALIBRATION } from '@/game/hand/constants';

/**
 * Build a synthetic 21-landmark hand. Wrist at (0.5,0.9), middle-MCP at
 * (0.5,0.5) → hand size 0.4. Fingers "extended" place the tip above the PIP.
 */
function buildHand(opts: {
  thumb?: boolean;
  index?: boolean;
  middle?: boolean;
  ring?: boolean;
  pinky?: boolean;
  pinch?: boolean;
}): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  lm[0] = { x: 0.5, y: 0.9 }; // wrist
  lm[9] = { x: 0.5, y: 0.5 }; // middle MCP (hand-size anchor)

  // Thumb (tip 4, MCP 2)
  if (opts.thumb) {
    lm[2] = { x: 0.42, y: 0.75 };
    lm[4] = { x: 0.18, y: 0.62 };
  } else {
    lm[2] = { x: 0.46, y: 0.78 };
    lm[4] = { x: 0.46, y: 0.82 };
  }

  const finger = (tipId: number, pipId: number, extended?: boolean) => {
    lm[pipId] = { x: 0.5, y: 0.5 };
    lm[tipId] = { x: 0.5, y: extended ? 0.25 : 0.62 };
  };
  finger(8, 6, opts.index);
  finger(12, 10, opts.middle);
  finger(16, 14, opts.ring);
  finger(20, 18, opts.pinky);

  // Pinch: pull thumb tip onto the index tip.
  if (opts.pinch) lm[4] = { x: lm[8].x, y: lm[8].y + 0.04 };

  return lm;
}

const CAL = DEFAULT_CALIBRATION;

describe('detectGesture', () => {
  it('detects a pinch (thumb+index together, others folded)', () => {
    const hand = buildHand({ index: true, pinch: true });
    expect(detectGesture(hand, false, CAL)).toBe('pinch');
  });

  it('keeps a pinch held via hysteresis (wider exit threshold)', () => {
    const hand = buildHand({ index: true, pinch: true });
    expect(detectGesture(hand, true, CAL)).toBe('pinch');
  });

  it('detects pointing (index only, not pinching) as draw', () => {
    const hand = buildHand({ index: true });
    expect(detectGesture(hand, false, CAL)).toBe('draw');
  });

  it('detects a fist (all folded)', () => {
    const hand = buildHand({});
    expect(detectGesture(hand, false, CAL)).toBe('fist');
  });

  it('detects an open palm (all four fingers extended)', () => {
    const hand = buildHand({ index: true, middle: true, ring: true, pinky: true });
    expect(detectGesture(hand, false, CAL)).toBe('palm');
  });

  it('detects an open hand (four fingers + thumb) as open, not palm', () => {
    const hand = buildHand({ thumb: true, index: true, middle: true, ring: true, pinky: true });
    expect(detectGesture(hand, false, CAL)).toBe('open');
  });

  it('detects a shaka (thumb + pinky only)', () => {
    const hand = buildHand({ thumb: true, pinky: true });
    expect(detectGesture(hand, false, CAL)).toBe('shaka');
  });

  it('detects two-finger (index + middle)', () => {
    const hand = buildHand({ index: true, middle: true });
    expect(detectGesture(hand, false, CAL)).toBe('two-finger');
  });

  it('detects three-finger (index + middle + ring)', () => {
    const hand = buildHand({ index: true, middle: true, ring: true });
    expect(detectGesture(hand, false, CAL)).toBe('three-finger');
  });
});
