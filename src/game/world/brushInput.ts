import type { BrushKind } from './brushes';

/**
 * Shared, mutable input state written by both hand tracking (`useWorldBrushes`)
 * and the mouse fallback (`ElementCreator`), and read each frame by
 * `BrushTarget` (which raycasts it into a grid cell). Hand and mouse are tracked
 * independently so neither clobbers the other; storm (two-hand) overrides both.
 */
export interface BrushInput {
  /** pointer position in CSS px relative to the canvas (last writer wins). */
  px: number;
  py: number;
  /** hand-tracking source. */
  handActive: boolean;
  handKind: BrushKind;
  /** mouse-fallback source. */
  mouseActive: boolean;
  mouseKind: BrushKind;
  /** two-hand storm, overriding both sources. */
  storm: boolean;
  /** storm centre in normalized 0..1 canvas space. */
  stormCx: number;
  stormCy: number;
}

export const makeBrushInput = (): BrushInput => ({
  px: 0,
  py: 0,
  handActive: false,
  handKind: 'none',
  mouseActive: false,
  mouseKind: 'none',
  storm: false,
  stormCx: 0.5,
  stormCy: 0.5,
});
