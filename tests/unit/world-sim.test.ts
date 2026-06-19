import { describe, it, expect } from 'vitest';
import { createWorldState, type WorldState } from '@/game/world/WorldState';
import { stepWater } from '@/game/world/simulation/water';
import { EVAP_RATE, SIM_DT } from '@/game/world/constants';

/** Build a small flat world with a single dug basin at the centre. */
function basinWorld(cols = 16, rows = 16): WorldState {
  const s = createWorldState(cols, rows);
  s.height.fill(0.5);
  s.water.fill(0);
  s.lava.fill(0);
  s.vegetation.fill(0);
  s.rock.fill(0);
  const cx = cols >> 1;
  const cy = rows >> 1;
  // a 1-cell-deep basin and a uniform layer of water to drain into it
  s.height[cy * cols + cx] = 0.2;
  s.water.fill(0.05);
  s.waterNew.set(s.water);
  return s;
}

const sum = (a: Float32Array) => a.reduce((t, v) => t + v, 0);

describe('water simulation', () => {
  it('conserves water up to a bounded evaporation loss (never creates it)', () => {
    const s = basinWorld();
    const before = sum(s.water);
    const ticks = 60;
    for (let i = 0; i < ticks; i++) stepWater(s, SIM_DT);
    const after = sum(s.water);

    // Flow never manufactures water.
    expect(after).toBeLessThanOrEqual(before + 1e-5);
    // Loss is bounded by evaporation acting on at most every cell each tick.
    const maxEvapLoss = EVAP_RATE * SIM_DT * s.n * ticks;
    expect(after).toBeGreaterThanOrEqual(before - maxEvapLoss - 1e-5);
  });

  it('pools water in the basin (lowest cell ends up deepest)', () => {
    const s = basinWorld();
    const cx = s.cols >> 1;
    const cy = s.rows >> 1;
    const basin = cy * s.cols + cx;
    for (let i = 0; i < 120; i++) stepWater(s, SIM_DT);

    let maxIdx = 0;
    for (let i = 1; i < s.n; i++) if (s.water[i] > s.water[maxIdx]) maxIdx = i;
    expect(maxIdx).toBe(basin);
    expect(s.water[basin]).toBeGreaterThan(0.05); // deeper than the starting layer
  });

  it('does not produce negative depths', () => {
    const s = basinWorld();
    for (let i = 0; i < 80; i++) stepWater(s, SIM_DT);
    for (let i = 0; i < s.n; i++) expect(s.water[i]).toBeGreaterThanOrEqual(0);
  });
});
