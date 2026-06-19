/**
 * Element Creator simulation constants. All tuning lives here so the world can
 * be balanced from one place. "Per-tick" fractions assume a fixed SIM_DT; the
 * slow processes (evaporation, growth, cooling) are scaled by dt in seconds.
 */

export type Quality = 'low' | 'med' | 'high';

/** Simulation grid sizes (decoupled from canvas/DPR — only the blit scales). */
export const GRID: Record<Quality, { cols: number; rows: number }> = {
  low: { cols: 160, rows: 90 },
  med: { cols: 192, rows: 108 },
  high: { cols: 256, rows: 144 },
};
export const DEFAULT_QUALITY: Quality = 'med';

// ── loop ───────────────────────────────────────────────────────
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ; // seconds per sim tick
export const MAX_STEPS = 5; // anti spiral-of-death after a tab switch

// ── water ──────────────────────────────────────────────────────
export const WATER_EPS = 1e-4;
export const FLOW_FRACTION = 0.45; // per-tick share of the height delta to move
export const FLOW_DAMP = 0.5; // never move more than half a column (stability)
export const EVAP_RATE = 0.02; // per-second evaporation of standing water
export const EROSION_RATE = 0.04; // per-second terrain carved by fast flow
export const EROSION_MIN_FLOW = 0.015; // outflow below this doesn't erode

// ── moisture ───────────────────────────────────────────────────
export const WATER_TO_MOIST = 1.5; // per-second moisture gained under water
export const RAIN_TO_MOIST = 0.4; // moisture added where a raindrop lands
export const MOIST_DIFFUSE = 0.12; // per-tick neighbour averaging
export const MOIST_DECAY = 0.03; // per-second drying

// ── vegetation ─────────────────────────────────────────────────
export const VEG_GROW = 0.6; // per-second logistic growth
export const VEG_SPREAD = 0.25; // per-second spread from greener neighbours
export const VEG_DIE = 0.9; // per-second die-back when drowned/burnt
export const VEG_DROWN = 0.05; // water depth that drowns vegetation
export const VEG_BURN = 0.45; // temperature that burns vegetation
export const VEG_MOIST_LO = 0.22; // moisture band where forest thrives
export const VEG_MOIST_HI = 0.75;

// ── lava / thermal ─────────────────────────────────────────────
export const LAVA_EPS = 1e-3;
export const LAVA_FLOW_FRACTION = 0.18; // viscous: slower than water
export const LAVA_HOT = 0.02; // lava depth that counts as "hot"
export const AMBIENT_TEMP = 0;
export const COOL_RATE = 0.5; // per-second cooling toward ambient
export const REACT_RATE = 2.0; // per-second lava↔water steam reaction
export const ROCK_YIELD = 0.7; // fraction of reacted material that becomes land
export const SOLIDIFY_TEMP = 0.22; // cool lava below this turns to rock

// ── two-hand storm detection ───────────────────────────────────
export const STORM_SPREAD_MIN = 0.42; // normalized palm-to-palm distance
export const STORM_HYST = 4; // frames the spread must hold before firing

// ── 3D world units (react-three-fiber renderer) ────────────────
export const CELL = 0.1; // world units per grid cell (plane ≈ cols*CELL wide)
export const HEIGHT_SCALE = 3.0; // world Y per height unit (0..1 → 0..3)
export const WATER_RENDER_EPS = 0.004; // below this depth, no water surface is drawn
export const VEG_THRESHOLD = 0.3; // vegetation level at which a tree instance appears
export const MAX_TREES = 1500; // instance cap (stride-sampled beyond)
export const TREE_UPDATE_HZ = 4; // how often tree instances are rebuilt

// ── day / night cycle ──────────────────────────────────────────
export const SUN_PERIOD = 90; // seconds for a full sun orbit (day→night→day)
export const SUN_MAX_INTENSITY = 2.6; // directional light intensity at noon
export const LAVA_GLOW_DAY = 0.9; // emissive multiplier in daylight
export const LAVA_GLOW_NIGHT = 2.6; // emissive multiplier at night (lava pops)
export const NIGHT_SKY = 0x0b1020; // background/fog at night (matches old bg)
export const DAY_SKY = 0x9ec7ff; // background/fog at midday
