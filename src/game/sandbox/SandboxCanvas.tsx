import { useEffect, useRef } from 'react';
import { SandboxScene } from './SandboxScene';
import type { SandboxCallbacks } from './types';
import './sandbox-canvas.css';

interface Props {
  onReady: (scene: SandboxScene) => void;
  callbacks?: SandboxCallbacks;
  /** When false, pointer input is ignored (gesture-only / preview). */
  pointerInput?: boolean;
}

/** Mounts the three stacked canvas layers and owns the SandboxScene lifecycle. */
export function SandboxCanvas({ onReady, callbacks, pointerInput = true }: Props) {
  const mainRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!mainRef.current || !activeRef.current || !overlayRef.current) return;
    const scene = new SandboxScene(
      { main: mainRef.current, active: activeRef.current, overlay: overlayRef.current },
      callbacks ?? {},
    );
    onReady(scene);

    const surface = overlayRef.current;
    const local = (e: PointerEvent) => {
      const r = surface.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => {
      if (!pointerInput) return;
      surface.setPointerCapture(e.pointerId);
      const p = local(e);
      scene.pointerDown(p.x, p.y);
    };
    const onMove = (e: PointerEvent) => {
      if (!pointerInput) return;
      const p = local(e);
      scene.pointerMove(p.x, p.y);
    };
    const onUp = () => {
      if (!pointerInput) return;
      scene.pointerUp();
    };
    surface.addEventListener('pointerdown', onDown);
    surface.addEventListener('pointermove', onMove);
    surface.addEventListener('pointerup', onUp);
    surface.addEventListener('pointercancel', onUp);

    return () => {
      surface.removeEventListener('pointerdown', onDown);
      surface.removeEventListener('pointermove', onMove);
      surface.removeEventListener('pointerup', onUp);
      surface.removeEventListener('pointercancel', onUp);
      scene.destroy();
    };
    // Scene is created once; callbacks captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sandbox-surface">
      <canvas ref={mainRef} className="sb-layer sb-main" />
      <canvas ref={activeRef} className="sb-layer sb-active" />
      <canvas ref={overlayRef} className="sb-layer sb-overlay" />
    </div>
  );
}
