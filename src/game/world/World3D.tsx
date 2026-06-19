import { useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { WorldEngine } from './WorldEngine';
import type { BrushInput } from './brushInput';
import type { DayNight } from './worldCoords';
import { planeSize } from './worldCoords';
import { useWorldTextures } from './useWorldTextures';
import { Terrain } from './Terrain';
import { Water } from './Water';
import { Trees } from './Trees';
import { Particles3D } from './Particles3D';
import { SkyDayNight } from './SkyDayNight';
import { BrushTarget } from './BrushTarget';
import { PostFX } from './PostFX';
import { HEIGHT_SCALE, LAVA_GLOW_DAY, type Quality } from './constants';

interface Props {
  engine: WorldEngine;
  input: React.MutableRefObject<BrushInput>;
  quality: Quality;
}

/**
 * Scene root. Owns the single sim-driving useFrame (renderPriority -1 so the sim
 * steps before child components read `state`), gates texture re-uploads on the
 * engine's version counter, and composes terrain/water/trees/particles/sky/post.
 */
export function World3D({ engine, input, quality }: Props) {
  const textures = useWorldTextures(engine);
  const dayNight = useRef<DayNight>({ lavaEmissive: LAVA_GLOW_DAY, elevation: 1, sunDir: new Vector3(0, 1, 0) });
  const flash = useRef(0);
  const lastVersion = useRef(-1);

  const { w, h } = planeSize(engine);

  useFrame((_, delta) => {
    engine.tick(delta * 1000);
    if (engine.version !== lastVersion.current) {
      lastVersion.current = engine.version;
      textures.update();
    }
  }, -1);

  const onLightning = useCallback((i: number) => {
    flash.current = Math.max(flash.current, i);
  }, []);

  const shadows = quality !== 'low';
  const treeShadows = quality === 'high';
  const shadowMapSize = quality === 'high' ? 2048 : 1024;
  const midY = HEIGHT_SCALE * 0.4;

  return (
    <>
      <SkyDayNight
        engine={engine}
        dayNight={dayNight}
        flash={flash}
        shadows={shadows}
        shadowMapSize={shadowMapSize}
      />
      <Terrain engine={engine} textures={textures} dayNight={dayNight} />
      <Water engine={engine} textures={textures} />
      <Trees engine={engine} castShadow={treeShadows} />
      <Particles3D engine={engine} onLightning={onLightning} />
      <BrushTarget engine={engine} input={input} />
      <PostFX quality={quality} />
      <OrbitControls
        makeDefault
        enableDamping
        autoRotate
        autoRotateSpeed={0.35}
        target={[0, midY, 0]}
        minDistance={Math.max(w, h) * 0.4}
        maxDistance={Math.max(w, h) * 1.8}
        minPolarAngle={0.15}
        maxPolarAngle={1.45}
      />
    </>
  );
}
