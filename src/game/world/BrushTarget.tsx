import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, type Mesh, type MeshBasicMaterial, Plane, Vector2, Vector3 } from 'three';
import type { WorldEngine } from './WorldEngine';
import type { BrushInput } from './brushInput';
import { surfaceY, worldToGrid } from './worldCoords';
import { BRUSHES, BRUSH_TINT, type BrushKind } from './brushes';
import { CELL } from './constants';

interface Props {
  engine: WorldEngine;
  input: React.MutableRefObject<BrushInput>;
}

/**
 * Projects the (hand or mouse) cursor into the 3D world: raycasts the pointer
 * against the ground plane to a grid cell, drives the engine's grid-space held
 * brush, and shows a tinted ring on the surface. Disables OrbitControls while a
 * brush is held so dragging paints instead of orbiting.
 */
export function BrushTarget({ engine, input }: Props) {
  const ringRef = useRef<Mesh>(null);
  const { camera, raycaster, size } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useThree((s) => s.controls) as any;

  const ground = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const ndc = useMemo(() => new Vector2(), []);
  const hit = useMemo(() => new Vector3(), []);
  const tint = useMemo(() => new Color(), []);

  useFrame(() => {
    const inp = input.current;
    const active = inp.storm || inp.mouseActive || inp.handActive;
    if (controls) controls.enabled = !active;

    if (!active) {
      engine.clearBrush();
      if (ringRef.current) ringRef.current.visible = false;
      return;
    }

    // pointer → NDC (storm uses its normalized centre, else the px cursor)
    if (inp.storm) {
      ndc.set(inp.stormCx * 2 - 1, -(inp.stormCy * 2 - 1));
    } else {
      ndc.set((inp.px / size.width) * 2 - 1, -((inp.py / size.height) * 2 - 1));
    }
    raycaster.setFromCamera(ndc, camera);
    const p = raycaster.ray.intersectPlane(ground, hit);
    if (!p) {
      if (ringRef.current) ringRef.current.visible = false;
      return;
    }

    const [gx, gy] = worldToGrid(engine, p.x, p.z);
    const kind: BrushKind = inp.storm ? 'storm' : inp.mouseActive ? inp.mouseKind : inp.handKind;
    if (kind === 'none') {
      engine.clearBrush();
      if (ringRef.current) ringRef.current.visible = false;
      return;
    }
    engine.setBrush(kind, gx, gy);

    const ring = ringRef.current;
    if (ring) {
      ring.visible = true;
      ring.position.set(p.x, surfaceY(engine, gx, gy) + 0.02, p.z);
      const r = BRUSHES[kind].radius * CELL;
      ring.scale.setScalar(Math.max(0.1, r));
      tint.set(BRUSH_TINT[kind]);
      (ring.material as MeshBasicMaterial).color.copy(tint);
    }
  });

  return (
    <mesh ref={ringRef} rotation-x={-Math.PI / 2} visible={false}>
      <ringGeometry args={[0.82, 1, 40]} />
      <meshBasicMaterial transparent opacity={0.85} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
