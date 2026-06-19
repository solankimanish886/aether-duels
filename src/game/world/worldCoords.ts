import type { Vector3 } from 'three';
import { CELL, HEIGHT_SCALE } from './constants';
import type { WorldEngine } from './WorldEngine';

/** Shared day/night state, written by SkyDayNight, read by Terrain/Water/Sky. */
export interface DayNight {
  /** lava emissive multiplier (rises at night). */
  lavaEmissive: number;
  /** sun elevation, ~ -1..1 (>0 day, <0 night). */
  elevation: number;
  /** normalized sun direction. */
  sunDir: Vector3;
}

/** Plane dimensions in world units (centred on the origin). */
export function planeSize(engine: WorldEngine): { w: number; h: number } {
  return { w: engine.state.cols * CELL, h: engine.state.rows * CELL };
}

/** Grid cell (gx,gy, fractional) → world [x,y,z]. gy=0 is +Z, increasing gy → -Z. */
export function gridToWorld(engine: WorldEngine, gx: number, gy: number, y = 0): [number, number, number] {
  const { cols, rows } = engine.state;
  return [(gx / cols - 0.5) * cols * CELL, y, (0.5 - gy / rows) * rows * CELL];
}

/** World (x,z) → fractional grid cell (gx,gy). Inverse of gridToWorld. */
export function worldToGrid(engine: WorldEngine, x: number, z: number): [number, number] {
  const { cols, rows } = engine.state;
  return [(x / (cols * CELL) + 0.5) * cols, (0.5 - z / (rows * CELL)) * rows];
}

/** World-space surface height (Y) at a grid cell. */
export function surfaceY(engine: WorldEngine, gx: number, gy: number): number {
  const { cols, rows, height, water, lava } = engine.state;
  const x = Math.min(cols - 1, Math.max(0, Math.floor(gx)));
  const y = Math.min(rows - 1, Math.max(0, Math.floor(gy)));
  const i = y * cols + x;
  return (height[i] + water[i] + lava[i]) * HEIGHT_SCALE;
}
