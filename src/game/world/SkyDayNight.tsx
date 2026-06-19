import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import { Color, type DirectionalLight, type Group, type PointLight, Vector3 } from 'three';
import type { WorldEngine } from './WorldEngine';
import type { DayNight } from './worldCoords';
import { planeSize } from './worldCoords';
import {
  DAY_SKY,
  LAVA_GLOW_DAY,
  LAVA_GLOW_NIGHT,
  NIGHT_SKY,
  SUN_MAX_INTENSITY,
  SUN_PERIOD,
} from './constants';

interface Props {
  engine: WorldEngine;
  dayNight: React.MutableRefObject<DayNight>;
  flash: React.MutableRefObject<number>;
  shadows?: boolean;
  shadowMapSize?: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Day/night cycle: a directional "sun" orbiting overhead (casting shadows),
 * drei <Sky> + <Stars>, and ambient/hemisphere fill. Writes shared day/night
 * state (sun direction, elevation, lava-emissive multiplier) each frame and
 * lerps the scene background day→night. Also drives the lightning flash light.
 */
export function SkyDayNight({ engine, dayNight, flash, shadows = true, shadowMapSize = 1024 }: Props) {
  const sunRef = useRef<DirectionalLight>(null);
  const starsRef = useRef<Group>(null);
  const flashRef = useRef<PointLight>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skyRef = useRef<any>(null);
  const t = useRef(SUN_PERIOD * 0.18); // start mid-morning
  const scene = useThree((s) => s.scene);

  const { w, h } = planeSize(engine);
  const R = Math.max(w, h) * 1.4;
  const span = Math.max(w, h) * 0.62;
  const sunDir = useMemo(() => new Vector3(), []);
  const dayColor = useMemo(() => new Color(DAY_SKY), []);
  const nightColor = useMemo(() => new Color(NIGHT_SKY), []);
  const bg = useMemo(() => new Color(), []);

  useFrame((_, delta) => {
    t.current += delta;
    const angle = (t.current / SUN_PERIOD) * Math.PI * 2;
    const sx = Math.cos(angle) * R;
    const sy = Math.sin(angle) * R;
    const sz = 0.45 * R;
    sunDir.set(sx, sy, sz).normalize();
    const elevation = sunDir.y;

    if (sunRef.current) {
      sunRef.current.position.set(sx, sy, sz);
      sunRef.current.intensity = smoothstep(-0.1, 0.25, elevation) * SUN_MAX_INTENSITY;
      sunRef.current.color.setRGB(1, 0.9 + elevation * 0.1, 0.78 + Math.max(0, elevation) * 0.22);
    }
    if (skyRef.current?.material?.uniforms?.sunPosition) {
      skyRef.current.material.uniforms.sunPosition.value.copy(sunDir);
    }
    if (starsRef.current) {
      starsRef.current.visible = elevation < 0.08;
    }

    // shared state for terrain/water shaders
    const dn = dayNight.current;
    dn.elevation = elevation;
    dn.sunDir.copy(sunDir);
    dn.lavaEmissive = LAVA_GLOW_NIGHT + (LAVA_GLOW_DAY - LAVA_GLOW_NIGHT) * smoothstep(0, 0.3, elevation);

    // background day → night
    const day = smoothstep(-0.15, 0.2, elevation);
    bg.copy(nightColor).lerp(dayColor, day);
    scene.background = bg;

    // lightning flash decay
    if (flashRef.current) {
      if (flash.current > 0) flash.current = Math.max(0, flash.current - delta * 3.5);
      flashRef.current.intensity = flash.current * 40;
    }
  });

  return (
    <>
      <Sky ref={skyRef} distance={450000} sunPosition={[1, 0.4, 0.45]} turbidity={6} rayleigh={2} />
      <group ref={starsRef}>
        <Stars radius={80} depth={40} count={1800} factor={3} saturation={0} fade speed={0.6} />
      </group>

      <directionalLight
        ref={sunRef}
        castShadow={shadows}
        intensity={SUN_MAX_INTENSITY}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={0.1}
        shadow-camera-far={R * 3}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={[0x9fc4ff, 0x36302a, 0.5]} />
      <ambientLight intensity={0.18} />
      <pointLight ref={flashRef} position={[0, R * 0.5, 0]} color={0xcfe0ff} intensity={0} distance={R * 4} />
    </>
  );
}
