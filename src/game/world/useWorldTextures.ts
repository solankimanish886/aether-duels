import { useEffect, useMemo } from 'react';
import { ClampToEdgeWrapping, DataTexture, FloatType, LinearFilter, RGBAFormat } from 'three';
import type { WorldEngine } from './WorldEngine';

export interface WorldTextures {
  /** R=solid surface(height+lava), G=height, B=waterDepth, A=lava */
  dataTex: DataTexture;
  /** R=vegetation, G=temp, B=rock, A=0 */
  auxTex: DataTexture;
  uTexel: [number, number];
  /** Re-pack the grids into the textures and flag for re-upload. */
  update: () => void;
}

/**
 * Two shared float DataTextures the terrain and water shaders both sample.
 * Packed from the engine's typed-array grids. `update()` is called once per sim
 * step (gated on `engine.version` by World3D) — one repack + upload, not 60Hz.
 */
export function useWorldTextures(engine: WorldEngine): WorldTextures {
  const tex = useMemo<WorldTextures>(() => {
    const { cols, rows, n } = engine.state;
    const dataArr = new Float32Array(n * 4);
    const auxArr = new Float32Array(n * 4);
    const dataTex = new DataTexture(dataArr, cols, rows, RGBAFormat, FloatType);
    const auxTex = new DataTexture(auxArr, cols, rows, RGBAFormat, FloatType);
    for (const t of [dataTex, auxTex]) {
      t.minFilter = LinearFilter;
      t.magFilter = LinearFilter;
      t.wrapS = ClampToEdgeWrapping;
      t.wrapT = ClampToEdgeWrapping;
      t.needsUpdate = true;
    }
    const update = () => {
      const s = engine.state;
      const { height, water, lava, vegetation, temp, rock } = s;
      for (let i = 0; i < s.n; i++) {
        const o = i * 4;
        dataArr[o] = height[i] + lava[i]; // solid surface (terrain mesh follows this)
        dataArr[o + 1] = height[i];
        dataArr[o + 2] = water[i];
        dataArr[o + 3] = lava[i];
        auxArr[o] = vegetation[i];
        auxArr[o + 1] = temp[i];
        auxArr[o + 2] = rock[i];
        auxArr[o + 3] = 0;
      }
      dataTex.needsUpdate = true;
      auxTex.needsUpdate = true;
    };
    update();
    return { dataTex, auxTex, uTexel: [1 / cols, 1 / rows], update };
  }, [engine]);

  useEffect(
    () => () => {
      tex.dataTex.dispose();
      tex.auxTex.dispose();
    },
    [tex],
  );

  return tex;
}
