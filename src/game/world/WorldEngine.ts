import { createWorldState, forEachCellInDisk, seedWorld, type WorldState } from './WorldState';
import { stepWater } from './simulation/water';
import { stepLava } from './simulation/lava';
import { stepThermal } from './simulation/thermal';
import { stepMoisture, stepVegetation } from './simulation/vegetation';
import { BRUSHES, type BrushKind } from './brushes';
import { GRID, MAX_STEPS, RAIN_TO_MOIST, SIM_DT, type Quality } from './constants';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Visual-effect hooks. The renderer registers these via `setEffects`; the
 * engine fires them with GRID-space coordinates (cell units) + cell radii so it
 * stays renderer-agnostic. The renderer maps cells → world/screen space itself.
 */
export interface WorldEffects {
  onSteam?: (gx: number, gy: number, amount: number) => void;
  onSpark?: (gx: number, gy: number, count: number) => void;
  onCloud?: (gx: number, gy: number, radiusCells: number) => void;
  onRain?: (gx: number, gy: number, radiusCells: number, drops: number) => void;
  onLightning?: (intensity: number) => void;
}

/**
 * Pure simulation driver — owns the world grids and the fixed-timestep stepping,
 * and nothing else. No renderer, no canvas, no DOM. The R3F scene owns the clock
 * (`tick` is called from useFrame), reads `state` each frame to build the GPU
 * scene, and supplies `setEffects` callbacks for particle bursts.
 *
 * Brushes are addressed in GRID coordinates (cell units); the scene raycasts the
 * cursor to a cell and calls `setBrush/moveBrush`. Held brushes deposit a little
 * each sim tick, so the world reacts smoothly even if input stutters.
 */
export class WorldEngine {
  readonly state: WorldState;
  /** Bumped whenever a sim step ran — lets the renderer gate texture uploads. */
  version = 0;

  private acc = 0;
  private clock = 0; // ms, advanced by tick()
  private fx: WorldEffects = {};

  // held-brush state (GRID coordinates / cells)
  private brush: BrushKind = 'none';
  private bgx = 0;
  private bgy = 0;
  private bRadiusCells = 6;
  private cooldowns: Partial<Record<BrushKind, number>> = {};

  constructor(quality: Quality) {
    const { cols, rows } = GRID[quality];
    this.state = createWorldState(cols, rows);
  }

  setEffects(fx: WorldEffects): void {
    this.fx = fx;
  }

  reset(): void {
    seedWorld(this.state);
    this.version++;
  }

  // ── fixed-timestep stepping (driven by the scene's useFrame) ──
  tick(deltaMS: number): void {
    let elapsed = deltaMS / 1000;
    if (elapsed > 0.25) elapsed = 0.25; // tab-switch clamp
    this.clock += deltaMS;
    this.acc += elapsed;

    let steps = 0;
    while (this.acc >= SIM_DT && steps < MAX_STEPS) {
      this.applyHeldBrush();
      stepWater(this.state, SIM_DT);
      stepLava(this.state, SIM_DT);
      stepThermal(this.state, SIM_DT, (gx, gy, amount) => this.fx.onSteam?.(gx, gy, amount));
      stepMoisture(this.state, SIM_DT);
      stepVegetation(this.state, SIM_DT);
      this.acc -= SIM_DT;
      steps++;
    }
    if (steps > 0) this.version++;
  }

  // ── brush input (GRID coordinates) ──────────────────────────
  setBrush(kind: BrushKind, gx: number, gy: number, radiusCells?: number): void {
    this.brush = kind;
    this.bgx = gx;
    this.bgy = gy;
    if (radiusCells != null) this.bRadiusCells = radiusCells;
    else if (kind !== 'none') this.bRadiusCells = BRUSHES[kind].radius;
  }
  moveBrush(gx: number, gy: number): void {
    this.bgx = gx;
    this.bgy = gy;
  }
  clearBrush(): void {
    this.brush = 'none';
  }
  get activeBrush(): BrushKind {
    return this.brush;
  }

  private ready(kind: BrushKind): boolean {
    const cd = BRUSHES[kind as Exclude<BrushKind, 'none'>]?.cooldownMs ?? 0;
    if (cd <= 0) return true;
    const next = this.cooldowns[kind] ?? 0;
    if (this.clock < next) return false;
    this.cooldowns[kind] = this.clock + cd;
    return true;
  }

  private applyHeldBrush(): void {
    if (this.brush === 'none') return;
    const gx = this.bgx;
    const gy = this.bgy;
    const gr = this.bRadiusCells;
    const spec = BRUSHES[this.brush as Exclude<BrushKind, 'none'>];
    switch (this.brush) {
      case 'raise':
        this.raiseLand(gx, gy, gr, spec.strength);
        break;
      case 'dig':
        this.digTerrain(gx, gy, gr, spec.strength);
        break;
      case 'forest':
        this.plantForest(gx, gy, gr, spec.strength);
        break;
      case 'volcano':
        if (this.ready('volcano')) this.eruptVolcano(gx, gy, gr, spec.strength);
        break;
      case 'rain':
        if (this.ready('rain')) this.fx.onRain?.(gx, gy, gr, 7);
        break;
      case 'storm':
        if (this.ready('storm')) {
          this.fx.onCloud?.(gx, gy, gr);
          this.fx.onRain?.(gx, gy, gr, 18);
          this.fx.onLightning?.(0.55 + Math.random() * 0.35);
        }
        break;
    }
  }

  // ── world-shaping operations (grid space) ────────────────────
  raiseLand(gx: number, gy: number, gr: number, strength: number): void {
    const h = this.state.height;
    forEachCellInDisk(this.state, gx, gy, gr, (i, f) => {
      h[i] = clamp01(h[i] + strength * f);
    });
  }

  digTerrain(gx: number, gy: number, gr: number, strength: number): void {
    const { height, water } = this.state;
    forEachCellInDisk(this.state, gx, gy, gr, (i, f) => {
      height[i] = clamp01(height[i] - strength * f);
      // seed a little water so dug basins read as lakes, then flow takes over
      water[i] = clamp01(water[i] + strength * f * 0.5);
    });
  }

  plantForest(gx: number, gy: number, gr: number, strength: number): void {
    const { vegetation, moisture } = this.state;
    forEachCellInDisk(this.state, gx, gy, gr, (i, f) => {
      vegetation[i] = clamp01(vegetation[i] + strength * f * SIM_DT * 4);
      moisture[i] = clamp01(moisture[i] + 0.25 * f);
    });
  }

  eruptVolcano(gx: number, gy: number, gr: number, strength: number): void {
    const { lava, temp } = this.state;
    forEachCellInDisk(this.state, gx, gy, gr, (i, f) => {
      lava[i] = clamp01(lava[i] + strength * f);
      temp[i] = 1;
    });
    this.fx.onSpark?.(gx, gy, 5);
  }

  /** Add water + moisture where a rain drop lands (grid coords). */
  rainLand(gx: number, gy: number): void {
    const x = Math.floor(gx);
    const y = Math.floor(gy);
    if (x < 0 || y < 0 || x >= this.state.cols || y >= this.state.rows) return;
    const i = y * this.state.cols + x;
    this.state.water[i] = clamp01(this.state.water[i] + 0.06);
    this.state.moisture[i] = clamp01(this.state.moisture[i] + RAIN_TO_MOIST);
  }
}
