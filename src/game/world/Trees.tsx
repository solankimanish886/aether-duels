import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, ConeGeometry, MeshStandardMaterial, Object3D, type InstancedMesh } from 'three';
import type { WorldEngine } from './WorldEngine';
import { gridToWorld, surfaceY } from './worldCoords';
import { MAX_TREES, TREE_UPDATE_HZ, VEG_THRESHOLD } from './constants';

interface Props {
  engine: WorldEngine;
  castShadow?: boolean;
}

const TREE_H = 0.2;
const dummy = /* reused */ new Object3D();
const tmpColor = new Color();

/**
 * Forest as a single InstancedMesh of small cones placed where vegetation
 * exceeds a threshold. Rebuilt a few times a second (not every frame) with
 * stable per-cell jitter so trees don't twitch. Stride-samples beyond MAX_TREES.
 */
export function Trees({ engine, castShadow = true }: Props) {
  const ref = useRef<InstancedMesh>(null);
  const acc = useRef(0);

  const geometry = useMemo(() => new ConeGeometry(0.06, TREE_H, 6), []);
  const material = useMemo(
    () => new MeshStandardMaterial({ roughness: 0.85, metalness: 0, vertexColors: false }),
    [],
  );

  const rebuild = () => {
    const mesh = ref.current;
    if (!mesh) return;
    const s = engine.state;
    const { vegetation, n } = s;
    // count candidate cells; stride-sample if more than the cap
    let candidates = 0;
    for (let i = 0; i < n; i++) if (vegetation[i] > VEG_THRESHOLD) candidates++;
    const stride = candidates > MAX_TREES ? Math.ceil(candidates / MAX_TREES) : 1;

    let count = 0;
    let seen = 0;
    for (let i = 0; i < n && count < MAX_TREES; i++) {
      const veg = vegetation[i];
      if (veg <= VEG_THRESHOLD) continue;
      if (seen++ % stride !== 0) continue;
      const gx = i % s.cols;
      const gy = (i / s.cols) | 0;
      // deterministic jitter from cell index (no per-frame randomness → no twitch)
      const jx = ((i * 1103515245 + 12345) & 0xff) / 255 - 0.5;
      const jy = ((i * 1664525 + 1013904223) & 0xff) / 255 - 0.5;
      const scale = 0.6 + veg * 0.9;
      const [wx, , wz] = gridToWorld(engine, gx + 0.5 + jx * 0.6, gy + 0.5 + jy * 0.6);
      const wy = surfaceY(engine, gx, gy) + (TREE_H * scale) / 2;
      dummy.position.set(wx, wy, wz);
      dummy.scale.setScalar(scale);
      dummy.rotation.set(0, (jx + jy) * 3.14, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(count, dummy.matrix);
      // greener (darker) where denser
      tmpColor.setRGB(0.13 + (1 - veg) * 0.25, 0.42 + veg * 0.2, 0.16);
      mesh.setColorAt(count, tmpColor);
      count++;
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current >= 1 / TREE_UPDATE_HZ) {
      acc.current = 0;
      rebuild();
    }
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, MAX_TREES]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
    />
  );
}
