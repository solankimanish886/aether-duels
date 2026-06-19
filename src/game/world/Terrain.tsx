import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, MeshStandardMaterial, PlaneGeometry, type IUniform, type Mesh } from 'three';
import type { WorldEngine } from './WorldEngine';
import type { WorldTextures } from './useWorldTextures';
import type { DayNight } from './worldCoords';
import { planeSize } from './worldCoords';
import { CELL, HEIGHT_SCALE, LAVA_GLOW_DAY } from './constants';
import {
  TERRAIN_BEGINNORMAL,
  TERRAIN_BEGIN_VERTEX,
  TERRAIN_EMISSIVE_FRAGMENT,
  TERRAIN_MAP_FRAGMENT,
  TERRAIN_PARS_FRAGMENT,
  TERRAIN_PARS_VERTEX,
} from './shaders/terrain.glsl';

interface Props {
  engine: WorldEngine;
  textures: WorldTextures;
  dayNight: React.MutableRefObject<DayNight>;
}

/**
 * The terrain surface: a plane GPU-displaced by the world's height texture,
 * with normals recomputed in-shader so the sun lights/shadows real relief, and
 * the paintTerrain colour ramp + lava emissive ported into the fragment shader.
 */
export function Terrain({ engine, textures, dayNight }: Props) {
  const meshRef = useRef<Mesh>(null);
  const lavaUniform = useRef<IUniform | null>(null);

  const { w, h } = planeSize(engine);
  const { cols, rows } = engine.state;

  const geometry = useMemo(() => new PlaneGeometry(w, h, cols - 1, rows - 1), [w, h, cols, rows]);

  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({ roughness: 0.96, metalness: 0.0, side: DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uData = { value: textures.dataTex };
      shader.uniforms.uAux = { value: textures.auxTex };
      shader.uniforms.uTexel = { value: textures.uTexel };
      shader.uniforms.uHeightScale = { value: HEIGHT_SCALE };
      shader.uniforms.uCell = { value: CELL };
      shader.uniforms.uLavaEmissive = { value: LAVA_GLOW_DAY };
      lavaUniform.current = shader.uniforms.uLavaEmissive;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + TERRAIN_PARS_VERTEX)
        .replace('#include <beginnormal_vertex>', TERRAIN_BEGINNORMAL)
        .replace('#include <begin_vertex>', TERRAIN_BEGIN_VERTEX);

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + TERRAIN_PARS_FRAGMENT)
        .replace('#include <map_fragment>', TERRAIN_MAP_FRAGMENT)
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n' + TERRAIN_EMISSIVE_FRAGMENT,
        );
    };
    return mat;
    // textures are stable for the engine's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textures]);

  useFrame(() => {
    if (lavaUniform.current) lavaUniform.current.value = dayNight.current.lavaEmissive;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation-x={-Math.PI / 2}
      receiveShadow
    />
  );
}
