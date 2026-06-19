import type { WorldState } from '../WorldState';
import {
  AMBIENT_TEMP,
  COOL_RATE,
  LAVA_HOT,
  REACT_RATE,
  ROCK_YIELD,
  SOLIDIFY_TEMP,
  WATER_EPS,
} from '../constants';

/** Reports where lava met water this tick, so the renderer can puff steam. */
export type SteamSink = (gx: number, gy: number, amount: number) => void;

/**
 * Temperature, lava cooling, and the signature lava↔water interaction. Runs
 * after water and lava have moved so it reacts to their final positions:
 *  - lava heats its cell; everything cools toward ambient.
 *  - lava + water → consume both, raise terrain (new rock), emit steam.
 *  - lava that cools on cold/wet ground solidifies into fresh land.
 */
export function stepThermal(s: WorldState, dt: number, onSteam?: SteamSink): void {
  const { cols, rows, height, water, lava, temp, rock } = s;
  const cool = COOL_RATE * dt;
  const react = REACT_RATE * dt;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const l = lava[i];

      // Heat from lava, otherwise cool toward ambient.
      if (l > LAVA_HOT) temp[i] = 1;
      else if (temp[i] > AMBIENT_TEMP) temp[i] = Math.max(AMBIENT_TEMP, temp[i] - cool);

      if (l <= 0) continue;

      // Lava meets water: hiss into steam and build a rock delta.
      const w = water[i];
      if (w > WATER_EPS) {
        const reacted = Math.min(l, w) * react;
        if (reacted > 0) {
          water[i] = Math.max(0, w - reacted);
          lava[i] = Math.max(0, l - reacted);
          height[i] = Math.min(1, height[i] + reacted * ROCK_YIELD);
          rock[i] = 1;
          onSteam?.(x, y, reacted);
        }
      }

      // Cool lava on cold/wet terrain solidifies into new land.
      if (lava[i] > 0 && temp[i] < SOLIDIFY_TEMP) {
        height[i] = Math.min(1, height[i] + lava[i] * ROCK_YIELD);
        lava[i] = 0;
        rock[i] = 1;
      }
    }
  }
}
