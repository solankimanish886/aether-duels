import { createNoise2D } from 'simplex-noise';

/**
 * The world's simulation state: a fixed-size grid held as Structure-of-Arrays
 * (one flat typed array per field, indexed `y * cols + x`). Allocated once and
 * mutated in place — the per-tick step functions never allocate. Renderer-
 * agnostic: nothing here imports Pixi.
 */
export interface WorldState {
  cols: number;
  rows: number;
  n: number;
  height: Float32Array; // terrain elevation 0..1
  water: Float32Array; // water depth above terrain
  waterNew: Float32Array; // double-buffer for flow (ping-pong)
  lava: Float32Array; // lava depth
  lavaNew: Float32Array;
  temp: Float32Array; // 0..1, lava heats / water+air cools
  moisture: Float32Array; // 0..1, drives forest growth
  vegetation: Float32Array; // 0..1 forest density
  rock: Uint8Array; // 1 where lava solidified into fresh rock (cosmetic)
}

export function createWorldState(cols: number, rows: number): WorldState {
  const n = cols * rows;
  const s: WorldState = {
    cols,
    rows,
    n,
    height: new Float32Array(n),
    water: new Float32Array(n),
    waterNew: new Float32Array(n),
    lava: new Float32Array(n),
    lavaNew: new Float32Array(n),
    temp: new Float32Array(n),
    moisture: new Float32Array(n),
    vegetation: new Float32Array(n),
    rock: new Uint8Array(n),
  };
  seedWorld(s);
  return s;
}

/** Reset to a fresh world: gentle simplex relief, dry, with a little starter grass. */
export function seedWorld(s: WorldState): void {
  const noise = createNoise2D();
  const { cols, rows } = s;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      // two octaves of value noise, normalized to 0..1, kept low so the player
      // does most of the shaping.
      const nx = x / cols;
      const ny = y / rows;
      let h = 0.5 * noise(nx * 3, ny * 3) + 0.25 * noise(nx * 7, ny * 7);
      h = 0.32 + h * 0.18; // bias to gentle lowlands
      s.height[i] = Math.max(0, Math.min(1, h));
      s.water[i] = 0;
      s.lava[i] = 0;
      s.temp[i] = 0;
      s.moisture[i] = 0.12;
      s.vegetation[i] = 0;
      s.rock[i] = 0;
    }
  }
  s.waterNew.set(s.water);
  s.lavaNew.set(s.lava);
}

export const idx = (s: WorldState, x: number, y: number) => y * s.cols + x;

/** Swap a field with its `*New` double-buffer (reference swap, no copy). */
export function swap(s: WorldState, a: 'water' | 'lava'): void {
  if (a === 'water') {
    const t = s.water;
    s.water = s.waterNew;
    s.waterNew = t;
  } else {
    const t = s.lava;
    s.lava = s.lavaNew;
    s.lavaNew = t;
  }
}

/**
 * Visit every cell within a disk of grid radius `gr` around (gx, gy), passing a
 * smooth 0..1 falloff (1 at centre → 0 at the edge). Used by brush stamps.
 */
export function forEachCellInDisk(
  s: WorldState,
  gx: number,
  gy: number,
  gr: number,
  fn: (i: number, falloff: number) => void,
): void {
  const r = Math.max(1, gr);
  const x0 = Math.max(0, Math.floor(gx - r));
  const x1 = Math.min(s.cols - 1, Math.ceil(gx + r));
  const y0 = Math.max(0, Math.floor(gy - r));
  const y1 = Math.min(s.rows - 1, Math.ceil(gy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - gx;
      const dy = y - gy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      // smoothstep falloff on normalized distance
      const t = 1 - Math.sqrt(d2) / r;
      const falloff = t * t * (3 - 2 * t);
      fn(y * s.cols + x, falloff);
    }
  }
}
