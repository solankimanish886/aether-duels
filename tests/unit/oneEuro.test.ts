import { describe, it, expect } from 'vitest';
import { OneEuroFilter } from '@/game/hand/oneEuro';

describe('OneEuroFilter', () => {
  it('returns the first sample unchanged', () => {
    const f = new OneEuroFilter();
    expect(f.filter(100, 0)).toBe(100);
  });

  it('smooths toward a step input rather than jumping', () => {
    const f = new OneEuroFilter(1.0, 0.05, 1.0);
    f.filter(0, 0);
    const out = f.filter(100, 16); // ~16ms later
    expect(out).toBeGreaterThan(0);
    expect(out).toBeLessThan(100); // lagged, not instant
  });

  it('converges to a held value over many samples', () => {
    const f = new OneEuroFilter();
    f.filter(0, 0);
    let t = 16;
    let v = 0;
    for (let i = 0; i < 60; i++, t += 16) v = f.filter(100, t);
    expect(v).toBeGreaterThan(95);
  });

  it('reset clears history', () => {
    const f = new OneEuroFilter();
    f.filter(50, 0);
    f.reset();
    expect(f.filter(999, 0)).toBe(999);
  });
});
