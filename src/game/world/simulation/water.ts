import type { WorldState } from '../WorldState';
import { swap } from '../WorldState';
import {
  EROSION_MIN_FLOW,
  EROSION_RATE,
  EVAP_RATE,
  FLOW_DAMP,
  FLOW_FRACTION,
  WATER_EPS,
} from '../constants';

/**
 * Virtual-pipe water flow. Each wet cell pushes water toward its lower 4-
 * neighbours in proportion to the surface-height difference, capped at half the
 * column so it can never oscillate or overshoot. Basins fill and rivers thread
 * through low ground emergently — there is no special-case river code.
 *
 * Conservative: water is only ever moved between cells (plus a small, explicit
 * evaporation term), never created.
 */
export function stepWater(s: WorldState, dt: number): void {
  const { cols, rows, height, water, waterNew, lava } = s;
  waterNew.set(water);

  const evap = EVAP_RATE * dt;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const w = water[i];
      if (w < WATER_EPS) continue;
      const surf = height[i] + w + lava[i];

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

      // Move at most half the column toward the lower side, scaled by FLOW_FRACTION.
      const move = Math.min(w, total * FLOW_DAMP) * FLOW_FRACTION;
      if (dL > 0) waterNew[i - 1] += move * (dL / total);
      if (dR > 0) waterNew[i + 1] += move * (dR / total);
      if (dU > 0) waterNew[i - cols] += move * (dU / total);
      if (dD > 0) waterNew[i + cols] += move * (dD / total);
      waterNew[i] -= move;

      // Erosion: fast-moving water carves the channel it flows through so rivers
      // persist. Kept tiny so the world doesn't melt.
      if (move > EROSION_MIN_FLOW) {
        height[i] = Math.max(0, height[i] - EROSION_RATE * move * dt);
      }
    }
  }

  // Standing-water evaporation (so puddles on high ground breathe away).
  if (evap > 0) {
    for (let i = 0; i < waterNew.length; i++) {
      const v = waterNew[i];
      if (v > 0) waterNew[i] = v > evap ? v - evap : 0;
    }
  }

  swap(s, 'water');
}
