import { Component, type ReactNode, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { NoToneMapping, type Vector3Tuple } from 'three';
import type { WorldEngine } from './WorldEngine';
import type { BrushInput } from './brushInput';
import { World3D } from './World3D';
import { planeSize } from './worldCoords';
import type { Quality } from './constants';
import './WorldCanvas.css';

interface Props {
  engine: WorldEngine;
  input: React.MutableRefObject<BrushInput>;
  quality: Quality;
  onError?: (message: string) => void;
}

/** Catches WebGL/shader-compile failures so the screen shows a friendly message. */
class GLErrorBoundary extends Component<{ onError?: (m: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    this.props.onError?.(err instanceof Error ? err.message : 'webgl-unavailable');
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Mounts the react-three-fiber canvas and 3D world. The engine + shared brush
 * input are created by the screen and passed in; this component only owns the
 * GPU canvas lifecycle (R3F disposes the context on unmount).
 */
export function WorldCanvas({ engine, input, quality, onError }: Props) {
  const { w, h } = planeSize(engine);
  const camPos = useMemo<Vector3Tuple>(() => {
    const d = Math.max(w, h);
    return [0, d * 0.72, d * 0.78];
  }, [w, h]);

  return (
    <div className="world-host">
      <GLErrorBoundary onError={onError}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: camPos, fov: 45, near: 0.05, far: 1000 }}
          gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: NoToneMapping }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener(
              'webglcontextlost',
              () => onError?.('webgl-context-lost'),
              { once: true },
            );
          }}
        >
          <World3D engine={engine} input={input} quality={quality} />
        </Canvas>
      </GLErrorBoundary>
    </div>
  );
}
