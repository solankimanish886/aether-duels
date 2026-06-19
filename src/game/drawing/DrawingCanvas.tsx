import { useEffect, useRef } from 'react';
import { DrawingEngine } from './DrawingEngine';
import type { EngineCallbacks } from './types';
import './DrawingCanvas.css';

interface Props {
  /** Called once the engine is constructed and attached. */
  onReady: (engine: DrawingEngine) => void;
  callbacks?: EngineCallbacks;
  /** Emit brush sparkle particles while drawing (default true). */
  sparkles?: boolean;
}

/** Mounts the three stacked canvas layers and owns the DrawingEngine lifecycle. */
export function DrawingCanvas({ onReady, callbacks, sparkles = true }: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!mainRef.current || !activeRef.current || !cursorRef.current) return;

    const spawnSpark = (x: number, y: number, color: string) => {
      const host = surfaceRef.current;
      if (!host) return;
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'brush-spark';
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 13;
        el.style.cssText = `left:${Math.round(x)}px;top:${Math.round(y)}px;background:${color};--sdx:${(Math.cos(angle) * dist).toFixed(1)}px;--sdy:${(Math.sin(angle) * dist).toFixed(1)}px`;
        host.appendChild(el);
        el.addEventListener('animationend', () => el.remove(), { once: true });
      }
    };

    const merged: EngineCallbacks = {
      ...callbacks,
      onSpark: (x, y, color) => {
        if (sparkles) spawnSpark(x, y, color);
        callbacks?.onSpark?.(x, y, color);
      },
    };

    const engine = new DrawingEngine(
      { main: mainRef.current, active: activeRef.current, cursor: cursorRef.current },
      merged,
    );
    onReady(engine);
    return () => engine.destroy();
    // Engine is created once; callbacks captured at mount (stable for our usage).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="draw-surface" ref={surfaceRef}>
      <canvas ref={mainRef} className="draw-layer draw-main" />
      <canvas ref={activeRef} className="draw-layer draw-active" />
      <canvas ref={cursorRef} className="draw-layer draw-cursor" />
    </div>
  );
}
