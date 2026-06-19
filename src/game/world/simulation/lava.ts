import type { WorldState } from '../WorldState';
import { swap } from '../WorldState';
import { FLOW_DAMP, LAVA_EPS, LAVA_FLOW_FRACTION } from '../constants';

/**
 * Lava flow — the same virtual-pipe model as water but more viscous (a smaller
 * flow fraction) and with no evaporation. Heating, solidification and the
 * lava↔water steam reaction live in the thermal step so they run after both
 * fluids have moved.
 */
export function stepLava(s: WorldState, _dt: number): void {
  const { cols, rows, height, water, lava, lavaNew } = s;
  lavaNew.set(lava);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const l = lava[i];
      if (l < LAVA_EPS) continue;
      const surf = height[i] + water[i] + l;

      let total = 0;
      let dL = 0;
      let dR = 0;
      let dU = 0;
      let dD = 0;
      if (x > 0) {
        const j = i - 1;
        const d = surf - (height[j] + water[j] + lava[j]);
        if (d > 0) {
          dL = d;
          total += d;
        }
      }
      if (x < cols - 1) {
        const j = i + 1;
        const d = surf - (height[j] + water[j] + lava[j]);
        if (d > 0) {
          dR = d;
          total += d;
        }
      }
      if (y > 0) {
        const j = i - cols;
        const d = surf - (height[j] + water[j] + lava[j]);
        if (d > 0) {
          dU = d;
          total += d;
        }
      }
      if (y < rows - 1) {
        const j = i + cols;
        const d = surf - (height[j] + water[j] + lava[j]);
        if (d > 0) {
          dD = d;
          total += d;
        }
      }
      if (total <= 0) continue;

      const move = Math.min(l, total * FLOW_DAMP) * LAVA_FLOW_FRACTION;
      if (dL > 0) lavaNew[i - 1] += move * (dL / total);
      if (dR > 0) lavaNew[i + 1] += move * (dR / total);
      if (dU > 0) lavaNew[i - cols] += move * (dU / total);
      if (dD > 0) lavaNew[i + cols] += move * (dD / total);
      lavaNew[i] -= move;
    }
  }

  swap(s, 'lava');
}
