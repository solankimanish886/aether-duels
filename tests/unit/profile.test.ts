import { describe, it, expect } from 'vitest';
import { levelForXP, xpRequiredForLevel } from '@/state/profile';

describe('progression curve', () => {
  it('starts everyone at level 1 with 0 XP', () => {
    expect(levelForXP(0)).toBe(1);
    expect(xpRequiredForLevel(1)).toBe(0);
  });

  it('is monotonically increasing per level', () => {
    for (let lvl = 1; lvl < 20; lvl++) {
      expect(xpRequiredForLevel(lvl + 1)).toBeGreaterThan(xpRequiredForLevel(lvl));
    }
  });

  it('maps XP back to the correct level at boundaries', () => {
    const l5 = xpRequiredForLevel(5);
    expect(levelForXP(l5)).toBe(5);
    expect(levelForXP(l5 - 1)).toBe(4);
  });
});
