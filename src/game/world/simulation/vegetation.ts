import type { WorldState } from '../WorldState';
import {
  MOIST_DECAY,
  MOIST_DIFFUSE,
  VEG_BURN,
  VEG_DIE,
  VEG_DROWN,
  VEG_GROW,
  VEG_MOIST_HI,
  VEG_MOIST_LO,
  VEG_SPREAD,
  WATER_TO_MOIST,
} from '../constants';

const smoothstep = (lo: number, hi: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1e-6)));
  return t * t * (3 - 2 * t);
};

/** Moisture: fed by standing water, diffused to neighbours, slowly drying out. */
export function stepMoisture(s: WorldState, dt: number): void {
  const { cols, rows, water, moisture } = s;
  const decay = MOIST_DECAY * dt;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      let m = moisture[i];
      m += WATER_TO_MOIST * water[i] * dt; // wet cells gain moisture
      // 4-neighbour averaging (diffusion)
      let sum = 0;
      let count = 0;
      if (x > 0) {
        sum += moisture[i - 1];
        count++;
      }
      if (x < cols - 1) {
        sum += moisture[i + 1];
        count++;
      }
      if (y > 0) {
        sum += moisture[i - cols];
        count++;
      }
      if (y < rows - 1) {
        sum += moisture[i + cols];
        count++;
      }
      if (count) m += MOIST_DIFFUSE * (sum / count - m);
      m -= decay;
      moisture[i] = m < 0 ? 0 : m > 1 ? 1 : m;
    }
  }
}

/**
 * Vegetation: logistic growth where moisture sits in a healthy band and the
 * cell is neither submerged nor too hot; spreads from greener neighbours so
 * forests creep along riverbanks; dies back when drowned or burnt.
 */
export function stepVegetation(s: WorldState, dt: number): void {
  const { cols, rows, water, temp, moisture, vegetation } = s;
  const grow = VEG_GROW * dt;
  const spread = VEG_SPREAD * dt;
  const die = VEG_DIE * dt;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const v = vegetation[i];
      if (water[i] > VEG_DROWN || temp[i] > VEG_BURN) {
        vegetation[i] = v > die ? v - die : 0;
        continue;
      }
      // fertility peaks mid-band, falls off when too dry or waterlogged
      const fertility =
        smoothstep(VEG_MOIST_LO, (VEG_MOIST_LO + VEG_MOIST_HI) / 2, moisture[i]) *
        (1 - smoothstep(VEG_MOIST_HI, 1, moisture[i]));

      // spread term: pull from the greenest neighbour
      let maxN = 0;
      if (x > 0 && vegetation[i - 1] > maxN) maxN = vegetation[i - 1];
      if (x < cols - 1 && vegetation[i + 1] > maxN) maxN = vegetation[i + 1];
      if (y > 0 && vegetation[i - cols] > maxN) maxN = vegetation[i - cols];
      if (y < rows - 1 && vegetation[i + cols] > maxN) maxN = vegetation[i + cols];

      let nv = v + grow * fertility * (1 - v); // logistic
      nv += spread * fertility * maxN * (1 - v);
      vegetation[i] = nv > 1 ? 1 : nv;
    }
  }
}
