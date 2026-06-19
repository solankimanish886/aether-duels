import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial, PlaneGeometry, type IUniform } from 'three';
import type { WorldEngine } from './WorldEngine';
import type { WorldTextures } from './useWorldTextures';
import { planeSize } from './worldCoords';
import { CELL, HEIGHT_SCALE, WATER_RENDER_EPS } from './constants';
import {
  WATER_BEGINNORMAL,
  WATER_BEGIN_VERTEX,
  WATER_MAP_FRAGMENT,
  WATER_PARS_FRAGMENT,
  WATER_PARS_VERTEX,
} from './shaders/water.glsl';

interface Props {
  engine: WorldEngine;
  textures: WorldTextures;
}

/**
 * Transparent water surface sitting at solid+waterDepth, sharing the terrain's
 * data texture. Glossy (low roughness) so the sun glints; animated ripple
 * normals make the glint move. Discards where there is no water.
 */
export function Water({ engine, textures }: Props) {
  const timeUniform = useRef<IUniform | null>(null);
  const { w, h } = planeSize(engine);
  const { cols, rows } = engine.state;

  const geometry = useMemo(() => new PlaneGeometry(w, h, cols - 1, rows - 1), [w, h, cols, rows]);

  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      transparent: true,
      depthWrite: false,
      roughness: 0.08,
      metalness: 0.0,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uData = { value: textures.dataTex };
      shader.uniforms.uTexel = { value: textures.uTexel };
      shader.uniforms.uHeightScale = { value: HEIGHT_SCALE };
      shader.uniforms.uCell = { value: CELL };
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uWaterEps = { value: WATER_RENDER_EPS };
      timeUniform.current = shader.uniforms.uTime;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + WATER_PARS_VERTEX)
        .replace('#include <beginnormal_vertex>', WATER_BEGINNORMAL)
        .replace('#include <begin_vertex>', WATER_BEGIN_VERTEX);

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + WATER_PARS_FRAGMENT)
        .replace('#include <map_fragment>', WATER_MAP_FRAGMENT);
    };
    return mat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textures]);

  useFrame((_, delta) => {
    if (timeUniform.current) timeUniform.current.value += delta;
  });

  return (
    <mesh geometry={geometry} material={material} rotation-x={-Math.PI / 2} renderOrder={1} />
  );
}
